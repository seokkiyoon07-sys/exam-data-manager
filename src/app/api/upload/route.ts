import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseExcelFile, ParsedProblem } from "@/lib/file-parser"
import { validateProblem } from "@/lib/validation-rules"
import { Problem } from "@prisma/client"

const BATCH_SIZE = 500
const MAX_CONCURRENCY = 5

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 }
      )
    }

    // 파일 확장자 확인
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)" },
        { status: 400 }
      )
    }

    // 업로드 이력 생성
    const uploadHistory = await prisma.uploadHistory.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        totalRows: 0,
        successRows: 0,
        failedRows: 0,
        uploadedBy: "system",
      },
    })

    // 파일 파싱
    const buffer = await file.arrayBuffer()
    const parseResult = parseExcelFile(buffer)

    // 파싱 에러 통계 로깅
    if (parseResult.errors.length > 0) {
      const errorStats: Record<string, number> = {}
      for (const err of parseResult.errors) {
        errorStats[err.message] = (errorStats[err.message] || 0) + 1
      }
      console.log("=== Parsing Error Stats ===")
      console.log(`Total parsed: ${parseResult.data.length}, Total errors: ${parseResult.errors.length}`)
      for (const [msg, count] of Object.entries(errorStats)) {
        console.log(`  ${msg}: ${count}건`)
      }
      console.log("===========================")
    }

    const importErrors: Array<{ row: number; message: string }> = [...parseResult.errors]
    let totalSuccess = 0
    let totalFailed = 0
    let totalSkipped = 0

    // 배치 처리를 위해 데이터 분할
    const batches: ParsedProblem[][] = []
    for (let i = 0; i < parseResult.data.length; i += BATCH_SIZE) {
      batches.push(parseResult.data.slice(i, i + BATCH_SIZE))
    }

    // 동시성 제어를 위한 배치 처리
    const processBatch = async (batch: ParsedProblem[]) => {
      let successCount = 0
      let failedCount = 0
      let skippedCount = 0

      try {
        // 1. subject+index 기준으로 기존 데이터 조회
        const existingBySubjectIndex = await prisma.problem.findMany({
          where: {
            OR: batch.map(p => ({
              subject: p.subject,
              index: p.index,
            }))
          },
        })

        // 2. examCode+problemNumber 기준으로 기존 데이터 조회 (중복 방지용)
        const examCodePairs = batch
          .filter(p => p.examCode && p.problemNumber !== undefined)
          .map(p => ({ examCode: p.examCode!, problemNumber: p.problemNumber }))

        const existingByExamCode = examCodePairs.length > 0
          ? await prisma.problem.findMany({
            where: {
              OR: examCodePairs.map(p => ({
                examCode: p.examCode,
                problemNumber: p.problemNumber,
              }))
            },
            select: { examCode: true, problemNumber: true }
          })
          : []

        // Map으로 변환 (빠른 조회용)
        const existingSubjectIndexMap = new Map(
          existingBySubjectIndex.map(p => [`${p.subject}-${p.index}`, p])
        )
        const existingExamCodeMap = new Set(
          existingByExamCode.map(p => `${p.examCode}-${p.problemNumber}`)
        )

        // 새로 생성할 데이터와 업데이트할 데이터 분리
        const toCreate: ParsedProblem[] = []
        const toUpdate: { where: { subject_index: { subject: string; index: number } }; data: ParsedProblem; original: Problem }[] = []

        for (const problem of batch) {
          const subjectIndexKey = `${problem.subject}-${problem.index}`
          const examCodeKey = problem.examCode ? `${problem.examCode}-${problem.problemNumber}` : null
          const existing = existingSubjectIndexMap.get(subjectIndexKey)

          if (existing) {
            // 변경여부 확인 헬퍼
            const isSameDate = (d1: Date | null | undefined, d2: Date | null | undefined) => {
              if (!d1 && !d2) return true
              if (!d1 || !d2) return false
              return d1.getTime() === d2.getTime()
            }

            const isSameData =
              existing.problemType === problem.problemType &&
              existing.examCode === problem.examCode &&
              existing.organization === problem.organization &&
              existing.subCategory === problem.subCategory &&
              existing.examYear === problem.examYear &&
              existing.problemNumber === problem.problemNumber &&
              existing.questionType === problem.questionType &&
              existing.answer === problem.answer &&
              existing.difficulty === problem.difficulty &&
              existing.score === problem.score &&
              existing.correctRate === problem.correctRate &&
              existing.choiceRate1 === problem.choiceRate1 &&
              existing.choiceRate2 === problem.choiceRate2 &&
              existing.choiceRate3 === problem.choiceRate3 &&
              existing.choiceRate4 === problem.choiceRate4 &&
              existing.choiceRate5 === problem.choiceRate5 &&
              existing.problemPosted === problem.problemPosted &&
              existing.problemWorker === problem.problemWorker &&
              isSameDate(existing.problemWorkDate, problem.problemWorkDate) &&
              existing.solutionPosted === problem.solutionPosted &&
              existing.solutionWorker === problem.solutionWorker &&
              isSameDate(existing.solutionWorkDate, problem.solutionWorkDate)

            if (isSameData) {
              skippedCount++
              continue
            }

            // examCode 충돌 체크
            const newExamCodeKey = problem.examCode ? `${problem.examCode}-${problem.problemNumber}` : null
            const existingExamCodeKey = existing.examCode ? `${existing.examCode}-${existing.problemNumber}` : null

            if (newExamCodeKey !== existingExamCodeKey && newExamCodeKey && existingExamCodeMap.has(newExamCodeKey)) {
              skippedCount++
              continue
            }

            toUpdate.push({
              where: { subject_index: { subject: problem.subject, index: problem.index } },
              data: problem,
              original: existing
            })
            if (newExamCodeKey) existingExamCodeMap.add(newExamCodeKey)
          } else {
            // examCode 충돌 체크
            if (examCodeKey && existingExamCodeMap.has(examCodeKey)) {
              skippedCount++
              continue
            }
            toCreate.push(problem)
            if (examCodeKey) existingExamCodeMap.add(examCodeKey)
          }
        }

        const problemIdsToValidate: string[] = []

        // 배치 생성
        if (toCreate.length > 0) {
          await prisma.problem.createMany({
            data: toCreate,
            skipDuplicates: true,
          })

          // 생성 ID 조회
          const created = await prisma.problem.findMany({
            where: {
              OR: toCreate.map(p => ({
                subject: p.subject,
                index: p.index,
              }))
            },
            select: { id: true }
          })
          successCount += created.length
          problemIdsToValidate.push(...created.map(p => p.id))
        }

        // 배치 업데이트
        if (toUpdate.length > 0) {
          // Promise.all로 병렬 처리 (Transaction 부하 분산)
          // 업데이트는 ID가 아닌 복합키로 하므로 updateMany가 안됨.
          // 성능을 위해 $transaction 대신 Promise.all 사용 고려 (에러 핸들링 주의)
          const updatePromises = toUpdate.map(async ({ where, data, original }) => {
            try {
              const updated = await prisma.problem.update({
                where: where as unknown as Parameters<typeof prisma.problem.update>[0]['where'],
                data
              })
              return updated.id
            } catch (e) {
              failedCount++
              importErrors.push({
                row: data.index,
                message: e instanceof Error ? e.message : "업데이트 오류"
              })
              return null
            }
          })

          const results = await Promise.all(updatePromises)
          const updatedIds = results.filter((id): id is string => id !== null)
          successCount += updatedIds.length
          problemIdsToValidate.push(...updatedIds)
        }

        // --- 검수 (Validation) 로직 통합 ---
        if (problemIdsToValidate.length > 0) {
          // 검수 대상 문제 다시 한 번 조회 (완전한 데이터 확보)
          // createMany 직후라 데이터를 다시 가져와야 정확함
          const problemsToValidate = await prisma.problem.findMany({
            where: { id: { in: problemIdsToValidate } }
          })

          // 기존 이슈 삭제
          await prisma.validationIssue.deleteMany({
            where: { problemId: { in: problemIdsToValidate }, resolved: false }
          })

          // 새 이슈 생성
          const allIssues: any[] = []
          for (const problem of problemsToValidate) {
            const issues = validateProblem(problem)
            allIssues.push(...issues.map(issue => ({
              problemId: problem.id,
              ruleCode: issue.ruleCode,
              severity: issue.severity,
              field: issue.field || null,
              message: issue.message,
            })))
          }

          if (allIssues.length > 0) {
            await prisma.validationIssue.createMany({ data: allIssues })
          }
        }

      } catch (err) {
        console.error("Batch processing error:", err)
        // 배치 전체 실패 시 에러 처리 (상세하게는 어렵지만 로깅)
        failedCount += batch.length
        importErrors.push({
          row: 0,
          message: `Batch Error: ${err instanceof Error ? err.message : "Unknown"}`
        })
      }

      return { successCount, failedCount, skippedCount }
    }

    // 배치 병렬 실행
    const chunkArray = <T>(arr: T[], size: number) => {
      const chunks = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    // 배치를 다시 청크로 나눠서 병렬 실행 (MAX_CONCURRENCY)
    const batchChunks = chunkArray(batches, MAX_CONCURRENCY)

    for (const chunk of batchChunks) {
      const results = await Promise.all(chunk.map(batch => processBatch(batch)))
      results.forEach(res => {
        totalSuccess += res.successCount
        totalFailed += res.failedCount
        totalSkipped += res.skippedCount
      })
    }

    // 업로드 이력 업데이트
    await prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        totalRows: parseResult.totalRows,
        successRows: totalSuccess,
        failedRows: totalFailed,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })

    // 에러 통계 계산
    const errorStats: Record<string, number> = {}
    for (const err of importErrors) {
      errorStats[err.message] = (errorStats[err.message] || 0) + 1
    }

    const parseErrorCount = parseResult.errors.length

    return NextResponse.json({
      success: true,
      message: totalSkipped > 0
        ? `${totalSuccess}건 저장, ${totalSkipped}건 중복 스킵${parseErrorCount > 0 ? `, ${parseErrorCount}건 파싱 오류` : ""}`
        : `${totalSuccess}건 저장 완료${parseErrorCount > 0 ? `, ${parseErrorCount}건 파싱 오류` : ""}`,
      totalRows: parseResult.totalRows,
      parsedRows: parseResult.data.length,
      parseErrorCount,
      successRows: totalSuccess,
      skippedRows: totalSkipped,
      failedRows: totalFailed,
      errors: importErrors.slice(0, 10),
      errorStats: Object.entries(errorStats).slice(0, 5).map(([msg, count]) => ({ message: msg, count })),
    })

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 실패" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseExcelFile, ParsedProblem } from "@/lib/file-parser"
import { validateProblem } from "@/lib/validation-rules"

const BATCH_SIZE = 100

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

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    const importErrors: Array<{ row: number; message: string }> = [...parseResult.errors]
    const uploadedProblemIds: string[] = []

    // 배치 처리를 위해 데이터 분할
    const batches: ParsedProblem[][] = []
    for (let i = 0; i < parseResult.data.length; i += BATCH_SIZE) {
      batches.push(parseResult.data.slice(i, i + BATCH_SIZE))
    }

    // 배치별로 처리
    for (const batch of batches) {
      // 1. subject+index 기준으로 기존 데이터 조회
      const existingBySubjectIndex = await prisma.problem.findMany({
        where: {
          OR: batch.map(p => ({
            subject: p.subject,
            index: p.index,
          }))
        },
        select: {
          id: true,
          subject: true,
          index: true,
          examCode: true,
          problemNumber: true,
          problemType: true,
          organization: true,
          subCategory: true,
          examYear: true,
          questionType: true,
          answer: true,
          difficulty: true,
          score: true,
          correctRate: true,
          choiceRate1: true,
          choiceRate2: true,
          choiceRate3: true,
          choiceRate4: true,
          choiceRate5: true,
          problemPosted: true,
          problemWorker: true,
          solutionPosted: true,
          solutionWorker: true,
        }
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
      const toUpdate: { where: { subject_index: { subject: string; index: number } }; data: ParsedProblem }[] = []

      for (const problem of batch) {
        const subjectIndexKey = `${problem.subject}-${problem.index}`
        const examCodeKey = problem.examCode ? `${problem.examCode}-${problem.problemNumber}` : null
        const existing = existingSubjectIndexMap.get(subjectIndexKey)

        if (existing) {
          // 기존 데이터와 비교 - 변경된 경우만 업데이트
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
            existing.solutionPosted === problem.solutionPosted &&
            existing.solutionWorker === problem.solutionWorker

          if (isSameData) {
            skippedCount++
            continue
          }

          // examCode가 변경되는 경우, 새 examCode+problemNumber가 다른 레코드와 충돌하는지 확인
          const newExamCodeKey = problem.examCode ? `${problem.examCode}-${problem.problemNumber}` : null
          const existingExamCodeKey = existing.examCode ? `${existing.examCode}-${existing.problemNumber}` : null

          // examCode가 변경되고, 새 조합이 이미 존재하면 스킵
          if (newExamCodeKey !== existingExamCodeKey && newExamCodeKey && existingExamCodeMap.has(newExamCodeKey)) {
            skippedCount++
            continue
          }

          // 업데이트 대상
          toUpdate.push({
            where: { subject_index: { subject: problem.subject, index: problem.index } },
            data: problem,
          })
          uploadedProblemIds.push(existing.id)

          // 새 examCode 조합을 맵에 추가 (배치 내 충돌 방지)
          if (newExamCodeKey) {
            existingExamCodeMap.add(newExamCodeKey)
          }
        } else {
          // examCode+problemNumber 중복 체크 (다른 subject의 같은 시험지 문항)
          if (examCodeKey && existingExamCodeMap.has(examCodeKey)) {
            skippedCount++
            continue
          }

          // 새로 생성
          toCreate.push(problem)
          if (examCodeKey) {
            existingExamCodeMap.add(examCodeKey) // 배치 내 중복 방지
          }
        }
      }

      // 배치 생성 (createMany 사용 - skipDuplicates로 중복 무시)
      if (toCreate.length > 0) {
        try {
          // createMany는 생성된 ID를 반환하지 않으므로, 먼저 생성 후 조회
          await prisma.problem.createMany({
            data: toCreate,
            skipDuplicates: true, // 중복 무시 (Unique constraint 에러 방지)
          })

          // 생성된 문항 ID 조회
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
          uploadedProblemIds.push(...created.map(p => p.id))
        } catch (err) {
          // createMany 실패 시 에러 로깅
          console.error("Batch create failed:", err)
          failedCount += toCreate.length
          importErrors.push({
            row: toCreate[0]?.index || 0,
            message: `배치 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
          })
        }
      }

      // 배치 업데이트 (한번에 처리)
      if (toUpdate.length > 0) {
        try {
          await prisma.$transaction(
            toUpdate.map(({ where, data }) =>
              prisma.problem.update({
                where: where as unknown as Parameters<typeof prisma.problem.update>[0]['where'],
                data
              })
            )
          )
          successCount += toUpdate.length
        } catch (err) {
          // 업데이트 실패 시 개별 처리로 폴백
          for (const { where, data } of toUpdate) {
            try {
              await prisma.problem.update({
                where: where as unknown as Parameters<typeof prisma.problem.update>[0]['where'],
                data
              })
              successCount++
            } catch (innerErr) {
              failedCount++
              importErrors.push({
                row: data.index,
                message: innerErr instanceof Error ? innerErr.message : "저장 오류",
              })
            }
          }
        }
      }
    }

    // 업로드된 문항만 검수 (전체 검수 X)
    if (uploadedProblemIds.length > 0) {
      // 배치로 검수 처리
      for (let i = 0; i < uploadedProblemIds.length; i += BATCH_SIZE) {
        const batchIds = uploadedProblemIds.slice(i, i + BATCH_SIZE)

        const problems = await prisma.problem.findMany({
          where: { id: { in: batchIds } }
        })

        // 기존 미해결 이슈 일괄 삭제
        await prisma.validationIssue.deleteMany({
          where: { problemId: { in: batchIds }, resolved: false }
        })

        // 새 이슈 일괄 생성
        const allIssues: Array<{
          problemId: string
          ruleCode: string
          severity: "ERROR" | "WARNING" | "INFO"
          field: string | null
          message: string
        }> = []

        for (const problem of problems) {
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
    }

    // 업로드 이력 업데이트
    await prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        totalRows: parseResult.totalRows,
        successRows: successCount,
        failedRows: failedCount,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: skippedCount > 0
        ? `${successCount}건 저장, ${skippedCount}건 중복 스킵`
        : `${successCount}건 저장 완료`,
      totalRows: parseResult.totalRows,
      successRows: successCount,
      skippedRows: skippedCount,
      failedRows: failedCount,
      errors: importErrors.slice(0, 10),
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 실패" },
      { status: 500 }
    )
  }
}

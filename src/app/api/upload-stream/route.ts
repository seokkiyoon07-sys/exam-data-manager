import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { parseExcelFile, ParsedProblem } from "@/lib/file-parser"
import { validateProblem } from "@/lib/validation-rules"
import { Problem } from "@prisma/client"

const BATCH_SIZE = 500
const MAX_CONCURRENCY = 5

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
          send({ type: "error", message: "파일이 없습니다." })
          controller.close()
          return
        }

        // 파일 확장자 확인
        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
          send({ type: "error", message: "지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 지원)" })
          controller.close()
          return
        }

        send({ type: "status", message: "파일 파싱 중...", phase: "parsing" })

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
          console.log(`Parsing errors: ${parseResult.errors.length}`)
        }

        send({
          type: "parsed",
          totalRows: parseResult.totalRows,
          parsedRows: parseResult.data.length,
          parseErrors: parseResult.errors.length,
        })

        let totalSuccess = 0
        let totalFailed = 0
        let totalSkipped = 0
        let processedCount = 0
        const totalToProcess = parseResult.data.length

        const importErrors: Array<{ row: number; message: string }> = [...parseResult.errors]

        // 배치 처리를 위해 데이터 분할
        const batches: ParsedProblem[][] = []
        for (let i = 0; i < parseResult.data.length; i += BATCH_SIZE) {
          batches.push(parseResult.data.slice(i, i + BATCH_SIZE))
        }

        send({ type: "status", message: "데이터 저장 중...", phase: "saving", totalBatches: batches.length })

        // ---------------------------------------------------------
        // 배치 처리 함수 (route.ts 로직 재사용)
        // ---------------------------------------------------------
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

            // 2. examCode+problemNumber 기준으로 기존 데이터 조회
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

            // Map으로 변환
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

              const created = await prisma.problem.findMany({
                where: { OR: toCreate.map(p => ({ subject: p.subject, index: p.index })) },
                select: { id: true }
              })
              successCount += created.length
              problemIdsToValidate.push(...created.map(p => p.id))
            }

            // 배치 업데이트 (Promise.all)
            if (toUpdate.length > 0) {
              const updatePromises = toUpdate.map(async ({ where, data }) => {
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

            // 검수 로직 통합 (Validation Integration)
            if (problemIdsToValidate.length > 0) {
              const problemsToValidate = await prisma.problem.findMany({
                where: { id: { in: problemIdsToValidate } }
              })

              await prisma.validationIssue.deleteMany({
                where: { problemId: { in: problemIdsToValidate }, resolved: false }
              })

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
            failedCount += batch.length
            importErrors.push({
              row: 0,
              message: `Batch Error: ${err instanceof Error ? err.message : "Unknown"}`
            })
          }

          return { successCount, failedCount, skippedCount }
        }

        // ---------------------------------------------------------
        // 청크 단위 병렬 처리 Loop
        // ---------------------------------------------------------
        const chunkArray = <T>(arr: T[], size: number) => {
          const chunks = []
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size))
          }
          return chunks
        }

        const batchChunks = chunkArray(batches, MAX_CONCURRENCY)

        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i]
          // 청크 내 배치들 병렬 실행
          const results = await Promise.all(chunk.map(batch => processBatch(batch)))

          results.forEach(res => {
            totalSuccess += res.successCount
            totalFailed += res.failedCount
            totalSkipped += res.skippedCount
          })

          // 진행률 업데이트 (청크 단위로 한번에 점프)
          // 현재까지 처리된 배치 수 = (i * MAX_CONCURRENCY) + chunk.length
          const processedBatchesCount = (i * MAX_CONCURRENCY) + chunk.length
          processedCount = Math.min(processedBatchesCount * BATCH_SIZE, totalToProcess) // 대략적 계산

          send({
            type: "progress",
            processed: processedCount,
            total: totalToProcess,
            success: totalSuccess,
            skipped: totalSkipped,
            failed: totalFailed,
            batchIndex: processedBatchesCount, // 현재까지 완료된 배치 수
            totalBatches: batches.length,
            percent: Math.round((processedCount / totalToProcess) * 100),
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

        // 최종 결과 전송
        send({
          type: "complete",
          success: true,
          message: totalSkipped > 0
            ? `${totalSuccess}건 저장, ${totalSkipped}건 중복 스킵`
            : `${totalSuccess}건 저장 완료`,
          totalRows: parseResult.totalRows,
          parsedRows: parseResult.data.length,
          successRows: totalSuccess,
          skippedRows: totalSkipped,
          failedRows: totalFailed,
          errors: importErrors.slice(0, 10),
        })

        controller.close()
      } catch (error) {
        console.error("Upload error:", error)
        send({
          type: "error",
          message: error instanceof Error ? error.message : "업로드 실패",
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

import { prisma } from "@/lib/db"
import { ParsedProblem } from "@/lib/file-parser"
import { validateProblem } from "@/lib/validation-rules"

export interface BatchResult {
    successCount: number
    failedCount: number
    skippedCount: number
    errors: Array<{ row: number; message: string }>
}

/**
 * ParsedProblem 배열을 받아 DB에 Upsert (Create/Update) 하고 검증 로직을 수행합니다.
 */
export async function processProblemBatch(batch: ParsedProblem[]): Promise<BatchResult> {
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: Array<{ row: number; message: string }> = []

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
        const toUpdate: { where: { subject_index: { subject: string; index: number } }; data: ParsedProblem; original: any }[] = []

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

                // 전체 필드 비교 (너무 많지만 정확성을 위해)
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

                // examCode 충돌 체크 (다른 레코드의 examCode를 뺏어오는 경우 방지)
                const newExamCodeKey = problem.examCode ? `${problem.examCode}-${problem.problemNumber}` : null
                const existingExamCodeKey = existing.examCode ? `${existing.examCode}-${existing.problemNumber}` : null

                if (newExamCodeKey !== existingExamCodeKey && newExamCodeKey && existingExamCodeMap.has(newExamCodeKey)) {
                    console.warn(`Skipping update due to ExamCode conflict: Subject=${problem.subject} Index=${problem.index} -> ExamCode=${problem.examCode}`)
                    skippedCount++
                    continue
                }

                toUpdate.push({
                    where: { subject_index: { subject: problem.subject, index: problem.index } },
                    data: problem,
                    original: existing // 로깅용
                })
                if (newExamCodeKey) existingExamCodeMap.add(newExamCodeKey)
            } else {
                // examCode 충돌 체크 (새로 만드는데 이미 있는 코드를 쓰는 경우)
                if (examCodeKey && existingExamCodeMap.has(examCodeKey)) {
                    console.warn(`Skipping create due to ExamCode conflict: ExamCode=${problem.examCode} Num=${problem.problemNumber}`)
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
                skipDuplicates: true, // DB 레벨 중복 방지 (안전장치)
            })

            // 생성된 ID 조회 (검증을 위해)
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
            // 병렬 업데이트 (Prisma에는 updateMany가 복합키 where를 지원하지 않으므로 루프)
            const updatePromises = toUpdate.map(async ({ where, data }) => {
                try {
                    const updated = await prisma.problem.update({
                        where: where as any, // TS 이슈 우회 (Prisma Generate 필요)
                        data
                    })
                    return updated.id
                } catch (e) {
                    failedCount++
                    errors.push({
                        row: data.index,
                        message: e instanceof Error ? e.message : "Update Failed"
                    })
                    return null
                }
            })

            const results = await Promise.all(updatePromises)
            const updatedIds = results.filter((id): id is string => id !== null)
            successCount += updatedIds.length
            problemIdsToValidate.push(...updatedIds)
        }

        // --- 검수 (Validation) 로직 실행 ---
        if (problemIdsToValidate.length > 0) {
            // 1. 최신 데이터 조회
            const problemsToValidate = await prisma.problem.findMany({
                where: { id: { in: problemIdsToValidate } }
            })

            // 2. 기존 이슈 삭제
            await prisma.validationIssue.deleteMany({
                where: { problemId: { in: problemIdsToValidate }, resolved: false }
            })

            // 3. 새 이슈 계산
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

            // 4. 이슈 대량 생성
            if (allIssues.length > 0) {
                await prisma.validationIssue.createMany({ data: allIssues })
            }
        }

    } catch (err) {
        console.error("Batch processing fatal error:", err)
        failedCount += batch.length
        errors.push({
            row: 0,
            message: `Fatal Batch Error: ${err instanceof Error ? err.message : "Unknown"}`
        })
    }

    return { successCount, failedCount, skippedCount, errors }
}

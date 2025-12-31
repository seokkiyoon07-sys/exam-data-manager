'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { QuestionType } from "@prisma/client"

export interface CreateProblemInput {
    subject: string
    examYear: number
    organization: string
    problemType: string
    examCode?: string
    startNumber: number
    count: number // 한 번에 생성할 개수
    questionType?: QuestionType
}

export async function createManualProblems(input: CreateProblemInput) {
    const {
        subject,
        examYear,
        organization,
        problemType,
        examCode,
        startNumber,
        count
    } = input

    // 마지막 Index 조회 (중복 방지 및 자동 증가용)
    // 과목별로 Index는 유니크해야 함.
    const lastProblem = await prisma.problem.findFirst({
        where: { subject },
        orderBy: { index: 'desc' },
        select: { index: true }
    })

    let nextIndex = (lastProblem?.index || 0) + 1

    const createdIds: string[] = []

    try {
        const problems = []

        for (let i = 0; i < count; i++) {
            const problemNum = startNumber + i

            // examCode 자동 생성 (없을 경우)
            // 로직은 file-parser와 비슷하게 가거나, 입력받은 값 사용
            // 여기서는 입력값 우선, 없으면 NULL 허용

            problems.push({
                index: nextIndex + i,
                subject,
                examYear,
                organization,
                problemType,
                examCode: examCode || undefined,
                problemNumber: problemNum,
                questionType: input.questionType || 'MULTIPLE',
                // 기본값
                problemPosted: false,
                solutionPosted: false,
                problemWorker: null,
                solutionWorker: null
            })
        }

        // createMany로 일괄 생성
        await prisma.problem.createMany({
            data: problems,
            skipDuplicates: true
        })

        // 검증 로직은 생략 (빈 껍데기 생성이므로)

        revalidatePath('/problems')
        return { success: true, count: problems.length }

    } catch (error) {
        console.error("Manual creation error:", error)
        return { success: false, error: error instanceof Error ? error.message : "생성 실패" }
    }
}

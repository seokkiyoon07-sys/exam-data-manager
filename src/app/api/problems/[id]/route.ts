import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateProblem } from "@/lib/validation-rules"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const problem = await prisma.problem.findUnique({
      where: { id },
      include: {
        validationIssues: {
          where: { resolved: false },
        },
      },
    })

    if (!problem) {
      return NextResponse.json(
        { error: "문항을 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    return NextResponse.json(problem)
  } catch (error) {
    console.error("Get problem error:", error)
    return NextResponse.json(
      { error: "문항 조회 실패" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()

    // 문항 업데이트
    const problem = await prisma.problem.update({
      where: { id },
      data: {
        answer: body.answer,
        difficulty: body.difficulty,
        score: body.score,
        correctRate: body.correctRate,
        problemPosted: body.problemPosted,
        solutionPosted: body.solutionPosted,
      },
    })

    // 작업 로그 기록
    await prisma.workLog.create({
      data: {
        problemId: id,
        action: "UPDATE",
        changes: body,
      },
    })

    // 검수 재실행
    const issues = validateProblem(problem)

    // 기존 미해결 이슈 삭제
    await prisma.validationIssue.deleteMany({
      where: { problemId: id, resolved: false },
    })

    // 새 이슈 생성
    if (issues.length > 0) {
      await prisma.validationIssue.createMany({
        data: issues.map((issue) => ({
          problemId: id,
          ruleCode: issue.ruleCode,
          severity: issue.severity,
          field: issue.field,
          message: issue.message,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      problem,
      validationIssues: issues,
    })
  } catch (error) {
    console.error("Update problem error:", error)
    return NextResponse.json(
      { error: "문항 수정 실패" },
      { status: 500 }
    )
  }
}

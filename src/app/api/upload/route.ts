import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseExcelFile } from "@/lib/file-parser"
import { validateProblem } from "@/lib/validation-rules"

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
        uploadedBy: "system", // TODO: 로그인 사용자로 변경
      },
    })

    // 파일 파싱
    const buffer = await file.arrayBuffer()
    const parseResult = parseExcelFile(buffer)

    let successCount = 0
    let failedCount = 0
    const importErrors: Array<{ row: number; message: string }> = [...parseResult.errors]

    // 데이터 저장
    for (const problem of parseResult.data) {
      try {
        // Upsert: index 기준으로 업데이트 또는 생성
        await prisma.problem.upsert({
          where: { index: problem.index },
          update: {
            problemType: problem.problemType,
            examCode: problem.examCode,
            organization: problem.organization,
            subject: problem.subject,
            subCategory: problem.subCategory,
            examYear: problem.examYear,
            problemNumber: problem.problemNumber,
            questionType: problem.questionType,
            answer: problem.answer,
            difficulty: problem.difficulty,
            score: problem.score,
            correctRate: problem.correctRate,
            choiceRate1: problem.choiceRate1,
            choiceRate2: problem.choiceRate2,
            choiceRate3: problem.choiceRate3,
            choiceRate4: problem.choiceRate4,
            choiceRate5: problem.choiceRate5,
            problemPosted: problem.problemPosted,
            problemWorker: problem.problemWorker,
            problemWorkDate: problem.problemWorkDate,
            solutionPosted: problem.solutionPosted,
            solutionWorker: problem.solutionWorker,
            solutionWorkDate: problem.solutionWorkDate,
          },
          create: problem,
        })

        successCount++
      } catch (err) {
        failedCount++
        importErrors.push({
          row: problem.index,
          message: err instanceof Error ? err.message : "저장 오류",
        })
      }
    }

    // 검수 실행
    const allProblems = await prisma.problem.findMany()
    for (const problem of allProblems) {
      const issues = validateProblem(problem)

      // 기존 미해결 이슈 삭제
      await prisma.validationIssue.deleteMany({
        where: { problemId: problem.id, resolved: false },
      })

      // 새 이슈 생성
      if (issues.length > 0) {
        await prisma.validationIssue.createMany({
          data: issues.map((issue) => ({
            problemId: problem.id,
            ruleCode: issue.ruleCode,
            severity: issue.severity,
            field: issue.field,
            message: issue.message,
          })),
        })
      }
    }

    // 업로드 이력 업데이트
    await prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        totalRows: parseResult.totalRows,
        successRows: successCount,
        failedRows: failedCount,
        status: failedCount > 0 ? "COMPLETED" : "COMPLETED",
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `${successCount}건 저장 완료`,
      totalRows: parseResult.totalRows,
      successRows: successCount,
      failedRows: failedCount,
      errors: importErrors.slice(0, 10), // 최대 10개만 반환
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 실패" },
      { status: 500 }
    )
  }
}

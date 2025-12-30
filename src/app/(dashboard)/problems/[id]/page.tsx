export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar,
  User,
} from "lucide-react"
import { QuestionType, Severity } from "@prisma/client"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { ProblemEditForm } from "@/components/problems/ProblemEditForm"
import { ProblemImages } from "@/components/problems/ProblemImages"

async function getProblem(id: string) {
  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      validationIssues: {
        where: { resolved: false },
        orderBy: { severity: "asc" },
      },
      workLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  return problem
}

const severityConfig = {
  ERROR: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-50",
    label: "오류",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    label: "경고",
  },
  INFO: {
    icon: Info,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    label: "정보",
  },
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const problem = await getProblem(id)

  if (!problem) {
    notFound()
  }

  const hasErrors = problem.validationIssues.some((i) => i.severity === Severity.ERROR)
  const hasWarnings = problem.validationIssues.some((i) => i.severity === Severity.WARNING)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/problems">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                문항 #{problem.index}
              </h2>
              {problem.solutionPosted ? (
                <Badge className="bg-green-500 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  완료
                </Badge>
              ) : problem.problemPosted ? (
                <Badge variant="secondary">문제만 게시</Badge>
              ) : (
                <Badge variant="outline">미게시</Badge>
              )}
              {hasErrors && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  오류
                </Badge>
              )}
              {hasWarnings && !hasErrors && (
                <Badge className="bg-yellow-500 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  경고
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {problem.organization} · {problem.subject} · {problem.examYear}년 {problem.problemNumber}번
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 문항 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 문제/해설 이미지 - 최상단 */}
          <ProblemImages index={problem.index} />

          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">시험지코드</p>
                  <p className="font-medium">{problem.examCode || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">출제기관</p>
                  <p className="font-medium">{problem.organization}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">과목</p>
                  <p className="font-medium">{problem.subject}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">소분류</p>
                  <p className="font-medium">{problem.subCategory || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">시행년도</p>
                  <p className="font-medium">{problem.examYear}년</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">문항번호</p>
                  <p className="font-medium">{problem.problemNumber}번</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">문제유형</p>
                  <p className="font-medium">
                    {problem.questionType === QuestionType.MULTIPLE ? "객관식" : "주관식"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">문제종류</p>
                  <p className="font-medium">{problem.problemType || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>정답 및 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">정답</p>
                  <p className="text-2xl font-bold">{problem.answer || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">난이도</p>
                  <p className="text-2xl font-bold">{problem.difficulty || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">배점</p>
                  <p className="text-2xl font-bold">
                    {problem.score !== null ? `${problem.score}점` : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">정답률</p>
                  <p className="text-2xl font-bold">
                    {problem.correctRate !== null ? `${problem.correctRate}%` : "-"}
                  </p>
                </div>
              </div>

              {problem.questionType === QuestionType.MULTIPLE && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">선택비율</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        problem.choiceRate1,
                        problem.choiceRate2,
                        problem.choiceRate3,
                        problem.choiceRate4,
                        problem.choiceRate5,
                      ].map((rate, i) => (
                        <div
                          key={i}
                          className={`text-center p-2 rounded-lg ${
                            problem.answer === String(i + 1)
                              ? "bg-green-100 border-2 border-green-500"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-xs text-muted-foreground">{i + 1}번</p>
                          <p className="font-bold">
                            {rate !== null ? `${rate}%` : "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>작업 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    {problem.problemPosted ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">문제 게시</span>
                  </div>
                  {problem.problemWorker && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {problem.problemWorker}
                    </div>
                  )}
                  {problem.problemWorkDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(problem.problemWorkDate, "yyyy.MM.dd", { locale: ko })}
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    {problem.solutionPosted ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">해설 게시</span>
                  </div>
                  {problem.solutionWorker && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {problem.solutionWorker}
                    </div>
                  )}
                  {problem.solutionWorkDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(problem.solutionWorkDate, "yyyy.MM.dd", { locale: ko })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 사이드바 */}
        <div className="space-y-6">
          {/* 검수 결과 */}
          <Card>
            <CardHeader>
              <CardTitle>검수 결과</CardTitle>
            </CardHeader>
            <CardContent>
              {problem.validationIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>검수 통과</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {problem.validationIssues.map((issue) => {
                    const config = severityConfig[issue.severity]
                    const Icon = config.icon
                    return (
                      <div
                        key={issue.id}
                        className={`p-3 rounded-lg ${config.bgColor}`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                          <div>
                            <p className="text-sm font-medium">{issue.message}</p>
                            {issue.field && (
                              <p className="text-xs text-muted-foreground">
                                필드: {issue.field}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 수정 폼 */}
          <ProblemEditForm problem={problem} />
        </div>
      </div>
    </div>
  )
}

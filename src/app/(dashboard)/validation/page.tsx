export const dynamic = 'force-dynamic'

import Link from "next/link"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle, AlertTriangle, Info, Download, RefreshCw, ArrowRight } from "lucide-react"
import { Severity } from "@prisma/client"
import { ruleMessages } from "@/lib/validation-rules"

async function getValidationData() {
  const [issuesByRule, issuesBySubject, recentIssues] = await Promise.all([
    // 규칙별 오류 수
    prisma.validationIssue.groupBy({
      by: ["ruleCode", "severity"],
      where: { resolved: false },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // 과목별 오류 수
    // 과목별 오류 수 (최적화: JOIN 대신 groupBy 사용 불가능하므로, Prisma의 findMany로 가져와서 앱 레벨 집계 or 가벼운 쿼리)
    // 메모리 부족 방지를 위해 queryRaw 대신 Prisma API 활용 시도
    // 하지만 subject는 Problem에 있어서 JOIN 필수. 
    // 대안: 단순화된 쿼리 사용 (ORDER BY 제거하여 Sort 부하 감소)
    prisma.$queryRaw`
      SELECT p.subject, COUNT(vi.id) as count
      FROM "ValidationIssue" vi
      JOIN "Problem" p ON vi."problemId" = p.id
      WHERE vi.resolved = false
      GROUP BY p.subject
    ` as Promise<Array<{ subject: string; count: bigint }>>,
    // 최근 오류 문항
    prisma.validationIssue.findMany({
      where: { resolved: false },
      include: {
        problem: {
          select: {
            id: true,
            index: true,
            subject: true,
            examYear: true,
            problemNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  const totalErrors = issuesByRule
    .filter((i) => i.severity === Severity.ERROR)
    .reduce((sum, i) => sum + i._count.id, 0)
  const totalWarnings = issuesByRule
    .filter((i) => i.severity === Severity.WARNING)
    .reduce((sum, i) => sum + i._count.id, 0)
  const totalInfo = issuesByRule
    .filter((i) => i.severity === Severity.INFO)
    .reduce((sum, i) => sum + i._count.id, 0)

  return {
    summary: {
      errors: totalErrors,
      warnings: totalWarnings,
      info: totalInfo,
      total: totalErrors + totalWarnings + totalInfo,
    },
    byRule: issuesByRule.map((i) => ({
      ruleCode: i.ruleCode,
      severity: i.severity,
      count: i._count.id,
      message: ruleMessages[i.ruleCode] || i.ruleCode,
    })),
    bySubject: issuesBySubject.map((s) => ({
      subject: s.subject,
      count: Number(s.count),
    })),
    recent: recentIssues,
  }
}

const severityConfig = {
  ERROR: {
    icon: AlertCircle,
    label: "오류",
    cardStyle: "bg-slate-500 text-white",
    iconStyle: "text-white",
    rowStyle: "bg-slate-500 text-white",
    badgeStyle: "bg-white/20 text-white",
  },
  WARNING: {
    icon: AlertTriangle,
    label: "경고",
    cardStyle: "bg-slate-200 text-slate-800",
    iconStyle: "text-slate-600",
    rowStyle: "bg-slate-200 text-slate-800",
    badgeStyle: "bg-slate-300/50 text-slate-700",
  },
  INFO: {
    icon: Info,
    label: "정보",
    cardStyle: "border-2 border-dashed border-slate-300 text-slate-700",
    iconStyle: "text-slate-500",
    rowStyle: "bg-slate-50 text-slate-700",
    badgeStyle: "bg-slate-100 text-slate-600",
  },
}

export default async function ValidationPage() {
  const data = await getValidationData()

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
            Validation
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">검수 현황</h1>
          <p className="text-slate-600 mt-1">
            전체 <span className="font-mono font-bold text-slate-900">{data.summary.total}</span>건의 미해결 검수 이슈
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            전체 재검수
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            CSV 내보내기
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={severityConfig.ERROR.cardStyle}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              오류 (ERROR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-10 w-10 text-white/80" />
              <span className="text-4xl font-bold text-white">
                {data.summary.errors}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className={severityConfig.WARNING.cardStyle}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              경고 (WARNING)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-10 w-10 text-slate-600" />
              <span className="text-4xl font-bold text-slate-800">
                {data.summary.warnings}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className={severityConfig.INFO.cardStyle}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              정보 (INFO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Info className="h-10 w-10 text-slate-400" />
              <span className="text-4xl font-bold text-slate-700">
                {data.summary.info}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 규칙별 오류 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">규칙별 오류 현황</CardTitle>
            <CardDescription className="text-slate-500">
              검수 규칙별 오류 건수
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.byRule.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  검수 오류가 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.byRule.map((item, index) => {
                  const config = severityConfig[item.severity]
                  const Icon = config.icon
                  return (
                    <Link
                      key={`${item.ruleCode}-${item.severity}-${index}`}
                      href={`/problems?ruleCode=${encodeURIComponent(item.ruleCode)}`}
                      className="block group"
                    >
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${config.rowStyle} group-hover:scale-[1.01]`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono opacity-50 w-6">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <Icon className={`h-4 w-4 ${config.iconStyle}`} />
                          <span className="text-sm font-medium">
                            {item.message}
                          </span>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${config.badgeStyle}`}>
                          {item.count}건
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 과목별 오류 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">과목별 오류 현황</CardTitle>
            <CardDescription className="text-slate-500">
              과목별 미해결 오류 건수
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.bySubject.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  검수 오류가 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.bySubject.map((item, index) => (
                  <Link
                    key={item.subject}
                    href={`/problems?subject=${encodeURIComponent(item.subject)}&hasError=true`}
                    className="block group"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 transition-all duration-200 group-hover:bg-slate-100 group-hover:scale-[1.01]">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 w-6">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-slate-800">{item.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-600">
                          {item.count}건
                        </span>
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 오류 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">최근 검수 오류</CardTitle>
          <CardDescription className="text-slate-500">
            최근 발견된 검수 오류 목록
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <AlertCircle className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-800">검수 오류가 없습니다</p>
              <p className="text-xs text-slate-500 mt-1">
                모든 문항이 정상입니다
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-20 font-semibold text-slate-700">Index</TableHead>
                    <TableHead className="font-semibold text-slate-700">과목</TableHead>
                    <TableHead className="w-32 font-semibold text-slate-700">시행년도/문항</TableHead>
                    <TableHead className="w-24 font-semibold text-slate-700">심각도</TableHead>
                    <TableHead className="font-semibold text-slate-700">오류 내용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((issue) => {
                    const config = severityConfig[issue.severity]
                    const Icon = config.icon
                    return (
                      <TableRow key={issue.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Link
                            href={`/problems/${issue.problem.id}`}
                            className="font-mono font-medium text-slate-800 hover:underline"
                          >
                            {issue.problem.index}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-700">{issue.problem.subject}</TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">
                          {issue.problem.examYear}년 {issue.problem.problemNumber}번
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded ${config.badgeStyle}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{issue.message}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

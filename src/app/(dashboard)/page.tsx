export const dynamic = 'force-dynamic'

import { FileText, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { ProgressChart } from "@/components/dashboard/ProgressChart"
import { ValidationSummary } from "@/components/dashboard/ValidationSummary"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { prisma } from "@/lib/db"

async function getDashboardData() {
  const [
    totalProblems,
    problemPostedCount,
    solutionPostedCount,
    validationIssueCount,
    subjectProgress,
    topIssues,
    recentLogs,
  ] = await Promise.all([
    prisma.problem.count(),
    prisma.problem.count({ where: { problemPosted: true } }),
    prisma.problem.count({ where: { solutionPosted: true } }),
    prisma.validationIssue.count({ where: { resolved: false } }),
    prisma.problem.groupBy({
      by: ["subject"],
      _count: { id: true },
      orderBy: { subject: "asc" },
    }),
    prisma.validationIssue.groupBy({
      by: ["ruleCode", "severity", "message"],
      where: { resolved: false },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.workLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { problem: true },
    }),
  ])

  // 과목별 진행률 계산
  const subjectProgressData = await Promise.all(
    subjectProgress.map(async (s) => {
      const problemPosted = await prisma.problem.count({
        where: { subject: s.subject, problemPosted: true },
      })
      const solutionPosted = await prisma.problem.count({
        where: { subject: s.subject, solutionPosted: true },
      })
      return {
        subject: s.subject,
        total: s._count.id,
        problemPosted,
        solutionPosted,
      }
    })
  )

  return {
    stats: {
      total: totalProblems,
      problemPosted: problemPostedCount,
      solutionPosted: solutionPostedCount,
      issues: validationIssueCount,
    },
    subjectProgress: subjectProgressData,
    topIssues: topIssues.map((i) => ({
      ruleCode: i.ruleCode,
      message: i.message,
      severity: i.severity,
      count: i._count.id,
    })),
    recentActivities: recentLogs.map((log) => ({
      id: log.id,
      worker: log.problem.problemWorker || log.problem.solutionWorker || "시스템",
      action: log.action === "CREATE" ? "등록" : log.action === "UPDATE" ? "수정" : log.action,
      subject: log.problem.subject,
      problemNumber: log.problem.problemNumber,
      createdAt: log.createdAt,
    })),
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const problemRate = data.stats.total > 0
    ? Math.round((data.stats.problemPosted / data.stats.total) * 100)
    : 0
  const solutionRate = data.stats.total > 0
    ? Math.round((data.stats.solutionPosted / data.stats.total) * 100)
    : 0

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">대시보드</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">마지막 업데이트</p>
          <p className="text-sm font-medium text-slate-700">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="전체 문항"
          value={data.stats.total.toLocaleString()}
          description="등록된 전체 문항 수"
          icon={FileText}
          variant="filled"
        />
        <StatsCard
          title="문제 게시"
          value={`${problemRate}%`}
          description={`${data.stats.problemPosted.toLocaleString()} / ${data.stats.total.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="해설 게시"
          value={`${solutionRate}%`}
          description={`${data.stats.solutionPosted.toLocaleString()} / ${data.stats.total.toLocaleString()}`}
          icon={CheckCircle}
        />
        <StatsCard
          title="검수 오류"
          value={data.stats.issues.toLocaleString()}
          description="미해결 오류 건수"
          icon={AlertTriangle}
          variant={data.stats.issues > 0 ? "outline" : "default"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProgressChart data={data.subjectProgress} />
        <ValidationSummary issues={data.topIssues} />
      </div>

      {/* Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity activities={data.recentActivities} />
      </div>
    </div>
  )
}

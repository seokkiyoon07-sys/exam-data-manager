export const dynamic = 'force-dynamic'

import { FileText, CheckCircle, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { ProgressChart } from "@/components/dashboard/ProgressChart"
import { ValidationSummary } from "@/components/dashboard/ValidationSummary"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Card, CardContent } from "@/components/ui/card"
import {
  getStatsFromCache,
  getCacheStatus,
  ensureCacheReady,
} from "@/lib/sheet-cache"
import { SheetSyncButton } from "@/components/problems/SheetSyncButton"

async function getDashboardData() {
  const cacheReady = await ensureCacheReady()

  if (!cacheReady) {
    return null
  }

  const stats = getStatsFromCache()

  // 과목별 진행률 데이터 변환
  const subjectProgress = Object.entries(stats.bySubject).map(([subject, data]) => ({
    subject,
    total: data.total,
    problemPosted: data.problemPosted,
    solutionPosted: data.solutionPosted,
  })).sort((a, b) => a.subject.localeCompare(b.subject))

  return {
    stats: {
      total: stats.total,
      problemPosted: stats.problemPosted,
      solutionPosted: stats.solutionPosted,
      issues: 0, // 캐시에서는 검수 이슈 미지원 (필요시 DB에서 조회)
    },
    subjectProgress,
    topIssues: [], // 캐시에서는 검수 이슈 미지원
    recentActivities: [], // 캐시에서는 활동 로그 미지원
  }
}

function CacheNotReadyBanner() {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <RefreshCw className="h-12 w-12 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-slate-900">데이터 로드 필요</h3>
            <p className="text-sm text-slate-600 mt-1">
              Google Sheets에서 데이터를 가져오려면 &ldquo;새로고침&rdquo; 버튼을 클릭하세요.
            </p>
          </div>
          <SheetSyncButton />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const cacheStatus = getCacheStatus()

  if (!data) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
              Overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">대시보드</h1>
          </div>
        </div>
        <CacheNotReadyBanner />
      </div>
    )
  }

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
        <div className="flex items-center gap-4">
          <SheetSyncButton />
          <div className="text-right">
            <p className="text-sm text-slate-500">마지막 업데이트</p>
            <p className="text-sm font-medium text-slate-700">
              {cacheStatus.lastUpdated
                ? new Date(cacheStatus.lastUpdated).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"
              }
            </p>
          </div>
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

      {/* Activity - 캐시 모드에서는 비활성화 */}
      {data.recentActivities.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivity activities={data.recentActivities} />
        </div>
      )}
    </div>
  )
}

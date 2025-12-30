export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Calendar, TrendingUp, FileText, CheckCircle } from "lucide-react"
import Link from "next/link"

type Params = {
  name: string
}

async function getWorkerStats(workerName: string) {
  const decodedName = decodeURIComponent(workerName)

  // 작업자 기본 통계
  const [problemCount, solutionCount] = await Promise.all([
    prisma.problem.count({ where: { problemWorker: decodedName } }),
    prisma.problem.count({ where: { solutionWorker: decodedName } }),
  ])

  // 일별 통계 (최근 30일)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const dailyStats = await prisma.$queryRaw<Array<{
    date: Date
    problemCount: bigint
    solutionCount: bigint
  }>>`
    SELECT
      DATE("problemWorkDate") as date,
      COUNT(CASE WHEN "problemWorker" = ${decodedName} AND "problemWorkDate" IS NOT NULL THEN 1 END) as "problemCount",
      COUNT(CASE WHEN "solutionWorker" = ${decodedName} AND "solutionWorkDate" IS NOT NULL THEN 1 END) as "solutionCount"
    FROM "Problem"
    WHERE (
      ("problemWorker" = ${decodedName} AND "problemWorkDate" >= ${thirtyDaysAgo})
      OR ("solutionWorker" = ${decodedName} AND "solutionWorkDate" >= ${thirtyDaysAgo})
    )
    GROUP BY DATE("problemWorkDate")
    ORDER BY date DESC
  `

  // 주별 통계 (최근 12주)
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  twelveWeeksAgo.setHours(0, 0, 0, 0)

  const weeklyStats = await prisma.$queryRaw<Array<{
    year: number
    week: number
    problemCount: bigint
    solutionCount: bigint
  }>>`
    SELECT
      EXTRACT(YEAR FROM "problemWorkDate")::int as year,
      EXTRACT(WEEK FROM "problemWorkDate")::int as week,
      COUNT(CASE WHEN "problemWorker" = ${decodedName} AND "problemWorkDate" IS NOT NULL THEN 1 END) as "problemCount",
      COUNT(CASE WHEN "solutionWorker" = ${decodedName} AND "solutionWorkDate" IS NOT NULL THEN 1 END) as "solutionCount"
    FROM "Problem"
    WHERE (
      ("problemWorker" = ${decodedName} AND "problemWorkDate" >= ${twelveWeeksAgo})
      OR ("solutionWorker" = ${decodedName} AND "solutionWorkDate" >= ${twelveWeeksAgo})
    )
    GROUP BY EXTRACT(YEAR FROM "problemWorkDate"), EXTRACT(WEEK FROM "problemWorkDate")
    ORDER BY year DESC, week DESC
  `

  // 월별 통계 (최근 12개월)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  const monthlyStats = await prisma.$queryRaw<Array<{
    year: number
    month: number
    problemCount: bigint
    solutionCount: bigint
  }>>`
    SELECT
      EXTRACT(YEAR FROM "problemWorkDate")::int as year,
      EXTRACT(MONTH FROM "problemWorkDate")::int as month,
      COUNT(CASE WHEN "problemWorker" = ${decodedName} AND "problemWorkDate" IS NOT NULL THEN 1 END) as "problemCount",
      COUNT(CASE WHEN "solutionWorker" = ${decodedName} AND "solutionWorkDate" IS NOT NULL THEN 1 END) as "solutionCount"
    FROM "Problem"
    WHERE (
      ("problemWorker" = ${decodedName} AND "problemWorkDate" >= ${twelveMonthsAgo})
      OR ("solutionWorker" = ${decodedName} AND "solutionWorkDate" >= ${twelveMonthsAgo})
    )
    GROUP BY EXTRACT(YEAR FROM "problemWorkDate"), EXTRACT(MONTH FROM "problemWorkDate")
    ORDER BY year DESC, month DESC
  `

  // 오류 건수
  const errorCount = await prisma.validationIssue.count({
    where: {
      resolved: false,
      problem: {
        OR: [
          { problemWorker: decodedName },
          { solutionWorker: decodedName },
        ],
      },
    },
  })

  return {
    name: decodedName,
    totalStats: {
      problemCount,
      solutionCount,
      totalCount: problemCount + solutionCount,
      errorCount,
    },
    dailyStats: dailyStats.map(d => ({
      date: d.date,
      problemCount: Number(d.problemCount),
      solutionCount: Number(d.solutionCount),
      total: Number(d.problemCount) + Number(d.solutionCount),
    })),
    weeklyStats: weeklyStats.map(w => ({
      year: w.year,
      week: w.week,
      problemCount: Number(w.problemCount),
      solutionCount: Number(w.solutionCount),
      total: Number(w.problemCount) + Number(w.solutionCount),
    })),
    monthlyStats: monthlyStats.map(m => ({
      year: m.year,
      month: m.month,
      problemCount: Number(m.problemCount),
      solutionCount: Number(m.solutionCount),
      total: Number(m.problemCount) + Number(m.solutionCount),
    })),
  }
}

export default async function WorkerDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { name } = await params
  const data = await getWorkerStats(name)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href="/workers"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-lg">
              {data.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            <p className="text-muted-foreground">작업자 상세 통계</p>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              문제 게시
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">
                {data.totalStats.problemCount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              해설 게시
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {data.totalStats.solutionCount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 작업량
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {data.totalStats.totalCount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              미해결 오류
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {data.totalStats.errorCount > 0 ? (
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {data.totalStats.errorCount}
                </Badge>
              ) : (
                <Badge className="bg-green-500 text-lg px-3 py-1">0</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 기간별 통계 탭 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            기간별 작업 통계
          </CardTitle>
          <CardDescription>일별, 주별, 월별 작업량을 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList className="mb-4">
              <TabsTrigger value="daily">일별</TabsTrigger>
              <TabsTrigger value="weekly">주별</TabsTrigger>
              <TabsTrigger value="monthly">월별</TabsTrigger>
            </TabsList>

            <TabsContent value="daily">
              {data.dailyStats.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  최근 30일간 작업 기록이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead className="text-right">문제 게시</TableHead>
                      <TableHead className="text-right">해설 게시</TableHead>
                      <TableHead className="text-right">합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dailyStats.map((stat, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {stat.date ? new Date(stat.date).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.problemCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.solutionCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {stat.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="weekly">
              {data.weeklyStats.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  최근 12주간 작업 기록이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>기간</TableHead>
                      <TableHead className="text-right">문제 게시</TableHead>
                      <TableHead className="text-right">해설 게시</TableHead>
                      <TableHead className="text-right">합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.weeklyStats.map((stat, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{stat.year}년 {stat.week}주차</TableCell>
                        <TableCell className="text-right">
                          {stat.problemCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.solutionCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {stat.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="monthly">
              {data.monthlyStats.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  최근 12개월간 작업 기록이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>기간</TableHead>
                      <TableHead className="text-right">문제 게시</TableHead>
                      <TableHead className="text-right">해설 게시</TableHead>
                      <TableHead className="text-right">합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.monthlyStats.map((stat, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{stat.year}년 {stat.month}월</TableCell>
                        <TableCell className="text-right">
                          {stat.problemCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.solutionCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {stat.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

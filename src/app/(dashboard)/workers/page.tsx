export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, FileText, CheckCircle, AlertTriangle } from "lucide-react"

async function getWorkersData() {
  // 작업자별 통계 (문제게시)
  const problemWorkers = await prisma.problem.groupBy({
    by: ["problemWorker"],
    where: { problemWorker: { not: null } },
    _count: { id: true },
  })

  // 작업자별 통계 (해설게시)
  const solutionWorkers = await prisma.problem.groupBy({
    by: ["solutionWorker"],
    where: { solutionWorker: { not: null } },
    _count: { id: true },
  })

  // 작업자 목록 추출 및 통합
  const workerMap = new Map<
    string,
    {
      name: string
      problemCount: number
      solutionCount: number
      totalCount: number
    }
  >()

  problemWorkers.forEach((w) => {
    if (w.problemWorker) {
      const existing = workerMap.get(w.problemWorker) || {
        name: w.problemWorker,
        problemCount: 0,
        solutionCount: 0,
        totalCount: 0,
      }
      existing.problemCount = w._count.id
      existing.totalCount += w._count.id
      workerMap.set(w.problemWorker, existing)
    }
  })

  solutionWorkers.forEach((w) => {
    if (w.solutionWorker) {
      const existing = workerMap.get(w.solutionWorker) || {
        name: w.solutionWorker,
        problemCount: 0,
        solutionCount: 0,
        totalCount: 0,
      }
      existing.solutionCount = w._count.id
      existing.totalCount += w._count.id
      workerMap.set(w.solutionWorker, existing)
    }
  })

  const workers = Array.from(workerMap.values()).sort(
    (a, b) => b.totalCount - a.totalCount
  )

  // 작업자별 오류 수
  const workerErrors = await Promise.all(
    workers.map(async (worker) => {
      const errorCount = await prisma.validationIssue.count({
        where: {
          resolved: false,
          problem: {
            OR: [
              { problemWorker: worker.name },
              { solutionWorker: worker.name },
            ],
          },
        },
      })
      return { name: worker.name, errorCount }
    })
  )

  const errorMap = new Map(workerErrors.map((e) => [e.name, e.errorCount]))

  // 오늘 작업량
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayWork = await prisma.problem.groupBy({
    by: ["problemWorker", "solutionWorker"],
    where: {
      OR: [
        { problemWorkDate: { gte: today } },
        { solutionWorkDate: { gte: today } },
      ],
    },
    _count: { id: true },
  })

  // 전체 통계
  const totalProblems = await prisma.problem.count()
  const totalProblemPosted = await prisma.problem.count({
    where: { problemPosted: true },
  })
  const totalSolutionPosted = await prisma.problem.count({
    where: { solutionPosted: true },
  })

  return {
    workers: workers.map((w) => ({
      ...w,
      errorCount: errorMap.get(w.name) || 0,
    })),
    summary: {
      totalWorkers: workers.length,
      totalProblems,
      problemPostedRate: totalProblems > 0
        ? Math.round((totalProblemPosted / totalProblems) * 100)
        : 0,
      solutionPostedRate: totalProblems > 0
        ? Math.round((totalSolutionPosted / totalProblems) * 100)
        : 0,
    },
  }
}

export default async function WorkersPage() {
  const data = await getWorkersData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">작업자 관리</h2>
        <p className="text-muted-foreground">
          작업자별 처리량 및 KPI를 확인합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 작업자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{data.summary.totalWorkers}명</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              전체 문항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {data.summary.totalProblems.toLocaleString()}개
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              문제 게시율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <span className="text-2xl font-bold">
                {data.summary.problemPostedRate}%
              </span>
              <Progress value={data.summary.problemPostedRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              해설 게시율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <span className="text-2xl font-bold">
                {data.summary.solutionPostedRate}%
              </span>
              <Progress value={data.summary.solutionPostedRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작업자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>작업자별 현황</CardTitle>
          <CardDescription>
            작업자별 처리량과 오류 현황
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.workers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>등록된 작업자가 없습니다.</p>
              <p className="text-sm">파일을 업로드하면 작업자 정보가 표시됩니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>작업자</TableHead>
                  <TableHead className="text-right">문제 게시</TableHead>
                  <TableHead className="text-right">해설 게시</TableHead>
                  <TableHead className="text-right">총 작업량</TableHead>
                  <TableHead className="text-right">오류 건수</TableHead>
                  <TableHead className="w-32">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.workers.map((worker) => (
                  <TableRow key={worker.name} className="cursor-pointer hover:bg-slate-50">
                    <TableCell>
                      <a
                        href={`/workers/${encodeURIComponent(worker.name)}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {worker.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium hover:underline">{worker.name}</span>
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      {worker.problemCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {worker.solutionCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {worker.totalCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {worker.errorCount > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {worker.errorCount}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {worker.errorCount === 0 ? (
                        <Badge className="bg-green-500">양호</Badge>
                      ) : worker.errorCount < 5 ? (
                        <Badge variant="secondary">주의</Badge>
                      ) : (
                        <Badge variant="destructive">점검필요</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

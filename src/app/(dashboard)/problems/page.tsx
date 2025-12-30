export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import { prisma } from "@/lib/db"
import { ProblemTable } from "@/components/problems/ProblemTable"
import { ProblemFilters } from "@/components/problems/ProblemFilters"
import { ExamList } from "@/components/problems/ExamList"
import { SubjectFilter } from "@/components/problems/SubjectFilter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, List } from "lucide-react"
import Link from "next/link"

type SearchParams = {
  page?: string
  limit?: string
  subject?: string
  examYear?: string
  organization?: string
  status?: string
  worker?: string
  hasError?: string
  ruleCode?: string
  search?: string
  sort?: string
  order?: string
  view?: string
  examCode?: string
  [key: string]: string | undefined
}

async function getProblems(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = Number(searchParams.limit) || 20
  const skip = (page - 1) * limit

  // 필터 조건 구성
  const where: Record<string, unknown> = {}

  if (searchParams.examCode) {
    where.examCode = searchParams.examCode
  }
  if (searchParams.subject) {
    where.subject = searchParams.subject
  }
  if (searchParams.examYear) {
    where.examYear = Number(searchParams.examYear)
  }
  if (searchParams.organization) {
    where.organization = searchParams.organization
  }
  if (searchParams.status === "problem_pending") {
    where.problemPosted = false
  } else if (searchParams.status === "problem_done") {
    where.problemPosted = true
    where.solutionPosted = false
  } else if (searchParams.status === "solution_done") {
    where.solutionPosted = true
  }
  if (searchParams.worker) {
    where.OR = [
      { problemWorker: searchParams.worker },
      { solutionWorker: searchParams.worker },
    ]
  }
  if (searchParams.hasError === "true") {
    where.validationIssues = {
      some: { resolved: false },
    }
  }
  if (searchParams.ruleCode) {
    where.validationIssues = {
      some: {
        resolved: false,
        ruleCode: searchParams.ruleCode,
      },
    }
  }
  if (searchParams.search) {
    const searchNum = Number(searchParams.search)
    if (!isNaN(searchNum)) {
      where.OR = [
        { index: searchNum },
        { problemNumber: searchNum },
        { examCode: { contains: searchParams.search } },
      ]
    } else {
      where.OR = [
        { examCode: { contains: searchParams.search } },
        { subject: { contains: searchParams.search } },
        { organization: { contains: searchParams.search } },
      ]
    }
  }

  // 정렬
  const orderBy: Record<string, string> = {}
  const sortField = searchParams.sort || "index"
  const sortOrder = searchParams.order || "asc"
  orderBy[sortField] = sortOrder

  const [problems, total, filters] = await Promise.all([
    prisma.problem.findMany({
      where,
      include: {
        validationIssues: {
          where: { resolved: false },
          select: { id: true, severity: true, ruleCode: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.problem.count({ where }),
    getFilterOptions(),
  ])

  return {
    problems,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    filters,
  }
}

async function getExamGroups(searchParams: SearchParams) {
  // 필터 조건 구성
  const whereConditions: string[] = []
  const params: unknown[] = []

  if (searchParams.subject) {
    whereConditions.push(`p.subject = $${params.length + 1}`)
    params.push(searchParams.subject)
  }
  if (searchParams.examYear) {
    whereConditions.push(`p."examYear" = $${params.length + 1}`)
    params.push(Number(searchParams.examYear))
  }
  if (searchParams.organization) {
    whereConditions.push(`p.organization = $${params.length + 1}`)
    params.push(searchParams.organization)
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(" AND ")}`
    : ""

  const exams = await prisma.$queryRawUnsafe<Array<{
    examCode: string
    problemType: string | null
    organization: string
    subject: string
    examYear: number
    totalCount: bigint
    problemPostedCount: bigint
    solutionPostedCount: bigint
    errorCount: bigint
  }>>(
    `SELECT
      p."examCode",
      MAX(p."problemType") as "problemType",
      p.organization,
      p.subject,
      p."examYear",
      COUNT(p.id) as "totalCount",
      SUM(CASE WHEN p."problemPosted" = true THEN 1 ELSE 0 END) as "problemPostedCount",
      SUM(CASE WHEN p."solutionPosted" = true THEN 1 ELSE 0 END) as "solutionPostedCount",
      COUNT(DISTINCT vi.id) as "errorCount"
    FROM "Problem" p
    LEFT JOIN "ValidationIssue" vi ON vi."problemId" = p.id AND vi.resolved = false
    ${whereClause}
    GROUP BY p."examCode", p.organization, p.subject, p."examYear"
    ORDER BY p."examYear" DESC, p.subject ASC, p."examCode" ASC`,
    ...params
  )

  const filters = await getFilterOptions()

  return {
    exams: exams.map(e => ({
      ...e,
      totalCount: Number(e.totalCount),
      problemPostedCount: Number(e.problemPostedCount),
      solutionPostedCount: Number(e.solutionPostedCount),
      errorCount: Number(e.errorCount),
    })),
    filters,
  }
}

async function getSubjects() {
  const subjects = await prisma.problem.findMany({
    select: { subject: true },
    distinct: ["subject"],
    orderBy: { subject: "asc" },
  })
  return subjects.map((s) => s.subject)
}

async function getFilterOptions() {
  const [subjects, organizations, years, workers] = await Promise.all([
    prisma.problem.findMany({
      select: { subject: true },
      distinct: ["subject"],
      orderBy: { subject: "asc" },
    }),
    prisma.problem.findMany({
      select: { organization: true },
      distinct: ["organization"],
      orderBy: { organization: "asc" },
    }),
    prisma.problem.findMany({
      select: { examYear: true },
      distinct: ["examYear"],
      orderBy: { examYear: "desc" },
    }),
    prisma.problem.findMany({
      select: { problemWorker: true, solutionWorker: true },
      distinct: ["problemWorker", "solutionWorker"],
    }),
  ])

  // 작업자 목록 추출
  const workerSet = new Set<string>()
  workers.forEach((w) => {
    if (w.problemWorker) workerSet.add(w.problemWorker)
    if (w.solutionWorker) workerSet.add(w.solutionWorker)
  })

  return {
    subjects: subjects.map((s) => s.subject),
    organizations: organizations.map((o) => o.organization),
    years: years.map((y) => y.examYear),
    workers: Array.from(workerSet).sort(),
  }
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      <div className="border rounded-lg">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentView = params.view || "exam"

  // 시험지코드가 있으면 index 뷰로 전환
  const effectiveView = params.examCode ? "index" : currentView

  const [problemData, examData, subjects] = await Promise.all([
    effectiveView === "index" ? getProblems(params) : null,
    effectiveView === "exam" ? getExamGroups(params) : null,
    getSubjects(),
  ])

  // 시험지코드로 필터링된 경우 해당 시험지 정보 가져오기
  const currentExam = params.examCode
    ? await prisma.problem.findFirst({
        where: { examCode: params.examCode },
        select: { examCode: true, subject: true, examYear: true, organization: true },
      })
    : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
          Problems
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">문항 관리</h1>
        <p className="text-slate-600 mt-1">
          시험지별 또는 전체 문항을 관리합니다.
        </p>
      </div>

      {/* 과목 필터 - 탭 위에 배치 */}
      <SubjectFilter subjects={subjects} currentSubject={params.subject} />

      <Tabs value={effectiveView} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="exam" asChild>
            <Link
              href={`/problems?view=exam${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ""}`}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              시험지별
            </Link>
          </TabsTrigger>
          <TabsTrigger value="index" asChild>
            <Link
              href={`/problems?view=index${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ""}`}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              전체 문항
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exam" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">시험지 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                {examData && (
                  <ExamList
                    exams={examData.exams}
                    filters={examData.filters}
                  />
                )}
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="index" className="mt-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-slate-800">
                    {currentExam ? (
                      <span className="flex items-center gap-2">
                        <Link
                          href="/problems?view=exam"
                          className="text-slate-500 hover:text-slate-700"
                        >
                          시험지
                        </Link>
                        <span className="text-slate-400">/</span>
                        <span>{currentExam.examCode}</span>
                      </span>
                    ) : (
                      "전체 문항 목록"
                    )}
                  </CardTitle>
                  {currentExam && (
                    <p className="text-sm text-slate-500 mt-1">
                      {currentExam.organization} · {currentExam.subject} · {currentExam.examYear}년
                    </p>
                  )}
                </div>
                {problemData && (
                  <p className="text-sm text-slate-500">
                    총 <span className="font-mono font-bold text-slate-800">{problemData.total.toLocaleString()}</span>개
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                {problemData && (
                  <div className="space-y-4">
                    <ProblemFilters
                      filters={problemData.filters}
                      currentParams={params}
                    />
                    <ProblemTable
                      problems={problemData.problems}
                      page={problemData.page}
                      totalPages={problemData.totalPages}
                      total={problemData.total}
                    />
                  </div>
                )}
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

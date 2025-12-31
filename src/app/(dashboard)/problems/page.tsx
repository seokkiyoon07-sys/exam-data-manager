export const dynamic = 'force-dynamic'

import { Suspense, cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"
import { ProblemTable } from "@/components/problems/ProblemTable"
import { ProblemFilters } from "@/components/problems/ProblemFilters"
import { ExamList } from "@/components/problems/ExamList"
import { HierarchicalFilter } from "@/components/problems/HierarchicalFilter"
import { ManualProblemModal } from "@/components/problems/ManualProblemModal"
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
  privateOrg?: string
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

// 하위 호환성을 위한 사설 업체 매핑 (DB에 organization이 '사설'로 되어있을 때 problemType 검색용)
const LEGACY_PRIVATE_ORGS = [
  { key: "더프", searchTerms: ["더프"] },
  { key: "시대인재", searchTerms: ["시대인재", "서바"] },
  { key: "강남대성", searchTerms: ["강남대성", "강대"] },
  { key: "히든카이스", searchTerms: ["히든카이스"] },
  { key: "양승진", searchTerms: ["양승진"] },
  { key: "현우진킬링캠프", searchTerms: ["현우진", "킬링캠프"] },
  { key: "한석원", searchTerms: ["한석원", "JMT", "jmt"] },
  { key: "이해원", searchTerms: ["이해원"] },
  { key: "이감", searchTerms: ["이감"] }, // 국어 대표 사설
  { key: "상상", searchTerms: ["상상"] }, // 국어 대표 사설
  { key: "바탕", searchTerms: ["바탕"] }, // 국어 대표 사설
]

// 필터 옵션을 가져오는 캐시된 함수 (Request Memoization + Data Cache)
// 필터 옵션을 가져오는 캐시된 함수 (Request Memoization + Data Cache)
const getFilterOptions = cache(unstable_cache(
  async () => {
    // 1. 기본 필터 데이터 조회 (Subject - Organization 관계 포함)
    const [subjectOrgPairs, yearsResult, workersResult] = await Promise.all([
      prisma.problem.groupBy({
        by: ['subject', 'organization'],
        orderBy: { organization: 'asc' }
      }),
      prisma.$queryRaw<Array<{ examYear: number }>>`
        SELECT DISTINCT "examYear" FROM "Problem" ORDER BY "examYear" DESC
      `,
      prisma.$queryRaw<Array<{ worker: string }>>`
        SELECT DISTINCT worker FROM (
          SELECT "problemWorker" as worker FROM "Problem" WHERE "problemWorker" IS NOT NULL
          UNION
          SELECT "solutionWorker" as worker FROM "Problem" WHERE "solutionWorker" IS NOT NULL
        ) w ORDER BY worker ASC
      `,
    ])

    // 기본 데이터로부터 맵 생성
    const orgsBySubject: Record<string, Set<string>> = {}
    const allSubjects = new Set<string>()
    const allOrgs = new Set<string>()

    subjectOrgPairs.forEach(item => {
      if (!orgsBySubject[item.subject]) {
        orgsBySubject[item.subject] = new Set()
      }
      orgsBySubject[item.subject].add(item.organization)
      allSubjects.add(item.subject)
      allOrgs.add(item.organization)
    })

    // 2. 레거시 사설 업체 데이터 존재 여부 확인 (과목별로 스캔)
    await Promise.all(
      LEGACY_PRIVATE_ORGS.map(async (org) => {
        // 이미 DB 컬럼에 이름이 있는 과목들은 스캔 제외할 수도 있으나, 
        // 과목별로 다를 수 있으므로 '사설'로 되어있는 것들 중에서 검색

        const foundSubjects = await prisma.problem.groupBy({
          by: ['subject'],
          where: {
            organization: { notIn: ['교육청', '평가원', 'EBS'] }, // 공식 기관이 아닌 모든 것 대상
            OR: org.searchTerms.map(term => ({ problemType: { contains: term } }))
          }
        })

        foundSubjects.forEach(fs => {
          if (!orgsBySubject[fs.subject]) {
            orgsBySubject[fs.subject] = new Set()
            allSubjects.add(fs.subject)
          }
          orgsBySubject[fs.subject].add(org.key)
          allOrgs.add(org.key)
        })
      })
    )

    // Set -> Array 변환
    const organizationsBySubject: Record<string, string[]> = {}
    Object.keys(orgsBySubject).forEach(subject => {
      organizationsBySubject[subject] = Array.from(orgsBySubject[subject]).sort()
      // 사설 옵션 강제 추가
      const hasPrivate = organizationsBySubject[subject].some(o => !['교육청', '평가원', 'EBS'].includes(o))
      if (hasPrivate && !organizationsBySubject[subject].includes('사설')) {
        organizationsBySubject[subject].push('사설')
      }
    })

    return {
      subjects: Array.from(allSubjects).sort(),
      organizations: Array.from(allOrgs).sort(),
      organizationsBySubject, // 추가된 필드
      years: yearsResult.map((y) => y.examYear),
      workers: workersResult.map((w) => w.worker),
    }
  },
  ["filter-options-v3"], // 캐시 키 변경으로 즉시 갱신 유도
  { revalidate: 1 } // 1초로 설정 (0은 허용되지 않음)
))

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
    if (searchParams.organization === "사설") {
      // '사설' 선택 시: 공식 기관이 아니거나 '사설'인 것
      where.organization = {
        notIn: ["교육청", "평가원", "EBS"]
      }
    } else {
      where.organization = searchParams.organization
    }
  }

  // 사설 업체 필터 (DB에 업체명이 있는 경우 + 기존 problemType 검색 호환)
  if (searchParams.privateOrg) {
    where.OR = [
      { organization: searchParams.privateOrg }, // DB에 '시대인재' 등으로 저장된 경우
      { problemType: { contains: searchParams.privateOrg } }, // 기존 데이터 호환
      // 하드코딩된 매핑 호환
      ...(searchParams.privateOrg === "시대인재" ? [{ problemType: { contains: "서바" } }] : []),
      ...(searchParams.privateOrg === "강남대성" ? [{ problemType: { contains: "강대" } }] : []),
      ...(searchParams.privateOrg === "한석원" ? [{ problemType: { contains: "JMT" } }, { problemType: { contains: "jmt" } }] : []),
    ]
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

  const [problems, total] = await Promise.all([
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
  ])

  const filters = await getFilterOptions()

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
    if (searchParams.organization === "사설") {
      whereConditions.push(`p.organization NOT IN ('교육청', '평가원', 'EBS')`)
    } else {
      whereConditions.push(`p.organization = $${params.length + 1}`)
      params.push(searchParams.organization)
    }
  }

  // 사설 업체 필터 - SQL Raw Query
  if (searchParams.privateOrg) {
    const orgParam = searchParams.privateOrg
    const orConditions = [`p.organization = $${params.length + 1}`]
    params.push(orgParam)

    orConditions.push(`p."problemType" ILIKE $${params.length + 1}`)
    params.push(`%${orgParam}%`)

    // 호환성 추가 검색어
    if (orgParam === "시대인재") {
      orConditions.push(`p."problemType" ILIKE $${params.length + 1}`)
      params.push(`%서바%`)
    }
    if (orgParam === "강남대성") {
      orConditions.push(`p."problemType" ILIKE $${params.length + 1}`)
      params.push(`%강대%`)
    }

    whereConditions.push(`(${orConditions.join(" OR ")})`)
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(" AND ")}`
    : ""

  // 1. 시험지 목록 조회 (JOIN 없이 Problem 테이블만 집계 - 메모리 절약)
  const exams = await prisma.$queryRawUnsafe<Array<{
    examCode: string
    problemType: string | null
    organization: string
    subject: string
    examYear: number
    totalCount: bigint
    problemPostedCount: bigint
    solutionPostedCount: bigint
  }>>(
    `SELECT
      p."examCode",
      MAX(p."problemType") as "problemType",
      p.organization,
      p.subject,
      p."examYear",
      COUNT(p.id) as "totalCount",
      SUM(CASE WHEN p."problemPosted" = true THEN 1 ELSE 0 END) as "problemPostedCount",
      SUM(CASE WHEN p."solutionPosted" = true THEN 1 ELSE 0 END) as "solutionPostedCount"
    FROM "Problem" p
    ${whereClause}
    GROUP BY p."examCode", p.organization, p.subject, p."examYear"
    ORDER BY p."examYear" DESC, p.subject ASC, p."examCode" ASC`,
    ...params
  )

  // 2. 오류 건수 별도 조회 (INNER JOIN으로 오류가 있는 것만 집계하여 가볍게 처리)
  const errorWhereClause = whereClause
    ? whereClause + ` AND vi.resolved = false`
    : `WHERE vi.resolved = false`

  const errorCountsRaw = await prisma.$queryRawUnsafe<Array<{
    examCode: string
    errorCount: bigint
  }>>(
    `SELECT
      p."examCode",
      COUNT(vi.id) as "errorCount"
    FROM "ValidationIssue" vi
    JOIN "Problem" p ON vi."problemId" = p.id
    ${errorWhereClause}
    GROUP BY p."examCode"`,
    ...params
  )

  const errorCountMap = new Map<string, number>()
  errorCountsRaw.forEach(e => {
    errorCountMap.set(e.examCode, Number(e.errorCount))
  })

  // 필터 옵션
  const filters = await getFilterOptions()

  return {
    exams: exams.map(e => ({
      ...e,
      totalCount: Number(e.totalCount),
      problemPostedCount: Number(e.problemPostedCount),
      solutionPostedCount: Number(e.solutionPostedCount),
      errorCount: errorCountMap.get(e.examCode) || 0,
    })),
    filters,
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

function FilterSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Async Loader Components
// ----------------------------------------------------------------------------

async function FilterSection({ searchParams }: { searchParams: SearchParams }) {
  const filterOptions = await getFilterOptions();

  // 현재 선택된 과목에 해당하는 출제기관 목록만 전달
  const currentOrgs = searchParams.subject
    ? (filterOptions.organizationsBySubject?.[searchParams.subject] || [])
    : filterOptions.organizations

  return (
    <HierarchicalFilter
      subjects={filterOptions.subjects}
      organizations={currentOrgs}
      currentSubject={searchParams.subject}
      currentOrganization={searchParams.organization}
      currentPrivateOrg={searchParams.privateOrg}
    />
  );
}

async function ExamSection({ searchParams }: { searchParams: SearchParams }) {
  const examData = await getExamGroups(searchParams);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-slate-800">시험지 목록</CardTitle>
      </CardHeader>
      <CardContent>
        <ExamList
          exams={examData.exams}
          filters={examData.filters}
        />
      </CardContent>
    </Card>
  );
}

async function ProblemSection({ searchParams }: { searchParams: SearchParams }) {
  // 병렬 데이터 페칭
  const [problemData, currentExam] = await Promise.all([
    getProblems(searchParams),
    searchParams.examCode
      ? prisma.problem.findFirst({
        where: { examCode: searchParams.examCode },
        select: { examCode: true, subject: true, examYear: true, organization: true },
      })
      : null
  ]);

  return (
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
                "문항 목록"
              )}
            </CardTitle>
            {currentExam && (
              <p className="text-sm text-slate-500 mt-1">
                {currentExam.organization} · {currentExam.subject} · {currentExam.examYear}년
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">
              총 <span className="font-mono font-bold text-slate-800">{problemData.total.toLocaleString()}</span>개
            </p>
            <ManualProblemModal />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ProblemFilters
            filters={problemData.filters}
            currentParams={searchParams}
          />
          <ProblemTable
            problems={problemData.problems}
            page={problemData.page}
            totalPages={problemData.totalPages}
            total={problemData.total}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------------------

import { SheetSyncButton } from "@/components/problems/SheetSyncButton"

// ... imports

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentView = params.view || "exam"

  // 1. 변수 미리 계산
  const effectiveView = params.examCode ? "index" : currentView
  const hasSubjectFilter = !!params.subject

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
            Problems
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">문항 관리</h1>
          <p className="text-slate-600 mt-1">
            시험지별 또는 전체 문항을 관리합니다.
          </p>
        </div>
        <SheetSyncButton />
      </div>

      {/* 계층형 필터 - 스트리밍 적용 */}
      <Suspense fallback={<FilterSkeleton />}>
        <FilterSection searchParams={params} />
      </Suspense>

      {hasSubjectFilter && (
        <Tabs value={effectiveView} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="exam" asChild>
              <Link
                href={`/problems?view=exam&subject=${encodeURIComponent(params.subject!)}${params.organization ? `&organization=${encodeURIComponent(params.organization)}` : ""}`}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                시험지별
              </Link>
            </TabsTrigger>
            <TabsTrigger value="index" asChild>
              <Link
                href={`/problems?view=index&subject=${encodeURIComponent(params.subject!)}${params.organization ? `&organization=${encodeURIComponent(params.organization)}` : ""}`}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                전체 문항
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exam" className="mt-0">
            <Suspense fallback={<TableSkeleton />}>
              <ExamSection searchParams={params} />
            </Suspense>
          </TabsContent>

          <TabsContent value="index" className="mt-0">
            <Suspense fallback={<TableSkeleton />}>
              <ProblemSection searchParams={params} />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import {
  getProblemsFromCache,
  getFilterOptionsFromCache,
  getExamGroupsFromCache,
  getCacheStatus,
  ensureCacheReady,
  CachedProblem,
} from "@/lib/sheet-cache"
import { ProblemTable } from "@/components/problems/ProblemTable"
import { ProblemFilters } from "@/components/problems/ProblemFilters"
import { ExamList } from "@/components/problems/ExamList"
import { HierarchicalFilter } from "@/components/problems/HierarchicalFilter"
import { ManualProblemModal } from "@/components/problems/ManualProblemModal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, List, AlertCircle } from "lucide-react"
import Link from "next/link"
import { SheetSyncButton } from "@/components/problems/SheetSyncButton"

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

// CachedProblem을 기존 ProblemTable이 기대하는 형식으로 변환
function transformProblemsForTable(problems: CachedProblem[]) {
  return problems.map(p => {
    // questionType 변환: 'MULTIPLE', '객관식' -> MULTIPLE, 나머지 -> SUBJECTIVE
    const qType = p.questionType?.toUpperCase();
    const questionType: 'MULTIPLE' | 'SUBJECTIVE' =
      (qType === 'MULTIPLE' || p.questionType === '객관식') ? 'MULTIPLE' : 'SUBJECTIVE';

    return {
      id: p.id,
      index: p.index,
      subject: p.subject,
      problemType: p.problemType || null,
      examCode: p.examCode || null,
      organization: p.organization,
      subCategory: p.subCategory || null,
      examYear: p.examYear ? parseInt(p.examYear) : 0,
      problemNumber: p.problemNumber || 0,
      questionType,
      answer: p.answer || null,
      difficulty: p.difficulty || null,
      score: p.score ?? null,
      correctRate: p.correctRate ?? null,
      choiceRate1: p.choiceRate1 ?? null,
      choiceRate2: p.choiceRate2 ?? null,
      choiceRate3: p.choiceRate3 ?? null,
      choiceRate4: p.choiceRate4 ?? null,
      choiceRate5: p.choiceRate5 ?? null,
      problemPosted: p.problemPosted,
      problemWorker: p.problemWorker || null,
      problemWorkDate: p.problemWorkDate || null,
      solutionPosted: p.solutionPosted,
      solutionWorker: p.solutionWorker || null,
      solutionWorkDate: p.solutionWorkDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      validationIssues: [] as { id: string; severity: 'ERROR' | 'WARNING' | 'INFO'; ruleCode: string }[],
    };
  })
}

// 필터 옵션 가져오기
async function getFilterOptions() {
  await ensureCacheReady()
  const options = getFilterOptionsFromCache()

  // 과목별 organization 맵 생성
  const organizationsBySubject: Record<string, string[]> = {}
  options.subjects.forEach(subject => {
    organizationsBySubject[subject] = options.organizations
  })

  return {
    subjects: options.subjects,
    organizations: options.organizations,
    organizationsBySubject,
    years: options.examYears.map(y => parseInt(y)).filter(y => !isNaN(y)),
    workers: options.workers,
  }
}

// 문제 목록 가져오기
async function getProblems(searchParams: SearchParams) {
  await ensureCacheReady()

  const page = Number(searchParams.page) || 1
  const limit = Number(searchParams.limit) || 20

  // 상태 필터 변환
  let status: string | undefined
  if (searchParams.status === "problem_pending") {
    status = "not_started"
  } else if (searchParams.status === "problem_done") {
    status = "problem_only"
  } else if (searchParams.status === "solution_done") {
    status = "completed"
  }

  const result = getProblemsFromCache({
    subject: searchParams.subject,
    examYear: searchParams.examYear,
    organization: searchParams.organization,
    examCode: searchParams.examCode,
    worker: searchParams.worker,
    status,
    search: searchParams.search,
    page,
    limit,
    sortBy: searchParams.sort || 'index',
    sortOrder: (searchParams.order as 'asc' | 'desc') || 'asc',
  })

  const filters = await getFilterOptions()

  return {
    problems: transformProblemsForTable(result.problems),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: Math.ceil(result.total / result.limit),
    filters,
  }
}

// 시험지 그룹 가져오기
async function getExamGroups(searchParams: SearchParams) {
  await ensureCacheReady()

  const exams = getExamGroupsFromCache({
    subject: searchParams.subject,
    examYear: searchParams.examYear,
    organization: searchParams.organization,
  })

  const filters = await getFilterOptions()

  return {
    exams: exams.map(e => ({
      ...e,
      examYear: parseInt(e.examYear) || 0,
      errorCount: 0, // 캐시에서는 검수 이슈 카운트 없음
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

function CacheNotReady() {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-slate-900">캐시 초기화 필요</h3>
            <p className="text-sm text-slate-600 mt-1">
              Google Sheets에서 데이터를 가져오려면 상단의 &ldquo;새로고침&rdquo; 버튼을 클릭하세요.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Async Loader Components
// ----------------------------------------------------------------------------

async function FilterSection({ searchParams }: { searchParams: SearchParams }) {
  const cacheReady = await ensureCacheReady()
  if (!cacheReady) return null

  const filterOptions = await getFilterOptions()

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
  )
}

async function ExamSection({ searchParams }: { searchParams: SearchParams }) {
  const cacheReady = await ensureCacheReady()
  if (!cacheReady) return <CacheNotReady />

  const examData = await getExamGroups(searchParams)
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
  )
}

async function ProblemSection({ searchParams }: { searchParams: SearchParams }) {
  const cacheReady = await ensureCacheReady()
  if (!cacheReady) return <CacheNotReady />

  const problemData = await getProblems(searchParams)

  // 현재 시험지 정보 (examCode가 있으면)
  let currentExam = null
  if (searchParams.examCode && problemData.problems.length > 0) {
    const firstProblem = problemData.problems[0]
    currentExam = {
      examCode: firstProblem.examCode,
      subject: firstProblem.subject,
      examYear: firstProblem.examYear,
      organization: firstProblem.organization,
    }
  }

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
  )
}

// ----------------------------------------------------------------------------
// Cache Status Banner
// ----------------------------------------------------------------------------

async function CacheStatusBanner() {
  const status = getCacheStatus()

  if (!status.isReady) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-yellow-800">
            {status.isLoading
              ? "데이터를 불러오는 중..."
              : "Google Sheets 데이터가 로드되지 않았습니다. 새로고침 버튼을 클릭하세요."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-xs text-slate-500">
      {status.totalProblems.toLocaleString()}개 문항 캐시됨
      {status.lastUpdated && (
        <span className="ml-2">
          (마지막 업데이트: {new Date(status.lastUpdated).toLocaleString('ko-KR')})
        </span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------------------

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentView = params.view || "exam"
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
        <div className="flex flex-col items-end gap-2">
          <SheetSyncButton />
          <CacheStatusBanner />
        </div>
      </div>

      {/* 계층형 필터 */}
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

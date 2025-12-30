"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ExamGroup {
  examCode: string
  problemType: string | null
  organization: string
  subject: string
  examYear: number
  totalCount: number
  problemPostedCount: number
  solutionPostedCount: number
  errorCount: number
}

interface ExamListProps {
  exams: ExamGroup[]
  filters: {
    subjects: string[]
    organizations: string[]
    years: number[]
  }
}

export function ExamList({ exams, filters }: ExamListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")

  const currentSubject = searchParams.get("subject") || ""
  const currentYear = searchParams.get("examYear") || ""
  const currentOrg = searchParams.get("organization") || ""

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set("view", "exam")
    router.push(`/problems?${params.toString()}`)
  }

  const filteredExams = exams.filter((exam) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        exam.examCode.toLowerCase().includes(search) ||
        exam.subject.toLowerCase().includes(search) ||
        exam.organization.toLowerCase().includes(search) ||
        (exam.problemType && exam.problemType.toLowerCase().includes(search))
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="시험지코드, 과목 검색..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select
          value={currentSubject || "all"}
          onValueChange={(value) =>
            updateFilter("subject", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="과목" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 과목</SelectItem>
            {filters.subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentYear || "all"}
          onValueChange={(value) =>
            updateFilter("examYear", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="시행년도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 연도</SelectItem>
            {filters.years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentOrg || "all"}
          onValueChange={(value) =>
            updateFilter("organization", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="출제기관" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 기관</SelectItem>
            {filters.organizations.map((org) => (
              <SelectItem key={org} value={org}>
                {org}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 시험지 목록 */}
      <div className="space-y-2">
        {filteredExams.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">시험지가 없습니다.</p>
          </div>
        ) : (
          filteredExams.map((exam) => {
            const progressPercent = Math.round(
              (exam.solutionPostedCount / exam.totalCount) * 100
            )
            const hasErrors = exam.errorCount > 0

            return (
              <Link
                key={exam.examCode}
                href={`/problems?view=index&examCode=${encodeURIComponent(exam.examCode)}`}
                className="block group"
              >
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {exam.problemType || exam.examCode}
                        </span>
                        {hasErrors && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" />
                            {exam.errorCount}
                          </Badge>
                        )}
                        {progressPercent === 100 && (
                          <Badge className="gap-1 text-xs bg-green-500">
                            <CheckCircle className="h-3 w-3" />
                            완료
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        <span className="font-mono text-slate-400">{exam.examCode}</span>
                        {" · "}
                        {exam.organization} · {exam.subject} · {exam.examYear}년
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* 진행률 */}
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-500 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-slate-600 w-10">
                          {progressPercent}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {exam.solutionPostedCount}/{exam.totalCount}문항 완료
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* 카운트 */}
      <div className="text-sm text-slate-500 text-center">
        총 {filteredExams.length}개의 시험지
      </div>
    </div>
  )
}

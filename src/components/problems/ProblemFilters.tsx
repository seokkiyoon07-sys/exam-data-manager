"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Search, X, AlertTriangle, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ruleMessages } from "@/lib/validation-rules"

interface FilterOptions {
  subjects: string[]
  organizations: string[]
  years: number[]
  workers: string[]
}

interface ProblemFiltersProps {
  filters: FilterOptions
  currentParams: Record<string, string | undefined>
}

export function ProblemFilters({ filters, currentParams }: ProblemFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.set("page", "1") // 필터 변경시 첫 페이지로
      router.push(`/problems?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAllFilters = useCallback(() => {
    router.push("/problems")
  }, [router])

  const hasFilters =
    currentParams.subject ||
    currentParams.examYear ||
    currentParams.organization ||
    currentParams.status ||
    currentParams.worker ||
    currentParams.hasError ||
    currentParams.ruleCode ||
    currentParams.examCode ||
    currentParams.search

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {/* 검색 */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Index, 시험지코드 검색..."
            className="pl-8"
            defaultValue={currentParams.search}
            onChange={(e) => {
              const value = e.target.value
              // 디바운스
              const timeoutId = setTimeout(() => {
                updateFilter("search", value || null)
              }, 500)
              return () => clearTimeout(timeoutId)
            }}
          />
        </div>

        {/* 과목 */}
        <Select
          value={currentParams.subject || "all"}
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

        {/* 시행년도 */}
        <Select
          value={currentParams.examYear || "all"}
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

        {/* 출제기관 */}
        <Select
          value={currentParams.organization || "all"}
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

        {/* 상태 */}
        <Select
          value={currentParams.status || "all"}
          onValueChange={(value) =>
            updateFilter("status", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="problem_pending">문제 미게시</SelectItem>
            <SelectItem value="problem_done">문제만 게시</SelectItem>
            <SelectItem value="solution_done">해설 게시 완료</SelectItem>
          </SelectContent>
        </Select>

        {/* 작업자 */}
        {filters.workers.length > 0 && (
          <Select
            value={currentParams.worker || "all"}
            onValueChange={(value) =>
              updateFilter("worker", value === "all" ? null : value)
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="작업자" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 작업자</SelectItem>
              {filters.workers.map((worker) => (
                <SelectItem key={worker} value={worker}>
                  {worker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* 오류 있는 항목만 */}
        <Button
          variant={currentParams.hasError === "true" ? "destructive" : "outline"}
          size="sm"
          onClick={() =>
            updateFilter(
              "hasError",
              currentParams.hasError === "true" ? null : "true"
            )
          }
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          오류 항목만
        </Button>

        {/* 필터 초기화 */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            초기화
          </Button>
        )}
      </div>

      {/* 활성 필터 표시 */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {currentParams.search && (
            <Badge variant="secondary" className="gap-1">
              검색: {currentParams.search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("search", null)}
              />
            </Badge>
          )}
          {currentParams.subject && (
            <Badge variant="secondary" className="gap-1">
              과목: {currentParams.subject}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("subject", null)}
              />
            </Badge>
          )}
          {currentParams.examYear && (
            <Badge variant="secondary" className="gap-1">
              시행년도: {currentParams.examYear}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("examYear", null)}
              />
            </Badge>
          )}
          {currentParams.organization && (
            <Badge variant="secondary" className="gap-1">
              출제기관: {currentParams.organization}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("organization", null)}
              />
            </Badge>
          )}
          {currentParams.status && (
            <Badge variant="secondary" className="gap-1">
              상태: {
                currentParams.status === "problem_pending"
                  ? "문제 미게시"
                  : currentParams.status === "problem_done"
                  ? "문제만 게시"
                  : "해설 게시 완료"
              }
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("status", null)}
              />
            </Badge>
          )}
          {currentParams.hasError === "true" && (
            <Badge variant="destructive" className="gap-1">
              오류 항목만
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("hasError", null)}
              />
            </Badge>
          )}
          {currentParams.ruleCode && (
            <Badge className="gap-1 bg-slate-600">
              <AlertCircle className="h-3 w-3" />
              {ruleMessages[currentParams.ruleCode] || currentParams.ruleCode}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("ruleCode", null)}
              />
            </Badge>
          )}
          {currentParams.examCode && (
            <Badge className="gap-1 bg-slate-500">
              시험지: {currentParams.examCode}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("examCode", null)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

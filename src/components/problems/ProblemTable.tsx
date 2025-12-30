"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Problem, ValidationIssue, Severity, QuestionType } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Circle,
} from "lucide-react"

type ProblemWithIssues = Problem & {
  validationIssues: Pick<ValidationIssue, "id" | "severity" | "ruleCode">[]
}

interface ProblemTableProps {
  problems: ProblemWithIssues[]
  page: number
  totalPages: number
  total: number
}

function StatusBadge({ problemPosted, solutionPosted }: { problemPosted: boolean; solutionPosted: boolean }) {
  if (solutionPosted) {
    return (
      <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle className="h-3 w-3" />
        완료
      </Badge>
    )
  }
  if (problemPosted) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Circle className="h-3 w-3" />
        문제만
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Circle className="h-3 w-3" />
      미시작
    </Badge>
  )
}

function IssueBadge({ issues }: { issues: Pick<ValidationIssue, "id" | "severity" | "ruleCode">[] }) {
  if (issues.length === 0) {
    return null
  }

  const errorCount = issues.filter((i) => i.severity === Severity.ERROR).length
  const warningCount = issues.filter((i) => i.severity === Severity.WARNING).length
  const infoCount = issues.filter((i) => i.severity === Severity.INFO).length

  return (
    <div className="flex gap-1">
      {errorCount > 0 && (
        <Badge variant="destructive" className="gap-1 text-xs px-1.5">
          <AlertCircle className="h-3 w-3" />
          {errorCount}
        </Badge>
      )}
      {warningCount > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs px-1.5 bg-yellow-100 text-yellow-700">
          <AlertTriangle className="h-3 w-3" />
          {warningCount}
        </Badge>
      )}
      {infoCount > 0 && (
        <Badge variant="outline" className="gap-1 text-xs px-1.5">
          <Info className="h-3 w-3" />
          {infoCount}
        </Badge>
      )}
    </div>
  )
}

export function ProblemTable({ problems, page, totalPages, total }: ProblemTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    router.push(`/problems?${params.toString()}`)
  }

  if (problems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>검색 결과가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Index</TableHead>
              <TableHead className="w-32">시험지명</TableHead>
              <TableHead className="w-28">시험지코드</TableHead>
              <TableHead>과목</TableHead>
              <TableHead className="w-20">시행년도</TableHead>
              <TableHead className="w-16">문항</TableHead>
              <TableHead className="w-16">유형</TableHead>
              <TableHead className="w-12">정답</TableHead>
              <TableHead className="w-20">상태</TableHead>
              <TableHead className="w-24">검수</TableHead>
              <TableHead className="w-24">작업자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.map((problem) => (
              <TableRow
                key={problem.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/problems/${problem.id}`)}
              >
                <TableCell className="font-mono text-sm">
                  {problem.index}
                </TableCell>
                <TableCell className="text-sm text-slate-700">
                  {problem.problemType || "-"}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-500">
                  {problem.examCode || "-"}
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{problem.subject}</span>
                    {problem.subCategory && (
                      <span className="text-xs text-muted-foreground ml-1">
                        / {problem.subCategory}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{problem.examYear}</TableCell>
                <TableCell className="text-center">{problem.problemNumber}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {problem.questionType === QuestionType.MULTIPLE ? "객관" : "주관"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {problem.answer || "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    problemPosted={problem.problemPosted}
                    solutionPosted={problem.solutionPosted}
                  />
                </TableCell>
                <TableCell>
                  <IssueBadge issues={problem.validationIssues} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {problem.solutionWorker || problem.problemWorker || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          전체 {total.toLocaleString()}개 중 {(page - 1) * 20 + 1} - {Math.min(page * 20, total)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(1)}
            disabled={page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-4">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToPage(totalPages)}
            disabled={page === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

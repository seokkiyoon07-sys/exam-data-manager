import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react"
import Link from "next/link"

interface ValidationIssue {
  ruleCode: string
  message: string
  count: number
  severity: "ERROR" | "WARNING" | "INFO"
}

interface ValidationSummaryProps {
  issues: ValidationIssue[]
}

const severityConfig = {
  ERROR: {
    icon: AlertCircle,
    label: "오류",
    style: "bg-slate-500 text-white",
    iconStyle: "text-white",
    countStyle: "bg-white/20 text-white",
  },
  WARNING: {
    icon: AlertTriangle,
    label: "경고",
    style: "bg-slate-200 text-slate-800",
    iconStyle: "text-slate-600",
    countStyle: "bg-slate-300/50 text-slate-700",
  },
  INFO: {
    icon: Info,
    label: "정보",
    style: "bg-slate-50 border border-slate-200 text-slate-700",
    iconStyle: "text-slate-500",
    countStyle: "bg-slate-100 text-slate-600",
  },
}

export function ValidationSummary({ issues }: ValidationSummaryProps) {
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { ERROR: 0, WARNING: 1, INFO: 2 }
    return order[a.severity] - order[b.severity]
  })

  const totalCount = issues.reduce((sum, issue) => sum + issue.count, 0)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-slate-800">검수 오류 TOP 5</CardTitle>
            <CardDescription className="text-slate-500">미해결 검수 이슈 현황</CardDescription>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">{totalCount}건</span>
              <Link
                href="/validation"
                className="flex items-center gap-1 hover:text-slate-800 transition-colors"
              >
                전체보기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedIssues.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
              <AlertCircle className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">검수 오류가 없습니다</p>
            <p className="text-xs text-slate-500 mt-1">
              모든 문항이 정상입니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedIssues.slice(0, 5).map((issue, index) => {
              const config = severityConfig[issue.severity]
              const Icon = config.icon

              return (
                <Link
                  key={issue.ruleCode}
                  href={`/problems?hasError=true`}
                  className="block group"
                >
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${config.style} group-hover:scale-[1.01] group-hover:shadow-sm`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono opacity-50">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <Icon className={`h-4 w-4 ${config.iconStyle}`} />
                      </div>
                      <span className="text-sm font-medium truncate">
                        {issue.message}
                      </span>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${config.countStyle}`}>
                      {issue.count}건
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

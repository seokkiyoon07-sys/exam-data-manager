"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface SubjectProgress {
  subject: string
  total: number
  problemPosted: number
  solutionPosted: number
}

interface ProgressChartProps {
  data: SubjectProgress[]
}

export function ProgressChart({ data }: ProgressChartProps) {
  const totalProblems = data.reduce((sum, item) => sum + item.total, 0)
  const totalPosted = data.reduce((sum, item) => sum + item.solutionPosted, 0)
  const overallProgress = totalProblems > 0 ? Math.round((totalPosted / totalProblems) * 100) : 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-slate-800">과목별 진행률</CardTitle>
            <CardDescription className="text-slate-500">문제 및 해설 게시 현황</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-800">{overallProgress}%</p>
            <p className="text-xs text-slate-500">전체 완료율</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">
              데이터가 없습니다.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              파일을 업로드해주세요.
            </p>
          </div>
        ) : (
          data.map((item) => {
            const problemProgress = item.total > 0
              ? Math.round((item.problemPosted / item.total) * 100)
              : 0
            const solutionProgress = item.total > 0
              ? Math.round((item.solutionPosted / item.total) * 100)
              : 0

            return (
              <div key={item.subject} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-800">{item.subject}</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {item.solutionPosted}/{item.total}
                  </span>
                </div>
                <div className="space-y-2">
                  {/* 문제게시 진행률 */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 w-14">
                      문제
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-300 transition-all duration-500 ease-out"
                        style={{ width: `${problemProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-600 w-10 text-right">
                      {problemProgress}%
                    </span>
                  </div>
                  {/* 해설게시 진행률 */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 w-14">
                      해설
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-500 transition-all duration-500 ease-out"
                        style={{ width: `${solutionProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-600 w-10 text-right">
                      {solutionProgress}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

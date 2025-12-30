import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { FileEdit, FilePlus, Clock } from "lucide-react"
import Link from "next/link"

interface Activity {
  id: string
  worker: string
  action: string
  subject: string
  problemNumber: number
  createdAt: Date
}

interface RecentActivityProps {
  activities: Activity[]
}

function getActionIcon(action: string) {
  switch (action) {
    case "등록":
      return FilePlus
    case "수정":
      return FileEdit
    default:
      return Clock
  }
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-slate-800">최근 작업</CardTitle>
        <CardDescription className="text-slate-500">실시간 작업 현황</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
              <Clock className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">최근 작업 내역이 없습니다</p>
            <p className="text-xs text-slate-500 mt-1">
              작업이 시작되면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

            <div className="space-y-0">
              {activities.map((activity, index) => {
                const Icon = getActionIcon(activity.action)
                const isLast = index === activities.length - 1

                return (
                  <div
                    key={activity.id}
                    className={`relative flex items-start gap-4 pl-8 py-3 ${
                      !isLast ? "border-b border-dashed border-slate-100" : ""
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-2 top-4 w-4 h-4 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-500 text-white flex items-center justify-center text-xs font-bold">
                      {getInitials(activity.worker)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">
                          {activity.worker}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          <Icon className="h-3 w-3" />
                          {activity.action}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        <Link
                          href={`/problems?subject=${encodeURIComponent(activity.subject)}`}
                          className="hover:text-slate-800 hover:underline transition-colors"
                        >
                          {activity.subject}
                        </Link>
                        {" "}
                        <span className="font-mono">{activity.problemNumber}번</span>
                      </p>
                    </div>

                    {/* Time */}
                    <div className="flex-shrink-0 text-xs text-slate-500">
                      {formatDistanceToNow(activity.createdAt, {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

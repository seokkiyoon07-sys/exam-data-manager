"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SubjectFilterProps {
  subjects: string[]
  currentSubject?: string
}

export function SubjectFilter({ subjects, currentSubject }: SubjectFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateSubject = (subject: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (subject) {
      params.set("subject", subject)
    } else {
      params.delete("subject")
    }
    // examCode 필터 제거 (과목 변경 시 시험지 필터 해제)
    params.delete("examCode")
    // page 초기화
    params.delete("page")
    router.push(`/problems?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <div className="flex items-center gap-1.5 text-slate-500 mr-2">
        <BookOpen className="h-4 w-4" />
        <span className="text-sm font-medium">과목</span>
      </div>
      <Button
        variant={!currentSubject ? "default" : "outline"}
        size="sm"
        onClick={() => updateSubject(null)}
        className={cn(
          "h-8 px-3 text-sm whitespace-nowrap",
          !currentSubject && "bg-slate-700 hover:bg-slate-800"
        )}
      >
        전체
      </Button>
      {subjects.map((subject) => (
        <Button
          key={subject}
          variant={currentSubject === subject ? "default" : "outline"}
          size="sm"
          onClick={() => updateSubject(subject)}
          className={cn(
            "h-8 px-3 text-sm whitespace-nowrap",
            currentSubject === subject && "bg-slate-700 hover:bg-slate-800"
          )}
        >
          {subject}
        </Button>
      ))}
    </div>
  )
}

"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Building2, ChevronRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// 주요 과목 그룹
const SUBJECT_GROUPS = [
  { key: "국어", label: "국어" },
  { key: "수학", label: "수학" },
  { key: "영어", label: "영어" },
  { key: "과탐", label: "과탐", subjects: ["물리", "화학", "생명", "지구과학"] },
  { key: "사탐", label: "사탐", subjects: ["경제", "동아시아사", "사회문화", "생활과윤리", "정치와법", "세계사", "세계지리", "한국지리", "윤리와사상"] },
]

// 출제기관 그룹
const ORG_GROUPS = [
  { key: "교육청", label: "교육청" },
  { key: "평가원", label: "평가원" },
  { key: "EBS", label: "EBS" },
  { key: "사설", label: "사설" },
]

// 사설 업체 목록 (강대 = 강남대성 통합)
// key는 problemType에서 검색할 키워드, label은 UI에 표시할 이름
const PRIVATE_ORGS = [
  { key: "더프", label: "더프", searchTerms: ["더프"] },
  { key: "시대인재", label: "시대인재", searchTerms: ["시대인재", "서바"] },
  { key: "강남대성", label: "강남대성", searchTerms: ["강남대성", "강대"] },
  { key: "히든카이스", label: "히든카이스", searchTerms: ["히든카이스"] },
  { key: "양승진", label: "양승진", searchTerms: ["양승진"] },
  { key: "현우진킬링캠프", label: "현우진 킬링캠프", searchTerms: ["현우진", "킬링캠프"] },
  { key: "한석원", label: "한석원(JMT)", searchTerms: ["한석원", "JMT", "jmt"] },
  { key: "이해원", label: "이해원", searchTerms: ["이해원"] },
]

interface HierarchicalFilterProps {
  subjects: string[]
  organizations: string[]
  currentSubject?: string
  currentOrganization?: string
  currentPrivateOrg?: string
}

export function HierarchicalFilter({
  subjects,
  organizations,
  currentSubject,
  currentOrganization,
  currentPrivateOrg,
}: HierarchicalFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 실제 존재하는 출제기관만 필터
  const availableOrgs = ORG_GROUPS.filter(org =>
    organizations.includes(org.key)
  )

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    // 과목 변경 시 하위 필터 초기화
    if (key === "subject") {
      params.delete("organization")
      params.delete("examCode")
    }

    // 출제기관 변경 시 하위 필터 초기화
    if (key === "organization") {
      params.delete("examCode")
    }

    params.delete("page")
    router.push(`/problems?${params.toString()}`)
  }

  // 과목 그룹에서 실제 존재하는 과목만 필터링
  const getAvailableSubjectGroup = (group: typeof SUBJECT_GROUPS[0]) => {
    if (group.subjects) {
      return group.subjects.filter(s => subjects.some(sub => sub.includes(s)))
    }
    return subjects.filter(s => s === group.key || s.includes(group.key))
  }

  return (
    <div className="space-y-3">
      {/* 과목 필터 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="flex items-center gap-1.5 text-slate-500 mr-2 shrink-0">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm font-medium">과목</span>
        </div>
        {SUBJECT_GROUPS.map((group) => {
          const available = getAvailableSubjectGroup(group)
          if (available.length === 0) return null

          const isSelected = group.subjects
            ? group.subjects.some(s => currentSubject?.includes(s))
            : currentSubject === group.key

          return (
            <Button
              key={group.key}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => {
                // 단일 과목이면 바로 선택, 그룹이면 첫 번째 과목 선택
                const targetSubject = group.subjects
                  ? available[0]
                  : group.key
                updateFilter("subject", targetSubject)
              }}
              className={cn(
                "h-8 px-3 text-sm whitespace-nowrap",
                isSelected && "bg-slate-700 hover:bg-slate-800"
              )}
            >
              {group.label}
            </Button>
          )
        })}
      </div>

      {/* 출제기관 필터 - 과목 선택 후에만 표시 */}
      {currentSubject && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <div className="flex items-center gap-1.5 text-slate-500 mr-2 shrink-0">
            <ChevronRight className="h-4 w-4" />
            <Building2 className="h-4 w-4" />
            <span className="text-sm font-medium">출제기관</span>
          </div>
          <Button
            variant={!currentOrganization ? "default" : "outline"}
            size="sm"
            onClick={() => updateFilter("organization", null)}
            className={cn(
              "h-8 px-3 text-sm whitespace-nowrap",
              !currentOrganization && "bg-blue-600 hover:bg-blue-700"
            )}
          >
            전체
          </Button>
          {availableOrgs.map((org) => (
            <Button
              key={org.key}
              variant={currentOrganization === org.key ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("organization", org.key)}
              className={cn(
                "h-8 px-3 text-sm whitespace-nowrap",
                currentOrganization === org.key && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {org.label}
            </Button>
          ))}
        </div>
      )}

      {/* 사설 업체 필터 - 사설 선택 후에만 표시 */}
      {currentSubject && currentOrganization === "사설" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <div className="flex items-center gap-1.5 text-slate-500 mr-2 shrink-0">
            <ChevronRight className="h-4 w-4" />
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">업체</span>
          </div>
          <Button
            variant={!currentPrivateOrg ? "default" : "outline"}
            size="sm"
            onClick={() => updateFilter("privateOrg", null)}
            className={cn(
              "h-8 px-3 text-sm whitespace-nowrap",
              !currentPrivateOrg && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            전체
          </Button>
          {PRIVATE_ORGS.map((org) => (
            <Button
              key={org.key}
              variant={currentPrivateOrg === org.key ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("privateOrg", org.key)}
              className={cn(
                "h-8 px-3 text-sm whitespace-nowrap",
                currentPrivateOrg === org.key && "bg-purple-600 hover:bg-purple-700"
              )}
            >
              {org.label}
            </Button>
          ))}
        </div>
      )}

      {/* 과목 미선택 시 안내 메시지 */}
      {!currentSubject && (
        <div className="text-center py-8 text-slate-500">
          <BookOpen className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">과목을 선택해주세요</p>
          <p className="text-sm mt-1">과목 선택 후 문항 목록이 표시됩니다</p>
        </div>
      )}
    </div>
  )
}

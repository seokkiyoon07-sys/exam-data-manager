"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  Upload,
  AlertTriangle,
  Users,
  Settings,
  LogOut,
  Scissors,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const navigation = [
  {
    name: "대시보드",
    href: "/",
    icon: LayoutDashboard,
    description: "전체 현황",
  },
  {
    name: "문항 관리",
    href: "/problems",
    icon: FileText,
    description: "문항 조회/수정",
  },
  {
    name: "Crop 정산",
    href: "/crop",
    icon: Scissors,
    description: "작업량 및 정산",
  },
  {
    name: "데이터 연동",
    href: "/upload",
    icon: Upload,
    description: "엑셀 및 구글 시트 연동",
  },
  {
    name: "검수 현황",
    href: "/validation",
    icon: AlertTriangle,
    description: "오류 확인",
  },
  {
    name: "작업자 관리",
    href: "/workers",
    icon: Users,
    description: "KPI 현황",
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-800">검수 관리</span>
            <p className="text-xs text-slate-500">Data Labeling QA</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            메뉴
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200",
                    isActive
                      ? "bg-slate-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )} />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                    {!isActive && (
                      <p className="text-xs opacity-60">{item.description}</p>
                    )}
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4 space-y-1">
        <Link href="/settings">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
          >
            <Settings className="h-4 w-4" />
            설정
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  )
}

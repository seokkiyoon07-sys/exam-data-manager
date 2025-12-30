"use client"

import { Bell, Search, Command } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-6">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="검색..."
            className="w-64 pl-9 pr-12 h-9 bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-xs text-slate-400">
            <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-20"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-slate-500 text-[8px] text-white font-bold items-center justify-center">
              3
            </span>
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-500 text-white text-sm font-bold">
                AD
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none text-slate-700">관리자</p>
                <p className="text-xs leading-none text-slate-400">
                  admin@example.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-slate-600">
              프로필
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-slate-600">
              설정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-slate-500">
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

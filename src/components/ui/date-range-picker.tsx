"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format, startOfMonth } from "date-fns"

export function DateRangePicker() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // URL에서 초기값 가져오기 (없으면 이번 달 1일)
    const initialFrom = searchParams.get('from') || format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const initialTo = searchParams.get('to') || format(new Date(), 'yyyy-MM-dd')

    const [from, setFrom] = useState(initialFrom)
    const [to, setTo] = useState(initialTo)

    const handleSearch = () => {
        // URL 업데이트 (서버 컴포넌트 리프레시 유발)
        const params = new URLSearchParams(searchParams)
        params.set('from', from)
        params.set('to', to)
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2">
            <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-auto"
            />
            <span>~</span>
            <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-auto"
            />
            <Button onClick={handleSearch} variant="secondary">조회</Button>
        </div>
    )
}

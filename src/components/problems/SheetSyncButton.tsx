"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function SheetSyncButton() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleSync = async () => {
        setIsLoading(true)
        toast.info("구글 시트 동기화를 시작합니다...", {
            description: "데이터 양에 따라 1~2분 정도 소요될 수 있습니다.",
            duration: 5000,
        })

        try {
            // Manual trigger uses test=true to bypass Cron header check if needed,
            // or we will modify the route to allow manual calls.
            // Calling the API route
            const response = await fetch("/api/cron/sync-sheets?test=true", {
                method: "GET",
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "동기화 중 오류가 발생했습니다.")
            }

            // 결과 요약
            let totalSuccess = 0
            let totalFailed = 0
            let details = ""

            Object.entries(data.results || {}).forEach(([key, sheets]: [string, any]) => {
                if (Array.isArray(sheets)) {
                    sheets.forEach(s => {
                        if (s.success) totalSuccess += s.success
                        if (s.failed) totalFailed += s.failed
                    })
                }
            })

            if (totalSuccess === 0 && totalFailed === 0) {
                toast.info("변경사항이 없습니다.", {
                    description: "모든 데이터가 최신 상태입니다.",
                })
            } else {
                toast.success("동기화 완료!", {
                    description: `성공: ${totalSuccess}건, 실패: ${totalFailed}건 업데이트됨.`,
                })
                router.refresh()
            }

        } catch (error) {
            console.error("Sync failed:", error)
            toast.error("동기화 실패", {
                description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isLoading}
            className="gap-2"
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <RefreshCw className="h-4 w-4" />
            )}
            {isLoading ? "동기화 중..." : "구글 시트 동기화"}
        </Button>
    )
}

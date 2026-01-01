"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function SheetSyncButton() {
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState("")
    const router = useRouter()

    const handleSync = async () => {
        setIsLoading(true)
        setProgress("연결 중...")

        try {
            const response = await fetch("/api/sheets/refresh", {
                method: "GET",
            })

            if (!response.body) {
                throw new Error("스트리밍을 지원하지 않습니다.")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                const lines = buffer.split("\n\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            switch (data.type) {
                                case 'start':
                                case 'progress':
                                    setProgress(data.message)
                                    break
                                case 'complete':
                                    toast.success("캐시 갱신 완료!", {
                                        description: data.message,
                                    })
                                    router.refresh()
                                    break
                                case 'error':
                                    throw new Error(data.message)
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                                throw e
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Sync failed:", error)
            toast.error("동기화 실패", {
                description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
            })
        } finally {
            setIsLoading(false)
            setProgress("")
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
            {isLoading ? (progress || "동기화 중...") : "새로고침"}
        </Button>
    )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, CheckCircle, XCircle } from "lucide-react"

export function GoogleSheetSync({ onSyncComplete }: { onSyncComplete: () => void }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [progressMessage, setProgressMessage] = useState<string>("")

    const handleSync = async () => {
        if (!confirm("모든 구글 시트 데이터를 동기화하시겠습니까?\n이 작업은 시간이 소요될 수 있습니다.")) return

        setIsSyncing(true)
        setResult(null)
        setLogs([])
        setProgressMessage("연결 중...")

        try {
            const response = await fetch("/api/cron/sync-sheets?test=true", {
                method: "GET",
            })

            if (!response.body) throw new Error("ReadableStream not supported")

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            // 스트림 읽기 루프
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                // 줄바꿈으로 메시지 분리 (NDJSON)
                const lines = buffer.split("\n\n")
                buffer = lines.pop() || "" // 마지막 불완전한 조각은 남김

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6)) // "data: " 제거

                            switch (data.type) {
                                case 'start':
                                case 'log':
                                    setLogs(prev => [...prev, data.message])
                                    break
                                case 'progress':
                                    setProgressMessage(data.message)
                                    break
                                case 'complete':
                                    setResult({
                                        success: true,
                                        message: data.message
                                    })
                                    onSyncComplete()
                                    break
                                case 'error':
                                    throw new Error(data.message)
                            }
                        } catch (e) {
                            console.error("Stream parse error:", e)
                        }
                    }
                }
            }

        } catch (error) {
            setResult({
                success: false,
                message: error instanceof Error ? error.message : "알 수 없는 오류"
            })
        } finally {
            setIsSyncing(false)
            setProgressMessage("")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-slate-800">구글 시트 동기화</CardTitle>
                <CardDescription>
                    연동된 구글 스프레드시트에서 최신 데이터를 가져옵니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-slate-50">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <RefreshCw className={`h-8 w-8 text-green-600 ${isSyncing ? "animate-spin" : ""}`} />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">데이터 동기화</h3>

                    {isSyncing ? (
                        <div className="w-full max-w-sm space-y-2 text-center">
                            <p className="text-sm font-medium text-slate-700 animate-pulse">
                                {progressMessage || "동기화 진행 중..."}
                            </p>
                            {/* 로그 뷰어 */}
                            <div className="h-48 w-full bg-slate-900 rounded p-3 text-left overflow-y-auto font-mono text-xs shadow-inner custom-scrollbar">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-green-400 border-l-2 border-green-700 pl-2 mb-1 opacity-90 break-all whitespace-pre-wrap">
                                        {log}
                                        {i === logs.length - 1 && <span className="animate-pulse">_</span>}
                                    </div>
                                ))}
                                <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
                            마지막 동기화 이후 변경된 내용을 업데이트합니다.<br />
                            (새로운 문제 추가, 수정된 내용 반영)
                        </p>
                    )}

                    {!isSyncing && (
                        <Button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="w-full max-w-xs h-11 bg-green-600 hover:bg-green-700 text-white gap-2 mt-4"
                        >
                            <RefreshCw className="h-4 w-4" />
                            지금 동기화 시작
                        </Button>
                    )}
                </div>

                {result && (
                    <div className={`p-4 rounded-lg flex items-center gap-3 ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                        {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        <p className="font-medium text-sm">{result.message}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

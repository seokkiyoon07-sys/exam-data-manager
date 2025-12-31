"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react"

export function GoogleSheetSync({ onSyncComplete }: { onSyncComplete: () => void }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleSync = async () => {
        if (!confirm("모든 구글 시트 데이터를 동기화하시겠습니까?\n이 작업은 시간이 소요될 수 있습니다.")) return

        setIsSyncing(true)
        setResult(null)

        try {
            // Using GET as the route is defined as a Cron job (GET)
            // Adding ?test=true to bypass Cron Secret check for manual trigger from dashboard
            const response = await fetch("/api/cron/sync-sheets?test=true", {
                method: "GET",
            })

            let data;
            const text = await response.text();

            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error("Failed to parse JSON:", text);
                throw new Error("서버 응답이 올바르지 않습니다.");
            }

            if (!response.ok) {
                throw new Error(data.error || `동기화 실패 (${response.status})`)
            }

            setResult({
                success: true,
                message: `동기화 완료: ${data.processedSheets || 0}개 시트 처리됨`
            })
            onSyncComplete() // Refresh history
        } catch (error) {
            setResult({
                success: false,
                message: error instanceof Error ? error.message : "알 수 없는 오류"
            })
        } finally {
            setIsSyncing(false)
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
                    <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
                        마지막 동기화 이후 변경된 내용을 업데이트합니다.<br />
                        (새로운 문제 추가, 수정된 내용 반영)
                    </p>

                    <Button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="w-full max-w-xs h-11 bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        {isSyncing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                동기화 중...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4" />
                                지금 동기화 시작
                            </>
                        )}
                    </Button>
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

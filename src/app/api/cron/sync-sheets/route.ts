
import { NextRequest, NextResponse } from "next/server"
import { SHEET_SYNC_CONFIG } from "@/config/sheet-sync-config"
import { fetchSpreadsheetData, parseRow } from "@/lib/google-sheets"
import { processProblemBatch } from "@/lib/ingestion-service"
import { ParsedProblem } from "@/lib/file-parser"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic' // 정적 최적화 방지
export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder()
    const { searchParams } = new URL(request.url)
    const isTest = searchParams.get('test') === 'true'

    // Cron Secret 검증 (테스트 모드인 경우 건너뜀)
    if (!isTest) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response("Unauthorized", { status: 401 })
        }
    }

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, any>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            }

            const results: Record<string, any> = {}
            let totalProcessed = 0
            let totalSuccess = 0
            let totalFailed = 0
            let totalSkipped = 0
            const details: string[] = []
            const summaryParts: string[] = []

            try {
                send({ type: 'start', message: '동기화 시작...' })

                for (const [key, config] of Object.entries(SHEET_SYNC_CONFIG)) {
                    send({ type: 'log', message: `[${config.label}] 시트 데이터 가져오는 중...` })

                    try {
                        const sheets = await fetchSpreadsheetData(config.spreadsheetId)
                        results[key] = []

                        send({ type: 'log', message: `[${config.label}] 데이터 파싱 및 저장 시작 (${sheets.length}개 탭)` })

                        for (const sheet of sheets) {
                            // 필터링
                            if (config.includeTabs && !config.includeTabs.includes(sheet.title)) continue
                            if (config.excludeTabs && config.excludeTabs.includes(sheet.title)) continue

                            // 탭 이름 매핑 로직
                            const SUBJECT_MAPPING: Record<string, string> = {
                                "Physics_labeling": "과탐 - 물리",
                                "EAS_Labeling1": "과탐 - 지구과학"
                            }
                            const forceSubject = SUBJECT_MAPPING[sheet.title];
                            const displayTabName = forceSubject || sheet.title

                            send({ type: 'progress', message: `[${config.label}] ${displayTabName} 처리 중...` })

                            const header = sheet.values[0]
                            const dataRows = sheet.values.slice(1)

                            // Row Array -> Object 변환
                            const rowObjects = dataRows.map((rowArr) => {
                                const obj: Record<string, string> = {}
                                header.forEach((colName, idx) => {
                                    if (colName) {
                                        obj[colName] = rowArr[idx] || ""
                                    }
                                })

                                if (forceSubject) {
                                    obj["과목"] = forceSubject
                                } else if (!obj["과목"]) {
                                    obj["과목"] = displayTabName
                                }
                                return obj
                            })

                            // 파싱
                            const parsedBatch: ParsedProblem[] = []
                            const parseErrors: string[] = []

                            rowObjects.forEach((row, idx) => {
                                try {
                                    const parsed = parseRow(row, idx + 2) // 1-based header + 1
                                    if (parsed) parsedBatch.push(parsed)
                                } catch (e) {
                                    parseErrors.push(`Row ${idx + 2}: ${e instanceof Error ? e.message : "Unknown error"}`)
                                }
                            })

                            // DB 저장 (Ingestion Service 재사용)
                            const batchResult = await processProblemBatch(parsedBatch)

                            const sheetResult = {
                                tab: sheet.title,
                                status: 'success',
                                total: dataRows.length,
                                totalRows: parsedBatch.length, // 파싱 성공 수 (실제 처리 대상)
                                success: batchResult.successCount,
                                skipped: batchResult.skippedCount,
                                failed: batchResult.failedCount + parseErrors.length,
                                error: parseErrors.length > 0 ? `${parseErrors.length} parsing errors` : null
                            }
                            results[key].push(sheetResult)

                            // 통계 누적
                            totalProcessed += sheetResult.totalRows
                            totalSuccess += sheetResult.success
                            totalSkipped += sheetResult.skipped
                            totalFailed += sheetResult.failed

                            // 요약 메시지 생성 (매핑된 이름 사용)
                            let sheetSummary = `${displayTabName}: 성공 ${sheetResult.success}`
                            if (sheetResult.skipped > 0) {
                                sheetSummary += `, 건너뜀 ${sheetResult.skipped}`
                            }
                            if (sheetResult.failed > 0) {
                                sheetSummary += `, 실패 ${sheetResult.failed}`
                            }
                            summaryParts.push(sheetSummary)

                            send({
                                type: 'log',
                                message: `  - ${displayTabName}: 성공 ${sheetResult.success}, 건너뜀 ${sheetResult.skipped}, 실패 ${sheetResult.failed}`
                            })
                        }
                    } catch (sheetError) {
                        const errorMsg = `${key} 처리 중 오류: ${sheetError instanceof Error ? sheetError.message : "Unknown"}`
                        details.push(errorMsg)
                        summaryParts.push(errorMsg)
                        send({ type: 'error', message: errorMsg })
                        results[key] = { error: errorMsg }
                    }
                }

                // DB 히스토리 저장
                send({ type: 'log', message: '히스토리 저장 중...' })

                try {
                    let detailMessage = summaryParts.join(", ")
                    if (detailMessage.length > 190) {
                        detailMessage = detailMessage.slice(0, 187) + "..."
                    }

                    await prisma.uploadHistory.create({
                        data: {
                            fileName: `Google Sheet Sync (${new Date().toLocaleDateString()})`,
                            fileSize: 0,
                            totalRows: totalProcessed,
                            successRows: totalSuccess,
                            failedRows: totalFailed,
                            // 실패가 0건이면 COMPLETED (건너뜀은 실패가 아님)
                            status: totalFailed > 0 ? "FAILED" : "COMPLETED",
                            errorMessage: detailMessage || null,
                            uploadedBy: "SYSTEM",
                            type: "GOOGLE_SHEET",
                            completedAt: new Date()
                        } as any
                    })
                } catch (dbErr) {
                    console.error("Failed to save history:", dbErr)
                    send({ type: 'error', message: '히스토리 저장 실패' })
                }

                send({
                    type: 'complete',
                    processedSheets: totalProcessed, // 호환성 유지
                    message: `동기화 완료: 성공 ${totalSuccess}, 건너뜀 ${totalSkipped}, 실패 ${totalFailed}`
                })
                controller.close()

            } catch (globalError) {
                console.error("[Sync] Global Error:", globalError)
                send({ type: 'error', message: globalError instanceof Error ? globalError.message : "알 수 없는 오류 발생" })
                controller.close()
            }
        }
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    })
}

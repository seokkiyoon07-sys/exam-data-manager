import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSheetNames, getSheetValues } from "@/lib/google-sheets"
import { parseProblemRow } from "@/lib/file-parser"
import { processProblemBatch } from "@/lib/ingestion-service"
import { SHEET_SYNC_CONFIG, SYNC_BATCH_SIZE, SYNC_CONCURRENCY } from "@/config/sheet-sync-config"

// 최대 실행 시간 (Vercel Hobby 10s, Pro 60s / Edge Functions)
// 이 함수는 긴 작업이 될 수 있으므로 Cron 트리거를 권장
export const maxDuration = 60 // 60초 (Pro Plan 기준, 필요시 조정)

export async function GET(request: NextRequest) {
    // 간단한 보안: Cron Secret 헤더 확인 (Vercel Cron)
    // 로컬 테스트를 위해 'test' 쿼리 파라미터 허용
    const authHeader = request.headers.get("Authorization")
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
    const isTest = request.nextUrl.searchParams.get("test") === "true"

    if (!isCron && !isTest && process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const results: Record<string, any> = {}

    try {
        for (const [key, config] of Object.entries(SHEET_SYNC_CONFIG)) {
            const sheetResults: any[] = []

            // 1. 가져올 탭 목록 결정
            let targetTabs: string[] = []
            if ('sheets' in config && config.sheets && config.sheets.length > 0) {
                targetTabs = [...config.sheets]
            } else {
                // 설정된 탭이 없으면 모든 탭 가져오기
                try {
                    targetTabs = await getSheetNames(config.spreadsheetId)
                } catch (e) {
                    console.error(`[Sync] Failed to fetch tab names for ${key}:`, e)
                    results[key] = { error: "Failed to fetch tabs" }
                    continue
                }
            }

            console.log(`[Sync] Processing ${config.label} (${key}): ${targetTabs.length} tabs found.`)

            // 2. 각 탭 처리 (순차 처리하여 리소스 부하 관리)
            for (const tabName of targetTabs) {
                try {
                    // 데이터 가져오기
                    const rows = await getSheetValues(config.spreadsheetId, tabName)

                    if (rows.length < 2) {
                        sheetResults.push({ tab: tabName, status: "skipped", reason: "No data rows" })
                        continue
                    }

                    // 헤더 매핑
                    const header = rows[0]
                    const dataRows = rows.slice(1)

                    // Row Array -> Object 변환
                    const rowObjects = dataRows.map((rowArr) => {
                        const obj: Record<string, string> = {}
                        header.forEach((colName, idx) => {
                            if (colName) {
                                // 구글 시트는 빈 셀을 undefined/null로 줄 수 있음
                                obj[colName] = rowArr[idx] || ""
                            }
                        })
                        // 과목이 비어있으면 탭 이름으로 fallback (+ 매핑 적용)
                        if (!obj["과목"]) {
                            const SUBJECT_MAPPING: Record<string, string> = {
                                "Physics_labeling": "과탐 - 물리",
                                "EAS_Labeling1": "과탐 - 지구과학"
                            }
                            obj["과목"] = SUBJECT_MAPPING[tabName] || tabName
                        }
                        return obj
                    })

                    // 파싱
                    const parsedBatch = []
                    const parseErrors = []

                    for (let i = 0; i < rowObjects.length; i++) {
                        try {
                            const parsed = parseProblemRow(rowObjects[i], i + 2)
                            parsedBatch.push(parsed)
                        } catch (e) {
                            // 파싱 에러는 무시하고 진행하거나 모아서 리포트
                            // 필수 필드(Index) 누락인 경우 여기서 걸러짐
                        }
                    }

                    // DB 저장 (배치 처리)
                    // ingestion-service의 processProblemBatch는 한 번에 처리하므로
                    // 여기서 다시 500개씩나눌 필요가 있음 (이미 ingestion-service는 통째로 받음 -> 아니 통째로 받아서 내부에서 나눌 필요는 없고
                    // ingestion-service는 그냥 받으면 처리함. 단, 너무 크면 안됨.
                    // 여기서 SYNC_BATCH_SIZE 단위로 잘라서 보냄

                    let totalSuccess = 0
                    let totalFailed = 0
                    let totalSkipped = 0

                    for (let i = 0; i < parsedBatch.length; i += SYNC_BATCH_SIZE) {
                        const chunk = parsedBatch.slice(i, i + SYNC_BATCH_SIZE);
                        const result = await processProblemBatch(chunk);
                        totalSuccess += result.successCount
                        totalFailed += result.failedCount
                        totalSkipped += result.skippedCount
                    }

                    sheetResults.push({
                        tab: tabName,
                        status: "success",
                        totalRows: dataRows.length,
                        parsed: parsedBatch.length,
                        success: totalSuccess,
                        skipped: totalSkipped,
                        failed: totalFailed
                    })

                } catch (e) {
                    console.error(`[Sync] Error processing tab ${tabName} in ${key}:`, e)
                    sheetResults.push({ tab: tabName, status: "error", error: e instanceof Error ? e.message : "Unknown error" })
                }
            }

            results[key] = sheetResults
        }

        // 전체 결과 요약 및 히스토리 저장
        let totalProcessed = 0
        let totalSuccess = 0
        let totalFailed = 0
        const details = []

        for (const [key, sheets] of Object.entries(results)) {
            if (Array.isArray(sheets)) {
                for (const sheet of sheets) {
                    if (sheet.status === 'success') {
                        totalProcessed += sheet.totalRows
                        totalSuccess += sheet.success
                        totalFailed += sheet.failed // failed during parsing/ingestion logic
                    } else {
                        // Sheet fetch failed entirely
                        details.push(`${key}/${sheet.tab}: ${sheet.error || sheet.status}`)
                    }
                }
            } else if (sheets.error) {
                details.push(`${key}: ${sheets.error}`)
            }
        }

        // DB에 히스토리 저장
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await prisma.uploadHistory.create({
                data: {
                    fileName: `Google Sheet Sync (${new Date().toLocaleDateString()})`,
                    fileSize: 0, // Not applicable
                    totalRows: totalProcessed,
                    successRows: totalSuccess,
                    failedRows: totalFailed,
                    status: details.length > 0 ? "FAILED" : "COMPLETED",
                    errorMessage: details.length > 0 ? details.join(", ").slice(0, 190) : null,
                    uploadedBy: "SYSTEM",
                    type: "GOOGLE_SHEET",
                    completedAt: new Date()
                } as any
            })
        } catch (dbErr) {
            console.error("Failed to log upload history:", dbErr)
        }

        return NextResponse.json({ success: true, results, processedSheets: Object.values(results).flat().length })

    } catch (globalError) {
        console.error("[Sync] Global Error:", globalError)
        return NextResponse.json({ success: false, error: globalError }, { status: 500 })
    }
}

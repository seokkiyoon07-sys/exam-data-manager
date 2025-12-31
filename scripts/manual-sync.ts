import { getSheetNames, getSheetValues } from "../src/lib/google-sheets"
import { parseProblemRow } from "../src/lib/file-parser"
import { processProblemBatch } from "../src/lib/ingestion-service"
import { SHEET_SYNC_CONFIG } from "../src/config/sheet-sync-config"

const SYNC_BATCH_SIZE = 50;

async function run() {
    console.log("🚀 Starting Manual Google Sheets Sync...")
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
                    console.log(`[${key}] Fetching tab list...`)
                    targetTabs = await getSheetNames(config.spreadsheetId)
                } catch (e) {
                    console.error(`[Sync] Failed to fetch tab names for ${key}:`, e)
                    results[key] = { error: "Failed to fetch tabs" }
                    continue
                }
            }

            console.log(`[Sync] Processing ${config.label} (${key}): ${targetTabs.length} tabs found.`)

            // 2. 각 탭 처리
            for (const tabName of targetTabs) {
                try {
                    console.log(`  - Processing tab: ${tabName}`)

                    // 데이터 가져오기
                    const rows = await getSheetValues(config.spreadsheetId, tabName)

                    if (rows.length < 2) {
                        console.log(`    ⚠️ Skipped (No data)`)
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
                                obj[colName] = rowArr[idx] || ""
                            }
                        })
                        if (!obj["과목"]) {
                            obj["과목"] = tabName
                        }
                        return obj
                    })

                    // 파싱
                    const parsedBatch = []
                    for (let i = 0; i < rowObjects.length; i++) {
                        try {
                            const parsed = parseProblemRow(rowObjects[i], i + 2)
                            parsedBatch.push(parsed)
                        } catch (e) {
                            // Ignore individual parse errors
                        }
                    }

                    console.log(`    Parsed: ${parsedBatch.length} items. Syncing to DB...`)

                    // DB 저장 (배치 처리)
                    let totalSuccess = 0
                    let totalFailed = 0
                    let totalSkipped = 0

                    for (let i = 0; i < parsedBatch.length; i += SYNC_BATCH_SIZE) {
                        const chunk = parsedBatch.slice(i, i + SYNC_BATCH_SIZE);
                        const result = await processProblemBatch(chunk);
                        totalSuccess += result.successCount
                        totalFailed += result.failedCount
                        totalSkipped += result.skippedCount
                        process.stdout.write(".")
                    }

                    console.log(`\n    ✅ Done: Success=${totalSuccess}, Skipped=${totalSkipped}, Failed=${totalFailed}`)

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

        console.log("\n=== Final Summary ===")
        console.log(JSON.stringify(results, null, 2))

    } catch (globalError) {
        console.error("[Sync] Global Error:", globalError)
    }
}

run()

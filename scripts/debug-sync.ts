
import "dotenv/config";
import { fetchSpreadsheetData, parseRow } from "../src/lib/google-sheets";
import { SHEET_SYNC_CONFIG } from "../src/config/sheet-sync-config";

async function runDebug() {
    console.log("Starting Debug...");

    try {
        // 공교육 시트만 테스트
        const config = SHEET_SYNC_CONFIG.public;
        console.log(`Fetching data from: ${config.spreadsheetId}`);

        const sheets = await fetchSpreadsheetData(config.spreadsheetId);
        console.log(`Fetched ${sheets.length} sheets.`);

        for (const sheet of sheets) {
            console.log(`\n---------------------------------------------------`);
            console.log(`Sheet: ${sheet.title}`);
            console.log(`Total Rows: ${sheet.values.length}`);

            if (sheet.values.length === 0) {
                console.log("Empty sheet.");
                continue;
            }

            const header = sheet.values[0];
            console.log("Header:", header);

            const firstRowIdx = 1;
            const rowData = sheet.values[firstRowIdx];
            if (!rowData) {
                console.log("No data row.");
                continue;
            }

            console.log("First Row Raw:", rowData);

            // Row Object 변환 시뮬레이션
            const obj: Record<string, string> = {};
            header.forEach((colName, idx) => {
                if (colName) {
                    obj[colName] = rowData[idx] || "";
                }
            });

            // 매핑 적용
            const SUBJECT_MAPPING: Record<string, string> = {
                "Physics_labeling": "과탐 - 물리",
                "EAS_Labeling1": "과탐 - 지구과학"
            }
            if (!obj["과목"]) {
                obj["과목"] = SUBJECT_MAPPING[sheet.title] || sheet.title
            }


            console.log("Mapped Object:", obj);

            try {
                const parsed = parseRow(obj, 2);
                if (parsed) {
                    console.log("✅ Parsed Successfully:", parsed);
                } else {
                    console.log("❌ Parsed Result is NULL (Invalid Data)");
                }
            } catch (e) {
                console.log("❌ Parse Error:", e);
            }
        }

    } catch (e) {
        console.error("Global Error:", e);
    }
}

runDebug();

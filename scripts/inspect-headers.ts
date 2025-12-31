import { getSheetValues } from "../src/lib/google-sheets"
import { SHEET_SYNC_CONFIG } from "../src/config/sheet-sync-config"
import fs from "fs"
import path from "path"

// Load .env manually
const envPath = path.resolve(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8")
    envConfig.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split("=")
        if (key && valueParts.length > 0) {
            let value = valueParts.join("=").trim()
            // Remove quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
            }
            // Handle newlines in private key
            if (key.trim() === "GOOGLE_PRIVATE_KEY") {
                value = value.replace(/\\n/g, "\n")
            }
            process.env[key.trim()] = value
        }
    })
}

async function run() {
    const config = SHEET_SYNC_CONFIG["private"]
    const tabName = "IDX_KorPrivQ"

    console.log(`Inspecting headers for ${config.label} - ${tabName}...`)
    try {
        const rows = await getSheetValues(config.spreadsheetId, tabName)
        if (rows.length > 0) {
            console.log("Headers:", JSON.stringify(rows[0], null, 2))
        } else {
            console.log("No rows found.")
        }
    } catch (e) {
        console.error("Error:", e)
    }
}

run()

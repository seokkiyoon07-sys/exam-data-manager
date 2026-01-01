import { NextRequest, NextResponse } from "next/server";
import { getSheetNames } from "@/lib/google-sheets";

export async function GET(request: NextRequest) {
    const spreadsheetId = request.nextUrl.searchParams.get("id");

    if (!spreadsheetId) {
        return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    try {
        const sheetNames = await getSheetNames(spreadsheetId);
        return NextResponse.json({
            spreadsheetId,
            sheets: sheetNames,
            count: sheetNames.length,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}

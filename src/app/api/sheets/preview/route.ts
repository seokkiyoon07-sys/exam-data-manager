import { NextRequest, NextResponse } from "next/server";
import { getSheetValues } from "@/lib/google-sheets";

export async function GET(request: NextRequest) {
    const spreadsheetId = request.nextUrl.searchParams.get("id");
    const sheetName = request.nextUrl.searchParams.get("sheet");
    const rows = parseInt(request.nextUrl.searchParams.get("rows") || "5");

    if (!spreadsheetId || !sheetName) {
        return NextResponse.json({ error: "id and sheet parameters required" }, { status: 400 });
    }

    try {
        const values = await getSheetValues(spreadsheetId, `${sheetName}!A1:Z${rows}`);
        return NextResponse.json({
            spreadsheetId,
            sheetName,
            header: values[0] || [],
            rows: values.slice(1),
            totalRows: values.length,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}

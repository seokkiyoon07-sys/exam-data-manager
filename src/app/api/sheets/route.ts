import { NextRequest, NextResponse } from "next/server";
import {
    getProblemsFromCache,
    getFilterOptionsFromCache,
    getStatsFromCache,
    getExamGroupsFromCache,
    getCacheStatus,
    ensureCacheReady,
} from "@/lib/sheet-cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/sheets
 *
 * Query params:
 * - type: 'problems' | 'filters' | 'stats' | 'exams' | 'status'
 * - subject, examYear, organization, examCode, worker, status, search
 * - page, limit, sortBy, sortOrder
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "problems";

    // 캐시 준비 확인
    const cacheReady = await ensureCacheReady();
    if (!cacheReady) {
        const status = getCacheStatus();
        if (status.isLoading) {
            return NextResponse.json(
                { error: "캐시 로딩 중입니다. 잠시 후 다시 시도해주세요." },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: status.error || "캐시 초기화 실패" },
            { status: 500 }
        );
    }

    switch (type) {
        case "problems": {
            const result = getProblemsFromCache({
                subject: searchParams.get("subject") || undefined,
                examYear: searchParams.get("examYear") || undefined,
                organization: searchParams.get("organization") || undefined,
                examCode: searchParams.get("examCode") || undefined,
                worker: searchParams.get("worker") || undefined,
                status: searchParams.get("status") || undefined,
                search: searchParams.get("search") || undefined,
                page: parseInt(searchParams.get("page") || "1"),
                limit: parseInt(searchParams.get("limit") || "20"),
                sortBy: searchParams.get("sortBy") || undefined,
                sortOrder: (searchParams.get("sortOrder") as 'asc' | 'desc') || undefined,
            });
            return NextResponse.json(result);
        }

        case "filters": {
            const filters = getFilterOptionsFromCache();
            return NextResponse.json(filters);
        }

        case "stats": {
            const stats = getStatsFromCache();
            return NextResponse.json(stats);
        }

        case "exams": {
            const exams = getExamGroupsFromCache({
                subject: searchParams.get("subject") || undefined,
                examYear: searchParams.get("examYear") || undefined,
                organization: searchParams.get("organization") || undefined,
            });
            return NextResponse.json({ exams, total: exams.length });
        }

        case "status": {
            const status = getCacheStatus();
            return NextResponse.json(status);
        }

        default:
            return NextResponse.json(
                { error: "Invalid type parameter" },
                { status: 400 }
            );
    }
}

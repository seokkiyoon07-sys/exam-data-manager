import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
    try {
        // 모든 문제 삭제
        const deleted = await prisma.problem.deleteMany({});

        return NextResponse.json({
            success: true,
            deleted: deleted.count,
            message: `${deleted.count}개 문제가 삭제되었습니다.`,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const problemCount = await prisma.problem.count();
        const sampleProblems = await prisma.problem.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                subject: true,
                index: true,
                examCode: true,
                problemPosted: true,
                solutionPosted: true,
            }
        });

        return NextResponse.json({
            success: true,
            count: problemCount,
            sample: sampleProblems,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}

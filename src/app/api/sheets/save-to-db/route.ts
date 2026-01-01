import { NextResponse } from "next/server";
import { saveCacheToDb, getCacheStatus, refreshCache } from "@/lib/sheet-cache";

export async function POST() {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            // 캐시 준비 확인
            let status = getCacheStatus();

            if (!status.isReady) {
                send({ type: "progress", message: "캐시가 비어있습니다. Google Sheets에서 데이터를 가져오는 중..." });

                const result = await refreshCache((msg) => {
                    send({ type: "progress", message: msg });
                });

                if (!result.success) {
                    send({ type: "error", message: `캐시 로드 실패: ${result.message}` });
                    controller.close();
                    return;
                }

                status = getCacheStatus();
            }

            if (!status.isReady) {
                send({ type: "error", message: "캐시가 준비되지 않았습니다." });
                controller.close();
                return;
            }

            send({ type: "start", message: `DB 저장 시작... (${status.totalProblems}개)` });

            try {
                const result = await saveCacheToDb((message) => {
                    send({ type: "progress", message });
                });

                if (result.success) {
                    send({ type: "complete", message: result.message, saved: result.saved, failed: result.failed });
                } else {
                    send({ type: "error", message: result.message, saved: result.saved, failed: result.failed });
                }
            } catch (error) {
                send({ type: "error", message: error instanceof Error ? error.message : "알 수 없는 오류" });
            }

            controller.close();
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

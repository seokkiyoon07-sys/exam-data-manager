import { NextRequest } from "next/server";
import { refreshCache, getCacheStatus } from "@/lib/sheet-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분 타임아웃

/**
 * GET /api/sheets/refresh
 *
 * 캐시를 수동으로 갱신합니다.
 * SSE (Server-Sent Events)로 진행 상황을 스트리밍합니다.
 */
export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, any>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            // 이미 로딩 중인지 확인
            const status = getCacheStatus();
            if (status.isLoading) {
                send({ type: "error", message: "이미 갱신 중입니다." });
                controller.close();
                return;
            }

            send({ type: "start", message: "캐시 갱신 시작..." });

            const result = await refreshCache((message) => {
                send({ type: "progress", message });
            });

            if (result.success) {
                send({
                    type: "complete",
                    message: result.message,
                    count: result.count,
                });
            } else {
                send({
                    type: "error",
                    message: result.message,
                });
            }

            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

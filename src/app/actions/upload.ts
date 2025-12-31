'use server'

import { prisma } from "@/lib/db"

export interface UploadHistoryItem {
    id: string
    fileName: string
    fileSize: number
    totalRows: number
    successRows: number
    failedRows: number
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
    errorMessage: string | null
    createdAt: Date
    completedAt: Date | null
    uploadedBy: string
    type: 'FILE' | 'GOOGLE_SHEET'
}

export async function getRecentUploads(limit = 10): Promise<UploadHistoryItem[]> {
    try {
        const history = await prisma.uploadHistory.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return history.map(item => ({
            ...item,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: (item as any).type as 'FILE' | 'GOOGLE_SHEET'
        }))
    } catch (error) {
        console.error("Failed to fetch upload history:", error)
        return []
    }
}

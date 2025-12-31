'use server'

import { prisma } from "@/lib/db"
import { startOfDay, endOfDay, format } from "date-fns"

export interface WorkerStat {
    workerName: string
    problemCount: number
    solutionCount: number
    totalCount: number
    estimatedPay: number
}

export interface DailyStat {
    date: string
    workerName: string
    count: number
}

// 작업자 통계 조회 (기간별)
export async function getWorkerStats(startDate: Date, endDate: Date) {
    const start = startOfDay(startDate)
    const end = endOfDay(endDate)

    // 단가표 조회 (Map으로 변환)
    const rates = await prisma.cropRate.findMany()
    const rateMap = new Map<string, number>()
    rates.forEach(r => rateMap.set(r.subject, r.price))
    const defaultRate = 100 // 기본 단가 (예비용)

    // 1. 문제 게시 작업 집계
    const problemStats = await prisma.problem.groupBy({
        by: ['problemWorker', 'subject'],
        where: {
            problemPosted: true,
            problemWorkDate: { gte: start, lte: end },
            problemWorker: { not: null }
        },
        _count: { id: true }
    })

    // 2. 해설 게시 작업 집계
    const solutionStats = await prisma.problem.groupBy({
        by: ['solutionWorker', 'subject'],
        where: {
            solutionPosted: true,
            solutionWorkDate: { gte: start, lte: end },
            solutionWorker: { not: null }
        },
        _count: { id: true }
    })

    // 3. 데이터 병합 & 정산 계산
    const workerMap = new Map<string, WorkerStat>()

    // 문제 작업 처리
    for (const stat of problemStats) {
        if (!stat.problemWorker) continue
        const worker = stat.problemWorker
        const count = stat._count.id
        const price = rateMap.get(stat.subject) || defaultRate

        const current = workerMap.get(worker) || {
            workerName: worker,
            problemCount: 0,
            solutionCount: 0,
            totalCount: 0,
            estimatedPay: 0
        }

        current.problemCount += count
        current.totalCount += count
        current.estimatedPay += count * price
        workerMap.set(worker, current)
    }

    // 해설 작업 처리
    for (const stat of solutionStats) {
        if (!stat.solutionWorker) continue
        const worker = stat.solutionWorker
        const count = stat._count.id
        const price = rateMap.get(stat.subject) || defaultRate

        const current = workerMap.get(worker) || {
            workerName: worker,
            problemCount: 0,
            solutionCount: 0,
            totalCount: 0,
            estimatedPay: 0
        }

        current.solutionCount += count
        current.totalCount += count
        current.estimatedPay += count * price
        workerMap.set(worker, current)
    }

    return Array.from(workerMap.values()).sort((a, b) => b.estimatedPay - a.estimatedPay)
}

// 일별 생산성 조회 (차트용 + 과목별)
export async function getDailyProductivity(startDate: Date, endDate: Date) {
    const start = startOfDay(startDate)
    const end = endOfDay(endDate)

    // 문제 작업 일별 집계
    const problemDaily = await prisma.problem.groupBy({
        by: ['problemWorkDate', 'problemWorker', 'subject'],
        where: {
            problemPosted: true,
            problemWorkDate: { gte: start, lte: end },
            problemWorker: { not: null }
        },
        _count: { id: true }
    })

    // 해설 작업 일별 집계
    const solutionDaily = await prisma.problem.groupBy({
        by: ['solutionWorkDate', 'solutionWorker', 'subject'],
        where: {
            solutionPosted: true,
            solutionWorkDate: { gte: start, lte: end },
            solutionWorker: { not: null }
        },
        _count: { id: true }
    })

    // 데이터 병합
    const stats: (DailyStat & { subject: string })[] = []

    // 날짜 포맷팅 헬퍼
    const fmt = (d: Date | null) => d ? format(d, 'yyyy-MM-dd') : 'Unknown'

    problemDaily.forEach(p => {
        if (p.problemWorker) {
            stats.push({
                date: fmt(p.problemWorkDate),
                workerName: p.problemWorker,
                subject: p.subject, // 과목 추가
                count: p._count.id
            })
        }
    })

    solutionDaily.forEach(s => {
        if (s.solutionWorker) {
            stats.push({
                date: fmt(s.solutionWorkDate),
                workerName: s.solutionWorker,
                subject: s.subject, // 과목 추가
                count: s._count.id
            })
        }
    })

    // 같은 날짜+작업자+과목 합치기
    const mergedMap = new Map<string, DailyStat & { subject: string }>()
    stats.forEach(s => {
        const key = `${s.date}-${s.workerName}-${s.subject}`
        const existing = mergedMap.get(key)
        if (existing) {
            existing.count += s.count
        } else {
            mergedMap.set(key, { ...s })
        }
    })

    return Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// 단가표 관리
export async function getCropRates() {
    return prisma.cropRate.findMany({
        orderBy: { subject: 'asc' }
    })
}

export async function updateCropRate(subject: string, price: number) {
    // upsert: 없으면 생성, 있으면 업데이트
    return prisma.cropRate.upsert({
        where: { subject },
        update: { price },
        create: { subject, price }
    })
}

'use server'

import { getStatsFromCache, ensureCacheReady } from "@/lib/sheet-cache"

export interface CategoryStat {
    problemCount: number
    solutionCount: number
    total: number
}

export interface WorkerStat {
    workerName: string
    problemCount: number
    solutionCount: number
    totalCount: number
    estimatedPay: number
    // 4개 카테고리별 통계
    byCategory: {
        국어: CategoryStat
        수학: CategoryStat
        영어: CategoryStat
        탐구: CategoryStat
    }
}

export interface DailyStat {
    date: string
    workerName: string
    count: number
}

// 기본 단가 설정 (DB 대신 하드코딩 - 필요시 설정 파일로 분리)
const CROP_RATES: Record<string, number> = {
    "국어": 100,
    "수학": 120,
    "영어": 100,
    "과탐 - 물리": 150,
    "과탐 - 화학": 150,
    "과탐 - 생명과학": 150,
    "과탐 - 지구과학": 150,
}
const DEFAULT_RATE = 100

// 작업자 통계 조회 (기간별) - 캐시 기반
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getWorkerStats(_startDate: Date, _endDate: Date): Promise<WorkerStat[]> {
    await ensureCacheReady()
    const stats = getStatsFromCache()

    // byWorker에서 통계 추출
    const result: WorkerStat[] = Object.entries(stats.byWorker).map(([workerName, data]) => {
        const avgRate = DEFAULT_RATE

        // 각 카테고리의 total 계산
        const byCategory = {
            국어: {
                problemCount: data.byCategory.국어.problemCount,
                solutionCount: data.byCategory.국어.solutionCount,
                total: data.byCategory.국어.problemCount + data.byCategory.국어.solutionCount,
            },
            수학: {
                problemCount: data.byCategory.수학.problemCount,
                solutionCount: data.byCategory.수학.solutionCount,
                total: data.byCategory.수학.problemCount + data.byCategory.수학.solutionCount,
            },
            영어: {
                problemCount: data.byCategory.영어.problemCount,
                solutionCount: data.byCategory.영어.solutionCount,
                total: data.byCategory.영어.problemCount + data.byCategory.영어.solutionCount,
            },
            탐구: {
                problemCount: data.byCategory.탐구.problemCount,
                solutionCount: data.byCategory.탐구.solutionCount,
                total: data.byCategory.탐구.problemCount + data.byCategory.탐구.solutionCount,
            },
        }

        return {
            workerName,
            problemCount: data.problemCount,
            solutionCount: data.solutionCount,
            totalCount: data.problemCount + data.solutionCount,
            estimatedPay: (data.problemCount + data.solutionCount) * avgRate,
            byCategory,
        }
    })

    return result.sort((a, b) => b.estimatedPay - a.estimatedPay)
}

// 일별 생산성 조회 (차트용) - 캐시 기반
// 참고: 캐시에는 날짜별 세부 정보가 없어서 간소화된 버전 제공
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getDailyProductivity(_startDate: Date, _endDate: Date): Promise<(DailyStat & { subject: string })[]> {
    // 캐시에서는 상세 날짜별 정보를 추출하기 어려움
    return []
}

// 단가표 관리 - 메모리 기반 (DB 대신)
export async function getCropRates(): Promise<{ subject: string; price: number }[]> {
    return Object.entries(CROP_RATES).map(([subject, price]) => ({
        subject,
        price,
    }))
}

export async function updateCropRate(subject: string, price: number): Promise<{ subject: string; price: number }> {
    CROP_RATES[subject] = price
    return { subject, price }
}

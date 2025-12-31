import { Suspense } from "react"
import { getWorkerStats, getCropRates, getDailyProductivity, WorkerStat } from "@/app/actions/crop"
import { WorkerStatsTable } from "@/components/crop/WorkerStatsTable"
import { ProductivityChart } from "@/components/crop/ProductivityChart"
import { PricingConfig } from "@/components/crop/PricingConfig"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { startOfMonth } from "date-fns"

export default async function CropDashboardPage({
    searchParams,
}: {
    searchParams?: Promise<{ from?: string; to?: string }>
}) {
    const params = await searchParams
    const today = new Date()
    const from = params?.from ? new Date(params.from) : startOfMonth(today)
    const to = params?.to ? new Date(params.to) : today

    // Default to valid dates if invalid
    if (isNaN(from.getTime())) from.setTime(startOfMonth(new Date()).getTime())
    if (isNaN(to.getTime())) to.setTime(new Date().getTime())

    const [stats, productivity, rates] = await Promise.all([
        getWorkerStats(from, to),
        getDailyProductivity(from, to),
        getCropRates()
    ])

    const totalPay = stats.reduce((acc: number, curr: WorkerStat) => acc + curr.estimatedPay, 0)
    const totalCount = stats.reduce((acc: number, curr: WorkerStat) => acc + curr.totalCount, 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Crop 작업 관리</h1>
                <div className="flex items-center gap-2">
                    <DateRangePicker />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 작업량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCount.toLocaleString()}건</div>
                        <p className="text-xs text-muted-foreground">선택 기간 합계</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">예상 정산금</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₩{totalPay.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">선택 기간 합계</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="stats" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="stats">작업자 통계</TabsTrigger>
                    <TabsTrigger value="productivity">일별 생산성</TabsTrigger>
                    <TabsTrigger value="pricing">단가 설정</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="space-y-4">
                    <WorkerStatsTable data={stats} />
                </TabsContent>

                <TabsContent value="productivity" className="space-y-4">
                    <ProductivityChart data={productivity} />
                </TabsContent>

                <TabsContent value="pricing" className="space-y-4">
                    <PricingConfig initialRates={rates} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

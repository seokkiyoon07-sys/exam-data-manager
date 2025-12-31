"use client"

import { useState } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DailyStat } from "@/app/actions/crop"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Server Action에서 subject가 추가되었으므로 타입 확장
interface ExtendedDailyStat extends DailyStat {
    subject?: string
}

interface Props {
    data: ExtendedDailyStat[]
}

export function ProductivityChart({ data }: Props) {
    const [viewMode, setViewMode] = useState<"worker" | "subject">("worker")

    // 데이터 가공 로직
    const processData = (mode: "worker" | "subject") => {
        const chartData: Record<string, any>[] = []
        const dateMap = new Map<string, Record<string, number>>()
        const keys = new Set<string>()

        data.forEach(stat => {
            const dayStats = dateMap.get(stat.date) || {}
            // 모드에 따라 키 결정 (작업자명 vs 과목명)
            const key = mode === "worker"
                ? stat.workerName
                : (stat.subject || "Unknown")

            // 기존 값에 누적 (같은 날짜, 같은 키가 있을 수 있으므로 - 기존 로직과 차이점)
            dayStats[key] = (dayStats[key] || 0) + stat.count

            dateMap.set(stat.date, dayStats)
            keys.add(key)
        })

        dateMap.forEach((stats, date) => {
            chartData.push({
                date,
                ...stats,
                total: Object.values(stats).reduce((a, b) => a + b, 0) // Tooltip용 총합
            })
        })

        chartData.sort((a, b) => a.date.localeCompare(b.date))
        return { chartData, keys: Array.from(keys).sort() }
    }

    const { chartData, keys } = processData(viewMode)

    // 색상 팔레트
    const colors = [
        "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F",
        "#FFBB28", "#FF8042", "#a05195", "#d45087", "#f95d6a", "#ff7c43"
    ]

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle>일별 생산성 추이</CardTitle>
                    <CardDescription>
                        일별 작업량({viewMode === "worker" ? "작업자별" : "과목별"}) 통계입니다.
                    </CardDescription>
                </div>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "worker" | "subject")}>
                    <TabsList>
                        <TabsTrigger value="worker">작업자별</TabsTrigger>
                        <TabsTrigger value="subject">과목별</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full pt-4">
                    {chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            표시할 데이터가 없습니다.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number | undefined) => (value || 0).toLocaleString()}
                                    labelFormatter={(label) => `${label}`}
                                />
                                <Legend />
                                {keys.map((key, index) => (
                                    <Bar
                                        key={key}
                                        dataKey={key}
                                        stackId="a"
                                        fill={colors[index % colors.length]}
                                        name={key}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

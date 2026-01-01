"use client"

import React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkerStat } from "@/app/actions/crop"

interface Props {
    data: WorkerStat[]
}

const CATEGORIES = ['국어', '수학', '영어', '탐구'] as const

export function WorkerStatsTable({ data }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>작업자별 성과</CardTitle>
                <CardDescription>
                    문제 및 해설 Crop 작업량과 예상 정산금입니다. (문제/해설)
                </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead rowSpan={2} className="align-middle">작업자</TableHead>
                            {CATEGORIES.map(cat => (
                                <TableHead key={cat} colSpan={2} className="text-center border-l">
                                    {cat}
                                </TableHead>
                            ))}
                            <TableHead rowSpan={2} className="text-right align-middle border-l">합계</TableHead>
                            <TableHead rowSpan={2} className="text-right align-middle border-l">정산금</TableHead>
                        </TableRow>
                        <TableRow>
                            {CATEGORIES.map(cat => (
                                <React.Fragment key={cat}>
                                    <TableHead className="text-right text-xs border-l">문제</TableHead>
                                    <TableHead className="text-right text-xs">해설</TableHead>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center h-24">
                                    데이터가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((stat) => (
                                <TableRow key={stat.workerName}>
                                    <TableCell className="font-medium">{stat.workerName}</TableCell>
                                    {CATEGORIES.map(cat => {
                                        const catStats = stat.byCategory[cat]
                                        return (
                                            <React.Fragment key={cat}>
                                                <TableCell className="text-right border-l">
                                                    {catStats.problemCount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {catStats.solutionCount.toLocaleString()}
                                                </TableCell>
                                            </React.Fragment>
                                        )
                                    })}
                                    <TableCell className="text-right font-bold border-l">
                                        {stat.totalCount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 font-bold border-l">
                                        ₩{stat.estimatedPay.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

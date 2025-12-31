"use client"

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

export function WorkerStatsTable({ data }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>작업자별 성과</CardTitle>
                <CardDescription>
                    문제 및 해설 Crop 작업량과 예상 정산금입니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>작업자</TableHead>
                            <TableHead className="text-right">문제 (건)</TableHead>
                            <TableHead className="text-right">해설 (건)</TableHead>
                            <TableHead className="text-right">합계 (건)</TableHead>
                            <TableHead className="text-right">예상 정산금</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    데이터가 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((stat) => (
                                <TableRow key={stat.workerName}>
                                    <TableCell className="font-medium">{stat.workerName}</TableCell>
                                    <TableCell className="text-right">{stat.problemCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{stat.solutionCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-bold">{stat.totalCount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-green-600 font-bold">
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

"use client"

import { useState } from "react"
import { updateCropRate } from "@/app/actions/crop"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface CropRate {
    subject: string
    price: number
}

interface Props {
    initialRates: CropRate[]
}

export function PricingConfig({ initialRates }: Props) {
    const [rates, setRates] = useState(initialRates)
    const [editingSubject, setEditingSubject] = useState<string | null>(null)
    const [editPrice, setEditPrice] = useState<number>(0)
    const [loading, setLoading] = useState(false)

    const handleEdit = (rate: CropRate) => {
        setEditingSubject(rate.subject)
        setEditPrice(rate.price)
    }

    const handleSave = async (rate: CropRate) => {
        try {
            setLoading(true)
            await updateCropRate(rate.subject, editPrice)

            // 낙관적 업데이트
            setRates(rates.map(r => r.subject === rate.subject ? { ...r, price: editPrice } : r))

            setEditingSubject(null)
            toast.success(`${rate.subject} 단가가 수정되었습니다.`)
        } catch {
            toast.error("저장 중 오류가 발생했습니다.")
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setEditingSubject(null)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>과목별 정산 단가</CardTitle>
                <CardDescription>
                    각 과목의 Crop 작업(문제+해설) 건당 단가를 설정합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>과목</TableHead>
                            <TableHead>현재 단가</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rates.map((rate) => (
                            <TableRow key={rate.subject}>
                                <TableCell className="font-medium">{rate.subject}</TableCell>
                                <TableCell>
                                    {editingSubject === rate.subject ? (
                                        <Input
                                            type="number"
                                            value={editPrice}
                                            onChange={(e) => setEditPrice(Number(e.target.value))}
                                            className="w-32"
                                        />
                                    ) : (
                                        <span>{rate.price.toLocaleString()}원</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingSubject === rate.subject ? (
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleSave(rate)} disabled={loading}>저장</Button>
                                            <Button size="sm" variant="ghost" onClick={handleCancel}>취소</Button>
                                        </div>
                                    ) : (
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(rate)}>수정</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {rates.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                    등록된 단가가 없습니다. 기본값(100원)으로 자동 계산됩니다.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

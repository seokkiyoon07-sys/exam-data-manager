"use client"

import { useState } from "react"
import { createManualProblems } from "@/app/actions/problem"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function ManualProblemModal() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        subject: "",
        examYear: new Date().getFullYear(),
        organization: "",
        problemType: "",
        startNumber: 1,
        count: 1,
        questionType: "MULTIPLE" as "MULTIPLE" | "SUBJECTIVE"
    })

    // 핸들러: 입력값 변경
    const handleChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // 핸들러: 제출
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.subject || !formData.organization) {
            toast.error("과목과 출제기관은 필수입니다.")
            return
        }

        try {
            setLoading(true)
            const res = await createManualProblems({
                ...formData,
                examYear: Number(formData.examYear),
                startNumber: Number(formData.startNumber),
                count: Number(formData.count)
            })

            if (res.success) {
                toast.success(`${res.count}개의 문항이 생성되었습니다.`)
                setOpen(false)
            } else {
                toast.error(`실패: ${res.error}`)
            }
        } catch (e) {
            toast.error("오류가 발생했습니다.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    수동 추가
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>문항 수동 추가</DialogTitle>
                        <DialogDescription>
                            업로드 없이 메타데이터를 직접 생성합니다. (Index 자동 부여)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="subject" className="text-right">
                                과목 *
                            </Label>
                            <Input
                                id="subject"
                                value={formData.subject}
                                onChange={(e) => handleChange("subject", e.target.value)}
                                placeholder="예: 수학, 국어"
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="examYear" className="text-right">
                                시행년도
                            </Label>
                            <Input
                                id="examYear"
                                type="number"
                                value={formData.examYear}
                                onChange={(e) => handleChange("examYear", e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="organization" className="text-right">
                                출제기관 *
                            </Label>
                            <Input
                                id="organization"
                                value={formData.organization}
                                onChange={(e) => handleChange("organization", e.target.value)}
                                placeholder="예: 평가원, 교육청"
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="problemType" className="text-right">
                                문제분류
                            </Label>
                            <Input
                                id="problemType"
                                value={formData.problemType}
                                onChange={(e) => handleChange("problemType", e.target.value)}
                                placeholder="예: 공통, 미적분"
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="startNumber" className="text-right">
                                시작번호
                            </Label>
                            <Input
                                id="startNumber"
                                type="number"
                                value={formData.startNumber}
                                onChange={(e) => handleChange("startNumber", e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="count" className="text-right">
                                생성개수
                            </Label>
                            <Input
                                id="count"
                                type="number"
                                min={1}
                                max={50}
                                value={formData.count}
                                onChange={(e) => handleChange("count", e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="qType" className="text-right">
                                유형
                            </Label>
                            <Select
                                value={formData.questionType}
                                onValueChange={(v) => handleChange("questionType", v)}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="유형 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MULTIPLE">객관식</SelectItem>
                                    <SelectItem value="SUBJECTIVE">주관식</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "생성 중..." : "생성하기"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

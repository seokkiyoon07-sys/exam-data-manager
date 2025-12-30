"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Problem } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Loader2 } from "lucide-react"

interface ProblemEditFormProps {
  problem: Problem
}

export function ProblemEditForm({ problem }: ProblemEditFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    answer: problem.answer || "",
    difficulty: problem.difficulty || "",
    score: problem.score?.toString() || "",
    correctRate: problem.correctRate?.toString() || "",
    problemPosted: problem.problemPosted,
    solutionPosted: problem.solutionPosted,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/problems/${problem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: formData.answer || null,
          difficulty: formData.difficulty || null,
          score: formData.score ? parseFloat(formData.score) : null,
          correctRate: formData.correctRate ? parseFloat(formData.correctRate) : null,
          problemPosted: formData.problemPosted,
          solutionPosted: formData.solutionPosted,
        }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Update failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>정보 수정</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="answer">정답</Label>
            <Input
              id="answer"
              value={formData.answer}
              onChange={(e) =>
                setFormData({ ...formData, answer: e.target.value })
              }
              placeholder="정답 입력"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">난이도</Label>
            <Select
              value={formData.difficulty}
              onValueChange={(value) =>
                setFormData({ ...formData, difficulty: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="상">상</SelectItem>
                <SelectItem value="중">중</SelectItem>
                <SelectItem value="하">하</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="score">배점</Label>
            <Input
              id="score"
              type="number"
              step="0.5"
              value={formData.score}
              onChange={(e) =>
                setFormData({ ...formData, score: e.target.value })
              }
              placeholder="배점 입력"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="correctRate">정답률 (%)</Label>
            <Input
              id="correctRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.correctRate}
              onChange={(e) =>
                setFormData({ ...formData, correctRate: e.target.value })
              }
              placeholder="정답률 입력"
            />
          </div>

          <div className="space-y-2">
            <Label>문제 게시 상태</Label>
            <Select
              value={formData.problemPosted ? "Y" : "N"}
              onValueChange={(value) =>
                setFormData({ ...formData, problemPosted: value === "Y" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Y">게시완료</SelectItem>
                <SelectItem value="N">미게시</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>해설 게시 상태</Label>
            <Select
              value={formData.solutionPosted ? "Y" : "N"}
              onValueChange={(value) =>
                setFormData({ ...formData, solutionPosted: value === "Y" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Y">게시완료</SelectItem>
                <SelectItem value="N">미게시</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                저장
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

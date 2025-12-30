"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileQuestion,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ProblemImagesProps {
  index: number
}

interface ImageData {
  problemImages: string[]
  solutionImages: string[]
}

export function ProblemImages({ index }: ProblemImagesProps) {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    async function fetchImages() {
      try {
        setLoading(true)
        const response = await fetch("/api/images/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch images")
        }

        const data = await response.json()
        setImageData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "이미지를 불러올 수 없습니다")
      } finally {
        setLoading(false)
      }
    }

    fetchImages()
  }, [index])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => setZoom(1)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            문제/해설 이미지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            문제/해설 이미지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasProblemImages = imageData && imageData.problemImages.length > 0
  const hasSolutionImages = imageData && imageData.solutionImages.length > 0
  const hasAnyImages = hasProblemImages || hasSolutionImages

  if (!hasAnyImages) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            문제/해설 이미지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>등록된 이미지가 없습니다</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            문제/해설 이미지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={hasProblemImages ? "problem" : "solution"}>
            <TabsList className="mb-4">
              <TabsTrigger value="problem" disabled={!hasProblemImages} className="gap-2">
                <FileQuestion className="h-4 w-4" />
                문제 ({imageData?.problemImages.length || 0})
              </TabsTrigger>
              <TabsTrigger value="solution" disabled={!hasSolutionImages} className="gap-2">
                <BookOpen className="h-4 w-4" />
                해설 ({imageData?.solutionImages.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="problem">
              <div className="space-y-4">
                {imageData?.problemImages.map((fileName, i) => (
                  <div
                    key={fileName}
                    className="border rounded-lg overflow-hidden bg-white cursor-pointer hover:border-slate-400 transition-colors"
                    onClick={() => setSelectedImage(fileName)}
                  >
                    <div className="bg-slate-50 px-3 py-1.5 border-b flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        문제 이미지 {i + 1}
                      </span>
                      <span className="text-xs text-slate-400">{fileName}</span>
                    </div>
                    <div className="p-2">
                      <img
                        src={`/api/images/${fileName}`}
                        alt={`문제 ${index} - 이미지 ${i + 1}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="solution">
              <div className="space-y-4">
                {imageData?.solutionImages.map((fileName, i) => (
                  <div
                    key={fileName}
                    className="border rounded-lg overflow-hidden bg-white cursor-pointer hover:border-slate-400 transition-colors"
                    onClick={() => setSelectedImage(fileName)}
                  >
                    <div className="bg-slate-50 px-3 py-1.5 border-b flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        해설 이미지 {i + 1}
                      </span>
                      <span className="text-xs text-slate-400">{fileName}</span>
                    </div>
                    <div className="p-2">
                      <img
                        src={`/api/images/${fileName}`}
                        alt={`해설 ${index} - 이미지 ${i + 1}`}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 이미지 확대 다이얼로그 */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-mono w-16 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="outline" size="icon" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleResetZoom}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-100px)]">
            {selectedImage && (
              <img
                src={`/api/images/${selectedImage}`}
                alt={selectedImage}
                className="mx-auto"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                  transition: "transform 0.2s ease",
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

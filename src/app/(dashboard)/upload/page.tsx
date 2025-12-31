"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GoogleSheetSync } from "@/components/upload/GoogleSheetSync"
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, ArrowRight, File, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getRecentUploads, UploadHistoryItem } from "@/app/actions/upload"

interface UploadResult {
  success: boolean
  message: string
  totalRows: number
  successRows: number
  skippedRows?: number
  failedRows: number
  errors: Array<{ row: number; message: string }>
}

interface ProgressData {
  processed: number
  total: number
  success: number
  skipped: number
  failed: number
  percent: number
  batchIndex: number
  totalBatches: number
}

export default function UploadPage() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [phase, setPhase] = useState<string>("")
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([])

  const fetchHistory = useCallback(async () => {
    const data = await getRecentUploads()
    setUploadHistory(data)
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      setSelectedFile(files[0])
      setResult(null)
      setProgress(null)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
      setResult(null)
      setProgress(null)
    }
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setProgress(null)
    setResult(null)
    setPhase("준비 중...")

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload-stream", {
        method: "POST",
        body: formData,
      })

      if (!response.body) {
        throw new Error("스트리밍을 지원하지 않습니다.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case "status":
                  setPhase(data.message)
                  break

                case "parsed":
                  setPhase(`파싱 완료: ${data.parsedRows.toLocaleString()}건`)
                  break

                case "progress":
                  setProgress({
                    processed: data.processed,
                    total: data.total,
                    success: data.success,
                    skipped: data.skipped,
                    failed: data.failed,
                    percent: data.percent,
                    batchIndex: data.batchIndex,
                    totalBatches: data.totalBatches,
                  })
                  setPhase(`저장 중... (${data.batchIndex}/${data.totalBatches} 배치)`)
                  break

                  break

                case "complete":
                  setResult({
                    success: true,
                    message: data.message,
                    totalRows: data.totalRows,
                    successRows: data.successRows,
                    skippedRows: data.skippedRows,
                    failedRows: data.failedRows,
                    errors: data.errors || [],
                  })
                  fetchHistory()
                  break

                case "error":
                  setResult({
                    success: false,
                    message: data.message || "업로드 실패",
                    totalRows: 0,
                    successRows: 0,
                    failedRows: 0,
                    errors: [],
                  })
                  break
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.",
        totalRows: 0,
        successRows: 0,
        failedRows: 0,
        errors: [],
      })
    } finally {
      setIsUploading(false)
      setPhase("")
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setResult(null)
    setProgress(null)
    setPhase("")
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
          Import
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">파일 업로드</h1>
        <p className="text-slate-600 mt-1">
          엑셀 파일(xlsx, xls) 또는 CSV 파일을 업로드하여 문항 데이터를 가져옵니다.
        </p>
      </div>

      <Tabs defaultValue="db-upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="db-upload" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            엑셀 업로드
          </TabsTrigger>
          <TabsTrigger value="sheet-sync" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            구글 시트 동기화
          </TabsTrigger>
        </TabsList>

        <TabsContent value="db-upload" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 업로드 영역 */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">파일 선택</CardTitle>
                <CardDescription className="text-slate-500">
                  드래그 앤 드롭하거나 클릭하여 파일을 선택하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${isDragging
                    ? "border-slate-500 bg-slate-50 scale-[1.02]"
                    : selectedFile
                      ? "border-slate-400 bg-slate-50"
                      : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="space-y-4">
                    {selectedFile ? (
                      <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-500 text-white">
                          <FileSpreadsheet className="h-8 w-8" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-slate-800">{selectedFile.name}</p>
                          <p className="text-sm text-slate-500 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100">
                          <Upload className="h-8 w-8 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">파일을 여기에 드롭하세요</p>
                          <p className="text-sm text-slate-500 mt-1">
                            또는 클릭하여 파일 선택
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            지원 형식: .xlsx, .xls, .csv
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 실시간 진행률 표시 */}
                {isUploading && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">{phase}</span>
                    </div>

                    {progress && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">
                              {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} 건
                            </span>
                            <span className="font-mono font-semibold text-slate-800">
                              {progress.percent}%
                            </span>
                          </div>
                          <Progress value={progress.percent} className="h-3" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-green-50 rounded-lg">
                            <p className="text-lg font-bold font-mono text-green-700">
                              {progress.success.toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600">저장</p>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-lg font-bold font-mono text-slate-600">
                              {progress.skipped.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">스킵</p>
                          </div>
                          <div className="p-2 bg-red-50 rounded-lg">
                            <p className="text-lg font-bold font-mono text-red-600">
                              {progress.failed.toLocaleString()}
                            </p>
                            <p className="text-xs text-red-500">실패</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="flex-1 h-11 bg-slate-500 text-white hover:bg-slate-600"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        업로드 중...
                      </>
                    ) : (
                      "업로드"
                    )}
                  </Button>
                  {selectedFile && !isUploading && (
                    <Button variant="outline" onClick={handleReset} className="h-11">
                      초기화
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 결과 영역 */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">업로드 결과</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      {result.success ? (
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-500 text-white">
                          <CheckCircle className="h-7 w-7" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-dashed border-slate-400">
                          <XCircle className="h-7 w-7 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-lg text-slate-800">{result.message}</p>
                        {result.success && (
                          <p className="text-sm text-slate-500">
                            전체 <span className="font-mono">{result.totalRows.toLocaleString()}</span>행 처리 완료
                          </p>
                        )}
                      </div>
                    </div>

                    {result.success && (
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-4 bg-slate-50 rounded-lg">
                          <p className="text-2xl font-bold font-mono text-slate-800">
                            {result.totalRows.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">전체</p>
                        </div>
                        <div className="text-center p-4 bg-green-500 text-white rounded-lg">
                          <p className="text-2xl font-bold font-mono">
                            {result.successRows.toLocaleString()}
                          </p>
                          <p className="text-xs opacity-80 uppercase tracking-wider mt-1">저장</p>
                        </div>
                        <div className="text-center p-4 bg-slate-200 rounded-lg">
                          <p className="text-2xl font-bold font-mono text-slate-600">
                            {(result.skippedRows || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">스킵</p>
                        </div>
                        <div className="text-center p-4 border-2 border-dashed border-slate-300 rounded-lg">
                          <p className="text-2xl font-bold font-mono text-slate-600">
                            {result.failedRows.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">실패</p>
                        </div>
                      </div>
                    )}

                    {result.errors.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-800">오류 목록</span>
                          <span className="text-xs text-slate-500 font-mono">
                            ({result.errors.length}건)
                          </span>
                        </div>
                        <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead className="w-20 font-semibold text-slate-700">행</TableHead>
                                <TableHead className="font-semibold text-slate-700">오류 내용</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.errors.map((error, i) => (
                                <TableRow key={i} className="hover:bg-slate-50">
                                  <TableCell>
                                    <span className="font-mono text-sm bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      {error.row}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm text-slate-600">
                                    {error.message}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {result.success && (
                      <Button
                        variant="outline"
                        className="w-full h-11 gap-2"
                        onClick={() => router.push("/problems")}
                      >
                        문항 목록 보기
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                      <File className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">대기 중</p>
                    <p className="text-xs text-slate-500 mt-1">
                      파일을 업로드하면 결과가 표시됩니다
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 컬럼 매핑 안내 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">컬럼 매핑 안내</CardTitle>
              <CardDescription className="text-slate-500">
                엑셀 파일의 컬럼명이 아래와 일치해야 합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { name: "Index", required: true, desc: "고유 번호" },
                  { name: "시험지코드", required: false, desc: "시험지 식별 코드" },
                  { name: "출제기관", required: true, desc: "필수" },
                  { name: "과목", required: true, desc: "필수" },
                  { name: "시행년도", required: true, desc: "4자리 연도" },
                  { name: "문항번호", required: true, desc: "필수" },
                  { name: "정답", required: false, desc: "객관식 1~5" },
                  { name: "난이도", required: false, desc: "상/중/하 등" },
                  { name: "배점", required: false, desc: "숫자" },
                  { name: "정답률", required: false, desc: "0~100" },
                  { name: "1~5번 선택비율", required: false, desc: "0~100" },
                  { name: "문제게시YN", required: false, desc: "Y/N" },
                  { name: "해설게시YN", required: false, desc: "Y/N" },
                  { name: "객관식주관식", required: false, desc: "객관식/주관식" },
                ].map((col) => (
                  <div
                    key={col.name}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${col.required
                      ? "bg-slate-100 border border-slate-300"
                      : "bg-slate-50"
                      }`}
                  >
                    <span className="text-sm font-medium text-slate-800">{col.name}</span>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded ${col.required
                        ? "bg-slate-500 text-white"
                        : "bg-slate-200 text-slate-600"
                        }`}
                    >
                      {col.required ? "필수" : "선택"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheet-sync">
          <GoogleSheetSync onSyncComplete={fetchHistory} />
        </TabsContent>
      </Tabs>

      {/* 최근 업로드 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">진행 이력</CardTitle>
          <CardDescription>
            최근 10건의 업로드 및 동기화 기록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>유형</TableHead>
                <TableHead>파일명/내용</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>진행률</TableHead>
                <TableHead className="text-right">일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                    기록이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                uploadHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className={item.type === 'GOOGLE_SHEET' ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50"}>
                        {item.type === 'GOOGLE_SHEET' ? '구글시트' : '파일업로드'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.fileName}
                      {item.type === 'FILE' && (
                        <p className="text-xs text-muted-foreground">
                          {(item.fileSize / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'COMPLETED' ? 'outline' : item.status === 'FAILED' ? 'destructive' : 'secondary'}>
                        {item.status === 'COMPLETED' ? '완료' : item.status === 'FAILED' ? '실패' : '진행중'}
                      </Badge>
                      {/* 상태 메시지: 실패 시 빨간색, 성공(완료) 시 상세 내역(회색) 표시 */}
                      {item.errorMessage && (
                        <p className={`text-xs mt-1 ${item.status === 'FAILED' ? 'text-red-500 font-medium' : 'text-slate-500'
                          }`}>
                          {item.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-bold text-green-600">{item.successRows}</span> / {item.totalRows || '-'}
                        {item.status === 'COMPLETED' && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (실패 {item.failedRows})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

import * as XLSX from "xlsx"
import { QuestionType } from "@prisma/client"

export interface ParsedProblem {
  index: number
  problemType?: string
  examCode?: string
  organization: string
  subject: string
  subCategory?: string
  examYear: number
  problemNumber: number
  questionType: QuestionType
  answer?: string
  difficulty?: string
  score?: number
  correctRate?: number
  choiceRate1?: number
  choiceRate2?: number
  choiceRate3?: number
  choiceRate4?: number
  choiceRate5?: number
  problemPosted: boolean
  problemWorker?: string
  problemWorkDate?: Date
  solutionPosted: boolean
  solutionWorker?: string
  solutionWorkDate?: Date
}

export interface ParseResult {
  success: boolean
  data: ParsedProblem[]
  errors: Array<{ row: number; message: string }>
  totalRows: number
}

// 컬럼명 매핑
const COLUMN_MAPPING: Record<string, keyof ParsedProblem> = {
  Index: "index",
  문제종류: "problemType",
  시험지코드: "examCode",
  출제기관: "organization",
  과목: "subject",
  소분류1: "subCategory",
  시행년도: "examYear",
  문항번호: "problemNumber",
  정답: "answer",
  난이도: "difficulty",
  배점: "score",
  정답률: "correctRate",
  "1번 선택비율": "choiceRate1",
  "2번 선택비율": "choiceRate2",
  "3번 선택비율": "choiceRate3",
  "4번 선택비율": "choiceRate4",
  "5번 선택비율": "choiceRate5",
  문제게시YN: "problemPosted",
  해설게시YN: "solutionPosted",
  객관식주관식: "questionType",
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.toLowerCase().trim()
    return v === "y" || v === "yes" || v === "true" || v === "1"
  }
  return !!value
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const num = Number(value)
  return isNaN(num) ? undefined : num
}

// 비율 값을 퍼센트로 변환 (0~1 -> 0~100)
function parsePercent(value: unknown): number | undefined {
  const num = parseNumber(value)
  if (num === undefined) return undefined
  // 값이 1 이하면 소수 비율로 간주하여 100을 곱함
  if (num <= 1) {
    return Math.round(num * 100 * 100) / 100 // 소수점 2자리까지
  }
  return num
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === "number") {
    // Excel 날짜 시리얼 넘버
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return new Date(date.y, date.m - 1, date.d)
    }
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}

function parseQuestionType(value: unknown): QuestionType {
  if (!value) return QuestionType.MULTIPLE
  const v = String(value).toLowerCase().trim()
  if (v.includes("주관") || v === "subjective") {
    return QuestionType.SUBJECTIVE
  }
  return QuestionType.MULTIPLE
}

export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // JSON으로 변환
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" })

  // 디버깅: 첫 번째 행의 컬럼명 출력
  if (rawData.length > 0) {
    const firstRow = rawData[0] as Record<string, unknown>
    console.log("=== Excel Columns ===")
    console.log("Column names:", Object.keys(firstRow).join(", "))
    console.log("First row data:", JSON.stringify(firstRow, null, 2))
    console.log("====================")
  }

  const data: ParsedProblem[] = []
  const errors: Array<{ row: number; message: string }> = []

  ;(rawData as Record<string, unknown>[]).forEach((row, index) => {
    const rowNumber = index + 2 // 헤더 포함 + 1-indexed

    try {
      // Worker와 Work_Date 처리 (문제/해설 구분)
      let problemWorker: string | undefined
      let problemWorkDate: Date | undefined
      let solutionWorker: string | undefined
      let solutionWorkDate: Date | undefined

      // 컬럼 순서에 따라 Worker, Work_Date 매핑
      const keys = Object.keys(row)
      keys.forEach((key, i) => {
        if (key === "Worker") {
          // 첫 번째 Worker는 문제게시, 두 번째는 해설게시
          const prevKeys = keys.slice(0, i)
          const hasProblemPosted = prevKeys.some(k => k === "문제게시YN")
          const hasSolutionPosted = prevKeys.some(k => k === "해설게시YN")

          if (hasSolutionPosted) {
            solutionWorker = row[key] as string
          } else if (hasProblemPosted) {
            problemWorker = row[key] as string
          }
        }
        if (key === "Work_Date") {
          const prevKeys = keys.slice(0, i)
          const hasProblemPosted = prevKeys.some(k => k === "문제게시YN")
          const hasSolutionPosted = prevKeys.some(k => k === "해설게시YN")

          if (hasSolutionPosted) {
            solutionWorkDate = parseDate(row[key])
          } else if (hasProblemPosted) {
            problemWorkDate = parseDate(row[key])
          }
        }
      })

      const indexVal = parseNumber(row["Index"])
      const examYear = parseNumber(row["시행년도"])
      const problemNumber = parseNumber(row["문항번호"])
      const organization = row["출제기관"] as string
      const subject = row["과목"] as string

      // 필수 필드 검증
      if (indexVal === undefined) {
        errors.push({ row: rowNumber, message: "Index가 없습니다." })
        return
      }
      if (!organization) {
        errors.push({ row: rowNumber, message: "출제기관이 없습니다." })
        return
      }
      if (!subject) {
        errors.push({ row: rowNumber, message: "과목이 없습니다." })
        return
      }
      if (examYear === undefined) {
        errors.push({ row: rowNumber, message: "시행년도가 없습니다." })
        return
      }
      if (problemNumber === undefined) {
        errors.push({ row: rowNumber, message: "문항번호가 없습니다." })
        return
      }

      const problem: ParsedProblem = {
        index: indexVal,
        problemType: row["문제종류"] as string || undefined,
        examCode: row["시험지코드"] as string || undefined,
        organization,
        subject,
        subCategory: row["소분류1"] as string || undefined,
        examYear,
        problemNumber,
        questionType: parseQuestionType(row["객관식주관식"]),
        answer: row["정답"] ? String(row["정답"]) : undefined,
        difficulty: row["난이도"] as string || undefined,
        score: parseNumber(row["배점"]),
        correctRate: parsePercent(row["정답률"]),
        choiceRate1: parsePercent(row["1번 선택비율"]),
        choiceRate2: parsePercent(row["2번 선택비율"]),
        choiceRate3: parsePercent(row["3번 선택비율"]),
        choiceRate4: parsePercent(row["4번 선택비율"]),
        choiceRate5: parsePercent(row["5번 선택비율"]),
        problemPosted: parseBoolean(row["문제게시YN"]),
        problemWorker: problemWorker || undefined,
        problemWorkDate,
        solutionPosted: parseBoolean(row["해설게시YN"]),
        solutionWorker: solutionWorker || undefined,
        solutionWorkDate,
      }

      data.push(problem)
    } catch (err) {
      errors.push({
        row: rowNumber,
        message: err instanceof Error ? err.message : "파싱 오류",
      })
    }
  })

  return {
    success: errors.length === 0,
    data,
    errors,
    totalRows: rawData.length,
  }
}

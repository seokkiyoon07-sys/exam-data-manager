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

// 출제기관 정규화: 교육청, 평가원, EBS 외에는 모두 "사설"로 처리
const OFFICIAL_ORGANIZATIONS = ["교육청", "평가원", "ebs"]

function normalizeOrganization(value: string): string {
  const normalized = value.toLowerCase().trim()

  for (const official of OFFICIAL_ORGANIZATIONS) {
    if (normalized.includes(official.toLowerCase())) {
      if (normalized.includes("교육청")) return "교육청"
      if (normalized.includes("평가원")) return "평가원"
      if (normalized.includes("ebs")) return "EBS"
    }
  }
  return "사설"
}

// 사설 출제기관 코드 매핑
const PRIVATE_ORG_CODES: Record<string, string> = {
  "시대인재": "SDIJ",
  "강남대성": "KNDS",
  "대성": "KNDS",
  "종로": "JONG",
  "이투스": "ETOOS",
  "메가스터디": "MEGA",
}

// 과목 코드 매핑
function getSubjectCode(subject: string, subCategory?: string): string {
  const sub = subCategory?.toLowerCase() || ""

  if (subject === "국어") {
    if (sub.includes("화법") || sub.includes("작문")) return "KOR_SPW"
    if (sub.includes("언어") || sub.includes("매체")) return "KOR_LNM"
    return "KOR"
  }
  if (subject === "수학") {
    if (sub.includes("확률") || sub.includes("통계")) return "MATH_PS"
    if (sub.includes("미적분")) return "MATH_CAL"
    if (sub.includes("기하")) return "MATH_GEO"
    if (sub.includes("가형")) return "MATH_GA"
    if (sub.includes("나형")) return "MATH_NA"
    return "MATH"
  }
  if (subject === "영어") return "ENG"
  if (subject.includes("물리")) return "SCI_PHY"
  if (subject.includes("화학")) return "SCI_CHM"
  if (subject.includes("생명") || subject.includes("생물")) return "SCI_BIO"
  if (subject.includes("지구과학")) return "SCI_EAS"

  return subject.substring(0, 3).toUpperCase()
}

// 출제기관 코드 (시험지코드용)
function getOrgCode(rawOrganization: string): string {
  const org = rawOrganization.toLowerCase()

  // 공식 기관
  if (org.includes("수능")) return "S"
  if (org.includes("평가원")) return "M"
  if (org.includes("교육청")) return "H"

  // 사설 기관
  for (const [name, code] of Object.entries(PRIVATE_ORG_CODES)) {
    if (org.includes(name.toLowerCase())) return code
  }

  // 알 수 없는 사설은 첫 두 글자
  return rawOrganization.substring(0, 4).toUpperCase()
}

// 시험지코드 자동 생성
// 형식: [시행일(yyMMdd)]_[과목코드]_[출제기관코드]_[학년코드]
// 예: 240604_MATH_SDIJ_G3
function generateExamCode(
  problemType: string,
  subject: string,
  rawOrganization: string,
  examYear: number,
  subCategory?: string
): string {
  // 날짜 추출 시도 (문제종류에서)
  // 예: "고3 2006.10.12 학력평가" -> 061012
  // 예: "2026 학년도 전국시대인재 1회" -> 260101 (연도만 있으면 01월01일로)
  let dateCode = ""

  const dateMatch = problemType.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    dateCode = year.slice(2) + month.padStart(2, "0") + day.padStart(2, "0")
  } else {
    // 연도만 추출
    const yearMatch = problemType.match(/(\d{4})\s*학년도/)
    if (yearMatch) {
      dateCode = yearMatch[1].slice(2) + "0101"
    } else {
      dateCode = String(examYear).slice(2) + "0101"
    }
  }

  // 회차 추출
  const roundMatch = problemType.match(/(\d+)\s*회/)
  const round = roundMatch ? roundMatch[1] : ""

  // 학년 추출
  let grade = "G3" // 기본값
  if (problemType.includes("고1")) grade = "G1"
  else if (problemType.includes("고2")) grade = "G2"

  const subjectCode = getSubjectCode(subject, subCategory)
  const orgCode = getOrgCode(rawOrganization)

  // 형식: 날짜_과목_기관_학년 (회차가 있으면 기관 뒤에)
  if (round) {
    return `${dateCode}_${subjectCode}_${orgCode}${round}_${grade}`
  }
  return `${dateCode}_${subjectCode}_${orgCode}_${grade}`
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
      const rawOrganization = row["출제기관"] as string
      const organization = rawOrganization ? normalizeOrganization(rawOrganization) : ""
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

      // 시험지코드가 없으면 자동 생성
      const problemType = row["문제종류"] as string || ""
      const subCategory = row["소분류1"] as string || undefined
      let examCode = row["시험지코드"] as string || ""
      if (!examCode && problemType) {
        examCode = generateExamCode(problemType, subject, rawOrganization, examYear, subCategory)
      }

      const problem: ParsedProblem = {
        index: indexVal,
        problemType: problemType || undefined,
        examCode: examCode || undefined,
        organization,
        subject,
        subCategory,
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

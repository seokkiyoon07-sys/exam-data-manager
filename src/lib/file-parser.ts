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
  return value.trim()
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

// 과목명 정규화
function normalizeSubject(rawSubject: string, subCategory?: string): string {
  if (!rawSubject) return "미분류"
  let subject = rawSubject.trim()
  const sub = subCategory ? subCategory.trim().toLowerCase() : ""

  // 1. 과학탐구 (Science)
  // 물리학
  if (subject.includes("Physics") || subject === "물리" || subject === "과학") {
    // subCategory나 subject에서 2/II 감지
    if (subject.includes("2") || subject.includes("II") || sub.includes("2") || sub.includes("ii")) return "물리학II"
    return "물리학I"
  }
  // 화학
  if (subject.includes("Chem") || subject === "화학") {
    if (subject.includes("2") || subject.includes("II") || sub.includes("2") || sub.includes("ii")) return "화학II"
    return "화학I"
  }
  // 생명과학
  if (subject.includes("bio") || subject.includes("Bio") || subject === "생명" || subject === "생물" || subject === "생명과학") {
    if (subject.includes("2") || subject.includes("II") || sub.includes("2") || sub.includes("ii")) return "생명과학II"
    return "생명과학I"
  }
  // 지구과학
  if (subject.includes("EAS") || subject === "지구" || subject === "지구과학") {
    if (subject.includes("2") || subject.includes("II") || sub.includes("2") || sub.includes("ii")) return "지구과학II"
    return "지구과학I"
  }

  // 2. 사회탐구 (Social)
  if (subject === "윤리") return "생활과 윤리" // (가정: 대부분 생윤)
  if (subject === "윤사" || subject === "윤리와사상") return "윤리와 사상"
  if (subject === "생윤" || subject === "생활과윤리") return "생활과 윤리"
  if (subject === "한지" || subject === "한국지리") return "한국지리"
  if (subject === "세지" || subject === "세계지리") return "세계지리"
  if (subject === "동사" || subject === "동아시아사") return "동아시아사"
  if (subject === "세계사") return "세계사"
  if (subject === "경제") return "경제"
  if (subject === "정법" || subject === "정치" || subject === "정치와법" || subject.includes("정치")) return "정치와 법"
  if (subject === "사문" || subject === "사회문화") return "사회·문화"

  // 3. 국어/수학/영어
  if (subject === "국어B형" || subject === "국어A형") return "국어"

  return subject
}

// 과목 코드 매핑
function getSubjectCode(subject: string, subCategory?: string): string {
  const sub = subCategory?.toLowerCase() || ""

  // 정규화된 과목명 기준으로 코드 생성
  if (subject === "국어") {
    if (sub.includes("화법") || sub.includes("작문")) return "KOR_SPW"
    if (sub.includes("언어") || sub.includes("매체")) return "KOR_LNM"
    return "KOR"
  }
  if (subject === "수학") {
    // ... 기존 로직 유지
    if (sub.includes("확률") || sub.includes("통계")) return "MATH_PS"
    if (sub.includes("미적분")) return "MATH_CAL"
    if (sub.includes("기하")) return "MATH_GEO"
    return "MATH"
  }
  if (subject === "영어") return "ENG"

  // 과탐
  if (subject === "물리학I") return "PHY1"
  if (subject === "물리학II") return "PHY2"
  if (subject === "화학I") return "CHM1"
  if (subject === "화학II") return "CHM2"
  if (subject === "생명과학I") return "BIO1"
  if (subject === "생명과학II") return "BIO2"
  if (subject === "지구과학I") return "EAS1"
  if (subject === "지구과학II") return "EAS2"

  // 사탐
  if (subject === "생활과 윤리") return "ETH_L"
  if (subject === "윤리와 사상") return "ETH_T"
  if (subject === "한국지리") return "GEO_K"
  if (subject === "세계지리") return "GEO_W"
  if (subject === "동아시아사") return "HIS_E"
  if (subject === "세계사") return "HIS_W"
  if (subject === "경제") return "ECO"
  if (subject === "정치와 법") return "POL"
  if (subject === "사회·문화") return "SOC"

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

export function parseProblemRow(row: Record<string, unknown>, rowNumber: number): ParsedProblem {
  // Worker와 Work_Date 처리 (한글 헤더 우선 지원)
  // 문제게시 작업자
  const rawProblemWorker = (row["작업자"] || row["Worker"]) as string | undefined
  // 해설게시 작업자 (작업자1 or Worker_1)
  const rawSolutionWorker = (row["작업자1"] || row["Worker_1"]) as string | undefined

  const problemWorker = rawProblemWorker && rawProblemWorker.trim() ? rawProblemWorker.trim() : undefined
  const solutionWorker = rawSolutionWorker && rawSolutionWorker.trim() ? rawSolutionWorker.trim() : undefined

  // 날짜 파싱
  const problemWorkDate = parseDate(row["작업일"] || row["Work_Date"])
  const solutionWorkDate = parseDate(row["작업일1"] || row["Work_Date_1"])

  // Index (대소문자 허용)
  const indexVal = parseNumber(row["Index"]) ?? parseNumber(row["index"])
  const examYear = parseNumber(row["시행년도"])
  const problemNumber = parseNumber(row["문항번호"])
  const rawOrganization = row["출제기관"] as string
  const organization = rawOrganization ? normalizeOrganization(rawOrganization) : ""
  const subject = row["과목"] as string

  // Index는 필수 (없으면 에러 throw)
  if (indexVal === undefined) {
    throw new Error("Index가 없습니다.")
  }

  // 나머지 필드는 기본값으로 저장
  const finalOrganization = organization || "미분류"
  // 과목 정규화 적용
  // subCategory는 위에서 이미 선언된(row["소분류1"]) 사용
  const subCategory = row["소분류1"] as string || undefined
  const finalSubject = normalizeSubject(subject, subCategory)

  const finalExamYear = examYear ?? new Date().getFullYear()
  const finalProblemNumber = problemNumber ?? 0
  const problemType = row["문제종류"] as string || ""

  // 시험지코드 자동 생성을 위해 subCategory 재사용
  let examCode = row["시험지코드"] as string || ""
  if (!examCode && problemType && rawOrganization && finalExamYear) {
    examCode = generateExamCode(problemType, finalSubject, rawOrganization, finalExamYear, subCategory)
  }

  return {
    index: indexVal,
    problemType: problemType || undefined,
    examCode: examCode || undefined,
    organization: finalOrganization,
    subject: finalSubject,
    subCategory,
    examYear: finalExamYear,
    problemNumber: finalProblemNumber,
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
  }

  const data: ParsedProblem[] = []
  const errors: Array<{ row: number; message: string }> = []

    ; (rawData as Record<string, unknown>[]).forEach((row, index) => {
      const rowNumber = index + 2 // 헤더 포함 + 1-indexed

      try {
        const problem = parseProblemRow(row, rowNumber)
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

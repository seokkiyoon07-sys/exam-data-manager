import { Problem, Severity, QuestionType } from "@prisma/client"

export interface ValidationIssue {
  ruleCode: string
  severity: Severity
  field?: string
  message: string
}

export interface ValidationRule {
  code: string
  name: string
  severity: Severity
  check: (problem: Problem) => boolean
  getMessage: (problem: Problem) => string
  field?: string
}

// 검수 규칙 정의
export const validationRules: ValidationRule[] = [
  // 기본 정보 누락 (미분류 등)
  {
    code: "MISSING_SUBJECT",
    name: "과목 미분류",
    severity: Severity.ERROR,
    field: "subject",
    check: (p) => p.subject === "미분류" || !p.subject,
    getMessage: () => "과목이 지정되지 않았습니다.",
  },
  {
    code: "MISSING_ORGANIZATION",
    name: "출제기관 미분류",
    severity: Severity.ERROR,
    field: "organization",
    check: (p) => p.organization === "미분류" || !p.organization,
    getMessage: () => "출제기관이 지정되지 않았습니다.",
  },
  {
    code: "MISSING_PROBLEM_NUMBER",
    name: "문항번호 누락",
    severity: Severity.ERROR,
    field: "problemNumber",
    check: (p) => p.problemNumber === 0 || p.problemNumber === null || p.problemNumber === undefined,
    getMessage: () => "문항번호가 지정되지 않았습니다.",
  },

  // 필수값 누락
  {
    code: "MISSING_EXAM_CODE",
    name: "시험지코드 누락",
    severity: Severity.WARNING,
    field: "examCode",
    check: (p) => !p.examCode || p.examCode.trim() === "",
    getMessage: () => "시험지코드가 비어있습니다.",
  },
  {
    code: "MISSING_ANSWER",
    name: "정답 누락",
    severity: Severity.ERROR,
    field: "answer",
    check: (p) => p.problemPosted && (!p.answer || p.answer.trim() === ""),
    getMessage: () => "문제가 게시되었으나 정답이 비어있습니다.",
  },
  {
    code: "MISSING_DIFFICULTY",
    name: "난이도 누락",
    severity: Severity.WARNING,
    field: "difficulty",
    check: (p) => p.solutionPosted && (!p.difficulty || p.difficulty.trim() === ""),
    getMessage: () => "해설이 게시되었으나 난이도가 비어있습니다.",
  },
  {
    code: "MISSING_SCORE",
    name: "배점 누락",
    severity: Severity.ERROR,
    field: "score",
    check: (p) => p.problemPosted && (p.score === null || p.score === undefined),
    getMessage: () => "문제가 게시되었으나 배점이 비어있습니다.",
  },

  // 값 범위/형식 오류
  {
    code: "INVALID_ANSWER_RANGE",
    name: "정답 범위 오류",
    severity: Severity.ERROR,
    field: "answer",
    check: (p) => {
      if (p.questionType !== QuestionType.MULTIPLE) return false
      if (!p.answer) return false
      const num = Number(p.answer)
      return isNaN(num) || num < 1 || num > 5
    },
    getMessage: (p) => `객관식 정답이 1~5 범위를 벗어났습니다. (현재값: ${p.answer})`,
  },
  {
    code: "INVALID_YEAR_FORMAT",
    name: "시행년도 형식 오류",
    severity: Severity.ERROR,
    field: "examYear",
    check: (p) => {
      const year = p.examYear
      return year < 1900 || year > 2100
    },
    getMessage: (p) => `시행년도가 유효하지 않습니다. (현재값: ${p.examYear})`,
  },
  {
    code: "INVALID_CORRECT_RATE",
    name: "정답률 범위 오류",
    severity: Severity.ERROR,
    field: "correctRate",
    check: (p) => {
      if (p.correctRate === null || p.correctRate === undefined) return false
      return p.correctRate < 0 || p.correctRate > 100
    },
    getMessage: (p) => `정답률이 0~100 범위를 벗어났습니다. (현재값: ${p.correctRate})`,
  },
  {
    code: "INVALID_CHOICE_RATE_SUM",
    name: "선택비율 합계 오류",
    severity: Severity.WARNING,
    field: "choiceRate",
    check: (p) => {
      if (p.questionType !== QuestionType.MULTIPLE) return false
      const rates = [p.choiceRate1, p.choiceRate2, p.choiceRate3, p.choiceRate4, p.choiceRate5]
      const validRates = rates.filter((r) => r !== null && r !== undefined) as number[]
      if (validRates.length === 0) return false
      const sum = validRates.reduce((a, b) => a + b, 0)
      return Math.abs(sum - 100) > 0.5
    },
    getMessage: (p) => {
      const rates = [p.choiceRate1, p.choiceRate2, p.choiceRate3, p.choiceRate4, p.choiceRate5]
      const validRates = rates.filter((r) => r !== null && r !== undefined) as number[]
      const sum = validRates.reduce((a, b) => a + b, 0)
      return `선택비율 합계가 100%가 아닙니다. (현재값: ${sum.toFixed(1)}%)`
    },
  },

  // 선택비율 관련
  {
    code: "MISSING_CHOICE_RATE",
    name: "선택비율 누락",
    severity: Severity.WARNING,
    field: "choiceRate",
    check: (p) => {
      if (p.questionType !== QuestionType.MULTIPLE) return false
      if (!p.problemPosted) return false
      const rates = [p.choiceRate1, p.choiceRate2, p.choiceRate3, p.choiceRate4, p.choiceRate5]
      return rates.every((r) => r === null || r === undefined)
    },
    getMessage: () => "객관식 문제이나 선택비율이 모두 비어있습니다.",
  },
  {
    code: "UNEXPECTED_CHOICE_RATE",
    name: "불필요한 선택비율",
    severity: Severity.INFO,
    field: "choiceRate",
    check: (p) => {
      if (p.questionType !== QuestionType.SUBJECTIVE) return false
      const rates = [p.choiceRate1, p.choiceRate2, p.choiceRate3, p.choiceRate4, p.choiceRate5]
      return rates.some((r) => r !== null && r !== undefined)
    },
    getMessage: () => "주관식 문제에 선택비율이 입력되어 있습니다.",
  },

  // 게시 상태 관련
  {
    code: "POSTED_WITHOUT_META",
    name: "게시 전 메타 누락",
    severity: Severity.ERROR,
    field: "problemPosted",
    check: (p) => {
      if (!p.problemPosted) return false
      return !p.answer || !p.organization || !p.subject
    },
    getMessage: () => "문제게시=Y이나 필수 메타정보(정답, 출제기관, 과목)가 비어있습니다.",
  },
  {
    code: "SOLUTION_WITHOUT_PROBLEM",
    name: "문제 미게시 상태에서 해설 게시",
    severity: Severity.WARNING,
    field: "solutionPosted",
    check: (p) => p.solutionPosted && !p.problemPosted,
    getMessage: () => "문제가 게시되지 않았으나 해설이 게시 상태입니다.",
  },
]

// 규칙 코드별 메시지 매핑 (대시보드용)
export const ruleMessages: Record<string, string> = {
  MISSING_SUBJECT: "과목 미분류",
  MISSING_ORGANIZATION: "출제기관 미분류",
  MISSING_PROBLEM_NUMBER: "문항번호 누락",
  MISSING_EXAM_CODE: "시험지코드 누락",
  MISSING_ANSWER: "정답 누락",
  MISSING_DIFFICULTY: "난이도 누락",
  MISSING_SCORE: "배점 누락",
  INVALID_ANSWER_RANGE: "정답 범위 오류",
  INVALID_YEAR_FORMAT: "시행년도 형식 오류",
  INVALID_CORRECT_RATE: "정답률 범위 오류",
  INVALID_CHOICE_RATE_SUM: "선택비율 합계 오류",
  MISSING_CHOICE_RATE: "선택비율 누락",
  UNEXPECTED_CHOICE_RATE: "불필요한 선택비율",
  POSTED_WITHOUT_META: "게시 전 메타 누락",
  SOLUTION_WITHOUT_PROBLEM: "문제 미게시 상태에서 해설 게시",
}

// 문항 검수 실행
export function validateProblem(problem: Problem): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const rule of validationRules) {
    if (rule.check(problem)) {
      issues.push({
        ruleCode: rule.code,
        severity: rule.severity,
        field: rule.field,
        message: rule.getMessage(problem),
      })
    }
  }

  return issues
}

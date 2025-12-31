
import { google } from "googleapis";
import { ParsedProblem } from "./file-parser";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export async function getGoogleAuth() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    // Private Key 처리: \n 문자열을 실제 개행문자로 변환
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
        throw new Error("Google Service Account credential is missing.");
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: SCOPES,
    });

    return auth;
}

export async function getSheetNames(spreadsheetId: string): Promise<string[]> {
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
    });

    const titles =
        response.data.sheets
            ?.map((sheet) => sheet.properties?.title)
            .filter((title): title is string => !!title) || [];

    return titles;
}

export async function getSheetValues(
    spreadsheetId: string,
    range: string
): Promise<string[][]> {
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    return response.data.values || [];
}

// ------------------------------------------------------------------
// Helper Functions for Sync
// ------------------------------------------------------------------

export interface SheetData {
    title: string;
    values: string[][];
}

/**
 * 스프레드시트의 모든 시트(탭) 데이터를 가져옵니다.
 * (간단한 구현을 위해 순차적으로 가져옵니다. 필요 시 병렬 처리 가능)
 */
export async function fetchSpreadsheetData(spreadsheetId: string): Promise<SheetData[]> {
    const sheetNames = await getSheetNames(spreadsheetId);
    const results: SheetData[] = [];

    // 병렬로 모든 시트 데이터 가져오기
    const promises = sheetNames.map(async (title) => {
        const values = await getSheetValues(spreadsheetId, title);
        return { title, values };
    });

    const sheets = await Promise.all(promises);
    return sheets;
}

/**
 * 구글 시트의 한 행(Row Array)을 파싱하여 ParsedProblem 객체로 변환합니다.
 * Header Mapping은 호출하는 쪽에서 이미 Object로 변환했다고 가정하거나,
 * 여기서는 단순히 Object -> ParsedProblem 매핑을 담당할 수 있습니다.
 * 
 * 하지만 route.ts 로직을 보면 Object로 변환된 row를 받아서 처리하는게 아니라
 * 여기서 바로 처리하기를 원했던 것 같습니다.
 * 
 * 호환성을 위해 route.ts에서 Object로 변환한 `obj`를 인자로 받는 것으로 가정하고
 * rowObj -> ParsedProblem 변환 함수를 작성합니다.
 */
export function parseRow(rowObj: Record<string, string>, rowIndex: number): ParsedProblem | null {
    // 필수 필드 체크 (가장 기본적인 것만)
    // 문제 번호나 정답 등이 없으면 스킵할 수도 있음

    // 간단한 데이터 정제
    const clean = (val: string) => val?.trim() || "";

    // 숫자로 변환 (실패 시 0 or undefined)
    const num = (val: string) => {
        const n = Number(clean(val));
        return isNaN(n) ? 0 : n;
    }
    const numOrUndefined = (val: string) => {
        const n = Number(clean(val));
        return isNaN(n) ? undefined : n;
    }

    // 날짜 파싱 (YYYY-MM-DD or YYYY.MM.DD)
    const date = (val: string): Date | undefined => {
        const s = clean(val).replace(/\./g, "-");
        if (!s) return undefined;
        const d = new Date(s);
        return isNaN(d.getTime()) ? undefined : d;
    }

    // 인덱스가 없으면 문제 데이터로서 가치가 없음 (혹은 자동생성?)
    // 현재 시스템상 Index는 필수라고 가정
    const index = num(rowObj["Index"] || rowObj["인덱스"]);
    if (!index) return null; // Skip invalid rows

    return {
        // 필수 식별자
        index: index,
        subject: clean(rowObj["과목"]),

        // 메타 데이터
        problemType: clean(rowObj["문제 구분"]),
        examCode: clean(rowObj["시험지 코드"]),
        organization: clean(rowObj["시행 기관"]),
        subCategory: clean(rowObj["세부 과목"]),
        examYear: clean(rowObj["시행 연도"]),
        problemNumber: numOrUndefined(rowObj["문제 번호"]),

        // 문제 속성
        questionType: clean(rowObj["문제 유형"]),
        answer: clean(rowObj["정답"]),
        difficulty: clean(rowObj["난이도"]),
        score: numOrUndefined(rowObj["배점"]),

        // 정답률 통계
        correctRate: numOrUndefined(rowObj["정답률"]),
        choiceRate1: numOrUndefined(rowObj["①"]),
        choiceRate2: numOrUndefined(rowObj["②"]),
        choiceRate3: numOrUndefined(rowObj["③"]),
        choiceRate4: numOrUndefined(rowObj["④"]),
        choiceRate5: numOrUndefined(rowObj["⑤"]),

        // 작업 상태
        problemPosted: clean(rowObj["문제 탑재"]) === "완료",
        problemWorker: clean(rowObj["문제 작업자"]),
        problemWorkDate: date(rowObj["문제 작업일"]),

        solutionPosted: clean(rowObj["해설 탑재"]) === "완료",
        solutionWorker: clean(rowObj["해설 작업자"]),
        solutionWorkDate: date(rowObj["해설 작업일"]),
    };
}


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
 */
export async function fetchSpreadsheetData(spreadsheetId: string): Promise<SheetData[]> {
    const sheetNames = await getSheetNames(spreadsheetId);

    // 병렬로 모든 시트 데이터 가져오기
    const promises = sheetNames.map(async (title) => {
        const values = await getSheetValues(spreadsheetId, title);
        return { title, values };
    });

    const sheets = await Promise.all(promises);
    return sheets;
}

/**
 * 구글 시트의 한 행(Row Object)을 파싱하여 ParsedProblem 객체로 변환합니다.
 *
 * 실제 스프레드시트 헤더:
 * Index, 문제종류, 시험지코드, 출제기관, 과목, 소분류1, 시행년도, 문항번호,
 * 정답, 난이도, 배점, 정답률, 1번 선택비율~5번 선택비율,
 * 문제게시YN, Worker, Work_Date, 해설게시YN, Worker, Work_Date, 객관식주관식
 */
export function parseRow(rowObj: Record<string, string>, _rowIndex: number): ParsedProblem | null {
    // 간단한 데이터 정제
    const clean = (val: string | undefined) => val?.trim() || "";

    // 숫자로 변환 (실패 시 0)
    const num = (val: string | undefined) => {
        const s = clean(val).replace(/[%,\s]/g, "");
        const n = Number(s);
        return isNaN(n) ? 0 : n;
    };

    // 숫자로 변환 (실패 시 undefined)
    const numOrUndefined = (val: string | undefined) => {
        const s = clean(val).replace(/[%,\s]/g, "");
        if (!s) return undefined;
        const n = Number(s);
        return isNaN(n) ? undefined : n;
    };

    // 날짜 파싱 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
    const parseDate = (val: string | undefined): Date | undefined => {
        const s = clean(val).replace(/[./]/g, "-");
        if (!s) return undefined;
        const d = new Date(s);
        return isNaN(d.getTime()) ? undefined : d;
    };

    // Boolean 변환 (Y, 완료, TRUE 등)
    const toBool = (val: string | undefined): boolean => {
        const s = clean(val).toUpperCase();
        return s === "Y" || s === "완료" || s === "TRUE" || s === "1";
    };

    // Index는 필수 (대소문자 모두 지원: Index, index)
    const index = num(rowObj["Index"]) || num(rowObj["index"]);
    if (!index) return null;

    // 객관식/주관식 변환
    const questionTypeRaw = clean(rowObj["객관식주관식"]);
    const questionType: 'MULTIPLE' | 'SUBJECTIVE' =
        (questionTypeRaw === '객관식' || questionTypeRaw.toUpperCase() === 'MULTIPLE' || questionTypeRaw === 'M')
            ? 'MULTIPLE'
            : 'SUBJECTIVE';

    // Worker 컬럼이 중복되므로, 헤더 순서에 따라 구분 필요
    // 실제 데이터에서는 첫번째 Worker가 문제 작업자, 두번째가 해설 작업자
    // 하지만 Object로 변환 시 같은 키는 덮어씌워지므로,
    // 호출하는 쪽에서 별도 처리하거나 헤더를 다르게 변환해야 함
    // 일단 rowObj에서 직접 접근하는 방식으로 처리

    return {
        // 필수 식별자
        index: index,
        subject: clean(rowObj["과목"]),

        // 메타 데이터 - 실제 헤더명으로 매핑
        problemType: clean(rowObj["문제종류"]),
        examCode: clean(rowObj["시험지코드"]),
        organization: clean(rowObj["출제기관"]),
        subCategory: clean(rowObj["소분류1"]),
        examYear: num(rowObj["시행년도"]),
        problemNumber: numOrUndefined(rowObj["문항번호"]) || 0,

        // 문제 속성
        questionType,
        answer: clean(rowObj["정답"]),
        difficulty: clean(rowObj["난이도"]),
        score: numOrUndefined(rowObj["배점"]),

        // 정답률 통계 - 실제 헤더명으로 매핑
        correctRate: numOrUndefined(rowObj["정답률"]),
        choiceRate1: numOrUndefined(rowObj["1번 선택비율"]),
        choiceRate2: numOrUndefined(rowObj["2번 선택비율"]),
        choiceRate3: numOrUndefined(rowObj["3번 선택비율"]),
        choiceRate4: numOrUndefined(rowObj["4번 선택비율"]),
        choiceRate5: numOrUndefined(rowObj["5번 선택비율"]),

        // 작업 상태 - 실제 헤더명으로 매핑
        // 문제게시YN, 해설게시YN
        problemPosted: toBool(rowObj["문제게시YN"]),
        solutionPosted: toBool(rowObj["해설게시YN"]),

        // Worker 컬럼 중복 문제:
        // 호출 측에서 별도 처리 필요 (problemWorker, solutionWorker)
        // 일단 Worker를 문제 작업자로 처리
        problemWorker: clean(rowObj["Worker"]) || undefined,
        problemWorkDate: parseDate(rowObj["Work_Date"]),

        // 해설 작업자는 별도 키가 있다고 가정 (Worker_2, Work_Date_2 등)
        // 또는 호출 측에서 인덱스 기반으로 처리
        solutionWorker: clean(rowObj["Worker_해설"]) || clean(rowObj["해설Worker"]) || undefined,
        solutionWorkDate: parseDate(rowObj["Work_Date_해설"]) || parseDate(rowObj["해설Work_Date"]),
    };
}

/**
 * 헤더 배열과 데이터 행 배열을 Object로 변환
 * 중복 헤더 처리: Worker, Work_Date가 두 번 나오면 두 번째는 _해설 접미사 추가
 */
export function rowToObject(header: string[], row: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    const usedKeys: Record<string, number> = {};

    header.forEach((colName, idx) => {
        if (!colName) return;

        const trimmedName = colName.trim();

        // 중복 키 처리 (Worker, Work_Date)
        if (usedKeys[trimmedName] !== undefined) {
            usedKeys[trimmedName]++;
            // 두 번째 Worker/Work_Date는 해설용
            if (trimmedName === "Worker" || trimmedName === "Work_Date") {
                obj[`${trimmedName}_해설`] = row[idx] || "";
            } else {
                obj[`${trimmedName}_${usedKeys[trimmedName]}`] = row[idx] || "";
            }
        } else {
            usedKeys[trimmedName] = 0;
            obj[trimmedName] = row[idx] || "";
        }
    });

    return obj;
}

/**
 * Google Sheets 데이터를 메모리에 캐싱하는 모듈
 *
 * 사용법:
 * - getProblemsFromCache(): 캐시된 문제 데이터 조회
 * - refreshCache(): 캐시 수동 갱신
 * - getCacheStatus(): 캐시 상태 확인
 */

import { fetchSpreadsheetData, parseRow, rowToObject } from "./google-sheets";
import { SHEET_SYNC_CONFIG } from "@/config/sheet-sync-config";
import { prisma } from "./db";

// 캐시 전용 타입 (Google Sheets 원본 데이터 기반)
export interface CachedProblem {
    id: string;  // 고유 식별자 (시트명_인덱스)
    sheetSource: string;  // 원본 시트 (public/private)
    sheetTab: string;  // 원본 탭 이름

    // 기본 식별자
    index: number;
    subject: string;

    // 메타 데이터
    problemType?: string;
    examCode?: string;
    organization: string;
    subCategory?: string;
    examYear: string;  // Google Sheets에서는 string으로 유지
    problemNumber?: number;

    // 문제 속성
    questionType: string;  // '객관식' | '주관식' 등 (enum 대신 string)
    answer?: string;
    difficulty?: string;
    score?: number;

    // 정답률 통계
    correctRate?: number;
    choiceRate1?: number;
    choiceRate2?: number;
    choiceRate3?: number;
    choiceRate4?: number;
    choiceRate5?: number;

    // 작업 상태
    problemPosted: boolean;
    problemWorker?: string;
    problemWorkDate?: Date;
    solutionPosted: boolean;
    solutionWorker?: string;
    solutionWorkDate?: Date;
}

interface CacheData {
    problems: CachedProblem[];
    lastUpdated: Date | null;
    isLoading: boolean;
    error: string | null;
}

// 메모리 캐시 (싱글톤)
const cache: CacheData = {
    problems: [],
    lastUpdated: null,
    isLoading: false,
    error: null,
};

// 과목명 매핑 (공교육 + 사설)
const SUBJECT_MAPPING: Record<string, string> = {
    // 공교육 - 국영수
    "Korean_Labeling": "국어",
    "Math_Labeling": "수학",
    "English": "영어",
    // 공교육 - 과탐
    "Physics_labeling": "과탐 - 물리",
    "CHE_labeling": "과탐 - 화학",
    "BIO_labeling": "과탐 - 생명과학",
    "EAS_Labeling1": "과탐 - 지구과학",
    // 사설 - 국영수
    "IDX_KorPrivQ": "국어(사설)",
    "IDX_EngPrivQ": "영어(사설)",
    "IDX_MathPrivQ": "수학(사설)",
    "IDX_MathLocalQ": "수학(지역사설)",
    // 사설 - 과탐
    "IDX_PHYPrivQ": "과탐 - 물리(사설)",
    "IDX_CHMPrivQ": "과탐 - 화학(사설)",
    "IDX_BIOPrivQ": "과탐 - 생명과학(사설)",
    "IDX_EASPrivQ": "과탐 - 지구과학(사설)",
    // 사설 - 사탐
    "IDX_SCLPrivQ": "사탐(사설)",
    "IDX_PLWPrivQ": "정치와법(사설)",
    // 사설 - 기타
    "IDX_ETSPrivQ": "ETS(사설)",
    "IDX_LEVPrivQ": "LEV(사설)",
};

/**
 * 캐시 상태 조회
 */
export function getCacheStatus() {
    return {
        totalProblems: cache.problems.length,
        lastUpdated: cache.lastUpdated,
        isLoading: cache.isLoading,
        error: cache.error,
        isReady: cache.problems.length > 0 && !cache.isLoading,
    };
}

/**
 * 캐시에서 문제 데이터 조회 (필터링/페이지네이션 지원)
 */
export function getProblemsFromCache(options?: {
    subject?: string;
    examYear?: string;
    organization?: string;
    examCode?: string;
    worker?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): { problems: CachedProblem[]; total: number; page: number; limit: number } {
    let filtered = [...cache.problems];

    // 필터링
    if (options?.subject) {
        filtered = filtered.filter(p => p.subject === options.subject);
    }
    if (options?.examYear) {
        filtered = filtered.filter(p => p.examYear === options.examYear);
    }
    if (options?.organization) {
        filtered = filtered.filter(p => p.organization === options.organization);
    }
    if (options?.examCode) {
        filtered = filtered.filter(p => p.examCode === options.examCode);
    }
    if (options?.worker) {
        filtered = filtered.filter(p =>
            p.problemWorker === options.worker || p.solutionWorker === options.worker
        );
    }
    if (options?.status) {
        switch (options.status) {
            case 'not_started':
                filtered = filtered.filter(p => !p.problemPosted && !p.solutionPosted);
                break;
            case 'problem_only':
                filtered = filtered.filter(p => p.problemPosted && !p.solutionPosted);
                break;
            case 'completed':
                filtered = filtered.filter(p => p.problemPosted && p.solutionPosted);
                break;
        }
    }
    if (options?.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter(p =>
            p.examCode?.toLowerCase().includes(searchLower) ||
            p.subject?.toLowerCase().includes(searchLower) ||
            String(p.index).includes(searchLower) ||
            String(p.problemNumber).includes(searchLower)
        );
    }

    // 정렬
    const sortBy = options?.sortBy || 'index';
    const sortOrder = options?.sortOrder || 'asc';
    filtered.sort((a, b) => {
        const aVal = (a as any)[sortBy] ?? '';
        const bVal = (b as any)[sortBy] ?? '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortOrder === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
    });

    // 페이지네이션
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return {
        problems: paginated,
        total: filtered.length,
        page,
        limit,
    };
}

/**
 * 필터 옵션 조회 (과목, 연도, 기관 등)
 */
export function getFilterOptionsFromCache() {
    const subjects = new Set<string>();
    const examYears = new Set<string>();
    const organizations = new Set<string>();
    const workers = new Set<string>();

    for (const p of cache.problems) {
        if (p.subject) subjects.add(p.subject);
        if (p.examYear) examYears.add(p.examYear);
        if (p.organization) organizations.add(p.organization);
        if (p.problemWorker) workers.add(p.problemWorker);
        if (p.solutionWorker) workers.add(p.solutionWorker);
    }

    return {
        subjects: Array.from(subjects).sort(),
        examYears: Array.from(examYears).sort().reverse(),
        organizations: Array.from(organizations).sort(),
        workers: Array.from(workers).sort(),
    };
}

// 과목을 4개 카테고리로 분류하는 함수
function getCategoryFromSubject(subject: string): '국어' | '수학' | '영어' | '탐구' {
    if (subject.includes('국어')) return '국어';
    if (subject.includes('수학')) return '수학';
    if (subject.includes('영어') || subject.includes('English') || subject.includes('ETS') || subject.includes('LEV')) return '영어';
    // 과탐, 사탐 모두 탐구로 분류
    return '탐구';
}

export interface CategoryStats {
    problemCount: number;
    solutionCount: number;
}

export interface WorkerCategoryStats {
    problemCount: number;
    solutionCount: number;
    byCategory: {
        국어: CategoryStats;
        수학: CategoryStats;
        영어: CategoryStats;
        탐구: CategoryStats;
    };
}

/**
 * 통계 데이터 조회
 */
export function getStatsFromCache() {
    const total = cache.problems.length;
    const problemPosted = cache.problems.filter(p => p.problemPosted).length;
    const solutionPosted = cache.problems.filter(p => p.solutionPosted).length;
    const completed = cache.problems.filter(p => p.problemPosted && p.solutionPosted).length;
    const notStarted = cache.problems.filter(p => !p.problemPosted && !p.solutionPosted).length;

    // 과목별 통계
    const bySubject: Record<string, { total: number; problemPosted: number; solutionPosted: number }> = {};
    for (const p of cache.problems) {
        const subj = p.subject || '미분류';
        if (!bySubject[subj]) {
            bySubject[subj] = { total: 0, problemPosted: 0, solutionPosted: 0 };
        }
        bySubject[subj].total++;
        if (p.problemPosted) bySubject[subj].problemPosted++;
        if (p.solutionPosted) bySubject[subj].solutionPosted++;
    }

    // 작업자별 통계 (4개 카테고리 포함)
    const byWorker: Record<string, WorkerCategoryStats> = {};

    const createEmptyStats = (): WorkerCategoryStats => ({
        problemCount: 0,
        solutionCount: 0,
        byCategory: {
            국어: { problemCount: 0, solutionCount: 0 },
            수학: { problemCount: 0, solutionCount: 0 },
            영어: { problemCount: 0, solutionCount: 0 },
            탐구: { problemCount: 0, solutionCount: 0 },
        }
    });

    for (const p of cache.problems) {
        const category = getCategoryFromSubject(p.subject || '');

        if (p.problemWorker) {
            if (!byWorker[p.problemWorker]) {
                byWorker[p.problemWorker] = createEmptyStats();
            }
            byWorker[p.problemWorker].problemCount++;
            byWorker[p.problemWorker].byCategory[category].problemCount++;
        }
        if (p.solutionWorker) {
            if (!byWorker[p.solutionWorker]) {
                byWorker[p.solutionWorker] = createEmptyStats();
            }
            byWorker[p.solutionWorker].solutionCount++;
            byWorker[p.solutionWorker].byCategory[category].solutionCount++;
        }
    }

    return {
        total,
        problemPosted,
        solutionPosted,
        completed,
        notStarted,
        inProgress: total - completed - notStarted,
        bySubject,
        byWorker,
    };
}

/**
 * 시험지(examCode) 그룹별 통계
 */
export function getExamGroupsFromCache(options?: {
    subject?: string;
    examYear?: string;
    organization?: string;
}) {
    let filtered = [...cache.problems];

    if (options?.subject) {
        filtered = filtered.filter(p => p.subject === options.subject);
    }
    if (options?.examYear) {
        filtered = filtered.filter(p => p.examYear === options.examYear);
    }
    if (options?.organization) {
        filtered = filtered.filter(p => p.organization === options.organization);
    }

    // examCode별 그룹화
    const groups: Record<string, {
        examCode: string;
        subject: string;
        examYear: string;
        organization: string;
        problemType: string;
        totalCount: number;
        problemPostedCount: number;
        solutionPostedCount: number;
    }> = {};

    for (const p of filtered) {
        const key = p.examCode || 'unknown';
        if (!groups[key]) {
            groups[key] = {
                examCode: p.examCode || '',
                subject: p.subject || '',
                examYear: p.examYear || '',
                organization: p.organization || '',
                problemType: p.problemType || '',
                totalCount: 0,
                problemPostedCount: 0,
                solutionPostedCount: 0,
            };
        }
        groups[key].totalCount++;
        if (p.problemPosted) groups[key].problemPostedCount++;
        if (p.solutionPosted) groups[key].solutionPostedCount++;
    }

    return Object.values(groups).sort((a, b) => {
        // 연도 내림차순 → 과목 오름차순
        if (a.examYear !== b.examYear) {
            return b.examYear.localeCompare(a.examYear);
        }
        return a.subject.localeCompare(b.subject);
    });
}

/**
 * 캐시 갱신 (Google Sheets에서 데이터 새로 가져오기)
 */
export async function refreshCache(
    onProgress?: (message: string) => void
): Promise<{ success: boolean; message: string; count: number }> {
    if (cache.isLoading) {
        return { success: false, message: '이미 갱신 중입니다.', count: cache.problems.length };
    }

    cache.isLoading = true;
    cache.error = null;
    const newProblems: CachedProblem[] = [];

    try {
        for (const [sourceKey, config] of Object.entries(SHEET_SYNC_CONFIG)) {
            onProgress?.(`[${config.label}] 시트 데이터 가져오는 중...`);

            const sheets = await fetchSpreadsheetData(config.spreadsheetId);

            for (const sheet of sheets) {
                // 탭 필터링 (public 시트의 경우)
                if ('sheets' in config && config.sheets) {
                    const allowedSheets = config.sheets as readonly string[];
                    if (!allowedSheets.includes(sheet.title)) continue;
                }

                onProgress?.(`[${config.label}] ${sheet.title} 처리 중...`);

                const header = sheet.values[0];
                const dataRows = sheet.values.slice(1);

                // 과목명 결정
                const mappedSubject = SUBJECT_MAPPING[sheet.title];

                for (let i = 0; i < dataRows.length; i++) {
                    const rowArr = dataRows[i];
                    // 중복 헤더(Worker, Work_Date) 처리를 위해 rowToObject 사용
                    const obj = rowToObject(header, rowArr);

                    // 과목명 설정
                    if (mappedSubject) {
                        obj["과목"] = mappedSubject;
                    } else if (!obj["과목"]) {
                        obj["과목"] = sheet.title;
                    }

                    const parsed = parseRow(obj, i + 2);
                    if (parsed) {
                        // ParsedProblem -> CachedProblem 변환
                        const cachedProblem: CachedProblem = {
                            id: `${sourceKey}_${sheet.title}_${parsed.index}`,
                            sheetSource: sourceKey,
                            sheetTab: sheet.title,
                            index: parsed.index,
                            subject: parsed.subject,
                            problemType: parsed.problemType,
                            examCode: parsed.examCode,
                            organization: parsed.organization,
                            subCategory: parsed.subCategory,
                            examYear: String(parsed.examYear),  // number -> string
                            problemNumber: parsed.problemNumber,
                            questionType: String(parsed.questionType),  // enum -> string
                            answer: parsed.answer,
                            difficulty: parsed.difficulty,
                            score: parsed.score,
                            correctRate: parsed.correctRate,
                            choiceRate1: parsed.choiceRate1,
                            choiceRate2: parsed.choiceRate2,
                            choiceRate3: parsed.choiceRate3,
                            choiceRate4: parsed.choiceRate4,
                            choiceRate5: parsed.choiceRate5,
                            problemPosted: parsed.problemPosted,
                            problemWorker: parsed.problemWorker,
                            problemWorkDate: parsed.problemWorkDate,
                            solutionPosted: parsed.solutionPosted,
                            solutionWorker: parsed.solutionWorker,
                            solutionWorkDate: parsed.solutionWorkDate,
                        };
                        newProblems.push(cachedProblem);
                    }
                }
            }
        }

        // 캐시 업데이트
        cache.problems = newProblems;
        cache.lastUpdated = new Date();
        cache.isLoading = false;

        return {
            success: true,
            message: `${newProblems.length}개 문제 로드 완료`,
            count: newProblems.length,
        };

    } catch (error) {
        cache.isLoading = false;
        cache.error = error instanceof Error ? error.message : '알 수 없는 오류';
        return {
            success: false,
            message: cache.error,
            count: cache.problems.length,
        };
    }
}

/**
 * 캐시가 비어있으면 자동으로 갱신
 */
export async function ensureCacheReady(): Promise<boolean> {
    if (cache.problems.length === 0 && !cache.isLoading) {
        const result = await refreshCache();
        return result.success;
    }
    return cache.problems.length > 0;
}

/**
 * 캐시 데이터를 DB에 저장 (upsert)
 */
export async function saveCacheToDb(
    onProgress?: (message: string) => void
): Promise<{ success: boolean; message: string; saved: number; failed: number }> {
    if (cache.problems.length === 0) {
        return { success: false, message: '캐시가 비어있습니다.', saved: 0, failed: 0 };
    }

    let saved = 0;
    let failed = 0;
    const batchSize = 100;
    const total = cache.problems.length;

    onProgress?.(`DB 저장 시작... (총 ${total}개)`);

    // 배치 단위로 처리
    for (let i = 0; i < total; i += batchSize) {
        const batch = cache.problems.slice(i, i + batchSize);

        onProgress?.(`DB 저장 중... ${Math.min(i + batchSize, total)}/${total}`);

        // 병렬 upsert
        const results = await Promise.allSettled(
            batch.map(async (p) => {
                // questionType 변환
                const qType = p.questionType?.toUpperCase();
                const questionType: 'MULTIPLE' | 'SUBJECTIVE' =
                    (qType === 'MULTIPLE' || p.questionType === '객관식') ? 'MULTIPLE' : 'SUBJECTIVE';

                const indexNum = typeof p.index === 'number' ? p.index : parseInt(String(p.index)) || 0;

                await prisma.problem.upsert({
                    where: {
                        subject_index: {
                            subject: p.subject,
                            index: indexNum,
                        },
                    },
                    create: {
                        index: indexNum,
                        subject: p.subject,
                        problemType: p.problemType || null,
                        examCode: p.examCode || null,
                        organization: p.organization || '',
                        subCategory: p.subCategory || null,
                        examYear: p.examYear ? parseInt(p.examYear) : 0,
                        problemNumber: p.problemNumber || 0,
                        questionType,
                        answer: p.answer || null,
                        difficulty: p.difficulty || null,
                        score: p.score ?? null,
                        correctRate: p.correctRate ?? null,
                        choiceRate1: p.choiceRate1 ?? null,
                        choiceRate2: p.choiceRate2 ?? null,
                        choiceRate3: p.choiceRate3 ?? null,
                        choiceRate4: p.choiceRate4 ?? null,
                        choiceRate5: p.choiceRate5 ?? null,
                        problemPosted: p.problemPosted,
                        problemWorker: p.problemWorker || null,
                        problemWorkDate: p.problemWorkDate || null,
                        solutionPosted: p.solutionPosted,
                        solutionWorker: p.solutionWorker || null,
                        solutionWorkDate: p.solutionWorkDate || null,
                    },
                    update: {
                        problemType: p.problemType || null,
                        examCode: p.examCode || null,
                        organization: p.organization || '',
                        subCategory: p.subCategory || null,
                        examYear: p.examYear ? parseInt(p.examYear) : 0,
                        problemNumber: p.problemNumber || 0,
                        questionType,
                        answer: p.answer || null,
                        difficulty: p.difficulty || null,
                        score: p.score ?? null,
                        correctRate: p.correctRate ?? null,
                        choiceRate1: p.choiceRate1 ?? null,
                        choiceRate2: p.choiceRate2 ?? null,
                        choiceRate3: p.choiceRate3 ?? null,
                        choiceRate4: p.choiceRate4 ?? null,
                        choiceRate5: p.choiceRate5 ?? null,
                        problemPosted: p.problemPosted,
                        problemWorker: p.problemWorker || null,
                        problemWorkDate: p.problemWorkDate || null,
                        solutionPosted: p.solutionPosted,
                        solutionWorker: p.solutionWorker || null,
                        solutionWorkDate: p.solutionWorkDate || null,
                    },
                });
            })
        );

        // 결과 집계
        for (const result of results) {
            if (result.status === 'fulfilled') {
                saved++;
            } else {
                failed++;
            }
        }
    }

    const message = `DB 저장 완료: ${saved}개 성공, ${failed}개 실패`;
    onProgress?.(message);

    return { success: failed === 0, message, saved, failed };
}

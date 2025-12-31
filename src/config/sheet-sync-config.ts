export const SHEET_SYNC_CONFIG = {
    // 공교육 (평가원, 교육청 등)
    public: {
        spreadsheetId: "1gsM8vlZ5GP-ERdk5kfNHyu5UUwDv6S-jDhDnhMz7hTs",
        label: "공교육",
        // 명시된 탭만 가져옵니다.
        sheets: [
            "Korean_Labeling",
            "Math_Labeling",
            "English",
            "Physics_labeling",
            "CHE_labeling",
            "BIO_labeling",
            "EAS_Labeling1"
        ]
    },
    // 사설 (시대인재, 더프 등)
    private: {
        spreadsheetId: "1YMxE9gb_65mdfo9CfxCaz93M4tMlaPlKwdUv2jG7xgQ",
        label: "사설",
    }
} as const;

// 배치 사이즈 및 동시성 설정
// OOM 방지를 위해 500 -> 50 으로 감소
export const SYNC_BATCH_SIZE = 50
export const SYNC_CONCURRENCY = 5;

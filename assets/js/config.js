// =============================================================
//  플랫폼 설정
//  - 아래 값이 비어 있으면 "데모 모드"로 동작합니다 (브라우저 localStorage 사용).
//  - 운영 전환: Supabase / 토스페이먼츠 키를 입력하세요. (README 참고)
//  - 여기에는 "공개용" 키만 넣습니다. 시크릿 키는 Vercel 환경변수에만 넣으세요.
// =============================================================
export const CONFIG = {
  SUPABASE_URL: "",        // 예: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "",   // Supabase > Project Settings > API > anon public key
  TOSS_CLIENT_KEY: "",     // 토스페이먼츠 클라이언트 키 (test_ck_... / live_ck_...)
  DEFAULT_FEE_RATE: 0.1,   // 플랫폼 중개 수수료 기본값 (10%)
  SITE_NAME: "와이드가드 매칭",
};

export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

export const CATEGORIES = [
  "시설경비",
  "신변보호",
  "혼잡·교통유도",
  "이주관리·범죄예방",
  "행정대집행지원",
  "청소대행",
];

export const REGIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종",
  "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주",
];

export const REQUEST_STATUS = {
  open: "견적 모집중",
  matched: "업체 선정",
  paid: "결제 완료",
  in_progress: "진행중",
  completed: "완료",
  canceled: "취소",
};

export const QUOTE_STATUS = {
  submitted: "제출됨",
  accepted: "선정됨",
  rejected: "미선정",
};

export const VENDOR_STATUS = {
  pending: "승인 대기",
  approved: "승인",
  rejected: "반려",
};

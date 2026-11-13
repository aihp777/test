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

// -------------------------------------------------------------
//  운영사 사업자 정보 (전자상거래법 제10조·제13조 표시 의무)
//  ※ "확인 후 입력" 항목은 실제 값으로 바꿔야 정식 오픈할 수 있습니다.
// -------------------------------------------------------------
export const COMPANY = {
  name: "주식회사 와이드가드",
  ceo: "김정환",
  address: "경기도 김포시 풍무2로 25, 2층 2-2호",
  tel: "031-945-2001",
  fax: "031-3442-2001",
  email: "",                    // 대표 이메일 (확인 후 입력)
  bizNo: "",                    // 사업자등록번호 (확인 후 입력)
  mailOrderNo: "",              // 통신판매업 신고번호 (신고 후 입력)
  securityLicenseNo: "",        // 경비업 허가번호 (확인 후 입력)
  privacyOfficer: "김정환",     // 개인정보보호책임자
  hosting: "Vercel Inc. / Supabase Inc.",
};
export const pending = (v, label = "확인 후 입력") => v || `(${label})`;

// -------------------------------------------------------------
//  공동 관리자 (업무 동시 확인·알림)
//  ※ 휴대폰 번호는 공개 저장소에 올리면 안 되므로 코드에 넣지 않습니다.
//    Vercel 환경변수 ADMIN_PHONES="번호1,번호2" 로 설정하면 문자(SMS) 알림이 두 분께 동시에 발송됩니다.
// -------------------------------------------------------------
export const ADMIN_TEAM = [
  { name: "김정환", title: "대표이사" },
  { name: "김종연", title: "사내이사" },
];
export const TASK_TYPES = {
  guest_inquiry: { label: "비회원 견적문의", icon: "📞" },
  request: { label: "회원 견적요청", icon: "📝" },
  vendor_review: { label: "업체 승인 심사", icon: "🏢" },
  payment: { label: "결제 완료", icon: "💳" },
  settle: { label: "정산 대기", icon: "🏦" },
  refund: { label: "환불 처리", icon: "↩️" },
  bid: { label: "나라장터 신규 공고", icon: "📢" },
  bid_result: { label: "나라장터 개찰 결과", icon: "🏁" },
};
export const TASK_STATUS = { new: "신규", in_progress: "처리중", done: "완료" };

// 비회원 견적문의: 휴대폰 문자 인증
export const OTP = { length: 6, ttlMin: 5, maxSendPerHour: 5 };

// 나라장터(조달청) 입찰공고 수집 조건
export const BID = {
  keywords: ["경비", "경호", "보안요원", "안전요원", "교통정리", "주차관리", "질서유지"],
  excludeKeywords: ["경비지원", "운영경비", "여비", "경비정산"],
  homeRegion: "경기",            // 주사무소 소재지 (지역제한 판단 기준)
  okRegions: ["경기", "경기도"], // 참가 가능 지역제한 (빈 값 = 전국)
};
export const BID_STATUS = {
  new: "신규", review: "검토중", go: "참여 결정", submitted: "투찰 완료", won: "낙찰", lost: "미낙찰", skip: "불참",
};

// -------------------------------------------------------------
//  서비스 분야 ↔ 필요한 허가·신고 (경비업법 제2조·제4조, 공중위생관리법 제3조)
//  업체는 보유한 허가에 해당하는 분야만 선택할 수 있습니다.
// -------------------------------------------------------------
// ※ 특수경비는 차후 별도 설계 예정 (특수경비업자 겸업 제한: 경비업법 제7조⑨).
//   보안 매칭 코드(SPECIAL, FACILITY_TYPES, 요청 보안 모드)는 남겨 두었으며,
//   ENABLE_SPECIAL 을 true 로 바꾸면 분야·허가 목록에 다시 나타납니다.
export const ENABLE_SPECIAL = false;
export const SPECIAL = "특수경비";
export const CATEGORIES = [
  "시설경비",
  "신변보호",
  "혼잡·교통유도",
  "이주관리·범죄예방",
  "행정대집행지원",
  ...(ENABLE_SPECIAL ? [SPECIAL] : []),
  "청소대행",
];
// 경비업법 제2조1호 경비업무 (특수경비는 차후)
export const LICENSES = ["시설경비", "호송경비", "신변보호", "기계경비", "혼잡·교통유도경비", ...(ENABLE_SPECIAL ? [SPECIAL] : [])];
export const SANITATION = "건물위생관리업"; // 공중위생관리법 신고
export const CATEGORY_REQUIRES = {
  "시설경비": ["시설경비"],
  "신변보호": ["신변보호"],
  "혼잡·교통유도": ["혼잡·교통유도경비"],
  "이주관리·범죄예방": ["시설경비"],       // 경비원 배치 시 시설경비 허가 필요 (대부분 집단민원현장)
  "행정대집행지원": ["시설경비"],          // 행정대집행 장소 = 집단민원현장
  [SPECIAL]: [SPECIAL],                    // 국가중요시설 경비 (ENABLE_SPECIAL 일 때만 노출)
  "청소대행": [SANITATION],
};
export const allowedCategories = (licenses = []) => CATEGORIES.filter((c) => CATEGORY_REQUIRES[c].every((l) => licenses.includes(l)));

// 집단민원현장 (경비업법 제2조5호) — 배치 48시간 전 배치허가, 경비지도사 현장 배치 의무
export const COLLECTIVE_SITES = {
  "": "해당 없음",
  labor: "노동쟁의(파업 등) 발생 사업장",
  redevelopment: "재개발·재건축 등 정비사업 다툼 장소",
  facility_dispute: "시설물 설치 관련 민원 장소",
  shareholders: "주주총회 관련 다툼 장소",
  property: "부동산·동산 권리 다툼 장소 (명도 등)",
  event100: "100명 이상 모이는 국제·문화·예술·체육 행사장",
  admin_execution: "행정대집행 장소",
};
// 특수경비 대상 시설 유형 (구체적 시설명·위치는 플랫폼에 기재 금지)
export const FACILITY_TYPES = ["공항·항만", "발전·에너지 시설", "수도·통신 시설", "산업·연구 시설", "공공기관 청사", "기타 국가중요시설"];

export const REGIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종",
  "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주",
];

// 전국 / 권역 단위 운영
export const NATIONWIDE = "전국";
export const REGION_GROUPS = {
  "수도권": ["서울", "경기", "인천"],
  "강원권": ["강원"],
  "충청권": ["대전", "세종", "충북", "충남"],
  "호남권": ["광주", "전북", "전남"],
  "영남권": ["부산", "대구", "울산", "경북", "경남"],
  "제주권": ["제주"],
};
// 업체 서비스 지역(vendorRegions)이 요청 지역(region)을 커버하는지
export const covers = (vendorRegions = [], region) =>
  !region || region === NATIONWIDE || vendorRegions.includes(NATIONWIDE) || vendorRegions.includes(region);
export const regionLabel = (regions = []) => (regions.includes(NATIONWIDE) ? "전국" : regions.join(", "));

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

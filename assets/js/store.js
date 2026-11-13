// =============================================================
//  데이터 계층: 데모(localStorage) / 운영(Supabase) 공통 인터페이스
// =============================================================
import { CONFIG, IS_DEMO, NATIONWIDE, covers, allowedCategories, SANITATION, SPECIAL, CATEGORY_REQUIRES, OTP } from "./config.js";

// 업체 보유 허가·신고 목록
export const vendorLicenses = (v) => [...(v.licenses || []), ...(v.sanitation_no ? [SANITATION] : [])];
// 업체 등록 검증: 허가 없는 분야 선택 금지 (경비업법 제7조의2 무허가 도급 방지)
function validateVendor(data) {
  const allowed = allowedCategories(vendorLicenses(data));
  const bad = (data.categories || []).filter((c) => !allowed.includes(c));
  if (bad.length) throw new Error(`허가(신고)가 없는 분야는 선택할 수 없습니다: ${bad.join(", ")} → 필요: ${bad.map((c) => CATEGORY_REQUIRES[c].join("·")).join(" / ")}`);
  if ((data.licenses || []).length && !String(data.license_no || "").trim()) throw new Error("경비업 허가번호를 입력해 주세요.");
}
// 견적 요청 검증: 특수경비는 사진 첨부 금지·시설 유형 필수 (국가중요시설 보안)
function validateRequest(data, photos) {
  if (data.category === SPECIAL) {
    if (photos.length) throw new Error("특수경비 요청에는 보안상 사진을 첨부할 수 없습니다.");
    if (!data.facility_type) throw new Error("특수경비 대상 시설 유형을 선택해 주세요.");
  }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const makeOrderId = () => "WG" + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();

// -------------------------------------------------------------
//  DEMO STORE
// -------------------------------------------------------------
const DB_KEY = "wg_platform_v7";
const SESSION_KEY = "wg_session_v1";

function seed() {
  const t = (d) => new Date(Date.now() - d * 86400000).toISOString();
  // 공동 관리자 2인 (휴대폰 번호는 공개 코드에 넣지 않음 → Vercel 환경변수 ADMIN_PHONES)
  const admin = { id: "u-admin", email: "admin@demo.com", password: "demo1234", name: "김정환", title: "대표이사", phone: "", role: "admin", created_at: t(400) };
  const admin2 = { id: "u-admin2", email: "admin2@demo.com", password: "demo1234", name: "김종연", title: "사내이사", phone: "", role: "admin", created_at: t(400) };
  const cust = { id: "u-cust", email: "customer@demo.com", password: "demo1234", name: "김고객", phone: "010-1234-5678", role: "customer", created_at: t(60) };
  const v1u = { id: "u-v1", email: "vendor@demo.com", password: "demo1234", name: "김정환", phone: "031-945-2001", role: "vendor", created_at: t(300) };
  const v2u = { id: "u-v2", email: "vendor2@demo.com", password: "demo1234", name: "이대표", phone: "02-000-0000", role: "vendor", created_at: t(120) };
  const v3u = { id: "u-v3", email: "vendor3@demo.com", password: "demo1234", name: "박대표", phone: "032-000-0000", role: "vendor", created_at: t(1) };
  return {
    users: [admin, admin2, cust, v1u, v2u, v3u],
    vendors: [
      { id: "v-1", owner_id: "u-v1", company: "(주)와이드가드", ceo: "김정환", biz_no: "000-00-00000", phone: "031-945-2001", email: "vendor@demo.com", address: "경기도 김포시 풍무2로 25, 2층 2-2호",
        licenses: ["시설경비", "신변보호", "혼잡·교통유도경비"], license_no: "(데모) 허가번호 확인 후 입력", sanitation_no: "", docs: [], is_operator: true,
        categories: ["시설경비", "신변보호", "혼잡·교통유도", "이주관리·범죄예방", "행정대집행지원"], regions: [NATIONWIDE],
        intro: "경찰청 허가법인. 재개발·재건축 이주관리, 대형 행사 경비, VIP 신변보호 다수 실적 보유.", license_info: "경비업 허가증, 분사기 허가증", status: "approved", rating: 4.9, review_count: 128, created_at: t(300) },
      { id: "v-2", owner_id: "u-v2", company: "한빛시큐리티(데모)", ceo: "이대표", biz_no: "000-00-00001", phone: "02-000-0000", email: "vendor2@demo.com", address: "서울특별시",
        licenses: ["시설경비", "혼잡·교통유도경비"], license_no: "서울청 제0000호(데모)", sanitation_no: "", docs: [],
        categories: ["시설경비", "혼잡·교통유도"], regions: ["서울", "경기"], intro: "공연·행사 전문 경비업체 (데모 데이터)", license_info: "경비업 허가증", status: "approved", rating: 4.6, review_count: 41, created_at: t(120) },
      { id: "v-3", owner_id: "u-v3", company: "그린클린(데모)", ceo: "박대표", biz_no: "000-00-00002", phone: "032-000-0000", email: "vendor3@demo.com", address: "인천광역시",
        licenses: [], license_no: "", sanitation_no: "인천 제2026-000호(데모)", docs: [],
        categories: ["청소대행"], regions: ["인천", "경기"], intro: "빌딩·사무실 정밀 청소 (데모 데이터)", license_info: "건물위생관리업 신고", status: "pending", rating: 0, review_count: 0, created_at: t(1) },
    ],
    requests: [
      { id: "r-1", customer_id: "u-cust", customer_name: "김고객", category: "혼잡·교통유도", region: "경기", title: "가평 야외 축제 교통유도 인력 20명", details: "2일간 진행되는 야외 축제의 주차장·진입로 교통유도 및 현장 질서유지 인력이 필요합니다.", service_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), budget: 6000000, target_vendor_id: null, collective_site: "event100", photos: [], status: "open", selected_quote_id: null, created_at: t(2) },    ],
    quotes: [
      { id: "q-1", request_id: "r-1", vendor_id: "v-2", vendor_company: "한빛시큐리티(데모)", amount: 5800000, message: "경비지도사 1명 포함 20명 투입, 무전기·경광봉 지참합니다.", status: "submitted", created_at: t(1) },
    ],
    messages: [
      { id: "m-1", request_id: "r-1", vendor_id: "v-2", sender_id: "u-v2", sender_name: "한빛시큐리티(데모)", body: "안녕하세요. 현장 사전답사가 가능할까요?", created_at: t(1) },
    ],
    payments: [],
    settings: { fee_rate: CONFIG.DEFAULT_FEE_RATE },
    tasks: [],
    otp_log: [],
    bids: [
      // 데모용 나라장터 공고 예시 (실제 공고 아님)
      { id: "b-1", bid_no: "R26BK0000001", bid_ord: "000", title: "(데모) 2027년 청사 시설경비 용역", org: "(데모) ○○시청", demand_org: "(데모) ○○시청", region_limit: "경기도", close_at: new Date(Date.now() + 6 * 86400000).toISOString(), open_at: new Date(Date.now() + 7 * 86400000).toISOString(), base_amount: 384000000, presumed_price: 349090909, url: "https://www.g2b.go.kr", keyword: "경비", status: "new", assignee: null, memo: "", my_amount: null, created_at: t(0.2) },
      { id: "b-2", bid_no: "R26BK0000002", bid_ord: "000", title: "(데모) 지역축제 안전요원 및 교통정리 용역", org: "(데모) ○○문화재단", demand_org: "(데모) ○○문화재단", region_limit: "", close_at: new Date(Date.now() + 3 * 86400000).toISOString(), open_at: new Date(Date.now() + 3.5 * 86400000).toISOString(), base_amount: 52000000, presumed_price: 47272727, url: "https://www.g2b.go.kr", keyword: "안전요원", status: "review", assignee: "김종연", memo: "현장설명회 참석 필요 여부 확인", my_amount: null, created_at: t(1) },
      { id: "b-3", bid_no: "R26BK0000003", bid_ord: "000", title: "(데모) 공공기관 본사 경비·보안 위탁용역", org: "(데모) △△공사", demand_org: "(데모) △△공사", region_limit: "부산광역시", close_at: new Date(Date.now() + 10 * 86400000).toISOString(), open_at: new Date(Date.now() + 11 * 86400000).toISOString(), base_amount: 1210000000, presumed_price: 1100000000, url: "https://www.g2b.go.kr", keyword: "경비", status: "new", assignee: null, memo: "", my_amount: null, created_at: t(0.5) },
    ],
  };
}

// 관리자 업무함: 두 관리자가 동시에 확인 (운영 모드는 DB 트리거 + 문자 알림)
function addTask(d, type, ref_id, title, detail = "") {
  d.tasks = d.tasks || [];
  d.tasks.push({ id: uid(), type, ref_id, title, detail, status: "new", assignee: null, read_by: [], events: [{ at: now(), by: "시스템", action: "접수 · 관리자 2인 알림 (데모: 문자 미발송)" }], created_at: now() });
}
// 데모용 과거 입찰 이력 (통계 화면 확인용, 실제 공고·결과 아님)
function seedBidHistory(d) {
  const t = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const H = [
    // [며칠 전 개찰, 제목, 기관, 키워드, 기초금액, 우리 투찰률%, 결과(won/lost), 낙찰 투찰률%, 참가업체, 우리 순위]
    [160, "청사 시설경비 용역", "○○구청", "경비", 210000000, 88.12, "lost", 87.96, 34, 5],
    [140, "체육관 행사 안전요원 용역", "○○시체육회", "안전요원", 38000000, 88.40, "won", 88.40, 19, 1],
    [118, "도서관 야간 경비 용역", "○○교육청", "경비", 96000000, 87.90, "lost", 87.82, 41, 3],
    [96, "축제 교통정리·질서유지 용역", "○○문화재단", "교통정리", 61000000, 88.05, "won", 88.05, 22, 1],
    [75, "공영주차장 관리 용역", "○○도시공사", "주차관리", 145000000, 88.30, "lost", 87.88, 28, 9],
    [52, "복지관 시설경비 용역", "○○복지재단", "경비", 72000000, 87.95, "won", 87.95, 26, 1],
    [30, "청사 보안요원 용역", "○○공단", "보안요원", 188000000, 88.20, "lost", 87.91, 37, 6],
    [12, "공원 질서유지 용역", "○○시", "질서유지", 44000000, 88.01, "won", 88.01, 17, 1],
  ];
  H.forEach(([ago, title, org, kw, base, ourRate, res, winRate, n, rank], i) => {
    const est = Math.round(base * 0.995);
    d.bids.push({ id: "bh-" + i, bid_no: "R26BKH" + String(i).padStart(5, "0"), bid_ord: "000", title: "(데모) " + title, org: "(데모) " + org, demand_org: "(데모) " + org,
      region_limit: "경기도", close_at: t(ago + 1), open_at: t(ago), base_amount: base, presumed_price: Math.round(base / 1.1), url: "https://www.g2b.go.kr", keyword: kw,
      status: res, assignee: i % 2 ? "김종연" : "김정환", memo: "", my_amount: Math.round(est * ourRate / 100), created_at: t(ago + 10),
      participants: n, our_rank: rank, our_rate: ourRate, winner_name: res === "won" ? "(주)와이드가드" : `(데모) 경쟁업체${i + 1}`, winner_amount: Math.round(est * winRate / 100), winner_rate: winRate,
      result_checked_at: t(ago - 0.2), result_source: "demo" });
  });
  // 투찰 완료 후 개찰일이 지났지만 결과 미반영 상태 → '결과 확인' 버튼으로 반영 체험
  d.bids.push({ id: "bh-p", bid_no: "R26BKH00099", bid_ord: "000", title: "(데모) 경로당 순찰·경비 용역", org: "(데모) ○○군청", demand_org: "(데모) ○○군청", region_limit: "", close_at: t(2), open_at: t(1), base_amount: 58000000, presumed_price: 52727272, url: "https://www.g2b.go.kr", keyword: "경비", status: "submitted", assignee: "김정환", memo: "투찰 완료", my_amount: 50800000, created_at: t(9) });
  return d;
}
function seedTasks(d) {
  addTask(d, "request", "r-1", "가평 야외 축제 교통유도 인력 20명", "김고객 · 혼잡·교통유도 · 경기");
  addTask(d, "vendor_review", "v-3", "그린클린(데모) 업체 등록 심사", "청소대행 · 건물위생관리업 신고증 확인 필요");
  d.bids.filter((b) => b.status === "new").forEach((b) => addTask(d, "bid", b.id, b.title, `${b.org} · 마감 ${b.close_at.slice(0, 10)}`));
  return d;
}

// 데모용 과거 거래 이력 (관리자 대시보드 차트 확인용)
function seedHistory(db) {
  const t = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const past = [
    [170, "이주관리·범죄예방", "서울", "재건축 단지 이주관리 3개월", 42000000, "v-1"],
    [140, "시설경비", "경기", "물류센터 야간 경비 2개월", 9800000, "v-1"],
    [120, "혼잡·교통유도", "서울", "콘서트 관객 동선 관리", 7200000, "v-2"],
    [95, "신변보호", "서울", "VIP 행사 근접 경호", 5500000, "v-1"],
    [80, "시설경비", "인천", "공장 시설경비 1개월", 6300000, "v-1"],
    [62, "행정대집행지원", "경기", "불법 구조물 철거 지원", 15000000, "v-1"],
    [45, "혼잡·교통유도", "경기", "지역 축제 교통유도", 4800000, "v-2"],
    [30, "청소대행", "서울", "오피스 빌딩 정밀 청소", 3900000, "v-1"],
    [12, "시설경비", "부산", "리조트 성수기 시설경비", 11200000, "v-1"],
  ];
  past.forEach(([ago, category, region, title, amount, vid], i) => {
    const rid = "r-h" + i, qid = "q-h" + i, v = db.vendors.find((x) => x.id === vid);
    db.requests.push({ id: rid, customer_id: "u-cust", customer_name: "김고객", category, region, title, details: "(데모 과거 거래)", service_date: t(ago - 7).slice(0, 10), budget: null, target_vendor_id: null, photos: [], status: "completed", selected_quote_id: qid, created_at: t(ago) });
    db.quotes.push({ id: qid, request_id: rid, vendor_id: vid, vendor_company: v.company, amount, message: "(데모)", status: "accepted", created_at: t(ago - 1) });
    db.payments.push({ id: "p-h" + i, order_id: "WGDEMO" + (1000 + i), request_id: rid, quote_id: qid, customer_id: "u-cust", vendor_id: vid, amount, fee: Math.round(amount * 0.1), status: "paid", payment_key: "DEMO", created_at: t(ago - 2), paid_at: t(ago - 2), order_name: `[${category}] ${title}`, settlement_status: ago > 40 ? "settled" : "pending", settled_at: ago > 40 ? t(ago - 20) : null });
  });
  return db;
}

const load = () => {
  try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d) return d; } catch (e) {}
  const d = seedTasks(seedBidHistory(seedHistory(seed()))); localStorage.setItem(DB_KEY, JSON.stringify(d)); return d;
};
const save = (d) => {
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
  catch (e) { throw new Error("데모 저장 공간(브라우저)이 가득 찼습니다. 사진 수를 줄이거나 상단의 '데모 데이터 초기화'를 눌러주세요."); }
};
const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const PHOTO_BUCKET = "request-photos";
const DOC_BUCKET = "vendor-docs";
const strip = (u) => { if (!u) return null; const { password, ...rest } = u; return rest; };
const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : -1);

const demo = {
  mode: "demo",
  resetDemo() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); },

  async currentUser() {
    const id = localStorage.getItem(SESSION_KEY); if (!id) return null;
    return strip(load().users.find((u) => u.id === id));
  },
  async signUp({ email, password, name, phone, role, marketing }) {
    const d = load();
    if (d.users.some((u) => u.email === email)) throw new Error("이미 가입된 이메일입니다.");
    const consents = { terms_at: now(), privacy_at: now(), marketing: !!marketing };
    const u = { id: uid(), email, password, name, phone, role: role === "vendor" ? "vendor" : "customer", consents, created_at: now() };
    d.users.push(u); save(d); localStorage.setItem(SESSION_KEY, u.id); return strip(u);
  },
  async signIn(email, password) {
    const u = load().users.find((x) => x.email === email && x.password === password);
    if (!u) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    localStorage.setItem(SESSION_KEY, u.id); return strip(u);
  },
  async signOut() { localStorage.removeItem(SESSION_KEY); },

  // --- vendors
  async listVendors({ category, region, status = "approved", q } = {}) {
    return load().vendors.filter((v) =>
      (!status || v.status === status) &&
      (!category || v.categories.includes(category)) &&
      covers(v.regions, region) &&
      (!q || (v.company + v.intro).includes(q))
    ).sort((a, b) => b.rating - a.rating);
  },
  async getVendor(id) { return load().vendors.find((v) => v.id === id) || null; },
  async myVendor() { const me = await this.currentUser(); return me ? load().vendors.find((v) => v.owner_id === me.id) || null : null; },
  async registerVendor(data, docs = []) {
    const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    validateVendor(data);
    const d = load();
    const newDocs = await Promise.all(docs.map(async (f) => ({ name: f.name, path: await blobToDataURL(f.blob) })));
    const existing = d.vendors.find((v) => v.owner_id === me.id);
    if (existing) {
      // 허가 정보가 바뀌면 재심사 (승인 → 승인 대기)
      const licChanged = JSON.stringify(vendorLicenses(existing)) !== JSON.stringify(vendorLicenses(data)) || existing.license_no !== data.license_no;
      const wasApproved = existing.status === "approved";
      Object.assign(existing, data, { docs: [...(existing.docs || []), ...newDocs], status: wasApproved && !licChanged && !newDocs.length ? "approved" : "pending" });
      if (existing.status === "pending") addTask(d, "vendor_review", existing.id, `${existing.company} ${wasApproved ? "허가정보 변경 재심사" : "등록 정보 수정 심사"}`, existing.categories.join(", "));
      save(d); return existing;
    }
    if (!newDocs.length) throw new Error("허가증(신고증) 사본을 첨부해 주세요.");
    const v = { id: uid(), owner_id: me.id, status: "pending", rating: 0, review_count: 0, created_at: now(), ...data, docs: newDocs };
    d.vendors.push(v);
    addTask(d, "vendor_review", v.id, `${v.company} 업체 등록 심사`, `${v.categories.join(", ")} · 서류 ${newDocs.length}건`);
    const u = d.users.find((x) => x.id === me.id); if (u.role === "customer") u.role = "vendor";
    save(d); return v;
  },
  async setVendorStatus(id, status) { const d = load(); const v = d.vendors.find((x) => x.id === id); v.status = status; save(d); return v; },

  // --- requests
  async createRequest(data, photos = []) {
    const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    validateRequest(data, photos);
    const d = load();
    const urls = await Promise.all(photos.map(blobToDataURL));
    const r = { id: uid(), customer_id: me.id, customer_name: me.name, status: "open", selected_quote_id: null, target_vendor_id: null, created_at: now(), ...data, photos: urls };
    d.requests.push(r);
    addTask(d, "request", r.id, r.title, `${me.name} · ${r.category} · ${r.region}`);
    save(d); return r;
  },

  // --- 비회원 견적문의 (휴대폰 문자 인증)
  async sendOtp(phone) {
    phone = normPhone(phone); if (!/^01[016789]\d{7,8}$/.test(phone)) throw new Error("휴대폰 번호를 정확히 입력해 주세요.");
    const d = load(); d.otp_log = (d.otp_log || []).filter((x) => Date.now() - x.at < 3600e3);
    if (d.otp_log.filter((x) => x.phone === phone).length >= OTP.maxSendPerHour) throw new Error("인증번호 요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.");
    const code = String(Math.floor(Math.random() * 10 ** OTP.length)).padStart(OTP.length, "0");
    d.otp_log.push({ phone, at: Date.now() }); save(d);
    sessionStorage.setItem("wg_otp", JSON.stringify({ phone, code, exp: Date.now() + OTP.ttlMin * 60e3, tries: 0 }));
    return { demoCode: code }; // 데모: 화면에 표시 / 운영: 문자 발송
  },
  async verifyOtp(phone, code) {
    phone = normPhone(phone);
    const s = JSON.parse(sessionStorage.getItem("wg_otp") || "null");
    if (!s || s.phone !== phone) throw new Error("인증번호를 먼저 요청해 주세요.");
    if (Date.now() > s.exp) throw new Error("인증 시간이 지났습니다. 다시 요청해 주세요.");
    if (++s.tries > 5) { sessionStorage.removeItem("wg_otp"); throw new Error("입력 횟수를 초과했습니다. 다시 요청해 주세요."); }
    sessionStorage.setItem("wg_otp", JSON.stringify(s));
    if (s.code !== String(code).trim()) throw new Error("인증번호가 일치하지 않습니다.");
    sessionStorage.removeItem("wg_otp");
    const token = btoa(JSON.stringify({ phone, exp: Date.now() + 30 * 60e3, demo: true }));
    return { token };
  },
  async createGuestRequest(data, guest, photos = []) {
    const t = readDemoToken(guest.token);
    if (!String(guest.name || "").trim()) throw new Error("성함을 입력해 주세요.");
    validateRequest(data, photos);
    const d = load();
    const urls = await Promise.all(photos.map(blobToDataURL));
    const r = { id: uid(), customer_id: null, is_guest: true, guest_name: guest.name.trim(), guest_phone: t.phone, guest_verified_at: now(), customer_name: guest.name.trim() + " (비회원)", status: "open", selected_quote_id: null, target_vendor_id: null, created_at: now(), ...data, photos: urls };
    d.requests.push(r);
    addTask(d, "guest_inquiry", r.id, r.title, `${r.guest_name} · ${maskPhone(t.phone)} · ${r.category} · ${r.region} — 연락 필요`);
    save(d); return r;
  },
  async lookupGuestRequests(token) {
    const t = readDemoToken(token); const d = load();
    const rs = d.requests.filter((r) => r.is_guest && r.guest_phone === t.phone).sort(byNewest);
    return rs.map((r) => ({ ...r, quotes: d.quotes.filter((q) => q.request_id === r.id).map((q) => ({ ...q, vendor: d.vendors.find((v) => v.id === q.vendor_id) })) }));
  },
  async getGuestContact(request_id) { const r = load().requests.find((x) => x.id === request_id); return r && r.is_guest ? { name: r.guest_name, phone: r.guest_phone, verified_at: r.guest_verified_at } : null; },
  async claimGuestRequests(token) {
    const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    const t = readDemoToken(token); const d = load(); let n = 0;
    d.requests.filter((r) => r.is_guest && r.guest_phone === t.phone && !r.customer_id).forEach((r) => { r.customer_id = me.id; r.customer_name = me.name; n++; });
    save(d); return n;
  },
  async getPhotoUrls(r) { return r.photos || []; },
  async getDocUrls(v) { return (v.docs || []).map((x) => ({ name: x.name, url: x.path })); },
  async getRequest(id) {
    const r = load().requests.find((x) => x.id === id) || null; const me = await this.currentUser();
    return r && me && me.role === "admin" ? r : r && hideGuest(r);
  },
  async listMyRequests() { const me = await this.currentUser(); return load().requests.filter((r) => r.customer_id === me.id).sort(byNewest); },
  async listMatchedRequests() {
    const v = await this.myVendor(); if (!v || v.status !== "approved") return [];
    const d = load();
    const quoted = new Set(d.quotes.filter((q) => q.vendor_id === v.id).map((q) => q.request_id));
    return d.requests.filter((r) =>
      r.target_vendor_id === v.id || quoted.has(r.id) ||
      (r.status === "open" && !r.target_vendor_id && v.categories.includes(r.category) && covers(v.regions, r.region))
    ).sort(byNewest).map(hideGuest);
  },
  async listAllRequests() { return load().requests.sort(byNewest); },
  async updateRequestStatus(id, status) {
    const d = load(); const r = d.requests.find((x) => x.id === id); r.status = status;
    if (status === "completed") addTask(d, "settle", r.id, r.title, "고객 서비스 완료 확인 → PG 지급대행 정산 진행");
    save(d); return r;
  },

  // --- quotes
  async createQuote({ request_id, amount, message }) {
    const v = await this.myVendor(); if (!v || v.status !== "approved") throw new Error("승인된 업체만 견적을 제출할 수 있습니다.");
    const d = load();
    const r = d.requests.find((x) => x.id === request_id); if (r.status !== "open") throw new Error("견적 모집이 종료된 요청입니다.");
    const ex = d.quotes.find((q) => q.request_id === request_id && q.vendor_id === v.id);
    if (ex) { Object.assign(ex, { amount, message, created_at: now() }); save(d); return ex; }
    const q = { id: uid(), request_id, vendor_id: v.id, vendor_company: v.company, amount, message, status: "submitted", created_at: now() };
    d.quotes.push(q); save(d); return q;
  },
  async listQuotesForRequest(request_id) { return load().quotes.filter((q) => q.request_id === request_id).sort((a, b) => a.amount - b.amount); },
  async listMyQuotes() { const v = await this.myVendor(); return v ? load().quotes.filter((q) => q.vendor_id === v.id).sort(byNewest) : []; },
  async acceptQuote(quote_id) {
    const me = await this.currentUser(); const d = load();
    const q = d.quotes.find((x) => x.id === quote_id); const r = d.requests.find((x) => x.id === q.request_id);
    if (r.customer_id !== me.id) throw new Error("권한이 없습니다.");
    d.quotes.filter((x) => x.request_id === r.id).forEach((x) => (x.status = x.id === quote_id ? "accepted" : "rejected"));
    r.status = "matched"; r.selected_quote_id = quote_id; save(d); return q;
  },

  // --- messages
  async listMessages(request_id, vendor_id) { return load().messages.filter((m) => m.request_id === request_id && m.vendor_id === vendor_id).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)); },
  async listThreads(request_id) {
    const d = load(); const ids = new Set([...d.messages.filter((m) => m.request_id === request_id).map((m) => m.vendor_id), ...d.quotes.filter((q) => q.request_id === request_id).map((q) => q.vendor_id)]);
    return [...ids].map((id) => d.vendors.find((v) => v.id === id)).filter(Boolean);
  },
  async sendMessage(request_id, vendor_id, body) {
    const me = await this.currentUser(); const d = load();
    const v = d.vendors.find((x) => x.id === vendor_id);
    const sender_name = v && v.owner_id === me.id ? v.company : me.name;
    const m = { id: uid(), request_id, vendor_id, sender_id: me.id, sender_name, body, created_at: now() };
    d.messages.push(m); save(d); return m;
  },

  // --- payments
  async getSettings() { return load().settings; },
  async setFeeRate(rate) { const d = load(); d.settings.fee_rate = rate; save(d); return d.settings; },
  async createPayment(quote_id) {
    const me = await this.currentUser(); const d = load();
    const q = d.quotes.find((x) => x.id === quote_id); const r = d.requests.find((x) => x.id === q.request_id);
    if (r.customer_id !== me.id || q.status !== "accepted") throw new Error("결제할 수 없는 견적입니다.");
    const fee = Math.round(q.amount * d.settings.fee_rate);
    const p = { id: uid(), order_id: makeOrderId(), request_id: r.id, quote_id, customer_id: me.id, vendor_id: q.vendor_id, amount: q.amount, fee, status: "ready", payment_key: null, created_at: now(), paid_at: null, order_name: `[${r.category}] ${r.title}`.slice(0, 90) };
    d.payments.push(p); save(d); return p;
  },
  async completeDemoPayment(order_id) {
    const d = load(); const p = d.payments.find((x) => x.order_id === order_id);
    p.status = "paid"; p.payment_key = "DEMO-" + order_id; p.paid_at = now();
    d.requests.find((r) => r.id === p.request_id).status = "paid";
    addTask(d, "payment", p.id, p.order_name, `${p.amount.toLocaleString()}원 결제 완료`);
    save(d); return p;
  },
  async getPaymentByOrder(order_id) { return load().payments.find((p) => p.order_id === order_id) || null; },
  async listPayments() {
    const me = await this.currentUser(); const d = load();
    if (me.role === "admin") return d.payments.sort(byNewest);
    const v = d.vendors.find((x) => x.owner_id === me.id);
    return d.payments.filter((p) => p.customer_id === me.id || (v && p.vendor_id === v.id)).sort(byNewest);
  },

  // --- admin
  async listUsers() { return load().users.map(strip).map((u) => ({ created_at: u.created_at || "2025-01-01T00:00:00Z", ...u })); },
  async setUserRole(id, role) { const d = load(); const u = d.users.find((x) => x.id === id); u.role = role; save(d); return strip(u); },
  async updateVendorAdmin(id, patch) { const d = load(); const v = d.vendors.find((x) => x.id === id); Object.assign(v, patch); save(d); return v; },
  async listAllQuotes() { return load().quotes.sort(byNewest); },
  async settlePayment(id) {
    const d = load(); const p = d.payments.find((x) => x.id === id);
    if (p.status !== "paid") throw new Error("결제 완료 건만 정산할 수 있습니다.");
    p.settlement_status = "settled"; p.settled_at = now(); save(d); return p;
  },
  async refundPayment(id, reason) {
    const d = load(); const p = d.payments.find((x) => x.id === id);
    if (p.status !== "paid") throw new Error("결제 완료 건만 환불할 수 있습니다.");
    if (p.settlement_status === "settled") throw new Error("이미 정산된 건입니다.");
    p.status = "refunded"; p.refund_reason = reason; p.refunded_at = now();
    const r = d.requests.find((x) => x.id === p.request_id); if (r) r.status = "canceled";
    addTask(d, "refund", p.id, p.order_name, `환불 ${p.amount.toLocaleString()}원 · 사유: ${reason}`);
    save(d); return p;
  },

  // --- 관리자 업무함 (공동 확인)
  async listTasks() { return (load().tasks || []).sort(byNewest); },
  async updateTask(id, action, memo = "") {
    const me = await this.currentUser(); const d = load(); const t = d.tasks.find((x) => x.id === id);
    const who = `${me.name} ${me.title || ""}`.trim();
    if (action === "take") { t.status = "in_progress"; t.assignee = who; }
    if (action === "done") { t.status = "done"; t.assignee = t.assignee || who; }
    if (action === "reopen") { t.status = "new"; }
    if (action === "read") { t.read_by = [...new Set([...(t.read_by || []), me.id])]; save(d); return t; }
    t.events.push({ at: now(), by: who, action: { take: "담당 지정", done: "처리 완료", reopen: "다시 열기", memo: "메모" }[action] + (memo ? ` — ${memo}` : "") });
    save(d); return t;
  },

  // --- 나라장터 입찰
  async listBids() { return (load().bids || []).sort((a, b) => (a.close_at > b.close_at ? 1 : -1)); },
  async updateBid(id, patch) {
    const me = await this.currentUser(); const d = load(); const b = d.bids.find((x) => x.id === id);
    Object.assign(b, patch, { updated_by: me.name, updated_at: now() }); save(d); return b;
  },
  async syncBids() { return { added: 0, message: "데모 모드: 실제 수집은 운영 환경(Vercel 서버 함수 + 공공데이터포털 인증키)에서 실행됩니다." }; },
  // 개찰 결과 반영: 투찰 완료 + 개찰일 경과 + 결과 미반영 공고 (데모는 예시 결과로 채움)
  async syncBidResults() {
    const d = load(); let updated = 0;
    d.bids.filter((b) => b.status === "submitted" && b.open_at && new Date(b.open_at) < new Date() && !b.result_checked_at).forEach((b) => {
      const est = Math.round((b.base_amount || 0) * 0.998);
      const ourRate = b.my_amount && est ? +(b.my_amount / est * 100).toFixed(3) : null;
      // 낙찰하한율 이상 최저가가 1순위 → 우리보다 조금 낮게 투찰한 업체가 1순위인 예시
      const winRate = ourRate ? +(ourRate - 0.06).toFixed(3) : 87.7;
      Object.assign(b, { participants: 24, our_rank: 2, our_rate: ourRate, winner_name: "(데모) 경쟁업체A", winner_amount: Math.round(est * winRate / 100), winner_rate: winRate,
        status: "lost", result_checked_at: now(), result_source: "demo" });
      addTask(d, "bid_result", b.id, b.title, `개찰 결과: 미낙찰 · 우리 ${b.our_rank}위 / ${b.participants}개사 · 1순위 투찰률 ${b.winner_rate}% (데모 예시 결과)`);
      updated++;
    });
    save(d);
    return { updated, message: updated ? `개찰 결과 ${updated}건 반영 (데모 예시)` : "반영할 개찰 결과가 없습니다." };
  },
};

// 비회원 연락처는 관리자 외에는 숨김
function hideGuest(r) { if (!r || !r.is_guest) return r; const { guest_phone, guest_verified_at, ...rest } = r; return rest; }
function normPhone(p) { return String(p || "").replace(/\D/g, ""); }
function maskPhone(p) { p = normPhone(p); return p.length >= 10 ? p.slice(0, 3) + "-****-" + p.slice(-4) : p; }
function readDemoToken(token) {
  try { const t = JSON.parse(atob(token)); if (Date.now() > t.exp) throw 0; return t; }
  catch { throw new Error("휴대폰 인증이 만료되었습니다. 다시 인증해 주세요."); }
}

// -------------------------------------------------------------
//  SUPABASE STORE
// -------------------------------------------------------------
let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return sb;
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

const supa = {
  mode: "supabase",
  resetDemo() {},

  async currentUser() {
    const c = await client(); const { data } = await c.auth.getUser(); if (!data.user) return null;
    const p = ok(await c.from("profiles").select("*").eq("id", data.user.id).maybeSingle());
    return p ? { ...p, email: data.user.email } : { id: data.user.id, email: data.user.email, role: "customer", name: data.user.email };
  },
  async signUp({ email, password, name, phone, role, marketing }) {
    const c = await client();
    ok(await c.auth.signUp({ email, password, options: { data: { name, phone, role: role === "vendor" ? "vendor" : "customer", terms_agreed: true, privacy_agreed: true, marketing: !!marketing } } }));
    const { data } = await c.auth.getSession();
    if (!data.session) throw new Error("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
    return this.currentUser();
  },
  async signIn(email, password) { const c = await client(); ok(await c.auth.signInWithPassword({ email, password })); return this.currentUser(); },
  async signOut() { const c = await client(); await c.auth.signOut(); },

  async listVendors({ category, region, status = "approved", q } = {}) {
    const c = await client(); let s = c.from("vendors").select("*");
    if (status) s = s.eq("status", status);
    if (category) s = s.contains("categories", [category]);
    if (region && region !== NATIONWIDE) s = s.overlaps("regions", [region, NATIONWIDE]);
    if (q) s = s.or(`company.ilike.%${q}%,intro.ilike.%${q}%`);
    return ok(await s.order("rating", { ascending: false }));
  },
  async getVendor(id) { const c = await client(); return ok(await c.from("vendors").select("*").eq("id", id).maybeSingle()); },
  async myVendor() { const c = await client(); const me = await this.currentUser(); if (!me) return null; return ok(await c.from("vendors").select("*").eq("owner_id", me.id).maybeSingle()); },
  async registerVendor(data, docs = []) {
    const c = await client(); const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    validateVendor(data);
    const ex = await this.myVendor();
    if (!ex && !docs.length) throw new Error("허가증(신고증) 사본을 첨부해 주세요.");
    const uploaded = [];
    for (const f of docs) {
      const ext = f.blob.type === "application/pdf" ? "pdf" : "jpg";
      const path = `${me.id}/${uid()}.${ext}`;
      ok(await c.storage.from(DOC_BUCKET).upload(path, f.blob, { contentType: f.blob.type || "image/jpeg", upsert: false }));
      uploaded.push({ name: f.name, path });
    }
    const payload = { ...data, docs: [...((ex && ex.docs) || []), ...uploaded] };
    const v = ex ? ok(await c.from("vendors").update(payload).eq("id", ex.id).select().single())
                 : ok(await c.from("vendors").insert({ ...payload, owner_id: me.id }).select().single());
    if (me.role === "customer") await c.from("profiles").update({ role: "vendor" }).eq("id", me.id);
    return v;
  },
  async setVendorStatus(id, status) { const c = await client(); return ok(await c.from("vendors").update({ status }).eq("id", id).select().single()); },

  async createRequest(data, photos = []) {
    const c = await client(); const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    validateRequest(data, photos);
    const paths = [];
    try {
      for (const b of photos) {
        const path = `${me.id}/${uid()}.jpg`;
        ok(await c.storage.from(PHOTO_BUCKET).upload(path, b, { contentType: "image/jpeg", upsert: false }));
        paths.push(path);
      }
      return ok(await c.from("requests").insert({ ...data, photos: paths, customer_id: me.id, customer_name: me.name }).select().single());
    } catch (e) {
      if (paths.length) await c.storage.from(PHOTO_BUCKET).remove(paths);
      throw e;
    }
  },
  async getPhotoUrls(r) {
    if (!r.photos || !r.photos.length) return [];
    const c = await client();
    const data = ok(await c.storage.from(PHOTO_BUCKET).createSignedUrls(r.photos, 3600));
    return data.filter((x) => x.signedUrl).map((x) => x.signedUrl);
  },
  async getDocUrls(v) {
    if (!v.docs || !v.docs.length) return [];
    const c = await client();
    const data = ok(await c.storage.from(DOC_BUCKET).createSignedUrls(v.docs.map((x) => x.path), 600));
    return data.map((x, i) => ({ name: v.docs[i].name, url: x.signedUrl })).filter((x) => x.url);
  },
  async getRequest(id) { const c = await client(); return ok(await c.from("requests").select("*").eq("id", id).maybeSingle()); },
  async listMyRequests() { const c = await client(); const me = await this.currentUser(); return ok(await c.from("requests").select("*").eq("customer_id", me.id).order("created_at", { ascending: false })); },
  async listMatchedRequests() {
    const c = await client(); const v = await this.myVendor(); if (!v || v.status !== "approved") return [];
    let oq = c.from("requests").select("*").eq("status", "open").is("target_vendor_id", null).in("category", v.categories);
    if (!v.regions.includes(NATIONWIDE)) oq = oq.in("region", [...v.regions, NATIONWIDE]);
    const open = ok(await oq);
    const direct = ok(await c.from("requests").select("*").eq("target_vendor_id", v.id));
    const qids = ok(await c.from("quotes").select("request_id").eq("vendor_id", v.id)).map((x) => x.request_id);
    const quoted = qids.length ? ok(await c.from("requests").select("*").in("id", qids)) : [];
    const map = new Map(); [...open, ...direct, ...quoted].forEach((r) => map.set(r.id, r));
    return [...map.values()].sort(byNewest);
  },
  async listAllRequests() { const c = await client(); return ok(await c.from("requests").select("*").order("created_at", { ascending: false })); },
  async updateRequestStatus(id, status) { const c = await client(); return ok(await c.from("requests").update({ status }).eq("id", id).select().single()); },

  async createQuote({ request_id, amount, message }) {
    const c = await client(); const v = await this.myVendor(); if (!v || v.status !== "approved") throw new Error("승인된 업체만 견적을 제출할 수 있습니다.");
    return ok(await c.from("quotes").upsert({ request_id, vendor_id: v.id, vendor_company: v.company, amount, message }, { onConflict: "request_id,vendor_id" }).select().single());
  },
  async listQuotesForRequest(request_id) { const c = await client(); return ok(await c.from("quotes").select("*").eq("request_id", request_id).order("amount")); },
  async listMyQuotes() { const c = await client(); const v = await this.myVendor(); if (!v) return []; return ok(await c.from("quotes").select("*").eq("vendor_id", v.id).order("created_at", { ascending: false })); },
  async acceptQuote(quote_id) { const c = await client(); return ok(await c.rpc("accept_quote", { p_quote_id: quote_id })); },

  async listMessages(request_id, vendor_id) { const c = await client(); return ok(await c.from("messages").select("*").eq("request_id", request_id).eq("vendor_id", vendor_id).order("created_at")); },
  async listThreads(request_id) {
    const c = await client();
    const a = ok(await c.from("quotes").select("vendor_id").eq("request_id", request_id));
    const b = ok(await c.from("messages").select("vendor_id").eq("request_id", request_id));
    const ids = [...new Set([...a, ...b].map((x) => x.vendor_id))]; if (!ids.length) return [];
    return ok(await c.from("vendors").select("*").in("id", ids));
  },
  async sendMessage(request_id, vendor_id, body) {
    const c = await client(); const me = await this.currentUser(); const v = await this.getVendor(vendor_id);
    const sender_name = v && v.owner_id === me.id ? v.company : me.name;
    return ok(await c.from("messages").insert({ request_id, vendor_id, sender_id: me.id, sender_name, body }).select().single());
  },

  async getSettings() { const c = await client(); return ok(await c.from("settings").select("*").eq("id", 1).single()); },
  async setFeeRate(rate) { const c = await client(); return ok(await c.from("settings").update({ fee_rate: rate }).eq("id", 1).select().single()); },
  async createPayment(quote_id) { const c = await client(); return ok(await c.rpc("create_payment", { p_quote_id: quote_id })); },
  async completeDemoPayment() { throw new Error("운영 모드에서는 실제 결제를 이용하세요."); },
  async getPaymentByOrder(order_id) { const c = await client(); return ok(await c.from("payments").select("*").eq("order_id", order_id).maybeSingle()); },
  async listPayments() { const c = await client(); return ok(await c.from("payments").select("*").order("created_at", { ascending: false })); },

  // --- admin (RLS: is_admin() 정책 필요 - schema.sql)
  async listUsers() { const c = await client(); return ok(await c.from("profiles").select("*").order("created_at", { ascending: false })); },
  async setUserRole(id, role) { const c = await client(); return ok(await c.from("profiles").update({ role }).eq("id", id).select().single()); },
  async updateVendorAdmin(id, patch) { const c = await client(); return ok(await c.from("vendors").update(patch).eq("id", id).select().single()); },
  async listAllQuotes() { const c = await client(); return ok(await c.from("quotes").select("*").order("created_at", { ascending: false })); },
  async settlePayment(id) {
    const c = await client();
    return ok(await c.from("payments").update({ settlement_status: "settled", settled_at: now() }).eq("id", id).eq("status", "paid").select().single());
  },
  async refundPayment(id, reason) {
    const c = await client(); const { data } = await c.auth.getSession();
    const res = await fetch("/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
      body: JSON.stringify({ paymentId: id, reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || "환불 처리에 실패했습니다.");
    return body.payment;
  },

  // --- 비회원 견적문의 (서버 함수: api/otp.js, api/inquiry.js)
  async sendOtp(phone) { return api("/api/otp", { action: "send", phone }); },
  async verifyOtp(phone, code) { return api("/api/otp", { action: "verify", phone, code }); },
  async createGuestRequest(data, guest, photos = []) {
    validateRequest(data, photos);
    const images = await Promise.all(photos.map(blobToDataURL));
    return (await api("/api/inquiry", { action: "create", token: guest.token, name: guest.name, data, images })).request;
  },
  async lookupGuestRequests(token) { return (await api("/api/inquiry", { action: "lookup", token })).requests; },
  async getGuestContact(request_id) { const c = await client(); return ok(await c.from("guest_contacts").select("*").eq("request_id", request_id).maybeSingle()); },
  async claimGuestRequests(token) { return (await api("/api/inquiry", { action: "claim", token }, true)).claimed; },

  // --- 관리자 업무함
  async listTasks() { const c = await client(); return ok(await c.from("admin_tasks").select("*").order("created_at", { ascending: false }).limit(500)); },
  async updateTask(id, action, memo = "") {
    const c = await client(); const me = await this.currentUser();
    const t = ok(await c.from("admin_tasks").select("*").eq("id", id).single());
    const who = `${me.name} ${me.title || ""}`.trim();
    if (action === "read") return ok(await c.from("admin_tasks").update({ read_by: [...new Set([...(t.read_by || []), me.id])] }).eq("id", id).select().single());
    const patch = { events: [...(t.events || []), { at: now(), by: who, action: { take: "담당 지정", done: "처리 완료", reopen: "다시 열기", memo: "메모" }[action] + (memo ? ` — ${memo}` : "") }] };
    if (action === "take") Object.assign(patch, { status: "in_progress", assignee: who });
    if (action === "done") Object.assign(patch, { status: "done", assignee: t.assignee || who });
    if (action === "reopen") patch.status = "new";
    return ok(await c.from("admin_tasks").update(patch).eq("id", id).select().single());
  },

  // --- 나라장터 입찰
  async listBids() { const c = await client(); return ok(await c.from("bids").select("*").order("close_at", { ascending: true }).limit(300)); },
  async updateBid(id, patch) { const c = await client(); const me = await this.currentUser(); return ok(await c.from("bids").update({ ...patch, updated_by: me.name, updated_at: now() }).eq("id", id).select().single()); },
  async syncBids() { return api("/api/bids-sync", {}, true); },
  async syncBidResults() { return api("/api/bids-results", {}, true); },
};

async function api(path, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) { const c = await client(); const { data } = await c.auth.getSession(); if (data.session) headers.Authorization = "Bearer " + data.session.access_token; }
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "요청에 실패했습니다.");
  return json;
}
export { maskPhone };

export const store = IS_DEMO ? demo : supa;

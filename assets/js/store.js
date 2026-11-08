// =============================================================
//  데이터 계층: 데모(localStorage) / 운영(Supabase) 공통 인터페이스
// =============================================================
import { CONFIG, IS_DEMO, NATIONWIDE, covers } from "./config.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const makeOrderId = () => "WG" + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();

// -------------------------------------------------------------
//  DEMO STORE
// -------------------------------------------------------------
const DB_KEY = "wg_platform_v3";
const SESSION_KEY = "wg_session_v1";

function seed() {
  const t = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const admin = { id: "u-admin", email: "admin@demo.com", password: "demo1234", name: "플랫폼 관리자", phone: "031-945-2001", role: "admin", created_at: t(400) };
  const cust = { id: "u-cust", email: "customer@demo.com", password: "demo1234", name: "김고객", phone: "010-1234-5678", role: "customer", created_at: t(60) };
  const v1u = { id: "u-v1", email: "vendor@demo.com", password: "demo1234", name: "김정환", phone: "031-945-2001", role: "vendor", created_at: t(300) };
  const v2u = { id: "u-v2", email: "vendor2@demo.com", password: "demo1234", name: "이대표", phone: "02-000-0000", role: "vendor", created_at: t(120) };
  const v3u = { id: "u-v3", email: "vendor3@demo.com", password: "demo1234", name: "박대표", phone: "032-000-0000", role: "vendor", created_at: t(1) };
  return {
    users: [admin, cust, v1u, v2u, v3u],
    vendors: [
      { id: "v-1", owner_id: "u-v1", company: "(주)와이드가드", ceo: "김정환", biz_no: "000-00-00000", phone: "031-945-2001", email: "vendor@demo.com", address: "경기도 김포시 풍무2로 25, 2층 2-2호",
        categories: ["시설경비", "신변보호", "혼잡·교통유도", "이주관리·범죄예방", "행정대집행지원", "청소대행"], regions: [NATIONWIDE],
        intro: "경찰청 허가법인. 재개발·재건축 이주관리, 대형 행사 경비, VIP 신변보호 다수 실적 보유.", license_info: "경비업 허가증, 분사기 허가증", status: "approved", rating: 4.9, review_count: 128, created_at: t(300) },
      { id: "v-2", owner_id: "u-v2", company: "한빛시큐리티(데모)", ceo: "이대표", biz_no: "000-00-00001", phone: "02-000-0000", email: "vendor2@demo.com", address: "서울특별시",
        categories: ["시설경비", "혼잡·교통유도"], regions: ["서울", "경기"], intro: "공연·행사 전문 경비업체 (데모 데이터)", license_info: "경비업 허가증", status: "approved", rating: 4.6, review_count: 41, created_at: t(120) },
      { id: "v-3", owner_id: "u-v3", company: "그린클린(데모)", ceo: "박대표", biz_no: "000-00-00002", phone: "032-000-0000", email: "vendor3@demo.com", address: "인천광역시",
        categories: ["청소대행"], regions: ["인천", "경기"], intro: "빌딩·사무실 정밀 청소 (데모 데이터)", license_info: "", status: "pending", rating: 0, review_count: 0, created_at: t(1) },
    ],
    requests: [
      { id: "r-1", customer_id: "u-cust", customer_name: "김고객", category: "혼잡·교통유도", region: "경기", title: "가평 야외 축제 교통유도 인력 20명", details: "2일간 진행되는 야외 축제의 주차장·진입로 교통유도 및 현장 질서유지 인력이 필요합니다.", service_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), budget: 6000000, target_vendor_id: null, status: "open", selected_quote_id: null, created_at: t(2) },
    ],
    quotes: [
      { id: "q-1", request_id: "r-1", vendor_id: "v-2", vendor_company: "한빛시큐리티(데모)", amount: 5800000, message: "경비지도사 1명 포함 20명 투입, 무전기·경광봉 지참합니다.", status: "submitted", created_at: t(1) },
    ],
    messages: [
      { id: "m-1", request_id: "r-1", vendor_id: "v-2", sender_id: "u-v2", sender_name: "한빛시큐리티(데모)", body: "안녕하세요. 현장 사전답사가 가능할까요?", created_at: t(1) },
    ],
    payments: [],
    settings: { fee_rate: CONFIG.DEFAULT_FEE_RATE },
  };
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
  const d = seedHistory(seed()); localStorage.setItem(DB_KEY, JSON.stringify(d)); return d;
};
const save = (d) => {
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
  catch (e) { throw new Error("데모 저장 공간(브라우저)이 가득 찼습니다. 사진 수를 줄이거나 상단의 '데모 데이터 초기화'를 눌러주세요."); }
};
const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const PHOTO_BUCKET = "request-photos";
const strip = (u) => { if (!u) return null; const { password, ...rest } = u; return rest; };
const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : -1);

const demo = {
  mode: "demo",
  resetDemo() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); },

  async currentUser() {
    const id = localStorage.getItem(SESSION_KEY); if (!id) return null;
    return strip(load().users.find((u) => u.id === id));
  },
  async signUp({ email, password, name, phone, role }) {
    const d = load();
    if (d.users.some((u) => u.email === email)) throw new Error("이미 가입된 이메일입니다.");
    const u = { id: uid(), email, password, name, phone, role: role === "vendor" ? "vendor" : "customer", created_at: now() };
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
  async registerVendor(data) {
    const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    const d = load();
    const existing = d.vendors.find((v) => v.owner_id === me.id);
    if (existing) { Object.assign(existing, data, { status: existing.status === "approved" ? "approved" : "pending" }); save(d); return existing; }
    const v = { id: uid(), owner_id: me.id, status: "pending", rating: 0, review_count: 0, created_at: now(), ...data };
    d.vendors.push(v);
    const u = d.users.find((x) => x.id === me.id); if (u.role === "customer") u.role = "vendor";
    save(d); return v;
  },
  async setVendorStatus(id, status) { const d = load(); const v = d.vendors.find((x) => x.id === id); v.status = status; save(d); return v; },

  // --- requests
  async createRequest(data, photos = []) {
    const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    const d = load();
    const urls = await Promise.all(photos.map(blobToDataURL));
    const r = { id: uid(), customer_id: me.id, customer_name: me.name, status: "open", selected_quote_id: null, target_vendor_id: null, created_at: now(), ...data, photos: urls };
    d.requests.push(r); save(d); return r;
  },
  async getPhotoUrls(r) { return r.photos || []; },
  async getRequest(id) { return load().requests.find((r) => r.id === id) || null; },
  async listMyRequests() { const me = await this.currentUser(); return load().requests.filter((r) => r.customer_id === me.id).sort(byNewest); },
  async listMatchedRequests() {
    const v = await this.myVendor(); if (!v || v.status !== "approved") return [];
    const d = load();
    const quoted = new Set(d.quotes.filter((q) => q.vendor_id === v.id).map((q) => q.request_id));
    return d.requests.filter((r) =>
      r.target_vendor_id === v.id || quoted.has(r.id) ||
      (r.status === "open" && !r.target_vendor_id && v.categories.includes(r.category) && covers(v.regions, r.region))
    ).sort(byNewest);
  },
  async listAllRequests() { return load().requests.sort(byNewest); },
  async updateRequestStatus(id, status) { const d = load(); const r = d.requests.find((x) => x.id === id); r.status = status; save(d); return r; },

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
    d.requests.find((r) => r.id === p.request_id).status = "paid"; save(d); return p;
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
    save(d); return p;
  },
};

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
  async signUp({ email, password, name, phone, role }) {
    const c = await client();
    ok(await c.auth.signUp({ email, password, options: { data: { name, phone, role: role === "vendor" ? "vendor" : "customer" } } }));
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
  async registerVendor(data) {
    const c = await client(); const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
    const ex = await this.myVendor();
    const v = ex ? ok(await c.from("vendors").update(data).eq("id", ex.id).select().single())
                 : ok(await c.from("vendors").insert({ ...data, owner_id: me.id }).select().single());
    if (me.role === "customer") await c.from("profiles").update({ role: "vendor" }).eq("id", me.id);
    return v;
  },
  async setVendorStatus(id, status) { const c = await client(); return ok(await c.from("vendors").update({ status }).eq("id", id).select().single()); },

  async createRequest(data, photos = []) {
    const c = await client(); const me = await this.currentUser(); if (!me) throw new Error("로그인이 필요합니다.");
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
};

export const store = IS_DEMO ? demo : supa;

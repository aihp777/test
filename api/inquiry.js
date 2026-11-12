// 비회원 견적문의
// POST { action: "create", token, name, data, images[] }  → 견적 요청 등록 (관리자 2인 업무함 + 문자 알림은 DB 트리거/웹훅)
// POST { action: "lookup", token }                         → 내 문의·받은 견적 조회
// POST { action: "claim", token } + Authorization          → 로그인한 회원 계정으로 비회원 문의 가져오기
const L = require("./_lib");
const CATEGORIES = ["시설경비", "신변보호", "혼잡·교통유도", "이주관리·범죄예방", "행정대집행지원", "청소대행"];
const COLLECTIVE = ["", "labor", "redevelopment", "facility_dispute", "shareholders", "property", "event100", "admin_execution"];
const str = (v, max) => String(v ?? "").trim().slice(0, max);

module.exports = L.handler(async (req, res) => {
  if (req.method !== "POST") throw L.httpError(405, "Method Not Allowed");
  const b = L.body(req);
  const { phone } = L.verifyToken(b.token);

  if (b.action === "create") {
    const name = str(b.name, 30);
    const d = b.data || {};
    if (!name) throw L.httpError(400, "성함을 입력해 주세요.");
    if (!CATEGORIES.includes(d.category)) throw L.httpError(400, "서비스 분야를 선택해 주세요.");
    if (!str(d.title, 80) || !str(d.details, 3000) || !/^\d{4}-\d{2}-\d{2}$/.test(d.service_date || "")) throw L.httpError(400, "필수 항목을 입력해 주세요.");
    const images = Array.isArray(b.images) ? b.images.slice(0, 5) : [];
    // 하루 5건 제한 (같은 번호)
    const since = new Date(Date.now() - 86400e3).toISOString();
    if ((await L.rest(`/guest_contacts?phone=eq.${phone}&created_at=gte.${since}&select=request_id`)).length >= 5) throw L.httpError(429, "하루 문의 가능 건수를 초과했습니다. 전화로 문의해 주세요.");

    const paths = [];
    for (const img of images) {
      const m = /^data:image\/jpeg;base64,(.+)$/.exec(img || "");
      if (!m) continue;
      const buf = Buffer.from(m[1], "base64");
      if (buf.length > 10 * 1024 * 1024) continue;
      const path = `guest/${L.crypto.randomUUID()}.jpg`;
      await L.sb(`/storage/v1/object/request-photos/${path}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: buf });
      paths.push(path);
    }
    const row = {
      customer_id: null, is_guest: true,
      customer_name: `${name} (비회원)`, category: d.category, region: str(d.region, 10), title: str(d.title, 80), details: str(d.details, 3000),
      service_date: d.service_date, budget: Number(d.budget) > 0 ? Math.round(Number(d.budget)) : null,
      collective_site: COLLECTIVE.includes(d.collective_site) ? d.collective_site : "", photos: paths, status: "open",
      target_vendor_id: /^[0-9a-f-]{36}$/i.test(d.target_vendor_id || "") ? d.target_vendor_id : null,
    };
    const [r] = await L.rest("/requests", { method: "POST", body: JSON.stringify(row) });
    // 연락처는 관리자 전용 테이블에 저장 → DB 트리거가 공동 업무함 등록 → 웹훅으로 2인 문자 알림
    await L.rest("/guest_contacts", { method: "POST", body: JSON.stringify({ request_id: r.id, name, phone }) });
    return res.status(200).json({ request: { id: r.id, title: r.title } });
  }

  const myIds = async () => (await L.rest(`/guest_contacts?phone=eq.${phone}&select=request_id`)).map((x) => x.request_id);

  if (b.action === "lookup") {
    const ids0 = await myIds();
    const rs = ids0.length ? await L.rest(`/requests?id=in.(${ids0.join(",")})&order=created_at.desc&select=id,title,category,region,service_date,status,created_at,customer_id`) : [];
    const ids = rs.map((r) => r.id);
    const quotes = ids.length ? await L.rest(`/quotes?request_id=in.(${ids.join(",")})&select=id,request_id,vendor_id,vendor_company,amount,message,status,created_at`) : [];
    const vids = [...new Set(quotes.map((q) => q.vendor_id))];
    const vendors = vids.length ? await L.rest(`/vendors?id=in.(${vids.join(",")})&select=id,company,ceo,biz_no,phone,address,license_no,sanitation_no,is_operator`) : [];
    const vBy = Object.fromEntries(vendors.map((v) => [v.id, v]));
    return res.status(200).json({ requests: rs.map((r) => ({ ...r, quotes: quotes.filter((q) => q.request_id === r.id).map((q) => ({ ...q, vendor: vBy[q.vendor_id] })) })) });
  }

  if (b.action === "claim") {
    const u = await L.getUser(req);
    const ids = await myIds();
    const updated = ids.length ? await L.rest(`/requests?id=in.(${ids.join(",")})&customer_id=is.null`, { method: "PATCH", body: JSON.stringify({ customer_id: u.id, customer_name: u.profile.name || u.email }) }) : [];
    return res.status(200).json({ claimed: updated.length });
  }

  throw L.httpError(400, "잘못된 요청입니다.");
});

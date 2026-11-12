// 비회원 견적문의용 휴대폰 문자 인증
// POST { action: "send", phone }          → 인증번호 문자 발송 (1시간 5회 제한)
// POST { action: "verify", phone, code }  → 30분 유효 인증 토큰 발급
const L = require("./_lib");
const TTL_MIN = 5, MAX_PER_HOUR = 5, MAX_TRIES = 5;

module.exports = L.handler(async (req, res) => {
  if (req.method !== "POST") throw L.httpError(405, "Method Not Allowed");
  const { action, phone: raw, code } = L.body(req);
  const phone = L.normPhone(raw);
  if (!/^01[016789]\d{7,8}$/.test(phone)) throw L.httpError(400, "휴대폰 번호를 정확히 입력해 주세요.");
  L.need("OTP_SECRET");

  if (action === "send") {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent = await L.rest(`/otp_codes?phone=eq.${phone}&created_at=gte.${since}&select=id`);
    if (recent.length >= MAX_PER_HOUR) throw L.httpError(429, "인증번호 요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.");
    const otp = String(L.crypto.randomInt(0, 1e6)).padStart(6, "0");
    await L.rest("/otp_codes", { method: "POST", body: JSON.stringify({ phone, code_hash: L.hashCode(phone, otp), expires_at: new Date(Date.now() + TTL_MIN * 60e3).toISOString() }) });
    const sent = await L.sendSms([phone], `[와이드가드 매칭] 인증번호 ${otp} (${TTL_MIN}분 내 입력)`);
    if (!sent) throw L.httpError(500, "문자 발송 설정이 되어 있지 않습니다. 관리자에게 문의하세요.");
    return res.status(200).json({ ok: true, ttlMin: TTL_MIN });
  }

  if (action === "verify") {
    const now = new Date().toISOString();
    const rows = await L.rest(`/otp_codes?phone=eq.${phone}&used=eq.false&expires_at=gte.${now}&order=created_at.desc&limit=1&select=*`);
    const row = rows[0];
    if (!row) throw L.httpError(400, "인증번호가 만료되었습니다. 다시 요청해 주세요.");
    if (row.attempts >= MAX_TRIES) throw L.httpError(429, "입력 횟수를 초과했습니다. 다시 요청해 주세요.");
    await L.rest(`/otp_codes?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ attempts: row.attempts + 1 }) });
    if (row.code_hash !== L.hashCode(phone, String(code || "").trim())) throw L.httpError(400, "인증번호가 일치하지 않습니다.");
    await L.rest(`/otp_codes?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ used: true }) });
    return res.status(200).json({ token: L.signToken({ phone, exp: Date.now() + 30 * 60e3 }) });
  }

  throw L.httpError(400, "잘못된 요청입니다.");
});

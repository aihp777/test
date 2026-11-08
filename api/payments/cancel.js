// Vercel Serverless Function: 관리자 환불 (토스페이먼츠 결제 취소)
// 요청자 확인: Authorization: Bearer <Supabase access token> → profiles.role = 'admin' 인 경우만 허용
// 필요한 Vercel 환경변수: TOSS_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const H = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});
async function sb(path, init = {}) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1" + path, { ...init, headers: { ...H(), ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error("DB 오류: " + (body && body.message ? body.message : res.status));
  return body;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });
  const missing = ["TOSS_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) return res.status(500).json({ message: "서버 설정 누락: " + missing.join(", ") });

  try {
    // 1) 관리자 인증
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "로그인이 필요합니다." });
    const ures = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + token } });
    if (!ures.ok) return res.status(401).json({ message: "인증이 만료되었습니다. 다시 로그인하세요." });
    const user = await ures.json();
    const prof = await sb(`/profiles?id=eq.${user.id}&select=role`);
    if (!prof[0] || prof[0].role !== "admin") return res.status(403).json({ message: "관리자만 환불할 수 있습니다." });

    // 2) 결제 확인
    const { paymentId, reason } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!paymentId || !reason) return res.status(400).json({ message: "환불 사유가 필요합니다." });
    const rows = await sb(`/payments?id=eq.${encodeURIComponent(paymentId)}&select=*`);
    const p = rows[0];
    if (!p) return res.status(404).json({ message: "결제를 찾을 수 없습니다." });
    if (p.status !== "paid") return res.status(400).json({ message: "결제 완료 건만 환불할 수 있습니다." });
    if (p.settlement_status === "settled") return res.status(400).json({ message: "이미 업체에 정산된 건입니다." });

    // 3) 토스페이먼츠 취소 API
    const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64");
    const tres = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(p.payment_key)}/cancel`, {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json", "Idempotency-Key": "cancel-" + p.order_id },
      body: JSON.stringify({ cancelReason: String(reason).slice(0, 200) }),
    });
    const toss = await tres.json();
    if (!tres.ok) return res.status(400).json({ message: toss.message || "PG 환불에 실패했습니다.", code: toss.code });

    // 4) 상태 반영
    const updated = await sb(`/payments?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "refunded", refund_reason: reason, refunded_at: new Date().toISOString() }) });
    await sb(`/requests?id=eq.${p.request_id}`, { method: "PATCH", body: JSON.stringify({ status: "canceled" }) });
    return res.status(200).json({ payment: updated[0] });
  } catch (e) {
    return res.status(500).json({ message: e.message || "서버 오류" });
  }
};

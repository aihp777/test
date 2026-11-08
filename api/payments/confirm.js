// Vercel Serverless Function: 토스페이먼츠 결제 승인
// 필요한 Vercel 환경변수:
//   TOSS_SECRET_KEY            토스페이먼츠 시크릿 키 (test_sk_... / live_sk_...)
//   SUPABASE_URL               https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase service_role 키 (절대 브라우저에 노출 금지)

const SB = () => process.env.SUPABASE_URL + "/rest/v1";
const sbHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

async function sb(path, init = {}) {
  const res = await fetch(SB() + path, { ...init, headers: { ...sbHeaders(), ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error("DB 오류: " + (body && body.message ? body.message : res.status));
  return body;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });
  const missing = ["TOSS_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) return res.status(500).json({ message: "서버 설정 누락: " + missing.join(", ") });

  try {
    const { paymentKey, orderId, amount } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!paymentKey || !orderId || !amount) return res.status(400).json({ message: "잘못된 요청입니다." });

    // 1) 주문 조회 및 금액 위변조 검증
    const rows = await sb(`/payments?order_id=eq.${encodeURIComponent(orderId)}&select=*`);
    const payment = rows && rows[0];
    if (!payment) return res.status(404).json({ message: "주문을 찾을 수 없습니다." });
    if (payment.status === "paid") return res.status(200).json({ payment });
    if (Number(payment.amount) !== Number(amount)) return res.status(400).json({ message: "결제 금액이 주문 금액과 다릅니다." });

    // 2) 토스페이먼츠 승인 API 호출
    const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64");
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json", "Idempotency-Key": orderId },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    const toss = await tossRes.json();
    if (!tossRes.ok) {
      await sb(`/payments?order_id=eq.${encodeURIComponent(orderId)}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
      return res.status(400).json({ message: toss.message || "결제 승인에 실패했습니다.", code: toss.code });
    }

    // 3) 결제/요청 상태 업데이트
    const updated = await sb(`/payments?order_id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid", payment_key: paymentKey, method: toss.method || null, paid_at: new Date().toISOString() }),
    });
    await sb(`/requests?id=eq.${payment.request_id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });

    return res.status(200).json({ payment: updated[0] });
  } catch (e) {
    return res.status(500).json({ message: e.message || "서버 오류" });
  }
};

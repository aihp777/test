// 관리자 2인 동시 문자 알림
// Supabase > Database > Webhooks 에서 admin_tasks 테이블 INSERT 시 이 주소로 POST 하도록 설정
//   URL: https://<도메인>/api/notify   Header: x-webhook-secret: <NOTIFY_SECRET>
// 필요 환경변수: NOTIFY_SECRET, ADMIN_PHONES, SOLAPI_* (api/_lib.js 참고)
const L = require("./_lib");
const LABEL = {
  guest_inquiry: "비회원 견적문의", request: "회원 견적요청", vendor_review: "업체 승인 심사",
  payment: "결제 완료", settle: "정산 대기", refund: "환불 처리", bid: "나라장터 신규 공고",
};

module.exports = L.handler(async (req, res) => {
  if (req.method !== "POST") throw L.httpError(405, "Method Not Allowed");
  L.need("NOTIFY_SECRET");
  if (req.headers["x-webhook-secret"] !== L.env("NOTIFY_SECRET")) throw L.httpError(401, "unauthorized");
  const { record } = L.body(req);
  if (!record) return res.status(200).json({ skipped: true });
  const text = `[와이드가드] ${LABEL[record.type] || "알림"}\n${String(record.title || "").slice(0, 60)}\n${String(record.detail || "").slice(0, 80)}\n관리자 콘솔에서 확인하세요.`;
  const phones = L.adminPhones();
  const sent = await L.sendSms(phones, text);
  // 발송 기록을 업무 이력에 남김
  const events = [...(record.events || []), { at: new Date().toISOString(), by: "시스템", action: sent ? `문자 알림 발송 (${phones.length}명)` : "문자 미발송 (설정 필요)" }];
  await L.rest(`/admin_tasks?id=eq.${record.id}`, { method: "PATCH", body: JSON.stringify({ events }) });
  res.status(200).json({ sent, recipients: phones.length });
});

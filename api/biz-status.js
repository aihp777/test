// 국세청 사업자등록 상태조회 (업체 입점 심사용, 관리자 전용)
// 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" 활용신청 → 인증키
//   POST https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=...  body: { "b_no": ["1234567890"] }
//   응답 data[0]: b_stt(납세자상태: 계속사업자/휴업자/폐업자), tax_type(과세유형), end_dt(폐업일)
// 환경변수: NTS_SERVICE_KEY (Decoding 키)
const L = require("./_lib");

module.exports = L.handler(async (req, res) => {
  if (req.method !== "POST") throw L.httpError(405, "Method Not Allowed");
  await L.requireAdmin(req);
  L.need("NTS_SERVICE_KEY");
  const b = String(L.body(req).b_no || "").replace(/\D/g, "");
  if (b.length !== 10) throw L.httpError(400, "사업자등록번호 10자리를 입력하세요.");
  const r = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(L.env("NTS_SERVICE_KEY"))}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ b_no: [b] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw L.httpError(502, "국세청 조회 실패: " + (j.msg || r.status));
  const d = (j.data || [])[0] || {};
  res.status(200).json({
    b_no: b,
    status: d.b_stt || "확인 불가",           // 계속사업자 / 휴업자 / 폐업자
    tax_type: d.tax_type || "",                // 예: 부가가치세 일반과세자 / "국세청에 등록되지 않은 사업자등록번호입니다."
    end_date: d.end_dt || "",
    checked_at: new Date().toISOString(),
  });
});

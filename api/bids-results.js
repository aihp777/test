// 나라장터 개찰 결과 자동 반영 (2단계)
// - 대상: bids.status = 'submitted'(투찰 완료) 이고 개찰일시가 지났으며 결과 미반영인 공고
// - 조달청_나라장터 낙찰정보서비스(공공데이터포털 데이터 ID 15129397)의 "개찰결과 개찰완료 목록 조회"(입찰공고번호 필수)를 호출
// - 우리 회사(COMPANY_BIZ_NO) 순위·투찰률, 1순위 업체·금액·투찰률, 참가업체 수를 저장하고
//   1순위면 'won', 아니면 'lost'로 상태 변경 → 관리자 업무함 등록(웹훅으로 2인 문자 알림)
// - 실행: Vercel Cron(매일 18:00 KST) 또는 관리자 콘솔 "개찰 결과 확인" 버튼
//
// 환경변수
//   NARA_SERVICE_KEY   공공데이터포털 인증키(Decoding) — 낙찰정보서비스도 활용신청 필요
//   COMPANY_BIZ_NO     (주)와이드가드 사업자등록번호 (숫자만 또는 하이픈 포함)
//   NARA_RESULT_BASE   기본값 https://apis.data.go.kr/1230000/as/ScsbidInfoService
//   NARA_RESULT_OP     기본값 getOpengResultListInfoOpengCompt  ← 활용신청 후 명세서의 영문명과 다르면 이 값만 변경
//   CRON_SECRET        Vercel Cron 인증용
//
// ※ 적격심사 공고는 1순위가 심사에서 탈락할 수 있으므로 '1순위 개찰 기준' 결과입니다. 최종 낙찰자는 나라장터에서 확인하세요.
const L = require("./_lib");
const digits = (v) => String(v || "").replace(/\D/g, "");
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/[,%]/g, "")));
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return null; };

async function fetchResult(b) {
  const base = L.env("NARA_RESULT_BASE") || "https://apis.data.go.kr/1230000/as/ScsbidInfoService";
  const op = L.env("NARA_RESULT_OP") || "getOpengResultListInfoOpengCompt";
  const qs = new URLSearchParams({ pageNo: "1", numOfRows: "999", type: "json", bidNtceNo: b.bid_no, bidNtceOrd: b.bid_ord || "000" });
  const r = await fetch(`${base}/${op}?serviceKey=${encodeURIComponent(L.env("NARA_SERVICE_KEY"))}&${qs}`);
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { throw L.httpError(502, `낙찰정보 API 응답 오류(${b.bid_no}): ${text.slice(0, 120)}`); }
  const items = j?.response?.body?.items;
  const list = Array.isArray(items) ? items : Array.isArray(items?.item) ? items.item : items?.item ? [items.item] : [];
  return list.map((it) => ({
    rank: num(pick(it, "opengRank", "rank")),
    bizno: digits(pick(it, "prcbdrBizno", "bizno", "sucsfbidBizno")),
    name: pick(it, "prcbdrNm", "corpNm", "sucsfbidCorpNm"),
    amount: num(pick(it, "bidprcAmt", "bidAmt")),
    rate: num(pick(it, "bidprcrt", "bidprcRt", "bidRate")),
    note: pick(it, "rmrk", "remark") || "",
  }));
}

module.exports = L.handler(async (req, res) => {
  if (req.method === "GET") {
    if (!L.env("CRON_SECRET") || req.headers.authorization !== `Bearer ${L.env("CRON_SECRET")}`) throw L.httpError(401, "unauthorized");
  } else if (req.method === "POST") await L.requireAdmin(req);
  else throw L.httpError(405, "Method Not Allowed");
  L.need("NARA_SERVICE_KEY", "COMPANY_BIZ_NO");
  const myBiz = digits(L.env("COMPANY_BIZ_NO"));

  const nowIso = new Date().toISOString();
  const targets = await L.rest(`/bids?status=eq.submitted&open_at=lt.${nowIso}&result_checked_at=is.null&select=*&limit=50`);
  let updated = 0; const pendingList = [];
  for (const b of targets) {
    const rows = (await fetchResult(b)).filter((x) => x.rank !== null).sort((a, c) => a.rank - c.rank);
    if (!rows.length) { pendingList.push(b.bid_no); continue; } // 아직 개찰 결과 미게시 → 다음 실행 때 재확인
    const top = rows[0], mine = rows.find((x) => x.bizno === myBiz);
    const won = !!mine && mine.rank === 1;
    const patch = {
      participants: rows.length, our_rank: mine ? mine.rank : null, our_rate: mine ? mine.rate : null,
      winner_name: top.name, winner_bizno: top.bizno, winner_amount: top.amount, winner_rate: top.rate,
      result_note: top.note || null, status: won ? "won" : "lost", result_checked_at: nowIso, result_source: "nara",
    };
    await L.rest(`/bids?id=eq.${b.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    const summary = won ? `🎉 1순위(낙찰 예정) · ${rows.length}개사 참여 · 투찰률 ${mine.rate ?? "-"}%`
      : `미낙찰 · 우리 ${mine ? mine.rank + "위" : "순위 확인 불가"} / ${rows.length}개사 · 1순위 ${top.name || "-"} ${top.rate ?? "-"}%`;
    await L.rest("/admin_tasks", { method: "POST", body: JSON.stringify({
      type: "bid_result", ref_id: b.id, title: b.title, detail: `개찰 결과: ${summary}`,
      events: [{ at: nowIso, by: "시스템", action: "개찰 결과 자동 반영 · 관리자 2인 알림" }],
    }) });
    updated++;
  }
  res.status(200).json({ updated, checked: targets.length, pending: pendingList.length,
    message: `개찰 결과 ${updated}건 반영${pendingList.length ? `, ${pendingList.length}건은 아직 결과 미게시` : ""}` });
});

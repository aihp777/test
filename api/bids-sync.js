// 나라장터(조달청) 용역 입찰공고 자동 수집
// - Vercel Cron(매일 07:00 KST, vercel.json) 또는 관리자 콘솔 "지금 수집" 버튼으로 실행
// - 공공데이터포털 "조달청_나라장터 입찰공고정보서비스"(데이터 ID 15129394) 활용신청 후 인증키 필요
// - 새 공고는 bids 테이블에 저장 → DB 트리거가 관리자 업무함에 등록 → 웹훅으로 2인 문자 알림
// - 투찰(입찰서 제출)은 자동화하지 않습니다. 나라장터에서 인증서로 담당자가 직접 제출합니다.
//
// 환경변수
//   NARA_SERVICE_KEY  공공데이터포털 일반 인증키(Decoding)
//   NARA_BASE         기본값 https://apis.data.go.kr/1230000/ad/BidPublicInfoService02
//   NARA_OP           기본값 getBidPblancListInfoServcPPSSrch  ← "나라장터검색조건에 의한 입찰공고용역조회"
//                     (활용신청 후 명세서의 영문 오퍼레이션명과 다르면 이 값만 바꾸면 됩니다)
//   CRON_SECRET       Vercel Cron 인증용
const L = require("./_lib");
const KEYWORDS = ["경비", "경호", "보안요원", "안전요원", "교통정리", "주차관리", "질서유지"];
const EXCLUDE = ["경비지원", "운영경비", "여비", "경비정산"];
const pad = (n) => String(n).padStart(2, "0");
// 한국 시간(KST) 기준 YYYYMMDDHHMM (서버 시간대와 무관)
const ymdhm = (d) => { const k = new Date(d.getTime() + 9 * 3600e3); return `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}${pad(k.getUTCHours())}${pad(k.getUTCMinutes())}`; };
const pick = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return null; };
const toISO = (s) => { if (!s) return null; const m = String(s).match(/(\d{4})-?(\d{2})-?(\d{2})[ T]?(\d{2})?:?(\d{2})?/); return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:00+09:00`).toISOString() : null; };
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/,/g, "")) || null);

async function fetchKeyword(kw, from, to) {
  const base = L.env("NARA_BASE") || "https://apis.data.go.kr/1230000/ad/BidPublicInfoService02";
  const op = L.env("NARA_OP") || "getBidPblancListInfoServcPPSSrch";
  const qs = new URLSearchParams({ pageNo: "1", numOfRows: "100", type: "json", inqryDiv: "1", inqryBgnDt: ymdhm(from), inqryEndDt: ymdhm(to), bidNtceNm: kw });
  const url = `${base}/${op}?serviceKey=${encodeURIComponent(L.env("NARA_SERVICE_KEY"))}&${qs}`;
  const r = await fetch(url);
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { throw L.httpError(502, `나라장터 API 응답 오류(${kw}): ${text.slice(0, 120)}`); }
  const items = j?.response?.body?.items;
  const list = Array.isArray(items) ? items : Array.isArray(items?.item) ? items.item : items?.item ? [items.item] : [];
  return list.map((it) => ({
    bid_no: pick(it, "bidNtceNo"), bid_ord: pick(it, "bidNtceOrd") || "000",
    title: pick(it, "bidNtceNm"), org: pick(it, "ntceInsttNm"), demand_org: pick(it, "dminsttNm"),
    region_limit: pick(it, "prtcptLmtRgnNm") || "",
    close_at: toISO(pick(it, "bidClseDt", "bidClseDate")), open_at: toISO(pick(it, "opengDt", "opengDate")),
    base_amount: num(pick(it, "bssamt", "asignBdgtAmt")), presumed_price: num(pick(it, "presmptPrce")),
    url: pick(it, "bidNtceDtlUrl", "bidNtceUrl") || "https://www.g2b.go.kr", keyword: kw, raw: it,
  })).filter((b) => b.bid_no && b.title && !EXCLUDE.some((x) => b.title.includes(x)));
}

module.exports = L.handler(async (req, res) => {
  // 인증: Vercel Cron(GET + CRON_SECRET) 또는 관리자(POST + 로그인 토큰)
  if (req.method === "GET") {
    if (!L.env("CRON_SECRET") || req.headers.authorization !== `Bearer ${L.env("CRON_SECRET")}`) throw L.httpError(401, "unauthorized");
  } else if (req.method === "POST") await L.requireAdmin(req);
  else throw L.httpError(405, "Method Not Allowed");
  L.need("NARA_SERVICE_KEY");

  const to = new Date();
  const from = new Date(to.getTime() - 6 * 86400e3); // API 1회 조회기간 최대 7일 (2026-11-10 공지)

  const seen = new Map();
  for (const kw of KEYWORDS) for (const b of await fetchKeyword(kw, from, to)) seen.set(`${b.bid_no}-${b.bid_ord}`, b);
  const rows = [...seen.values()];
  if (!rows.length) return res.status(200).json({ added: 0, fetched: 0 });
  // 중복(같은 공고번호·차수)은 무시 → 새 공고만 저장 (DB 트리거가 업무함 등록)
  const inserted = await L.rest("/bids?on_conflict=bid_no,bid_ord", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) });
  res.status(200).json({ added: inserted.length, fetched: rows.length });
});

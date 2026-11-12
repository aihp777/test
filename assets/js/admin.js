// =============================================================
//  관리자 콘솔 (/admin)
// =============================================================
import { $, $$, esc, won, date, datetime, badge, toast, renderPhotos, store, CATEGORIES, REGIONS, regionLabel } from "./ui.js";
import { IS_DEMO, CONFIG, REQUEST_STATUS, QUOTE_STATUS, VENDOR_STATUS, COLLECTIVE_SITES } from "./config.js";

// ---------- 인증 ----------
const me = await store.currentUser();
if (!me) { location.href = "/platform/login?next=/admin/"; throw new Error("redirect"); }
if (me.role !== "admin") { document.body.innerHTML = `<div class="empty" style="padding:80px">관리자만 접근할 수 있습니다. <a href="/platform/" style="color:var(--blue)">플랫폼으로</a></div>`; throw new Error("forbidden"); }
$("#who").textContent = `${me.name} (${me.email})`;
$("#logout").onclick = async () => { await store.signOut(); location.href = "/platform/login"; };
$("#menu").onclick = () => $("#side").classList.toggle("open");

// ---------- 공통 ----------
const ROLE = { customer: "고객", vendor: "업체", admin: "관리자" };
const PAY = { ready: "결제대기", paid: "결제완료", failed: "실패", refunded: "환불" };
const SETTLE = { pending: "정산대기", settled: "정산완료" };
const tone = {
  vendor: { approved: "ok", pending: "warn", rejected: "bad" },
  request: { open: "teal", matched: "navy", paid: "ok", in_progress: "ok", completed: "", canceled: "bad" },
  pay: { paid: "ok", ready: "warn", failed: "bad", refunded: "" },
};
const vBadge = (s) => badge(VENDOR_STATUS[s] || s, tone.vendor[s]);
const rBadge = (s) => badge(REQUEST_STATUS[s] || s, tone.request[s]);
const pBadge = (p) => badge(PAY[p.status] || p.status, tone.pay[p.status]) + (p.status === "paid" ? " " + badge(SETTLE[p.settlement_status || "pending"], p.settlement_status === "settled" ? "navy" : "warn") : "");
const isPaid = (p) => p.status === "paid";
const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);

async function loadAll() {
  const [users, vendors, requests, quotes, payments, settings] = await Promise.all([
    store.listUsers(), store.listVendors({ status: null }), store.listAllRequests(), store.listAllQuotes(), store.listPayments(), store.getSettings(),
  ]);
  const pending = vendors.filter((v) => v.status === "pending").length;
  const toSettle = payments.filter((p) => isPaid(p) && (p.settlement_status || "pending") === "pending").length;
  $("#cntVendors").hidden = !pending; $("#cntVendors").textContent = pending;
  $("#cntPay").hidden = !toSettle; $("#cntPay").textContent = toSettle;
  return { users, vendors, requests, quotes, payments, settings };
}

function csv(filename, header, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = "﻿" + [header, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 드로어 ----------
function openDrawer(title, body, foot = "") {
  $("#drawerTitle").textContent = title; $("#drawerBody").innerHTML = body; $("#drawerFoot").innerHTML = foot;
  $("#drawerFoot").hidden = !foot;
  $("#drawer").classList.add("show"); $("#drawerBg").classList.add("show"); $("#drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() { $("#drawer").classList.remove("show"); $("#drawerBg").classList.remove("show"); $("#drawer").setAttribute("aria-hidden", "true"); }
$("#drawerClose").onclick = closeDrawer; $("#drawerBg").onclick = closeDrawer;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#lightbox.show")) closeDrawer(); });

// ---------- 차트 (단일 계열: 범례 없음, 제목이 계열명) ----------
const tip = $("#chartTip");
function bindTips(root) {
  $$("[data-tip]", root).forEach((el) => {
    el.onmousemove = (e) => { tip.innerHTML = el.dataset.tip; tip.classList.add("show"); tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY - 10 + "px"; };
    el.onmouseleave = () => tip.classList.remove("show");
  });
}
const short = (n) => (n >= 1e8 ? (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억" : n >= 1e4 ? Math.round(n / 1e4).toLocaleString() + "만" : n.toLocaleString());
function colChart(points) { // [{label, value, tip}]
  const max = Math.max(1, ...points.map((p) => p.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / nice) * nice;
  return `<div class="colchart">
      <div class="grid" style="bottom:100%"><span>${short(top)}</span></div>
      <div class="grid" style="bottom:50%"><span>${short(top / 2)}</span></div>
      ${points.map((p) => `<div class="bar" data-tip="${esc(p.tip)}"><i style="height:${(p.value / top) * 100}%"></i></div>`).join("")}
    </div><div class="collabels">${points.map((p) => `<span>${esc(p.label)}</span>`).join("")}</div>`;
}
function hBars(items) { // [{label, value}]
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="hbars">${items.map((i) => `
    <div class="hbar" data-tip="<b>${esc(i.label)}</b>${i.value}건">
      <span class="lbl">${esc(i.label)}</span><span class="trk"><i style="width:${(i.value / max) * 100}%"></i></span><span class="val">${i.value}</span>
    </div>`).join("") || `<p class="muted">데이터가 없습니다.</p>`}</div>`;
}

// =============================================================
//  1. 대시보드
// =============================================================
async function dashboard() {
  const { users, vendors, requests, quotes, payments } = await loadAll();
  const paid = payments.filter(isPaid);
  const ym = (d) => d.slice(0, 7);
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
  const byMonth = Object.fromEntries(months.map((m) => [m, sum(paid.filter((p) => ym(p.paid_at || p.created_at) === m), (p) => p.amount)]));
  const thisM = byMonth[months[5]], lastM = byMonth[months[4]];
  const diff = lastM ? Math.round(((thisM - lastM) / lastM) * 100) : null;
  const active = requests.filter((r) => ["open", "matched", "paid", "in_progress"].includes(r.status));
  const qCount = {}; quotes.forEach((q) => (qCount[q.request_id] = (qCount[q.request_id] || 0) + 1));
  const noQuote = requests.filter((r) => r.status === "open" && !qCount[r.id]);
  const toSettle = paid.filter((p) => (p.settlement_status || "pending") === "pending");
  const reqDone = new Set(requests.filter((r) => r.status === "completed").map((r) => r.id));
  const settleReady = toSettle.filter((p) => reqDone.has(p.request_id));

  const countBy = (list, key) => { const m = {}; list.forEach((x) => (m[x[key]] = (m[x[key]] || 0) + 1)); return m; };
  const cat = countBy(requests, "category");
  const reg = countBy(requests, "region");
  const regItems = Object.entries(reg).sort((a, b) => b[1] - a[1]);
  const regTop = regItems.slice(0, 7).map(([label, value]) => ({ label, value }));
  if (regItems.length > 7) regTop.push({ label: "기타", value: sum(regItems.slice(7), (x) => x[1]) });

  const feed = [
    ...requests.map((r) => ({ t: r.created_at, s: `📝 견적 요청 · ${r.customer_name} · ${r.title}` })),
    ...quotes.map((q) => ({ t: q.created_at, s: `💬 견적 제출 · ${q.vendor_company} · ${won(q.amount)}` })),
    ...paid.map((p) => ({ t: p.paid_at || p.created_at, s: `💳 결제 완료 · ${p.order_name || p.order_id} · ${won(p.amount)}` })),
    ...vendors.map((v) => ({ t: v.created_at, s: `🏢 업체 등록 · ${v.company} (${VENDOR_STATUS[v.status]})` })),
  ].filter((x) => x.t).sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 8);

  $("#main").innerHTML = `
    ${IS_DEMO ? `<div class="demo-note">데모 모드: 과거 거래는 데모용 예시 데이터입니다. 실제 운영 데이터는 Supabase 연결 후 표시됩니다.</div>` : ""}
    <div class="kpis">
      <div class="kpi"><span>이번 달 거래액</span><b>${won(thisM)}</b><small>${diff === null ? "전월 거래 없음" : `전월 대비 ${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)}%`}</small></div>
      <div class="kpi"><span>누적 수수료 수익</span><b>${won(sum(paid, (p) => p.fee))}</b><small>누적 거래액 ${won(sum(paid, (p) => p.amount))}</small></div>
      <div class="kpi"><span>진행 중 요청</span><b>${active.length}건</b><small>전체 ${requests.length}건</small></div>
      <div class="kpi"><span>활동 업체</span><b>${vendors.filter((v) => v.status === "approved").length}곳</b><small>승인 대기 ${vendors.filter((v) => v.status === "pending").length}곳</small></div>
      <div class="kpi"><span>전체 회원</span><b>${users.length}명</b><small>고객 ${users.filter((u) => u.role === "customer").length} · 업체 ${users.filter((u) => u.role === "vendor").length}</small></div>
    </div>
    <div class="cols c2">
      <div class="panel"><h3>월별 거래액</h3><p class="sub">최근 6개월 · 결제 완료 기준 (환불 제외)</p>
        ${colChart(months.map((m) => ({ label: +m.slice(5) + "월", value: byMonth[m], tip: `<b>${m.replace("-", "년 ")}월</b>${won(byMonth[m])}` })))}
      </div>
      <div class="panel"><h3>처리할 일</h3><p class="sub">관리자 확인이 필요한 항목</p>
        <div class="todo">
          <a href="#vendors?status=pending">승인 대기 업체 <b>${vendors.filter((v) => v.status === "pending").length}</b></a>
          <a href="#requests?filter=noquote">견적 0건인 요청 <b>${noQuote.length}</b></a>
          <a href="#payments?settle=ready">정산 가능 (서비스 완료) <b>${settleReady.length}</b></a>
          <a href="#payments?settle=pending">정산 대기 전체 <b>${toSettle.length}</b></a>
        </div>
      </div>
    </div>
    <div class="cols c3">
      <div class="panel"><h3>분야별 견적 요청</h3><p class="sub">전체 기간 · 건수</p>${hBars(CATEGORIES.map((c) => ({ label: c, value: cat[c] || 0 })))}</div>
      <div class="panel"><h3>지역별 견적 요청</h3><p class="sub">전체 기간 · 상위 지역</p>${hBars(regTop)}</div>
      <div class="panel"><h3>최근 활동</h3><p class="sub">최신 8건</p><div class="feed">${feed.map((f) => `<div><span>${esc(f.s)}</span><time>${datetime(f.t)}</time></div>`).join("") || `<p class="muted">활동이 없습니다.</p>`}</div></div>
    </div>`;
  bindTips($("#main"));
}

// =============================================================
//  2. 회원 관리
// =============================================================
async function users(params) {
  const { users, vendors, requests } = await loadAll();
  const vBy = Object.fromEntries(vendors.map((v) => [v.owner_id, v]));
  $("#main").innerHTML = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="이름, 이메일, 연락처 검색">
      <select id="role"><option value="">전체 유형</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <span class="sp"></span><span class="count" id="count"></span>
      <button class="p-btn p-btn-line p-btn-sm" id="csv">CSV 내보내기</button>
    </div>
    <div class="a-wrap"><table class="a-tbl"><thead><tr><th>이름</th><th>이메일</th><th>연락처</th><th>유형</th><th>업체</th><th>견적 요청</th><th>가입일</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  $("#role").value = params.get("role") || "";
  let rows = [];
  const draw = () => {
    const q = $("#q").value.trim(), role = $("#role").value;
    rows = users.filter((u) => (!role || u.role === role) && (!q || `${u.name}${u.email}${u.phone}`.includes(q)));
    $("#count").textContent = `${rows.length}명`;
    $("#tb").innerHTML = rows.map((u) => `<tr class="click" data-id="${u.id}">
      <td><b>${esc(u.name)}</b></td><td>${esc(u.email || "-")}</td><td>${esc(u.phone || "-")}</td><td>${badge(ROLE[u.role], u.role === "admin" ? "navy" : u.role === "vendor" ? "teal" : "")}</td>
      <td>${vBy[u.id] ? esc(vBy[u.id].company) + " " + vBadge(vBy[u.id].status) : "-"}</td><td class="num">${requests.filter((r) => r.customer_id === u.id).length}</td><td class="sm">${date(u.created_at)}</td></tr>`).join("")
      || `<tr><td colspan="7" class="empty">회원이 없습니다.</td></tr>`;
    $$("#tb tr.click").forEach((tr) => (tr.onclick = () => userDrawer(users.find((u) => u.id === tr.dataset.id), vBy, requests)));
  };
  $("#q").oninput = draw; $("#role").onchange = draw; draw();
  $("#csv").onclick = () => csv("회원", ["이름", "이메일", "연락처", "유형", "업체", "가입일"], rows.map((u) => [u.name, u.email, u.phone, ROLE[u.role], vBy[u.id]?.company || "", date(u.created_at)]));
}
function userDrawer(u, vBy, requests) {
  const v = vBy[u.id]; const self = u.id === me.id;
  openDrawer(u.name, `
    <dl class="kv"><dt>이메일</dt><dd>${esc(u.email || "-")}</dd><dt>연락처</dt><dd>${esc(u.phone || "-")}</dd><dt>유형</dt><dd>${badge(ROLE[u.role])}</dd><dt>가입일</dt><dd>${date(u.created_at)}</dd>
    <dt>업체</dt><dd>${v ? `${esc(v.company)} ${vBadge(v.status)}` : "-"}</dd><dt>견적 요청</dt><dd>${requests.filter((r) => r.customer_id === u.id).length}건</dd></dl>
    <h4>회원 유형 변경</h4>
    ${self ? `<p class="muted">본인 계정의 권한은 변경할 수 없습니다.</p>` : `<div class="flex"><select id="newRole" style="width:auto">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${l}</option>`).join("")}</select><button class="p-btn p-btn-sm" id="saveRole">변경</button></div>
    <p class="muted mt" style="font-size:13px">관리자로 지정하면 이 콘솔 전체에 접근할 수 있습니다.</p>`}`);
  const b = $("#saveRole");
  if (b) b.onclick = async () => {
    const role = $("#newRole").value; if (role === u.role) return;
    if (!confirm(`${u.name}님의 유형을 '${ROLE[role]}'(으)로 변경할까요?`)) return;
    try { await store.setUserRole(u.id, role); toast("변경되었습니다."); closeDrawer(); route(); } catch (e) { toast(e.message, "bad"); }
  };
}

// =============================================================
//  3. 업체 관리
// =============================================================
async function vendorsView(params) {
  const { vendors, quotes, payments } = await loadAll();
  const st = params.get("status") || "";
  $("#main").innerHTML = `
    <div class="tabs" id="vt">${[["", "전체"], ["pending", "승인 대기"], ["approved", "승인"], ["rejected", "반려·정지"]].map(([k, l]) => `<button data-s="${k}" class="${k === st ? "on" : ""}">${l} (${k ? vendors.filter((v) => v.status === k).length : vendors.length})</button>`).join("")}</div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="업체명, 대표자, 사업자번호 검색">
      <select id="cat"><option value="">전체 분야</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
      <span class="sp"></span><span class="count" id="count"></span>
      <button class="p-btn p-btn-line p-btn-sm" id="csv">CSV 내보내기</button>
    </div>
    <div class="a-wrap"><table class="a-tbl"><thead><tr><th>업체명</th><th>대표</th><th>사업자번호</th><th>분야</th><th>지역</th><th>견적</th><th>선정</th><th class="num">거래액</th><th>상태</th><th>등록일</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  $$("#vt button").forEach((b) => (b.onclick = () => (location.hash = "vendors" + (b.dataset.s ? "?status=" + b.dataset.s : ""))));
  const stat = (v) => { const qs = quotes.filter((q) => q.vendor_id === v.id); return { q: qs.length, a: qs.filter((q) => q.status === "accepted").length, amt: sum(payments.filter((p) => isPaid(p) && p.vendor_id === v.id), (p) => p.amount) }; };
  let rows = [];
  const draw = () => {
    const q = $("#q").value.trim(), c = $("#cat").value;
    rows = vendors.filter((v) => (!st || v.status === st) && (!c || v.categories.includes(c)) && (!q || `${v.company}${v.ceo}${v.biz_no}`.includes(q)));
    $("#count").textContent = `${rows.length}곳`;
    $("#tb").innerHTML = rows.map((v) => { const s = stat(v); return `<tr class="click" data-id="${v.id}">
      <td><b>${esc(v.company)}</b><div class="sm">${esc(v.phone)}</div></td><td>${esc(v.ceo)}</td><td class="sm">${esc(v.biz_no)}</td>
      <td class="sm" style="max-width:180px">${esc(v.categories.join(", "))}</td><td class="sm">${esc(regionLabel(v.regions))}</td>
      <td class="num">${s.q}</td><td class="num">${s.a}</td><td class="num">${won(s.amt)}</td><td>${vBadge(v.status)}</td><td class="sm">${date(v.created_at)}</td></tr>`; }).join("")
      || `<tr><td colspan="10" class="empty">업체가 없습니다.</td></tr>`;
    $$("#tb tr.click").forEach((tr) => (tr.onclick = () => vendorDrawer(vendors.find((v) => v.id === tr.dataset.id), stat)));
  };
  $("#q").oninput = draw; $("#cat").onchange = draw; draw();
  $("#csv").onclick = () => csv("업체", ["업체명", "대표", "사업자번호", "연락처", "이메일", "주소", "분야", "지역", "허가", "상태", "등록일"],
    rows.map((v) => [v.company, v.ceo, v.biz_no, v.phone, v.email, v.address, v.categories.join("/"), regionLabel(v.regions), v.license_info, VENDOR_STATUS[v.status], date(v.created_at)]));
}
function vendorDrawer(v, stat) {
  const s = stat(v);
  openDrawer(v.company, `
    <p>${vBadge(v.status)}</p>
    <dl class="kv mt"><dt>대표자</dt><dd>${esc(v.ceo)}</dd><dt>사업자번호</dt><dd>${esc(v.biz_no)}</dd><dt>연락처</dt><dd>${esc(v.phone)}</dd><dt>이메일</dt><dd>${esc(v.email)}</dd>
      <dt>주소</dt><dd>${esc(v.address || "-")}</dd>
      <dt>경비업 허가</dt><dd>${(v.licenses || []).map((l) => badge(l, "navy")).join(" ") || "-"}<br><small class="muted">허가번호 ${esc(v.license_no || "-")}</small></dd>
      <dt>건물위생관리업</dt><dd>${esc(v.sanitation_no || "-")}</dd>
      ${(v.licenses || []).includes("특수경비") ? `<dt>경비대행업자</dt><dd>${esc(v.special_agent || "미입력")}</dd>` : ""}
      <dt>기타 허가</dt><dd>${esc(v.license_info || "-")}</dd><dt>서비스 분야</dt><dd>${esc(v.categories.join(", "))}</dd><dt>서비스 지역</dt><dd>${esc(regionLabel(v.regions))}</dd>
      <dt>평점</dt><dd>★ ${v.rating || "-"} (${v.review_count || 0})</dd><dt>실적</dt><dd>견적 ${s.q}건 · 선정 ${s.a}건 · 거래액 ${won(s.amt)}</dd><dt>등록일</dt><dd>${date(v.created_at)}</dd></dl>
    <h4>업체 소개</h4><p style="white-space:pre-wrap;font-size:14px">${esc(v.intro)}</p>
    <h4>제출 서류</h4><div class="doc-list" id="vDocs"><span class="muted">불러오는 중...</span></div>
    <h4>심사 체크리스트</h4>
    <ul style="font-size:13.5px;margin-left:18px;line-height:1.9">
      <li>사업자등록 상태 조회 (국세청 홈택스 — 휴·폐업 여부)</li>
      <li>경비업 허가증의 <b>법인명·허가번호·허가 업무</b>가 입력값과 일치하는지 (필요 시 관할 시·도경찰청 확인)</li>
      <li>선택한 서비스 분야가 허가 업무 범위 안인지 (시스템이 자동 제한, 서류로 재확인)</li>
      <li>특수경비: 특수경비업 허가 + 경비대행업자 지정 신고 여부</li>
      <li>청소대행: 건물위생관리업 신고증</li>
      <li>배상책임보험 가입 여부 (권장)</li>
    </ul>
    <h4>운영사 직영 표시</h4>
    <label class="flex" style="font-size:14px"><input type="checkbox" id="isOp" style="width:auto" ${v.is_operator ? "checked" : ""}> 이 업체는 플랫폼 운영사(와이드가드)가 직접 운영함 — 고객 화면에 '운영사 직영' 표시</label>
    <h4>관리자 메모 <span class="muted" style="font-weight:500">(업체에 보이지 않음)</span></h4>
    <textarea id="memo" style="min-height:90px" placeholder="심사 내용, 반려 사유, 특이사항">${esc(v.admin_memo || "")}</textarea>
    <button class="p-btn p-btn-line p-btn-sm mt" id="saveMemo">메모 저장</button>`,
    `${v.status !== "approved" ? `<button class="p-btn" data-s="approved">승인</button>` : ""}
     ${v.status === "pending" ? `<button class="p-btn p-btn-bad" data-s="rejected">반려</button>` : ""}
     ${v.status === "approved" ? `<button class="p-btn p-btn-bad" data-s="rejected">활동 정지</button>` : ""}
     <a class="p-btn p-btn-line" href="/platform/vendor?id=${v.id}" target="_blank">공개 페이지</a>`);
  $("#saveMemo").onclick = async () => { await store.updateVendorAdmin(v.id, { admin_memo: $("#memo").value }); toast("메모를 저장했습니다."); };
  $("#isOp").onchange = async (e) => { await store.updateVendorAdmin(v.id, { is_operator: e.target.checked }); toast(e.target.checked ? "운영사 직영으로 표시합니다." : "직영 표시를 해제했습니다."); };
  store.getDocUrls(v).then((docs) => {
    $("#vDocs").innerHTML = docs.map((d) => `<a href="${esc(d.url)}" target="_blank" rel="noopener" download="${esc(d.name)}">📄 ${esc(d.name)}</a>`).join("") || `<span class="muted">제출된 서류가 없습니다.</span>`;
  });
  $$("#drawerFoot [data-s]").forEach((b) => (b.onclick = async () => {
    const label = b.textContent.trim();
    if (!confirm(`${v.company}을(를) '${label}' 처리할까요?`)) return;
    try { await store.updateVendorAdmin(v.id, { status: b.dataset.s, admin_memo: $("#memo").value }); toast(`${label} 처리되었습니다.`); closeDrawer(); route(); } catch (e) { toast(e.message, "bad"); }
  }));
}

// =============================================================
//  4. 견적 요청
// =============================================================
async function requestsView(params) {
  const { requests, quotes, payments, vendors } = await loadAll();
  const qBy = {}; quotes.forEach((q) => (qBy[q.request_id] = [...(qBy[q.request_id] || []), q]));
  $("#main").innerHTML = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="제목, 고객명 검색">
      <select id="st"><option value="">전체 상태</option>${Object.entries(REQUEST_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}<option value="noquote">견적 0건 (모집중)</option></select>
      <select id="cat"><option value="">전체 분야</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
      <select id="reg"><option value="">전체 지역</option><option>전국</option>${REGIONS.map((r) => `<option>${r}</option>`).join("")}</select>
      <span class="sp"></span><span class="count" id="count"></span>
      <button class="p-btn p-btn-line p-btn-sm" id="csv">CSV 내보내기</button>
    </div>
    <div class="a-wrap"><table class="a-tbl"><thead><tr><th>제목</th><th>고객</th><th>분야</th><th>지역</th><th>희망일</th><th class="num">예산</th><th class="num">견적</th><th>사진</th><th>상태</th><th>등록일</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  $("#st").value = params.get("filter") || params.get("status") || "";
  let rows = [];
  const draw = () => {
    const q = $("#q").value.trim(), st = $("#st").value, c = $("#cat").value, rg = $("#reg").value;
    rows = requests.filter((r) => (!st || (st === "noquote" ? r.status === "open" && !qBy[r.id] : r.status === st)) && (!c || r.category === c) && (!rg || r.region === rg) && (!q || `${r.title}${r.customer_name}`.includes(q)));
    $("#count").textContent = `${rows.length}건`;
    $("#tb").innerHTML = rows.map((r) => `<tr class="click" data-id="${r.id}">
      <td><b>${esc(r.title)}</b>${r.target_vendor_id ? ` ${badge("지정", "navy")}` : ""}${r.category === "특수경비" ? ` ${badge("🔒 보안", "navy")}` : ""}${r.collective_site ? ` ${badge("집단민원", "warn")}` : ""}</td><td>${esc(r.customer_name)}</td><td class="sm">${esc(r.category)}</td><td class="sm">${esc(r.region)}</td><td class="sm">${esc(r.service_date)}</td>
      <td class="num">${r.budget ? won(r.budget) : "협의"}</td><td class="num">${(qBy[r.id] || []).length}</td><td class="sm">${r.photos?.length ? "📷 " + r.photos.length : "-"}</td><td>${rBadge(r.status)}</td><td class="sm">${date(r.created_at)}</td></tr>`).join("")
      || `<tr><td colspan="10" class="empty">요청이 없습니다.</td></tr>`;
    $$("#tb tr.click").forEach((tr) => (tr.onclick = () => requestDrawer(requests.find((r) => r.id === tr.dataset.id), qBy, payments, vendors)));
  };
  ["q", "st", "cat", "reg"].forEach((id) => ($("#" + id)[id === "q" ? "oninput" : "onchange"] = draw)); draw();
  $("#csv").onclick = () => csv("견적요청", ["제목", "고객", "분야", "지역", "희망일", "예산", "견적수", "상태", "등록일"],
    rows.map((r) => [r.title, r.customer_name, r.category, r.region, r.service_date, r.budget || "", (qBy[r.id] || []).length, REQUEST_STATUS[r.status], date(r.created_at)]));
}
async function requestDrawer(r, qBy, payments, vendors) {
  const qs = (qBy[r.id] || []).sort((a, b) => a.amount - b.amount);
  const pay = payments.filter((p) => p.request_id === r.id);
  const threads = await store.listThreads(r.id);
  const logs = await Promise.all(threads.map(async (v) => ({ v, ms: await store.listMessages(r.id, v.id) })));
  const target = r.target_vendor_id ? vendors.find((v) => v.id === r.target_vendor_id) : null;
  openDrawer(r.title, `
    <p>${rBadge(r.status)} ${target ? badge("지정: " + target.company, "navy") : ""} ${r.category === "특수경비" ? badge("🔒 특수경비 · " + (r.facility_type || ""), "navy") : ""} ${r.collective_site ? badge("집단민원현장: " + (COLLECTIVE_SITES[r.collective_site] || r.collective_site), "warn") : ""}</p>
    <dl class="kv mt"><dt>고객</dt><dd>${esc(r.customer_name)}</dd><dt>분야 / 지역</dt><dd>${esc(r.category)} · ${esc(r.region)}</dd><dt>희망 시작일</dt><dd>${esc(r.service_date)}</dd>
      <dt>예산</dt><dd>${r.budget ? won(r.budget) : "협의"}</dd><dt>등록일</dt><dd>${datetime(r.created_at)}</dd></dl>
    <h4>상세 내용</h4><p style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:10px;font-size:14px">${esc(r.details)}</p>
    <div id="dPhotos"></div>
    <h4>받은 견적 (${qs.length})</h4>
    ${qs.map((q) => `<div class="quote"><div class="flex between"><b>${esc(q.vendor_company)}</b>${badge(QUOTE_STATUS[q.status], q.status === "accepted" ? "ok" : "")}</div><div class="amt">${won(q.amount)}</div><p class="muted" style="font-size:13.5px;white-space:pre-wrap">${esc(q.message)}</p><small class="muted">${datetime(q.created_at)}</small></div>`).join("") || `<p class="muted">견적이 없습니다.</p>`}
    <h4>결제</h4>
    ${pay.map((p) => `<p>${esc(p.order_id)} · ${won(p.amount)} ${pBadge(p)}</p>`).join("") || `<p class="muted">결제 내역이 없습니다.</p>`}
    <h4>상담 내역 (열람 전용)</h4>
    ${logs.map(({ v, ms }) => `<p style="font-weight:700;font-size:13.5px;margin:10px 0 6px">${esc(v.company)} ↔ ${esc(r.customer_name)}</p>
      <div class="log">${ms.map((m) => `<p><b>${esc(m.sender_name)}</b><time>${datetime(m.created_at)}</time><br>${esc(m.body)}</p>`).join("") || `<p class="muted">메시지 없음</p>`}</div>`).join("") || `<p class="muted">상담 내역이 없습니다.</p>`}
    <h4>상태 변경</h4>
    <div class="flex"><select id="newSt" style="width:auto">${Object.entries(REQUEST_STATUS).map(([k, l]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${l}</option>`).join("")}</select><button class="p-btn p-btn-sm" id="saveSt">변경</button></div>
    <p class="muted mt" style="font-size:12.5px">분쟁 조정, 허위 요청 처리 등 예외 상황에서만 사용하세요. 결제 건 취소는 결제·정산 메뉴에서 환불로 처리합니다.</p>`);
  renderPhotos($("#dPhotos"), r);
  $("#saveSt").onclick = async () => {
    const s = $("#newSt").value; if (s === r.status) return;
    if (!confirm(`상태를 '${REQUEST_STATUS[s]}'(으)로 변경할까요?`)) return;
    await store.updateRequestStatus(r.id, s); toast("변경되었습니다."); closeDrawer(); route();
  };
}

// =============================================================
//  5. 결제 · 정산
// =============================================================
async function paymentsView(params) {
  const { payments, requests, vendors } = await loadAll();
  const rBy = Object.fromEntries(requests.map((r) => [r.id, r]));
  const vBy = Object.fromEntries(vendors.map((v) => [v.id, v]));
  $("#main").innerHTML = `
    <div class="kpis" id="pk" style="grid-template-columns:repeat(4,1fr)"></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="주문번호, 내용, 업체 검색">
      <select id="st"><option value="">전체 결제상태</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <select id="se"><option value="">전체 정산상태</option><option value="pending">정산대기</option><option value="ready">정산 가능 (서비스 완료)</option><option value="settled">정산완료</option></select>
      <input type="month" id="mon" title="결제 월">
      <span class="sp"></span><span class="count" id="count"></span>
      <button class="p-btn p-btn-line p-btn-sm" id="csv">CSV 내보내기</button>
    </div>
    <div class="a-wrap"><table class="a-tbl"><thead><tr><th>주문번호</th><th>내용</th><th>업체</th><th class="num">결제액</th><th class="num">수수료</th><th class="num">정산액</th><th>상태</th><th>결제일시</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  $("#se").value = params.get("settle") || "";
  let rows = [];
  const draw = () => {
    const q = $("#q").value.trim(), st = $("#st").value, se = $("#se").value, mon = $("#mon").value;
    rows = payments.filter((p) => {
      const settle = p.settlement_status || "pending";
      if (st && p.status !== st) return false;
      if (se === "pending" && !(isPaid(p) && settle === "pending")) return false;
      if (se === "settled" && settle !== "settled") return false;
      if (se === "ready" && !(isPaid(p) && settle === "pending" && rBy[p.request_id]?.status === "completed")) return false;
      if (mon && (p.paid_at || p.created_at).slice(0, 7) !== mon) return false;
      return !q || `${p.order_id}${p.order_name}${vBy[p.vendor_id]?.company}`.includes(q);
    });
    const ok = rows.filter(isPaid);
    $("#pk").innerHTML = [["결제액 (결제완료)", won(sum(ok, (p) => p.amount))], ["플랫폼 수수료", won(sum(ok, (p) => p.fee))],
      ["정산 대기액", won(sum(ok.filter((p) => (p.settlement_status || "pending") === "pending"), (p) => p.amount - p.fee))], ["정산 완료액", won(sum(ok.filter((p) => p.settlement_status === "settled"), (p) => p.amount - p.fee))]]
      .map(([k, v]) => `<div class="kpi"><span>${k}</span><b>${v}</b><small>현재 필터 기준</small></div>`).join("");
    $("#count").textContent = `${rows.length}건`;
    $("#tb").innerHTML = rows.map((p) => `<tr class="click" data-id="${p.id}">
      <td class="sm">${esc(p.order_id)}</td><td>${esc(p.order_name || "-")}</td><td>${esc(vBy[p.vendor_id]?.company || "-")}</td>
      <td class="num">${won(p.amount)}</td><td class="num">${won(p.fee)}</td><td class="num"><b>${won(p.amount - p.fee)}</b></td><td>${pBadge(p)}</td><td class="sm">${datetime(p.paid_at || p.created_at)}</td></tr>`).join("")
      || `<tr><td colspan="8" class="empty">결제 내역이 없습니다.</td></tr>`;
    $$("#tb tr.click").forEach((tr) => (tr.onclick = () => paymentDrawer(payments.find((p) => p.id === tr.dataset.id), rBy, vBy)));
  };
  ["q", "st", "se", "mon"].forEach((id) => ($("#" + id)[id === "q" ? "oninput" : "onchange"] = draw)); draw();
  $("#csv").onclick = () => csv("결제정산", ["주문번호", "내용", "업체", "사업자번호", "결제액", "수수료", "정산액", "결제상태", "정산상태", "결제일시", "정산일시"],
    rows.map((p) => [p.order_id, p.order_name, vBy[p.vendor_id]?.company, vBy[p.vendor_id]?.biz_no, p.amount, p.fee, p.amount - p.fee, PAY[p.status], isPaid(p) ? SETTLE[p.settlement_status || "pending"] : "", datetime(p.paid_at), datetime(p.settled_at)]));
}
function paymentDrawer(p, rBy, vBy) {
  const r = rBy[p.request_id], v = vBy[p.vendor_id];
  const settle = p.settlement_status || "pending";
  const canSettle = isPaid(p) && settle === "pending";
  const canRefund = isPaid(p) && settle === "pending";
  openDrawer("결제 상세", `
    <p>${pBadge(p)}</p>
    <dl class="kv mt"><dt>주문번호</dt><dd>${esc(p.order_id)}</dd><dt>내용</dt><dd>${esc(p.order_name || "-")}</dd><dt>요청 상태</dt><dd>${r ? rBadge(r.status) : "-"}</dd>
      <dt>업체</dt><dd>${esc(v?.company || "-")} <span class="muted">${esc(v?.biz_no || "")}</span></dd><dt>결제액</dt><dd>${won(p.amount)}</dd><dt>수수료</dt><dd>${won(p.fee)}</dd><dt>정산액</dt><dd><b>${won(p.amount - p.fee)}</b></dd>
      <dt>PG 결제키</dt><dd class="sm">${esc(p.payment_key || "-")}</dd><dt>결제일시</dt><dd>${datetime(p.paid_at)}</dd><dt>정산일시</dt><dd>${datetime(p.settled_at)}</dd>
      ${p.status === "refunded" ? `<dt>환불일시</dt><dd>${datetime(p.refunded_at)}</dd><dt>환불 사유</dt><dd>${esc(p.refund_reason || "-")}</dd>` : ""}</dl>
    ${canSettle && r?.status !== "completed" ? `<p class="badge warn mt">고객이 아직 서비스 완료를 확인하지 않았습니다.</p>` : ""}
    <p class="muted mt" style="font-size:12.5px">정산 완료 처리는 업체 계좌로 정산액을 이체한 뒤 기록용으로 누르세요. 정산된 건은 환불할 수 없습니다.</p>`,
    `${canSettle ? `<button class="p-btn" id="doSettle">정산 완료 처리</button>` : ""}${canRefund ? `<button class="p-btn p-btn-bad" id="doRefund">전액 환불</button>` : ""}`);
  const s = $("#doSettle");
  if (s) s.onclick = async () => {
    if (!confirm(`${v?.company}에 ${won(p.amount - p.fee)} 정산 완료로 처리할까요?`)) return;
    try { await store.settlePayment(p.id); toast("정산 완료 처리되었습니다."); closeDrawer(); route(); } catch (e) { toast(e.message, "bad"); }
  };
  const rf = $("#doRefund");
  if (rf) rf.onclick = async () => {
    const reason = prompt(`${won(p.amount)} 전액을 환불합니다. 환불 사유를 입력하세요.`); if (!reason) return;
    try { await store.refundPayment(p.id, reason); toast("환불 처리되었습니다."); closeDrawer(); route(); } catch (e) { toast(e.message, "bad"); }
  };
}

// =============================================================
//  6. 설정
// =============================================================
async function settings() {
  const { settings } = await loadAll();
  $("#main").innerHTML = `
    <div class="cols c11">
      <form class="panel" id="feeForm"><h3>중개 수수료</h3><p class="sub">새로 생성되는 결제부터 적용됩니다.</p>
        <div class="field"><label>수수료율 (%)</label><input type="number" name="rate" min="0" max="50" step="0.5" value="${(settings.fee_rate * 100).toFixed(1)}"></div>
        <button class="p-btn">저장</button></form>
      <div class="panel"><h3>시스템 상태</h3><p class="sub">운영 전환 상태를 확인합니다. 설정 방법은 README 참고</p>
        <dl class="kv"><dt>데이터 저장</dt><dd>${IS_DEMO ? badge("데모 (브라우저 저장)", "warn") : badge("Supabase 연결됨", "ok")}</dd>
          <dt>결제</dt><dd>${CONFIG.TOSS_CLIENT_KEY ? (CONFIG.TOSS_CLIENT_KEY.startsWith("live_") ? badge("토스페이먼츠 라이브", "ok") : badge("토스페이먼츠 테스트", "teal")) : badge("미설정 (테스트 결제)", "warn")}</dd>
          <dt>서비스 분야</dt><dd>${CATEGORIES.length}개</dd><dt>지역</dt><dd>${REGIONS.length}개 + 전국</dd></dl>
        ${IS_DEMO ? `<button class="p-btn p-btn-line p-btn-sm mt" id="reset">데모 데이터 초기화</button>` : ""}
      </div>
    </div>`;
  $("#feeForm").onsubmit = async (e) => { e.preventDefault(); const v = Number(new FormData(e.target).get("rate")); if (v < 0 || v > 50) return toast("0~50% 사이로 입력하세요.", "bad"); await store.setFeeRate(v / 100); toast("저장되었습니다."); };
  const rs = $("#reset"); if (rs) rs.onclick = async () => { if (confirm("데모 데이터를 처음 상태로 되돌릴까요? (관리자 로그인은 유지됩니다)")) { store.resetDemo(); await store.signIn("admin@demo.com", "demo1234"); location.hash = "dashboard"; location.reload(); } };
}

// ---------- 라우터 ----------
const VIEWS = { dashboard: ["대시보드", dashboard], users: ["회원 관리", users], vendors: ["업체 관리", vendorsView], requests: ["견적 요청", requestsView], payments: ["결제 · 정산", paymentsView], settings: ["설정", settings] };
async function route() {
  const [name, qs] = (location.hash.slice(1) || "dashboard").split("?");
  const [title, fn] = VIEWS[name] || VIEWS.dashboard;
  $("#viewTitle").textContent = title; document.title = `${title} | 관리자 콘솔`;
  $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === (VIEWS[name] ? name : "dashboard")));
  $("#side").classList.remove("open"); closeDrawer();
  $("#main").innerHTML = `<p class="muted">불러오는 중...</p>`;
  try { await fn(new URLSearchParams(qs || "")); } catch (e) { $("#main").innerHTML = `<div class="panel empty">오류: ${esc(e.message)}</div>`; }
}
window.addEventListener("hashchange", route);
route();

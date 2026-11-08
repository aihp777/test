import { CONFIG, IS_DEMO, CATEGORIES, REGIONS } from "./config.js";
import { store } from "./store.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const won = (n) => (n == null || n === "" ? "-" : Number(n).toLocaleString("ko-KR") + "원");
export const date = (s) => (s ? new Date(s).toLocaleDateString("ko-KR") : "-");
export const datetime = (s) => (s ? new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
export const qs = (k) => new URLSearchParams(location.search).get(k);
export const options = (list, sel = "", placeholder) =>
  (placeholder ? `<option value="">${placeholder}</option>` : "") + list.map((x) => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("");
export const badge = (label, tone = "") => `<span class="badge ${tone}">${esc(label)}</span>`;
export { CATEGORIES, REGIONS, store };
export { regionLabel } from "./config.js";

export function toast(msg, tone = "") {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.className = "show " + tone; el.textContent = msg;
  clearTimeout(el._t); el._t = setTimeout(() => (el.className = ""), 2600);
}

export async function renderHeader() {
  const me = await store.currentUser();
  const header = document.createElement("header");
  header.className = "p-header";
  header.innerHTML = `
    <div class="p-container p-header-inner">
      <a class="p-logo" href="/platform/"><img src="/images/logo-dark.png" alt=""><span><b>WIDE GUARD</b><small>${esc(CONFIG.SITE_NAME)}</small></span></a>
      <nav class="p-nav" id="pNav">
        <a href="/platform/request">견적 요청</a>
        <a href="/platform/vendors">업체 찾기</a>
        <a href="/platform/vendor-join">업체 등록</a>
        ${me ? `<a href="/platform/dashboard">마이페이지</a>` : ""}
        ${me && me.role === "admin" ? `<a href="/platform/admin">관리자</a>` : ""}
        ${me ? `<span class="p-user">${esc(me.name)}님</span><button class="p-link" id="logoutBtn">로그아웃</button>`
             : `<a class="p-btn p-btn-sm" href="/platform/login">로그인 / 회원가입</a>`}
      </nav>
      <button class="p-menu" id="pMenu" aria-label="메뉴"><span></span><span></span><span></span></button>
    </div>
    ${IS_DEMO ? `<div class="demo-bar">데모 모드: 데이터가 이 브라우저에만 저장됩니다. <button id="resetDemo">데모 데이터 초기화</button></div>` : ""}`;
  document.body.prepend(header);
  $("#pMenu").onclick = () => $("#pNav").classList.toggle("open");
  const lo = $("#logoutBtn"); if (lo) lo.onclick = async () => { await store.signOut(); location.href = "/platform/"; };
  const rd = $("#resetDemo"); if (rd) rd.onclick = () => { if (confirm("데모 데이터를 처음 상태로 되돌릴까요?")) { store.resetDemo(); location.href = "/platform/"; } };

  const footer = document.createElement("footer");
  footer.className = "p-footer";
  footer.innerHTML = `<div class="p-container">주식회사 와이드가드 · 대표 김정환 · 경기도 김포시 풍무2로 25, 2층 2-2호 · T. 031-945-2001<br><a href="/">회사 홈페이지</a> · 통신판매중개자로서 거래 당사자가 아니며, 업체가 등록한 정보 및 거래에 대한 책임은 각 업체에 있습니다.</div>`;
  document.body.appendChild(footer);
  return me;
}

export async function requireLogin(roles) {
  const me = await store.currentUser();
  if (!me) { location.href = "/platform/login?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("redirect"); }
  if (roles && !roles.includes(me.role)) { document.querySelector("main").innerHTML = `<div class="p-container empty">접근 권한이 없습니다.</div>`; throw new Error("forbidden"); }
  return me;
}

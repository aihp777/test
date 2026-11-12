import { CONFIG, IS_DEMO, CATEGORIES, REGIONS, COMPANY, pending } from "./config.js";

// 사이버몰 운영자 표시 (전자상거래법 제10조) + 통신판매중개자 고지 (제20조①)
export function companyFooter() {
  const C = COMPANY;
  return `<div class="p-container">
    <p class="f-links"><a href="/platform/terms">이용약관</a> · <a href="/platform/privacy"><b>개인정보처리방침</b></a> · <a href="/">회사 홈페이지</a></p>
    <p>상호 ${esc(C.name)} · 대표 ${esc(C.ceo)} · 주소 ${esc(C.address)} · 전화 ${esc(C.tel)}${C.email ? " · 이메일 " + esc(C.email) : ""}<br>
    사업자등록번호 ${esc(pending(C.bizNo))} · 통신판매업 신고번호 ${esc(pending(C.mailOrderNo, "신고 진행 중"))} · 경비업 허가 ${esc(pending(C.securityLicenseNo))} · 개인정보보호책임자 ${esc(C.privacyOfficer)} · 호스팅 ${esc(C.hosting)}</p>
    <p class="f-notice">${esc(C.name)}는 「와이드가드 매칭」에서 <b>통신판매중개자</b>로서 거래 당사자가 아니며, 입점 업체가 등록한 정보와 업체가 제공하는 용역에 대한 책임은 각 업체에 있습니다.
    다만 ${esc(C.name)}가 '운영사 직영'으로 표시된 견적을 직접 제공하는 경우에는 용역 제공자로서 책임을 집니다.</p>
  </div>`;
}
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

// ---------- 이미지 ----------
// 업로드 전 브라우저에서 리사이즈/압축 (EXIF 회전 반영)
export async function resizeImage(file, max = 1600, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error(`${file.name}: 이미지를 읽을 수 없습니다.`);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", quality));
}
export const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

// 요청의 현장 사진을 지정한 요소에 썸네일로 렌더링 + 클릭 시 크게 보기
export async function renderPhotos(el, request) {
  if (!el || !request.photos || !request.photos.length) return;
  const urls = await store.getPhotoUrls(request);
  el.innerHTML = `<p class="photo-title">현장 사진 ${urls.length}장</p><div class="photo-grid">${urls.map((u, i) => `<button type="button" class="photo-thumb" data-i="${i}"><img src="${esc(u)}" alt="현장 사진 ${i + 1}" loading="lazy"></button>`).join("")}</div>`;
  el.querySelectorAll(".photo-thumb").forEach((b) => (b.onclick = () => openLightbox(urls, +b.dataset.i)));
}
export function openLightbox(urls, i = 0) {
  let lb = $("#lightbox");
  if (!lb) { lb = document.createElement("div"); lb.id = "lightbox"; document.body.appendChild(lb); }
  const draw = () => {
    lb.innerHTML = `<button class="lb-close" aria-label="닫기">✕</button>
      ${urls.length > 1 ? `<button class="lb-nav lb-prev" aria-label="이전">‹</button><button class="lb-nav lb-next" aria-label="다음">›</button>` : ""}
      <img src="${esc(urls[i])}" alt="현장 사진 ${i + 1}"><span class="lb-count">${i + 1} / ${urls.length}</span>`;
    lb.querySelector(".lb-close").onclick = close;
    const p = lb.querySelector(".lb-prev"), n = lb.querySelector(".lb-next");
    if (p) p.onclick = (e) => { e.stopPropagation(); i = (i - 1 + urls.length) % urls.length; draw(); };
    if (n) n.onclick = (e) => { e.stopPropagation(); i = (i + 1) % urls.length; draw(); };
  };
  const close = () => { lb.classList.remove("show"); document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") lb.querySelector(".lb-prev")?.click(); if (e.key === "ArrowRight") lb.querySelector(".lb-next")?.click(); };
  lb.onclick = (e) => { if (e.target === lb) close(); };
  document.addEventListener("keydown", key);
  draw(); lb.classList.add("show");
}

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
        ${me ? "" : `<a href="/platform/inquiry-status">비회원 문의 조회</a>`}
        <a href="/platform/vendors">업체 찾기</a>
        <a href="/platform/vendor-join">업체 등록</a>
        ${me ? `<a href="/platform/dashboard">마이페이지</a>` : ""}
        ${me && me.role === "admin" ? `<a href="/admin/">관리자 콘솔</a>` : ""}
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
  footer.innerHTML = companyFooter();
  document.body.appendChild(footer);
  return me;
}

export async function requireLogin(roles) {
  const me = await store.currentUser();
  if (!me) { location.href = "/platform/login?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("redirect"); }
  if (roles && !roles.includes(me.role)) { document.querySelector("main").innerHTML = `<div class="p-container empty">접근 권한이 없습니다.</div>`; throw new Error("forbidden"); }
  return me;
}

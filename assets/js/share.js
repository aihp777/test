// 공유하기: 모바일은 기기 공유창(카카오톡 선택 가능), PC는 링크 복사 → 카카오톡에 붙여넣기
// (카카오 SDK 없이 동작. 카카오 전용 버튼이 필요하면 developers.kakao.com 앱 키 발급 후 확장)

const css = `
.share-fab{position:fixed;right:20px;bottom:20px;z-index:150;display:flex;align-items:center;gap:8px;padding:13px 18px;border:0;border-radius:999px;
  background:#FEE500;color:#191919;font:700 15px "Pretendard","Malgun Gothic",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;transition:transform .15s}
.share-fab:hover{transform:translateY(-2px)}
.share-fab svg{width:20px;height:20px}
.share-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#191919;color:#fff;padding:12px 18px;border-radius:10px;
  font:600 14px "Pretendard","Malgun Gothic",sans-serif;z-index:160;opacity:0;transition:opacity .2s;pointer-events:none;text-align:center;max-width:90vw}
.share-toast.show{opacity:1}
@media print{.share-fab{display:none}}`;

function toast(msg) {
  let t = document.querySelector(".share-toast");
  if (!t) { t = document.createElement("div"); t.className = "share-toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3000);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export async function sharePage({ title = document.title, text = "", url = location.origin + location.pathname } = {}) {
  if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
    try { await navigator.share({ title, text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const ok = await copy(`${text ? text + "\n" : ""}${url}`);
  toast(ok ? "링크를 복사했습니다. 카카오톡 대화창에 붙여넣기(Ctrl+V) 하세요." : url);
}

export function mountShareButton(opts = {}) {
  if (document.querySelector(".share-fab")) return;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  const b = document.createElement("button");
  b.className = "share-fab"; b.type = "button"; b.setAttribute("aria-label", "카카오톡 등으로 공유하기");
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.78-.2.73-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.68.1 1.38.15 2.09.15 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>공유하기`;
  b.onclick = () => sharePage(opts);
  document.body.appendChild(b);
}

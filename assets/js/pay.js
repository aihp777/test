// 결제: 토스페이먼츠 결제위젯 v2 (키가 없으면 데모 결제)
import { CONFIG, IS_DEMO } from "./config.js";
import { store } from "./store.js";
import { won, esc } from "./ui.js";

function modal(html) {
  let m = document.getElementById("payModal");
  if (!m) { m = document.createElement("div"); m.id = "payModal"; m.className = "modal"; document.body.appendChild(m); }
  m.innerHTML = `<div class="modal-box">${html}</div>`; m.classList.add("show");
  m.onclick = (e) => { if (e.target === m) m.classList.remove("show"); };
  return m;
}

function loadToss() {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve(window.TossPayments);
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.onload = () => resolve(window.TossPayments); s.onerror = () => reject(new Error("결제 모듈을 불러오지 못했습니다."));
    document.head.appendChild(s);
  });
}

export async function startPayment(quote, me) {
  const settings = await store.getSettings();
  const fee = Math.round(quote.amount * settings.fee_rate);
  const m = modal(`
    <h3>결제하기</h3>
    <p class="muted">${esc(quote.vendor_company)}</p>
    <div class="sum">
      <span>서비스 금액</span><b>${won(quote.amount)}</b>
      <span class="muted">(포함) 플랫폼 중개수수료 ${Math.round(settings.fee_rate * 100)}%</span><b class="muted">${won(fee)}</b>
      <span class="total">결제 금액</span><b class="total">${won(quote.amount)}</b>
    </div>
    <p class="muted" style="font-size:13px">결제대금은 전자지급결제대행사(PG, 토스페이먼츠)가 보관하며, 서비스 완료 확인 후 중개수수료를 제외한 금액이 PG를 통해 업체에 지급됩니다. 용역 계약의 당사자는 고객과 업체입니다.</p>
    ${IS_DEMO || !CONFIG.TOSS_CLIENT_KEY ? `<p class="badge warn mt">테스트 결제 (실제 결제가 일어나지 않습니다)</p>` : ""}
    <div class="flex mt"><button class="p-btn" id="payGo" style="flex:1">${won(quote.amount)} 결제</button><button class="p-btn p-btn-line" id="payCancel">취소</button></div>`);
  m.querySelector("#payCancel").onclick = () => m.classList.remove("show");
  m.querySelector("#payGo").onclick = async (e) => {
    e.target.disabled = true;
    try {
      const p = await store.createPayment(quote.id);
      if (IS_DEMO) {
        await store.completeDemoPayment(p.order_id);
        location.href = `/platform/pay-success?orderId=${p.order_id}&demo=1`;
        return;
      }
      if (!CONFIG.TOSS_CLIENT_KEY) throw new Error("결제 키가 설정되지 않았습니다. 관리자에게 문의하세요.");
      const TossPayments = await loadToss();
      const toss = TossPayments(CONFIG.TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: me.id });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: p.amount },
        orderId: p.order_id,
        orderName: p.order_name || "와이드가드 매칭 서비스",
        successUrl: location.origin + "/platform/pay-success",
        failUrl: location.origin + "/platform/pay-fail",
        customerEmail: me.email,
        customerName: me.name,
      });
    } catch (err) {
      e.target.disabled = false;
      alert(err.message);
    }
  };
}

// 서버 함수 공통 유틸 (파일명이 _ 로 시작하면 Vercel 이 엔드포인트로 노출하지 않음)
// 필요한 Vercel 환경변수
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY          DB (서버 전용)
//   OTP_SECRET                                        인증 토큰 서명용 임의 문자열 (32자 이상)
//   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER  문자 발송 (솔라피, 발신번호 사전 등록 필수)
//   ADMIN_PHONES                                      알림 받을 관리자 휴대폰 "01000000000,01000000000"
const crypto = require("crypto");

const env = (k) => process.env[k] || "";
const need = (...keys) => { const m = keys.filter((k) => !env(k)); if (m.length) throw httpError(500, "서버 설정 누락: " + m.join(", ")); };
const httpError = (status, message) => Object.assign(new Error(message), { status });
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
const normPhone = (p) => String(p || "").replace(/\D/g, "");
const maskPhone = (p) => { p = normPhone(p); return p.length >= 10 ? `${p.slice(0, 3)}-****-${p.slice(-4)}` : p; };

async function sb(path, init = {}) {
  need("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(env("SUPABASE_URL") + path, {
    ...init,
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"),
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw httpError(500, "DB 오류: " + ((json && json.message) || res.status));
  return json;
}
const rest = (path, init) => sb("/rest/v1" + path, init);

// 로그인 사용자 확인 (Authorization: Bearer <supabase access token>)
async function getUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpError(401, "로그인이 필요합니다.");
  const r = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: "Bearer " + token } });
  if (!r.ok) throw httpError(401, "인증이 만료되었습니다. 다시 로그인하세요.");
  const user = await r.json();
  const prof = (await rest(`/profiles?id=eq.${user.id}&select=*`))[0] || {};
  return { ...user, profile: prof };
}
async function requireAdmin(req) {
  const u = await getUser(req);
  if (u.profile.role !== "admin") throw httpError(403, "관리자만 사용할 수 있습니다.");
  return u;
}

// 휴대폰 인증 토큰 (HMAC 서명)
function signToken(payload) {
  need("OTP_SECRET");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", env("OTP_SECRET")).update(data).digest("base64url");
  return `${data}.${sig}`;
}
function verifyToken(token) {
  need("OTP_SECRET");
  const [data, sig] = String(token || "").split(".");
  const expect = data && crypto.createHmac("sha256", env("OTP_SECRET")).update(data).digest("base64url");
  if (!data || !sig || sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) throw httpError(401, "휴대폰 인증이 유효하지 않습니다. 다시 인증해 주세요.");
  const p = JSON.parse(Buffer.from(data, "base64url").toString());
  if (Date.now() > p.exp) throw httpError(401, "휴대폰 인증이 만료되었습니다. 다시 인증해 주세요.");
  return p;
}
const hashCode = (phone, code) => crypto.createHmac("sha256", env("OTP_SECRET")).update(`${phone}:${code}`).digest("hex");

// 문자 발송 (솔라피 REST API v4). 키가 없으면 발송하지 않고 false 반환
async function sendSms(toList, text) {
  if (!env("SOLAPI_API_KEY") || !env("SOLAPI_API_SECRET") || !env("SOLAPI_SENDER")) return false;
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", env("SOLAPI_API_SECRET")).update(date + salt).digest("hex");
  const messages = toList.map(normPhone).filter(Boolean).map((to) => ({ to, from: normPhone(env("SOLAPI_SENDER")), text }));
  if (!messages.length) return false;
  const res = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `HMAC-SHA256 apiKey=${env("SOLAPI_API_KEY")}, date=${date}, salt=${salt}, signature=${signature}` },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw httpError(502, "문자 발송 실패: " + (await res.text()).slice(0, 200));
  return true;
}
const adminPhones = () => env("ADMIN_PHONES").split(",").map(normPhone).filter(Boolean);

function handler(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status(e.status || 500).json({ message: e.message || "서버 오류" }); }
  };
}

module.exports = { env, need, httpError, body, normPhone, maskPhone, sb, rest, getUser, requireAdmin, signToken, verifyToken, hashCode, sendSms, adminPhones, handler, crypto };

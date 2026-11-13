# (주)와이드가드 홈페이지 + 매칭 플랫폼

빌드 과정이 없는 정적 웹사이트(HTML/CSS/JS)와 Vercel 서버 함수 1개로 구성됩니다.

- `/` : 회사 홈페이지
- `/platform/` : 경비·경호 견적 중개 플랫폼 (고객 견적요청 ↔ 업체 견적·상담 ↔ 결제)

## 매칭 플랫폼 기능

| 화면 | 주소 | 기능 |
|---|---|---|
| 플랫폼 메인 | `/platform/` | 빠른 견적 요청, 서비스 분야, 추천 업체 |
| 로그인/회원가입 | `/platform/login` | 고객 / 업체 회원가입, 로그인 |
| 견적 요청 | `/platform/request` | 분야·지역·일정·예산·내용, 현장 사진(최대 5장), **집단민원현장 여부**(경비업법 안내) |
| 업체 찾기 | `/platform/vendors` | 분야·지역·키워드 검색, 업체 상세, 지정 견적 요청 |
| 업체 등록 | `/platform/vendor-join` | 사업자·허가 정보(경비업 허가 업무·허가번호, 건물위생관리업 신고), 허가증 사본 제출 → **허가받은 업무에 해당하는 분야만 선택 가능** → 관리자 심사·승인 |
| 마이페이지(고객) | `/platform/dashboard` | 받은 견적 비교, 업체별 1:1 상담, 업체 선정, 결제, 완료 확인 |
| 업체 센터 | `/platform/dashboard` | 자동 매칭된 요청 확인, 견적 제출/수정, 고객 상담, 정산 예정액 |
| **관리자 콘솔** | `/admin` | 대시보드(KPI·월별 거래액·분야/지역별 요청·처리할 일), 회원 관리(유형 변경), 업체 관리(심사·승인·정지·메모), 견적 요청(사진·견적·상담 내역 열람, 상태 변경), 결제·정산(정산 완료 처리, 전액 환불), 수수료 설정, CSV 내보내기 |

**매칭 규칙 (전국 운영):** 고객 요청의 `분야`가 업체 분야에 포함되고 `지역`이 업체 서비스 지역에 포함되면 승인 업체에 자동 노출됩니다. 서비스 지역을 **전국**으로 등록한 업체는 모든 지역 요청을 받고, 고객이 지역을 **전국(지역 무관)**으로 요청하면 해당 분야의 모든 업체에 전달됩니다. 업체 등록 시 수도권·충청권·호남권·영남권·강원권·제주권 버튼으로 권역 단위 선택이 가능합니다. 업체를 지정한 요청은 그 업체에만 보입니다.

**거래 흐름:** 견적 요청 → 업체 견적 제출 → 고객 비교·상담 → 업체 선정 → 결제(플랫폼 보관) → 서비스 진행 → 고객 완료 확인 → 수수료 차감 후 업체 정산

### 데모 모드 (지금 상태)
`assets/js/config.js`의 키가 비어 있으면 데이터가 **브라우저(localStorage)에만** 저장되는 데모로 동작합니다. 로그인 화면의 데모 계정 버튼으로 바로 체험할 수 있습니다 (비밀번호 `demo1234`).
- customer@demo.com (고객) / vendor@demo.com (와이드가드) / vendor2@demo.com (업체2) / admin@demo.com (관리자)

### 운영 모드로 전환하기
1. **Supabase** (DB·회원 관리, 무료 플랜 가능)
   1. https://supabase.com 에서 프로젝트 생성
   2. SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 Run (현장 사진용 비공개 Storage 버킷 `request-photos`도 함께 생성됨)
   3. Project Settings → API의 `Project URL`, `anon public` 키를 `assets/js/config.js`에 입력
   4. 관리자 계정: 사이트에서 가입한 뒤 `schema.sql` 맨 아래 주석의 SQL로 role을 admin으로 변경
2. **토스페이먼츠** (결제)
   1. https://developers.tosspayments.com 가입 → 테스트 키 발급 (실결제는 가맹 심사 후 라이브 키)
   2. 클라이언트 키(`test_ck_...`)를 `assets/js/config.js`의 `TOSS_CLIENT_KEY`에 입력
3. **Vercel 환경변수** (Project → Settings → Environment Variables)
   - `TOSS_SECRET_KEY` : 토스페이먼츠 시크릿 키
   - `SUPABASE_URL` : Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` : Supabase service_role 키 (**절대 config.js에 넣지 마세요**)
   - 위 3개는 결제 승인(`api/payments/confirm.js`)과 관리자 환불(`api/payments/cancel.js`)에 사용됩니다.
4. 커밋 후 push → Vercel 자동 배포

### 운영 전 확인할 것
- 결제를 중개하려면 **통신판매중개업 신고**와 PG(토스페이먼츠) 가맹 계약이 필요합니다. 결제 대금을 보관했다가 정산하는 구조는 PG사와 정산 방식(지급대행 등)을 협의해야 합니다.
- 업체 정산(계좌 이체), 환불·취소, 리뷰 작성은 아직 관리자 수작업 또는 추가 개발이 필요합니다.
- 이용약관, 개인정보처리방침 페이지를 법률 검토 후 추가해야 합니다.

## 폴더 구조

```
widegard-homepage/
├── platform/       # 매칭 플랫폼 페이지들
├── assets/         # 플랫폼 CSS, JS (config.js = 키 설정, store.js = 데이터 계층, pay.js = 결제)
├── admin/          # 관리자 콘솔 (/admin)
├── api/payments/   # Vercel 서버 함수: confirm.js(결제 승인), cancel.js(관리자 환불)
├── supabase/schema.sql       # DB 테이블 + 보안 정책(RLS)
├── index.html      # 메인 페이지
├── 404.html        # 없는 주소로 들어왔을 때 보이는 페이지
├── style.css       # 스타일
├── script.js       # 메뉴, 탭, 스크롤 애니메이션
├── favicon.svg     # 브라우저 탭 아이콘
├── robots.txt
├── vercel.json     # Vercel 설정 (캐시, 보안 헤더, 깔끔한 URL)
├── package.json    # 로컬 미리보기 / 배포 명령
└── images/         # 사이트 이미지 (og-image.jpg = 링크 공유 미리보기)
```

## 로컬에서 미리보기

```bash
npm run dev        # http://localhost:3000
```
(Node.js가 필요합니다. 없으면 `index.html`을 더블클릭해도 됩니다.)

## Vercel 배포 방법

### 방법 1. GitHub 연동 (권장: 이후 push하면 자동으로 배포)
1. GitHub에 새 저장소를 만들고 이 폴더를 push합니다.
   ```bash
   git remote add origin https://github.com/<계정>/widegard-homepage.git
   git push -u origin main
   ```
2. https://vercel.com/new 에서 해당 저장소를 **Import** 합니다.
3. 설정은 기본값 그대로 두고 **Deploy**를 누릅니다.
   - Framework Preset: `Other`
   - Build Command: 비워둠
   - Output Directory: 비워둠 (루트)

### 방법 2. Vercel CLI
```bash
npm i -g vercel
vercel          # 처음 한 번 로그인 및 프로젝트 연결 (미리보기 배포)
vercel --prod   # 운영 배포
```

### 방법 3. Git 없이 GitHub 웹에서 업로드
1. GitHub에서 새 저장소를 만들고 **"uploading an existing file"** 링크를 클릭합니다.
2. 이 폴더 **안의 파일과 폴더 전부**(images 폴더 포함)를 끌어다 놓고 Commit 합니다.
   (`index.html`이 저장소 최상위에 있어야 합니다.)
3. 방법 1의 2~3단계처럼 Vercel에서 Import → Deploy 합니다.

## 도메인 연결
Vercel 프로젝트 → **Settings → Domains**에서 회사 도메인을 추가하고, 안내에 나오는 DNS 레코드를 도메인 업체에 등록하면 됩니다.

## 수정 안내
- 회사 정보(주소, 전화번호 등): `index.html`의 `회사 개요`, `Contact`, `footer` 부분
- 실적 목록: `index.html`의 `#records` 섹션
- 색상: `style.css` 맨 위 `:root`의 변수들 (`--navy`, `--teal` 등)
- 로고: `index.html` 헤더의 `<svg class="logo-mark">`와 `favicon.svg`를 정식 로고로 바꾸면 됩니다.

## 법령 대응 기능 (2026-11 보완)
- **허가 기반 분야 제한**: `assets/js/config.js`의 `CATEGORY_REQUIRES`(분야 ↔ 필요 허가)로 화면·저장 로직·DB 트리거(`category_allowed`)에서 검증 — 경비업법 제7조의2(무허가 도급 금지) 대응
- **특수경비**: 차후 별도 설계 예정. 보안 매칭 코드는 보관 중이며 `config.js`의 `ENABLE_SPECIAL = false`로 비활성
- **집단민원현장**: 요청 시 선택, 업체에 48시간 전 배치허가·경비지도사 배치 안내
- **사업자정보 표시·중개자 고지**: `COMPANY` 설정값 → 모든 페이지 하단 (미확정 값은 "확인 후 입력" 표시)
- **약관·개인정보처리방침**: `/platform/terms`, `/platform/privacy` (초안, 법률 검토 후 확정)
- **동의 분리 및 기록**, **업체 신원정보 제공**(견적 선정 전), **운영사 직영 표시**(관리자 설정)
- 오픈 전 `assets/js/config.js`의 `COMPANY`(사업자등록번호, 통신판매업 신고번호, 경비업 허가번호, 이메일)를 실제 값으로 입력하세요.

## 공동 관리 · 비회원 문의 · 나라장터 (2026-11)

### 1. 공동 관리자 (김정환 대표이사 · 김종연 사내이사)
- 관리자 콘솔 **공동 업무함**(`/admin#tasks`): 비회원 견적문의, 회원 견적요청, 업체 승인 심사, 결제·정산·환불, 나라장터 신규 공고가 자동 등록되고, **누가 확인했는지(✔)·누가 처리 중인지·처리 이력**을 두 분이 함께 봅니다.
- **문자 동시 알림**: 업무가 등록되면 두 분 휴대폰으로 동시에 문자가 갑니다.
- ⚠️ 휴대폰 번호는 공개 저장소에 올리지 않습니다 → Vercel 환경변수에만 입력
- 데모 계정: admin@demo.com(김정환 대표), admin2@demo.com(김종연 이사) / demo1234
- 운영: 두 분이 사이트에서 회원가입 → Supabase SQL로 role='admin', title 지정
  ```sql
  update public.profiles set role='admin', title='대표이사' where email='대표님 이메일';
  update public.profiles set role='admin', title='사내이사' where email='이사님 이메일';
  ```

### 2. 비회원 견적문의 (휴대폰 문자 인증)
- `/platform/request`에서 로그인하지 않으면 **성함 + 휴대폰 번호 → 인증번호(6자리, 5분) 확인** 후 문의 가능
- 제한: 번호당 인증번호 1시간 5회, 입력 5회, 문의 하루 5건
- 비회원 연락처는 별도 테이블(`guest_contacts`)에 저장 → **관리자만 열람**, 업체에는 성함(비회원)만 표시
- `/platform/inquiry-status`: 같은 번호로 다시 인증하면 진행 상황·받은 견적 확인, 회원가입 후 계정으로 옮기기

### 3. 나라장터 입찰 (`/admin#bids`)
- 매일 07:00(KST) **용역 입찰공고 자동 수집**(키워드: 경비·경호·보안요원·안전요원·교통정리·주차관리·질서유지) → 새 공고는 업무함 등록 + 2인 문자 알림
- 지역제한 자동 판별, 마감 D-day, 상태 관리(신규→검토→참여 결정→투찰 완료→낙찰/미낙찰), 담당 지정, **투찰가 산정 보조**(기초금액 × 사정률 × 낙찰하한율), CSV
- **투찰(입찰서 제출)은 자동화하지 않습니다** — 나라장터에서 공동인증서로 담당자가 직접 제출
- 공공데이터포털 "조달청_나라장터 입찰공고정보서비스"(데이터 ID 15129394) **활용신청** 후 인증키 입력. API 1회 조회기간은 최대 7일(2026-11-10 변경)
- 오퍼레이션 영문명은 활용신청 후 명세서로 확인 → 다르면 `NARA_OP` 환경변수만 변경

### Vercel 환경변수 (전체)
| 변수 | 용도 |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | DB (서버 전용) |
| `TOSS_SECRET_KEY` | 결제 승인·환불 |
| `OTP_SECRET` | 휴대폰 인증 토큰 서명 (임의의 긴 문자열) |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` | 문자 발송 (솔라피 가입, **발신번호 사전 등록** 필수 — 예: 회사 대표번호) |
| `ADMIN_PHONES` | 알림 받을 관리자 휴대폰, 쉼표로 구분 (예: `010xxxxxxxx,010xxxxxxxx`) |
| `NOTIFY_SECRET` | Supabase 웹훅 → `/api/notify` 인증 (임의 문자열) |
| `NARA_SERVICE_KEY` | 공공데이터포털 인증키(Decoding) |
| `NARA_BASE`, `NARA_OP` | (선택) 나라장터 API 주소·오퍼레이션명 변경 시 |
| `CRON_SECRET` | Vercel Cron 인증 (임의 문자열) |

### Supabase 웹훅 (문자 알림 연결)
Database → Webhooks → Create: Table `admin_tasks`, Events `INSERT`, Method `POST`, URL `https://<도메인>/api/notify`, Header `x-webhook-secret: <NOTIFY_SECRET 값>`

### 나라장터 2단계: 개찰 결과 자동 반영 · 입찰 통계
- **개찰 결과 자동 반영** (`api/bids-results.js`, 매일 18:00 KST + 콘솔 '개찰 결과 확인' 버튼): 투찰 완료 + 개찰일 경과 공고를 낙찰정보서비스(데이터 ID 15129397, 활용신청 필요)로 조회 → 우리 순위·투찰률, 1순위 업체·금액·투찰률, 참가업체 수 저장 → 1순위면 '낙찰', 아니면 '미낙찰' → 공동 업무함 + 2인 문자 알림
- API 연결 전에는 공고 상세에서 **결과 직접 입력** 가능
- **입찰 통계 · 결과 분석** 탭(`/admin#bids?tab=stats`): 투찰 참여·낙찰 건수, 낙찰률, 누적 낙찰금액, 월별 낙찰금액, 키워드별 성과, 우리 vs 1순위 투찰률 차이
- 적격심사 공고는 1순위가 탈락할 수 있으므로 '1순위 개찰 기준' 결과 — 최종 낙찰자는 나라장터에서 확인
- 추가 환경변수: `COMPANY_BIZ_NO`(우리 사업자등록번호, 결과에서 우리 순위 찾기), (선택) `NARA_RESULT_BASE`, `NARA_RESULT_OP`(기본 `getOpengResultListInfoOpengCompt` — 활용신청 후 명세서로 확인)

### 사업자등록번호 · 국세청 상태조회 (2026-11-13)
- (주)와이드가드 사업자등록번호 **715-86-02889** 반영 (`config.js` COMPANY.bizNo → 모든 페이지 하단, 나라장터 개찰결과에서 우리 순위 찾기 기본값)
- 업체 등록 시 **사업자등록번호 검증번호(체크섬) 자동 확인** — 잘못된 번호는 등록 불가
- 관리자 업체 심사에 **국세청 상태조회** 버튼(계속·휴업·폐업) → 결과는 관리자 메모에 자동 기록 (`api/biz-status.js`)
- 추가 환경변수: `NTS_SERVICE_KEY` — 공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" 활용신청 인증키(Decoding)

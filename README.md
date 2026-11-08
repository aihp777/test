# (주)와이드가드 홈페이지 + 매칭 플랫폼

빌드 과정이 없는 정적 웹사이트(HTML/CSS/JS)와 Vercel 서버 함수 1개로 구성됩니다.

- `/` : 회사 홈페이지
- `/platform/` : 경비·경호 견적 중개 플랫폼 (고객 견적요청 ↔ 업체 견적·상담 ↔ 결제)

## 매칭 플랫폼 기능

| 화면 | 주소 | 기능 |
|---|---|---|
| 플랫폼 메인 | `/platform/` | 빠른 견적 요청, 서비스 분야, 추천 업체 |
| 로그인/회원가입 | `/platform/login` | 고객 / 업체 회원가입, 로그인 |
| 견적 요청 | `/platform/request` | 분야·지역·일정·예산·내용 입력 (특정 업체 지정 요청 가능) |
| 업체 찾기 | `/platform/vendors` | 분야·지역·키워드 검색, 업체 상세, 지정 견적 요청 |
| 업체 등록 | `/platform/vendor-join` | 동종업체 등록 신청 (사업자번호, 허가, 분야, 지역) → 관리자 승인 |
| 마이페이지(고객) | `/platform/dashboard` | 받은 견적 비교, 업체별 1:1 상담, 업체 선정, 결제, 완료 확인 |
| 업체 센터 | `/platform/dashboard` | 자동 매칭된 요청 확인, 견적 제출/수정, 고객 상담, 정산 예정액 |
| 관리자 | `/platform/admin` | 업체 승인/반려/정지, 전체 요청, 거래액·수수료 통계, 수수료율 설정 |

**매칭 규칙:** 고객 요청의 `분야`와 `지역`이 업체가 등록한 분야·지역에 모두 포함되면, 승인된 업체에 자동으로 노출됩니다. 업체를 지정한 요청은 그 업체에만 보입니다.

**거래 흐름:** 견적 요청 → 업체 견적 제출 → 고객 비교·상담 → 업체 선정 → 결제(플랫폼 보관) → 서비스 진행 → 고객 완료 확인 → 수수료 차감 후 업체 정산

### 데모 모드 (지금 상태)
`assets/js/config.js`의 키가 비어 있으면 데이터가 **브라우저(localStorage)에만** 저장되는 데모로 동작합니다. 로그인 화면의 데모 계정 버튼으로 바로 체험할 수 있습니다 (비밀번호 `demo1234`).
- customer@demo.com (고객) / vendor@demo.com (와이드가드) / vendor2@demo.com (업체2) / admin@demo.com (관리자)

### 운영 모드로 전환하기
1. **Supabase** (DB·회원 관리, 무료 플랜 가능)
   1. https://supabase.com 에서 프로젝트 생성
   2. SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 Run
   3. Project Settings → API의 `Project URL`, `anon public` 키를 `assets/js/config.js`에 입력
   4. 관리자 계정: 사이트에서 가입한 뒤 `schema.sql` 맨 아래 주석의 SQL로 role을 admin으로 변경
2. **토스페이먼츠** (결제)
   1. https://developers.tosspayments.com 가입 → 테스트 키 발급 (실결제는 가맹 심사 후 라이브 키)
   2. 클라이언트 키(`test_ck_...`)를 `assets/js/config.js`의 `TOSS_CLIENT_KEY`에 입력
3. **Vercel 환경변수** (Project → Settings → Environment Variables)
   - `TOSS_SECRET_KEY` : 토스페이먼츠 시크릿 키
   - `SUPABASE_URL` : Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` : Supabase service_role 키 (**절대 config.js에 넣지 마세요**)
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
├── api/payments/confirm.js   # Vercel 서버 함수: 토스페이먼츠 결제 승인
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

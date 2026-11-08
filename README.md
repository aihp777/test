# (주)와이드가드 홈페이지

빌드 과정이 없는 정적 웹사이트(HTML/CSS/JS)입니다. Vercel에 그대로 배포됩니다.

## 폴더 구조

```
widegard-homepage/
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

# 김우혁의 블로그

Markdown 기반 개인 포트폴리오 블로그. 글 본문은 파일시스템에 `.md`로 저장하고, 메타데이터(제목/카테고리/태그/검색 텍스트)와 계정·로그인 이력은 MariaDB에 저장하는 하이브리드 구조다.

- 방문자는 로그인 없이 모든 글을 열람·검색할 수 있고, 상단 메뉴에서 "전체 글 보기" / "About me" / 카테고리별 보기(드롭다운)로 이동할 수 있다.
- 관리자는 로그인 후 Toast UI Editor로 글을 작성·수정·삭제하고 이미지를 삽입할 수 있으며, About me 소개글도 같은 방식으로 수정할 수 있다.
- 운영: `https://blog.doomfan.win` (systemd 상시 구동 + Cloudflare Tunnel 경유 외부 공개)

## 기술 스택

- Node.js + Express, MariaDB (`mysql2/promise`)
- 세션: `express-session` + `express-mysql-session` (세션도 DB에 저장)
- 인증: `bcrypt`, CSRF: `csurf`, 레이트리밋: `express-rate-limit`
- 업로드: `multer` + `file-type`(바이너리 시그니처 검증) + `sharp`(리사이즈/EXIF 제거)
- 프론트엔드: 순수 HTML + jQuery + Vanilla JS, `marked.js` + `DOMPurify`(렌더링/새니타이즈), Toast UI Editor

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수

`.env.example`을 복사해 `.env`를 만들고 값을 채운다.

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=<랜덤한 긴 문자열>
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=blog_app
DB_PASSWORD=<blog_app 계정 비밀번호>
DB_NAME=portfolio_blog
UPLOAD_MAX_SIZE_MB=5
```

### 3. DB 스키마 적용

`root` 권한으로 스키마를 적용하고, 애플리케이션 전용 최소 권한 계정을 만든다 (`server/db/schema.sql` 하단에 `blog_app` 계정 생성 SQL 포함).

```bash
mysql -u root -p < server/db/schema.sql
```

### 4. 관리자 계정 생성

웹 API로는 계정을 생성할 수 없다 (인증 우회 시 계정이 무한 생성되는 것을 막기 위한 의도적 설계). 서버에 직접 접근해 CLI로만 생성한다.

```bash
npm run create-admin -- --username=kam
```

### 5. 실행

```bash
npm run dev     # 개발 (nodemon)
npm start       # 프로덕션
```

## 배포

- 이 서버는 `deploy/portfolio-blog.service` systemd 유닛으로 상시 구동된다 (`/etc/systemd/system/portfolio-blog.service`로 설치, `kam` 사용자로 실행).
- 앱은 **`127.0.0.1`에만 바인딩**된다 (`server/app.js`의 `app.listen(port, '127.0.0.1', ...)`). Cloudflare Tunnel만이 유일한 접근 경로여야 하므로, 호스트 인자를 빼서 모든 인터페이스에 열리게 하면 안 된다.
- 외부 접속은 Cloudflare Tunnel(`cloudflared`)을 통해 `blog.doomfan.win` → `localhost:3000`으로 연결된다. Tunnel의 Public Hostname 라우팅은 Cloudflare Zero Trust 대시보드에서 관리되며, 로컬 `config.yml`에는 반영되지 않는다.
- 앱은 `trust proxy 1`을 가정하므로(Cloudflare Tunnel이 유일한 프록시 hop), 세션 쿠키의 `secure` 플래그가 정상 동작하려면 `X-Forwarded-Proto: https` 헤더가 필요하다. 로컬에서 `curl`로 직접 테스트할 때는 이 헤더를 수동으로 추가해야 한다.
- MariaDB는 `bind-address 127.0.0.1` + 모든 계정이 `@localhost`로만 등록되어 있어 외부에서 DB에 직접 접근할 수 없다.

## 디렉토리 구조

```
server/    Express 앱 (routes → services → db/pool.js 또는 파일시스템)
posts/     글 원문 (.md, 카테고리별 하위 디렉토리)
content/   About me 소개글 (about.md, DB 메타데이터 없이 파일 하나로 관리)
uploads/   업로드 이미지 원본 (연/월별 하위 디렉토리)
public/    정적 프론트엔드 (공개 페이지 + /admin 관리자 페이지)
deploy/    systemd 유닛 파일
```

자세한 아키텍처/설계 원칙은 `CLAUDE.md`와 `portfolio-blog-spec.md`를 참고.

## Git 커밋 컨벤션

커밋 제목은 `<이모지> <type>: <설명>` 형식을 쓴다 (예: `✨ feat: About me 페이지 추가`, `🔒 fix: 127.0.0.1 바인딩`).

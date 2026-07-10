const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const csurf = require('csurf');

const env = require('./config/env');

const postsRouter = require('./routes/posts');
const categoriesRouter = require('./routes/categories');
const searchRouter = require('./routes/search');
const aboutRouter = require('./routes/about');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const adminUploadsRouter = require('./routes/adminUploads');
const adminLogsRouter = require('./routes/adminLogs');
const adminAccountsRouter = require('./routes/adminAccounts');
const adminGitRouter = require('./routes/adminGit');
const errorHandler = require('./middlewares/errorHandler');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_IMAGES_ROOT = path.resolve(PROJECT_ROOT, 'uploads', 'images');
const UPLOAD_FILENAME_PATTERN = /^([a-z0-9-]+)\.(jpg|jpeg|png|webp|gif)$/;

const app = express();

// Cloudflare Tunnel(cloudflared)이 유일한 리버스 프록시 hop이므로 1로 설정한다.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'sha256-...'는 각 페이지 <head>의 다크모드 FOUC 방지 인라인 스크립트(테마를 body 렌더링 전에
        // 적용하는 코드, public/*.html 참고) 전용 해시다. 그 스크립트 내용을 바꾸면 해시도 다시 계산해야 한다.
        // jQuery/marked/DOMPurify/highlight.js/mermaid는 CDN이 아니라 /vendor 경로(node_modules를
        // 그대로 서빙)로 자체 호스팅한다 - 아래 "정적 파일(vendor)" 섹션 참고. Toast UI Editor만은
        // CDN에 남겨뒀다: npm 배포판(dist/toastui-editor.js)은 prosemirror-* 의존성을 번들에
        // 담지 않고 외부 모듈로 남겨둬서 번들러 없이 plain <script>로는 동작하지 않고,
        // 브라우저에서 바로 쓸 수 있게 전부 번들링된 "-all" 빌드는 CDN에만 존재하고 npm 패키지에는 없다.
        // static.cloudflareinsights.com은 Cloudflare가 자체적으로 응답에 주입하는
        // Web Analytics beacon 스크립트로, Cloudflare 공식 문서가 권장하는 CSP 예외다.
        scriptSrc: [
          "'self'",
          'https://uicdn.toast.com',
          'https://static.cloudflareinsights.com',
          "'sha256-Uw/JSbeuICvK0EzyGYba6LuIn82IYoIVXtLwcuOdBdI='",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://uicdn.toast.com'],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'https://cloudflareinsights.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);

app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const sessionStore = new MySQLStore({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  createDatabaseTable: false,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data',
    },
  },
});

app.use(
  session({
    key: 'blog_sid',
    secret: env.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000,
    },
  })
);

const csrfProtection = csurf();
app.use('/api', csrfProtection);
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/posts', postsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/search', searchRouter);
app.use('/api/about', aboutRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/uploads', adminUploadsRouter);
app.use('/api/admin/logs', adminLogsRouter);
app.use('/api/admin/accounts', adminAccountsRouter);
app.use('/api/admin/git', adminGitRouter);

app.get('/uploads/images/:year/:month/:filename', (req, res) => {
  const { year, month, filename } = req.params;
  const match = UPLOAD_FILENAME_PATTERN.exec(filename);
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !match) {
    return res.status(404).end();
  }

  const resolved = path.resolve(UPLOADS_IMAGES_ROOT, year, month, filename);
  const relative = path.relative(UPLOADS_IMAGES_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return res.status(404).end();
  }

  res.sendFile(resolved, (err) => {
    if (err) res.status(404).end();
  });
});

// 깔끔한 URL을 위해 .html로 직접 접근하면 확장자 없는 경로로 리다이렉트한다
// (/about.html -> /about, /index.html -> /).
app.get(/\.html$/, (req, res) => {
  const withoutExt = req.path.slice(0, -'.html'.length) || '/';
  const target = withoutExt === '/index' ? '/' : withoutExt;
  const query = req.url.slice(req.path.length);
  res.redirect(301, target + query);
});

// 프론트엔드가 쓰는 서드파티 라이브러리(jQuery/marked/DOMPurify/highlight.js/Toast UI Editor)는
// CDN 대신 node_modules에 설치된 패키지를 그대로 정적 서빙한다. 번들러 없이 각 패키지가 이미
// 배포하는 브라우저용 빌드 산출물(dist)을 그대로 쓰는 것 - 버전은 package.json에 고정되어 있고,
// 배포 시 npm install만 하면 이 파일들도 함께 갱신된다.
const VENDOR_CACHE_HEADERS = (res) => res.setHeader('Cache-Control', 'public, max-age=2592000');
app.use('/vendor/jquery', express.static(path.join(PROJECT_ROOT, 'node_modules/jquery/dist'), { setHeaders: VENDOR_CACHE_HEADERS }));
app.use('/vendor/marked', express.static(path.join(PROJECT_ROOT, 'node_modules/marked/lib'), { setHeaders: VENDOR_CACHE_HEADERS }));
app.use('/vendor/dompurify', express.static(path.join(PROJECT_ROOT, 'node_modules/dompurify/dist'), { setHeaders: VENDOR_CACHE_HEADERS }));
app.use('/vendor/highlightjs', express.static(path.join(PROJECT_ROOT, 'node_modules/@highlightjs/cdn-assets'), { setHeaders: VENDOR_CACHE_HEADERS }));
app.use('/vendor/mermaid', express.static(path.join(PROJECT_ROOT, 'node_modules/mermaid/dist'), { setHeaders: VENDOR_CACHE_HEADERS }));

app.use(
  express.static(path.resolve(PROJECT_ROOT, 'public'), {
    extensions: ['html'],
    // CSS/JS는 페이지를 옮겨 다닐 때마다 다시 받지 않도록 좀 더 오래 캐시한다.
    // HTML은 지금도 계속 손보는 중이라 캐시를 걸지 않고 항상 최신 상태로 받게 둔다.
    setHeaders: (res, filePath) => {
      if (/\.(css|js)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  })
);

app.use('/api', (req, res) => {
  res.status(404).json({ error: true, message: '요청한 API를 찾을 수 없습니다.' });
});

app.use(errorHandler);

// Cloudflare Tunnel(cloudflared)이 localhost로만 접속하므로, 다른 인터페이스로는
// 열지 않는다 (LAN/외부에서 3000번 포트로 직접 접근하는 것을 차단).
app.listen(env.port, '127.0.0.1', () => {
  console.log(`portfolio-blog server listening on 127.0.0.1:${env.port} (${env.nodeEnv})`);
});

module.exports = app;

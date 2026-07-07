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
        scriptSrc: [
          "'self'",
          'https://code.jquery.com',
          'https://cdn.jsdelivr.net',
          'https://uicdn.toast.com',
          "'sha256-Uw/JSbeuICvK0EzyGYba6LuIn82IYoIVXtLwcuOdBdI='",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://uicdn.toast.com'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
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

app.use(express.static(path.resolve(PROJECT_ROOT, 'public'), { extensions: ['html'] }));

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

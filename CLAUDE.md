# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                              # install dependencies
npm run dev                              # start with nodemon (auto-restart)
npm start                                # start in production mode (node server/app.js)
npm run create-admin -- --username=xxx   # create an admin account (interactive password prompt)
```

There is no test suite, lint config, or build step — this is a plain Node/Express app served directly, no bundler/transpiler.

`server/db/schema.sql` must be applied manually against MariaDB before first run (`mysql < server/db/schema.sql`, as a user with `CREATE`), and a restricted `blog_app` DB user created per the `GRANT` block at the bottom of that same file. The app's own DB user only has `SELECT/INSERT/UPDATE/DELETE` — it cannot create tables, which is why the `sessions` table (used by `express-mysql-session`) is also defined in `schema.sql` with `createDatabaseTable: false` set in `server/app.js`.

## Architecture

**Storage is deliberately split across two systems**, and this split drives most of the code structure:
- Post *content* (raw Markdown + frontmatter) lives in `posts/{category_slug}/{post_slug}.md` on disk.
- Post *metadata* (title, category, tags, search text, timestamps) lives in MariaDB.
- Uploaded images live under `uploads/images/{yyyy}/{mm}/{uuid}.{ext}`; only their path/metadata is in DB.

`server/services/postService.js` is the only place that writes posts, and it has to keep the filesystem and DB in sync. The create/update flow is: write the `.md` file to a temp path → open a DB transaction → `rename()` the temp file over the real path *before* `commit()` → commit. This ordering (rename before commit, not after) is intentional: if the rename fails, the transaction can still be rolled back; if the commit fails after a successful rename, the code deletes/restores the file as a compensating action. When updating a post in place (same category+slug), a `.bak-*` copy of the original file is made first so a failed commit can restore it. Read this function before changing post create/update logic — it's easy to reintroduce a "file exists but DB doesn't" (or vice versa) bug by reordering steps.

**Request flow**: `routes/*.js` → `services/*.js` → either `db/pool.js` (mysql2 promise pool, prepared statements only) or the filesystem directly. Routes do not talk to the DB or filesystem themselves. `server/middlewares/auth.js` re-checks `is_active` in the DB on *every* admin request (not just at login) so that deactivating an account invalidates existing sessions immediately.

**Sessions & CSRF**: sessions are stored in MariaDB via `express-mysql-session`. `csurf` is mounted globally on `/api` in `server/app.js`; the frontend must first `GET /api/csrf-token` and send the value back as an `X-CSRF-Token` header on any mutating request (see `public/js/common.js`'s `fetchJSON` wrapper, which does this automatically). The session cookie has `secure: true` in production, which means it is **silently dropped** unless the request looks HTTPS to Express — see the trust-proxy note below.

**Reverse proxy / HTTPS**: this app runs as a plain HTTP server behind a Cloudflare Tunnel (`cloudflared`, running as a systemd service on the host, ingress configured in the Cloudflare Zero Trust dashboard — not in any local `config.yml`). `app.set('trust proxy', 1)` in `server/app.js` assumes exactly one hop (cloudflared) sets `X-Forwarded-Proto`. When testing locally with `curl` directly against `localhost:3000`, you must add `-H "X-Forwarded-Proto: https"` or the session cookie will not be set and every authenticated request will look logged-out.

**Upload validation**: `server/services/uploadService.js` uses `file-type` (v17+, ESM-only) via a dynamic `import()` from this otherwise-CommonJS codebase — don't `require()` it. Uploaded bytes are validated by binary signature (not by client-provided MIME type or extension), then re-encoded through `sharp` to strip EXIF, except animated GIFs which are passed through unmodified to preserve frames.

**Slugs / path safety**: `server/utils/sanitizeSlug.js` provides `assertValidSlug` (enforces `^[a-z0-9-]+$`) and `safeResolve` (resolves a path and verifies it stays inside the intended root dir). Any code building a filesystem path from a category/post slug or upload filename must go through these — this is the app's main defense against path traversal.

**About page**: unlike posts, the "About me" content (`server/services/aboutService.js`, `GET /api/about`, `PUT /api/admin/about`) has no DB row at all — it's a single Markdown file at `content/about.md`, written via a plain temp-file-then-`rename` (no DB transaction needed since there's no metadata to keep in sync). Don't force this into the `posts` table/category system; it's intentionally simpler because it has no title/slug/tags/search-indexing needs.

**Frontend nav/auth model**: there is exactly one nav renderer, `Blog.renderNav()` in `public/js/common.js`, used by *every* page (public and admin). It fetches `/api/categories` + `/api/auth/status` together and renders the same public-looking nav everywhere; if authenticated it swaps the "관리자 로그인" button for logout + 로그인이력/계정관리 links and returns the status object. There is no separate always-on editor UI: `/admin/editor.html` and `/admin/about.html` render a blank/prefilled Toast UI Editor only when navigated to directly (via `?category=&slug=` query params for a specific post, or with no params for a new one), reached only through "새 글 작성"/"수정" buttons that the public pages (`index.html`, `category.html`, `post.html`, `about.html`) show *only when `renderNav()`'s returned status is authenticated*. Admin-only pages with no public equivalent (`admin/logs.html`, `admin/accounts.html`, and the two editor pages) call `Blog.redirectIfNotAuthenticated(status)` right after `renderNav()` to bounce anonymous visitors to `/admin/login.html`. Don't reintroduce a separate "admin mode" landing page that shows the editor by default — that was deliberately removed in favor of this browse-then-edit-on-click model.

**Deployment**: runs as the `portfolio-blog` systemd service (unit file checked into `deploy/portfolio-blog.service`, installed to `/etc/systemd/system/`), as the `kam` user. **Binds to `127.0.0.1` only** (`app.listen(port, '127.0.0.1', ...)` in `server/app.js`) — this was originally omitted and bound to all interfaces, which let LAN/external traffic reach the app directly bypassing Cloudflare; don't remove the explicit host argument. Public hostname routing is `blog.doomfan.win` → `localhost:3000` via the Cloudflare Tunnel named `nextcloud` (dashboard-managed, see the tunnel's Public Hostname config in the Cloudflare Zero Trust dashboard — not in any file on disk).

## Git commits

Commit subjects in this repo use `<emoji> <type>: <summary>` (conventional-commit type, e.g. `feat`, `fix`, `security`, `docs`) — e.g. `🔒 fix: bind server to 127.0.0.1 only`.

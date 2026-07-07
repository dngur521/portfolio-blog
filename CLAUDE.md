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

**Deployment**: runs as the `portfolio-blog` systemd service (unit file checked into `deploy/portfolio-blog.service`, installed to `/etc/systemd/system/`), listening on `PORT` from `.env` (default 3000) as the `kam` user. Public hostname routing is `blog.doomfan.win` → `localhost:3000` via the Cloudflare Tunnel named `nextcloud`.

# CompHeart

CompHeart is a multi-organization **internal company operating system**: knowledge, tasks, planning, automations, AI assistance, chat, notifications, people management, and executive views in one role-aware web app (React + FastAPI + SQLite).

## Documentation

| Document | Purpose |
| --- | --- |
| **[README-DEV.md](README-DEV.md)** | Local development: install, run, env, API reference, native helper, seed users, CORS, password & admin settings, product detail |
| **[README-PROD.md](README-PROD.md)** | Production-style deployment: build, static hosting, reverse proxy, environment and security |

**Quick start (development):** from the repo root run `npm run install-all`, then `npm run dev` — UI at `http://localhost:8069`, API at `http://localhost:7155` (Vite proxies `/api` and `/ws` in dev; see [README-DEV.md](README-DEV.md)).

## At a glance

- **Roles:** `SUPER_ADMIN` → `ADMIN` → `MANAGER` → `USER`, with org-scoped data and a header org switcher for super admins.
- **Passwords:** everyone changes **their own** password under **Settings → Change password**. **Super admins** and **org admins** can **Set password** for other users on the **People** page (managers cannot).
- **Monorepo:** `frontend/` (Vite + React + MUI), `backend/` (FastAPI, SQLAlchemy, optional native risk-score DLL), root scripts in `package.json`.
- **Deep detail** (stacks, modules, full HTTP API, seed accounts, realtime, task rules, etc.) is in [README-DEV.md](README-DEV.md). **Shipping** a build is in [README-PROD.md](README-PROD.md).

## Repository layout

```text
compheart/
  package.json
  README.md
  README-DEV.md
  README-PROD.md
  frontend/          # Vite app (src/api, pages, store, layout, styles)
  backend/           # FastAPI (app/routers, services, models, seed)
    run.py
```

## License / usage

Internal or demo use—configure `SECRET_KEY`, CORS, and the database for anything beyond local development (see [README-PROD.md](README-PROD.md)).

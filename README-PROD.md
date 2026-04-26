# CompHeart — Production deployment

Back to the [main README](README.md) · [Development](README-DEV.md)

This document describes a **sensible** way to run CompHeart outside pure local dev. Adjust for your own infrastructure, TLS, and secrets management.

## Build artifacts

- **Backend:** Python 3.11+ with `backend/requirements.txt` installed; entry point for API + WebSocket: `cd backend` then `uvicorn app.main:app --host 0.0.0.0 --port 7155` (or gunicorn/uvicorn workers—your choice for scale).
- **Frontend:** from `frontend/`, `npm run build` produces `frontend/dist/`. The static bundle defaults to `http://localhost:7155/api` as the API base; override at **build** time with `VITE_API_BASE_URL` (see `frontend/.env.example`).

## Network and CORS

- The API listens with path prefix `/api` and a WebSocket at `/ws/live` (see [README-DEV.md](README-DEV.md) for details).
- For a **split** host setup (e.g. UI on `https://app.example.com` and API on `https://api.example.com`), set the frontend’s `VITE_API_BASE_URL` to `https://api.example.com/api` and configure the backend `ALLOWED_ORIGIN` / `CORS_EXTRA_ORIGINS` in the environment (see `backend/.env.example`).
- Use **TLS** in production. WebSockets use `wss://` when the page is `https://`.

## Environment variables (high level)

| Variable | Notes |
| --- | --- |
| `SECRET_KEY` | **Required** in production: strong random string for JWT signing. |
| `ENVIRONMENT` / app mode | In `backend` settings, set `environment` to `production` so development-only defaults are not assumed. |
| `DATABASE_URL` | Defaults to SQLite; for multi-instance hosts use a real database (would require a migration; out of box is SQLite). |
| `OPENAI_API_KEY` | Optional; without it, AI and meeting flows use heuristics / fallbacks. |
| `CORS_EXTRA_ORIGINS` | Comma-separated extra browser origins for your deployed UI. |

## Reverse proxy (typical)

Place **nginx**, Caddy, or Traefik in front of:

1. `frontend/dist` (static files) and/or
2. Upstream to `uvicorn` for `/api` and **WebSocket upgrade** for `/ws/`.

**Example (conceptual):**  
- Location `/` → static `dist` index.  
- Location `/api` → `proxy_pass http://127.0.0.1:7155/api;`  
- Location `/ws` → same upstream with `proxy_http_version 1.1`, `Upgrade`, and `Connection` headers for websockets.

If the UI and API are **same origin** (e.g. both under one domain with path-based routing), you avoid CORS in the browser.

## Security checklist

- Rotate `SECRET_KEY` if ever leaked; existing JWTs will invalidate.
- Do not run with `cors` wide open in production without an explicit need.
- Set strong passwords for all accounts; use **Settings → Change password** and **People → Set password** (admins) per [README-DEV.md](README-DEV.md).
- File uploads: backend uses `UPLOADS_DIR` (default `uploads/`) for task attachments; back up and size-limit as required.

## Health

- `GET /` on the API returns `{"name": "CompHeart", "status": "healthy"}`.
- For orchestrators, probe HTTP 200 on that path or a dedicated health route you add in front.

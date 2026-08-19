# Deploy — owm-frontend-new

Live at **https://kbizowm.duckdns.org** (EC2 13.204.50.151). Static Vite build served by nginx on the OWM EC2 box (same box as the backend). Full runbook
(EC2 launch, provisioning, secrets, nginx, HTTPS) lives in **owm-backend-new/DEPLOY.md** — the
backend repo owns the server config (`deploy/provision.sh`, `deploy/nginx-owm.conf`).

- Push to `main` → `.github/workflows/deploy.yml`: `npm ci → lint → build` → rsync `dist/` to
  `/var/www/owm-frontend` → smoke test `GET /` and a deep link.
- API base is **relative** (`.env.production` → `VITE_API_BASE_URL=/api/v1`); nginx proxies `/api/`
  to the backend, so no IP/domain is baked into the bundle. Local dev keeps using `.env`
  (`http://localhost:5000/api/v1`).
- Secrets needed in this repo: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (same values as the backend repo).
- Optional repo variable `VITE_API_BASE_URL` overrides the base at build time.

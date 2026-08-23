# Deploy — owm-frontend-new

Live at **https://kbizowm.duckdns.org** (EC2 13.204.50.151). Static Vite build served by nginx on the OWM EC2 box (same box as the backend). Full runbook
(EC2 launch, provisioning, secrets, nginx, HTTPS) lives in **owm-backend-new/DEPLOY.md** — the
backend repo owns the server config (`deploy/provision.sh`, `deploy/nginx-owm.conf`).

- Push to `main` → `.github/workflows/deploy.yml`: `npm ci → lint → build → test → browser checks`
  → rsync `dist/` to `/var/www/owm-frontend` → smoke test `GET /` and a deep link. The checks run
  before the deploy steps, so a failure stops the release rather than following it.
- API base is **relative** (`.env.production` → `VITE_API_BASE_URL=/api/v1`); nginx proxies `/api/`
  to the backend, so no IP/domain is baked into the bundle. Local dev keeps using `.env`
  (`http://localhost:5000/api/v1`).
- Secrets needed in this repo: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (same values as the backend
  repo), and `BACKEND_DEPLOY_KEY` for the browser checks — see below.
- Optional repo variable `VITE_API_BASE_URL` overrides the base at build time.

## Browser checks in CI

They drive the real app against a real API, so CI needs the backend beside this repo. `GITHUB_TOKEN`
is scoped to this repository alone, so that takes a credential of its own — a **read-only deploy
key**, which opens one repository and nothing else the account can reach.

```
ssh-keygen -t ed25519 -C "owm-frontend-ci" -f owm-ci-key -N ""
```

1. `owm-ci-key.pub` → **owm-backend-new** → Settings → Deploy keys → Add. Leave *Allow write
   access* unchecked.
2. `owm-ci-key` (the whole file, `BEGIN`/`END` lines included) → **this repo** → Settings →
   Secrets and variables → Actions → `BACKEND_DEPLOY_KEY`.

Until that secret exists the checks skip with a notice and the build still passes, so the pipeline
is never blocked on it — but nothing is watching the drawn page either.

## Visual baselines

The screen captures are compared against a stored set. They are per platform — Playwright renders
with the platform's own fonts — so only CI's Linux set is committed; your own is written on the
first local run and stays out of git.

A baseline CI has never seen is written on the run that first sees it, and published as the
`visual-baselines` artifact. Commit it once:

```
gh run download -n visual-baselines -D e2e/screens.spec.ts-snapshots
git add e2e/screens.spec.ts-snapshots && git commit -m "Accept the visual baselines"
```

Until those files are committed the comparison passes by construction, because every run writes
its own. Afterwards a moved column or a strip off the edge fails the build — and when a screen
changes on purpose, the same artifact carries the set to accept.

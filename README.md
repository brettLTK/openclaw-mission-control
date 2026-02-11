# OpenClaw Mission Control

[![CI](https://github.com/abhi1693/openclaw-mission-control/actions/workflows/ci.yml/badge.svg)](https://github.com/abhi1693/openclaw-mission-control/actions/workflows/ci.yml)

Mission Control is the **web UI and HTTP API** for operating OpenClaw. It’s designed for teams that want a clear control plane for managing **boards**, **tasks**, **agents**, **approvals**, and (optionally) **gateway connections**.

## Active development

OpenClaw Mission Control is under active development. Expect breaking changes and incomplete features as we iterate.

- Use at your own risk for production workloads.
- We welcome **bug reports**, **feature requests**, and **PRs** — see GitHub Issues: https://github.com/abhi1693/openclaw-mission-control/issues

## Architecture (high level)

Mission Control is a small, service-oriented stack:

- **Frontend:** Next.js (default http://localhost:3000)
- **Backend:** FastAPI (default http://localhost:8000)
- **Database:** Postgres
- **Gateway integration (optional):** WebSocket protocol documented in [`docs/openclaw_gateway_ws.md`](./docs/openclaw_gateway_ws.md)

## Documentation

Start with the docs landing page:
- [`docs/README.md`](./docs/README.md)

Operational deep dives:
- Deployment: [`docs/deployment/README.md`](./docs/deployment/README.md)
- Production notes: [`docs/production/README.md`](./docs/production/README.md)
- Troubleshooting: [`docs/troubleshooting/README.md`](./docs/troubleshooting/README.md)

## Authentication (Clerk)

Clerk is **optional for local/self-host**.

- The frontend enables Clerk only when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set.
- If you’re not configuring Clerk locally, keep Clerk env vars **unset/blank**.

## Deployment modes

### 1) Self-host (Docker Compose)

**Prerequisites:** Docker + Docker Compose v2 (`docker compose`)

```bash
cp .env.example .env

# REQUIRED: the browser must be able to reach the backend.
# NEXT_PUBLIC_API_URL must be reachable from the *browser* (host), not an internal Docker network name.
# Missing/blank NEXT_PUBLIC_API_URL will break frontend API calls (e.g. Activity feed).

docker compose -f compose.yml --env-file .env up -d --build
```

Open:
- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/healthz

Stop:

```bash
docker compose -f compose.yml --env-file .env down
```

Useful ops:

```bash
# Tail logs
docker compose -f compose.yml --env-file .env logs -f --tail=200

# Rebuild a single service
docker compose -f compose.yml --env-file .env up -d --build backend

# Reset data (DESTRUCTIVE: deletes Postgres volume)
docker compose -f compose.yml --env-file .env down -v
```

### 2) Contributor local dev loop (DB in Docker, apps on host)

This is the fastest workflow for contributors: run Postgres via Docker, and run the backend + frontend in dev mode.

See: [`docs/03-development.md`](./docs/03-development.md)

## Testing and CI parity

- Testing guide: [`docs/testing/README.md`](./docs/testing/README.md)
- Coverage policy: [`docs/coverage-policy.md`](./docs/coverage-policy.md)

From repo root:

```bash
make help
make setup
make check
```

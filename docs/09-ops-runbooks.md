# Ops / runbooks

## Deep dives

- [Deployment](deployment/README.md)
- [Production](production/README.md)
- [Troubleshooting](troubleshooting/README.md)

This page is the operator entrypoint. It points to the existing deep-dive runbooks and adds a short “first 30 minutes” checklist.

## First 30 minutes (incident checklist)

1. **Confirm impact**
   - What’s broken: UI, API, auth, or gateway integration?
   - All users or a subset?

2. **Check service health**
   - Backend: `/healthz` and `/readyz`
   - Frontend: can it load? does it reach the API?

3. **Check auth (Clerk)**
   - Frontend: did Clerk get enabled unintentionally? (publishable key set)
   - Backend: is `CLERK_SECRET_KEY` configured correctly?

4. **Check DB connectivity**
   - Can backend connect to Postgres (`DATABASE_URL`)?

5. **Check logs**
   - Backend logs for 5xx spikes or auth failures.
   - Frontend logs for API URL/proxy misconfig.

6. **Stabilize**
   - Roll back the last change if you can.
   - Temporarily disable optional integrations (gateway) to isolate.

## Backups / restore

See [Production](production/README.md). If you run Mission Control in production, treat backup/restore as a regular drill, not a one-time setup.

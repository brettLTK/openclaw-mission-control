# Troubleshooting

## Deep dives

- [Troubleshooting deep dive](troubleshooting/README.md)

This is the “quick triage” page. For detailed playbooks and diagnostics, use the deep dive.

## Quick triage

### Frontend loads but shows API errors
- Confirm `NEXT_PUBLIC_API_URL` points to a backend your browser can reach.
- Check backend `/healthz`.

### Frontend keeps redirecting / Clerk errors
- If you’re running locally without Clerk, keep `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset/blank.
- See: [repo README Clerk note](../README.md#note-on-auth-clerk).

### Backend returns 5xx
- Check DB connectivity (`DATABASE_URL`) and migrations.
- Check backend logs.

## Next
- Promote the most common issues from `docs/troubleshooting/README.md` into this page once we see repeated incidents.

# MC Dashboard & Webhook Improvements - Plan

## Issue #61: Task.done → GitHub Comment
- [x] Explore existing webhook-worker structure in MC
- [x] Find task status update hook/event system
- [x] Add GitHub issue extraction logic (pattern: `[#N]`)
- [x] Add GitHub API comment posting
- [x] Add GITHUB_TOKEN to .env if needed (found GITHUB_PAT already in .env)
- [x] Integrated GitHub notification into _finalize_updated_task
- [ ] Test with sample task marked done

## Issue #74: Dashboard Voltage KPI + Blocked Tasks
- [x] Examine current dashboard structure (`/dashboard`)
- [x] Examine existing KPI components
- [x] Add voltage KPI widget (count tasks with voltage_level="high")
- [x] Add blocked tasks panel (is_blocked=true, top 5)
- [x] Integrate both into dashboard layout
- [x] Add API endpoints for data fetching (voltage + blocked tasks)
- [ ] Test API endpoints for data fetching

## Issue #80: Approval Panel Comment Display
- [x] Find approval detail view components in frontend/src/
- [x] Locate where approval records are rendered
- [x] Add comment field display below approval action
- [ ] Test approval view with comment data

## Verification Checklist
- [ ] `npx next build` passes
- [ ] Curl all modified API endpoints with auth
- [ ] Check DB state if schema touched
- [ ] Git commit on feature branch
- [ ] Document what was built + curl proofs

## Architecture Notes
- Backend: http://10.0.0.124:8001
- Auth: LOCAL_AUTH_TOKEN in .env
- Branch: feature/mc-dashboard-webhooks
- No ~/.openclaw/ modifications
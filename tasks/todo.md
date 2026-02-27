# Fix #62 — MC Dashboard Cycle Time + Timezone Bug

## Plan

### Fix A: Cycle time uses wrong field (metrics.py)
- [x] In `_query_cycle_time()`: replace `created_at` → `in_progress_at`, add filter for non-null
- [x] In `_median_cycle_time_for_range()`: same fix
- [x] Remove unused `sql_cast` / `DateTime` imports if no longer needed

### Fix B: Timezone bug in series mapping (metrics.py)
- [x] In `_query_throughput()`: strip tzinfo from bucket keys
- [x] In `_query_cycle_time()`: same fix
- [x] In `_query_error_rate()`: same fix
- [x] In `_query_wip()`: same fix (both inbox and status bucket keys)

### Fix C: Add `in_progress_at` to TaskUpdate schema
- [x] Add `in_progress_at: datetime | None = None` to `TaskUpdate` in schemas/tasks.py

### Fix D: Sync script — backfill `in_progress_at` from GitHub events
- [x] Add `get_issue_events()` helper using `gh` CLI
- [x] Add backfill pass: for each synced task without `in_progress_at`, query GH events for `status:in-progress` label event, PATCH MC task

### Verification
- [x] Create feature branches
- [x] Rebuild backend container
- [x] Run sync script with `--force`
- [x] Curl dashboard endpoint — confirm non-zero values
- [x] Check DB for `in_progress_at` values
- [ ] Commit both branches

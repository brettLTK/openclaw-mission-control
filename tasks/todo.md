# Task: Required comment on MC approval decisions + GitHub Issues

## Plan

### Backend Changes
- [ ] Update `backend/app/schemas/approvals.py` - Add `comment: str | None = None` to `ApprovalUpdate`
- [ ] Create `post_github_decision_comment` helper in `backend/app/api/approvals.py`
- [ ] Update `update_approval` in `backend/app/api/approvals.py` to:
  - Merge comment into approval.payload
  - Call GitHub comment helper after decision (non-blocking)

### Frontend Changes
- [ ] Update `BoardApprovalsPanel.tsx` to add inline reason form:
  - Add state for comment textarea
  - Show form before decision fires
  - Disable approve/reject until comment is non-empty
  - Include comment in PATCH request

### Verification
- [ ] Run `npx next build` - must pass
- [ ] Restart docker containers
- [ ] Curl test PATCH approval with comment
- [ ] Verify payload.comment stored
- [ ] Fire openclaw event when complete

## Approach
1. Backend: Schema → GitHub helper → integrate into approval flow
2. Frontend: Add inline form with required validation
3. No DB migration needed (JSON payload)
4. GitHub post is fire-and-forget with error handling

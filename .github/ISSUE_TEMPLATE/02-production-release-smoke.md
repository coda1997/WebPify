---
name: Phase 5 - Production release smoke
title: "Phase 5: Production deployment and smoke validation"
labels: ["release", "ops", "phase-5"]
assignees: []
---

## Goal
Deploy the app and verify core conversion behavior on the live environment.

## References
- Checklist: plans/release-checklist.md
- README: README.md

## Pre-checks
- [ ] pnpm lint passes
- [ ] pnpm build passes
- [ ] Benchmark route works locally

## Deployment Tasks
- [ ] Deploy to target hosting provider
- [ ] Confirm live URL and HTTPS access
- [ ] Verify wasm/worker assets load correctly in production

## Live Smoke Tests
- [ ] Open app and load home page
- [ ] Upload image with picker
- [ ] Upload image with drag/drop
- [ ] Convert at quality 75
- [ ] Cancel in-flight conversion
- [ ] Download and open generated webp
- [ ] Run /benchmark once and confirm all 3 rows complete

## Acceptance Criteria
- [ ] Live smoke tests pass end-to-end
- [ ] No critical runtime errors observed
- [ ] Release checklist updated with status

## Deliverables
- Deployment URL
- Completed release checklist entries
- Notes on any non-blocking issues

# UX Improvement Plan (WebPify)

Date: 2026-02-19
Owner: Product + Frontend
Status: Proposed

## Goal
Make the converter feel like a polished product (guided, confidence-building, and outcome-focused) without expanding scope too much.

## Product Problems to Solve
- The current flow feels like a single utility form instead of a guided experience.
- The value of conversion is shown, but not emphasized enough visually.
- First-time users can miss the “what to do next” moment after conversion.
- Benchmark mode is useful but can distract from the core conversion journey.

## UX Principles
- Keep first run simple: one clear primary action at each step.
- Emphasize outcome: saved size and visual quality comparison.
- Build trust: local processing and privacy-safe messaging.
- Preserve speed: no heavy interactions or extra navigation overhead.

## Phase 1 — High Impact, Low Risk (MVP+)

### 1) Guided 3-step flow
**Change**
- Add lightweight step labels in the main converter card:
  1. Upload image
  2. Tune quality
  3. Download WebP

**Why**
- Gives structure and reduces “blank form” feeling.

**Acceptance Criteria**
- Step labels are visible at all times.
- Active/completed states reflect current progress.
- No additional page navigation required.

### 2) Before/After outcome emphasis
**Change**
- Add a clear before/after section in result area:
  - Original size
  - WebP size
  - Prominent “Saved X%” badge

**Why**
- Users immediately understand value after conversion.

**Acceptance Criteria**
- Saved percent is visually prominent and easy to scan.
- Metrics are shown with consistent formatting.
- Empty state remains clean before first conversion.

### 3) Single primary CTA behavior
**Change**
- Keep one dominant action button:
  - Before conversion: “Convert to WebP”
  - After success: “Download WebP”

**Why**
- Reduces choice paralysis and clarifies the next step.

**Acceptance Criteria**
- Exactly one primary CTA is visible at a time.
- Disabled/loading states remain accessible.
- Download still supports the generated filename.

### 4) Stronger guidance copy + trust line
**Change**
- Improve microcopy in empty/error/success states.
- Add explicit trust statement near upload/output: “Runs locally in your browser. No upload required.”

**Why**
- Better onboarding and privacy confidence.

**Acceptance Criteria**
- All key states have concise, friendly text.
- Trust message is visible without scrolling on desktop.

## Phase 2 — Optional Enhancements

### 5) Batch conversion queue
- Multi-file upload with per-file progress + per-file download.
- Keep implementation simple: sequential worker jobs first.
- Detailed implementation spec: `plans/batch-conversion-ux-spec.md`

### 6) Intent-based presets
- Replace/augment low-medium-high with intent labels:
  - Web (smaller)
  - Email (balanced)
  - Max Quality (larger)

### 7) Sticky mobile action row
- Keep primary action and reset/cancel visible during scroll.

## Information Architecture Recommendation
- Keep `/` focused on converter (core flow).
- Keep `/benchmark` but reduce prominence from top-level hero action.
- Option: place benchmark link as secondary text link under advanced section.

## Delivery Plan

### Sprint 1 (1–2 days)
- Implement Phase 1 items 1–4.
- Validate accessibility states (focus, live status, keyboard).

### Sprint 2 (optional, 2–4 days)
- Implement Phase 2 item 5 (batch queue) first.
- Add item 6 and 7 if time allows.

## Success Metrics
- Higher completion rate from file select → download.
- Lower reset/cancel rate before first successful conversion.
- Faster time-to-first-successful-download.
- Positive qualitative feedback: “clearer”, “more polished”, “easy to trust”.

## Out of Scope (for now)
- Account system, cloud storage, sharing links.
- Complex editor features (crop/resize/filters).
- Visual redesign beyond current style system.

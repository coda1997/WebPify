# WebP WASM Compressor Roadmap

## Objective
Build a browser-based image-to-WebP compressor with Next.js + TypeScript + pnpm, using WebAssembly (`@jsquash/webp`, libwebp-based) and a Web Worker to keep UI responsive. The product should support drag-and-drop conversion, adjustable quality, instant preview, and downloadable results without sending images to a server.

## Tech Stack Decisions
- **Framework:** Next.js (App Router) for fast iteration, simple deployment, and static-friendly pages.
- **Language:** TypeScript for safer async worker/WASM boundaries and maintainability.
- **Package manager:** pnpm for workspace speed and deterministic installs.
- **Compression engine:** `@jsquash/webp` (libwebp via WebAssembly) for high-quality in-browser encoding.
- **Concurrency model:** Dedicated Web Worker to run heavy encode work off main thread.
- **State/UI:** React state + minimal utility hooks; avoid heavy global state unless needed.
- **Styling:** Keep existing project styling approach (or plain CSS modules/Tailwind if chosen at setup).
- **Validation:** Zod/light runtime checks for file constraints and worker messages.

## Architecture Overview
### Components
- **UI Layer (Next.js pages/components):** file input, quality slider, progress, preview, download actions.
- **Processing Layer (Worker):** receives image buffers + encode settings, invokes WASM encoder, returns Blob/ArrayBuffer + metadata.
- **WASM Layer (`@jsquash/webp`):** encodes browser-decoded image data to WebP.
- **Utilities:** file-size formatter, EXIF orientation handling (if needed), error mapping.

### Data Flow
1. User drops/selects image in UI.
2. UI validates type/size and reads file as ArrayBuffer.
3. UI posts message to Web Worker with buffer + quality/options.
4. Worker loads/initializes WASM encoder (lazy + cached instance).
5. Worker encodes to WebP and emits progress/status updates.
6. Worker returns compressed bytes + stats (input size, output size, ratio, duration).
7. UI creates object URL, renders preview/comparison, and enables download.
8. User downloads `.webp`; object URLs are revoked on cleanup.

## Milestone Plan (5 Phases)

### Phase 1 — Setup
**Tasks**
- Initialize Next.js + TypeScript project with pnpm.
- Configure linting/formatting and basic folder structure (`app`, `components`, `workers`, `lib`).
- Add dependency baseline (`@squoosh/lib`, typing helpers).
- Add a minimal upload page shell and project README start.

**Deliverables**
- Running Next.js app with clean build/lint.
- Initial UI scaffold with upload area and placeholders.
- Repository scripts for dev/build/lint.

**Acceptance Criteria**
- `pnpm install`, `pnpm dev`, `pnpm build` succeed.
- App renders upload page with no runtime errors.
- Codebase follows consistent formatting/lint rules.

### Phase 2 — Core Pipeline
**Tasks**
- Implement Web Worker with typed message protocol.
- Integrate `@squoosh/lib` WebP encode path in worker.
- Build UI-to-worker bridge (postMessage, transferables, cancellation handling).
- Add single-image conversion flow and downloadable output.

**Deliverables**
- End-to-end in-browser conversion from image → WebP.
- Display of input/output size and compression ratio.
- Error states for invalid files and encode failures.

**Acceptance Criteria**
- PNG/JPEG input converts to valid WebP file locally.
- Main thread remains responsive during conversion.
- Output download works and stats are accurate.

### Phase 3 — UX Polish
**Tasks**
- Add drag-and-drop, file picker fallback, and clear reset action.
- Add quality slider and optional preset buttons (low/medium/high).
- Implement before/after preview and user-friendly progress indicators.
- Improve accessibility (labels, keyboard flow, ARIA for status updates).

**Deliverables**
- Polished upload/convert/download experience.
- Configurable quality with visible effect on output size.
- Accessibility improvements documented.

**Acceptance Criteria**
- Users can complete conversion in ≤3 obvious steps.
- Quality control updates output as expected.
- Core controls are keyboard accessible and screen-reader friendly.

### Phase 4 — Optimization & Performance
**Tasks**
- Lazy-load worker and WASM only when first conversion starts.
- Use transferable objects and avoid unnecessary buffer copies.
- Add memory/object URL cleanup and cancellation for repeated runs.
- Benchmark encode latency and bundle impact; tune defaults.

**Deliverables**
- Performance baseline report (small/medium/large sample images).
- Reduced initial load impact and stable memory behavior.
- Tuned default quality balancing speed vs size.

**Acceptance Criteria**
- First page load remains lightweight before conversion.
- No obvious memory growth across repeated conversions.
- Conversion time and output ratio meet baseline targets.

### Phase 5 — Release
**Tasks**
- Finalize README with usage, limitations, and privacy statement (local processing).
- Add basic analytics/error logging strategy (privacy-safe, optional).
- Verify cross-browser behavior (latest Chrome, Edge, Safari, Firefox).
- Prepare production build and deployment checklist.

**Deliverables**
- Release-ready app + docs.
- Browser compatibility verification notes.
- Deployment configuration and rollback notes.

**Acceptance Criteria**
- Production deployment passes smoke tests.
- Documentation enables new contributors to run locally quickly.
- Known issues and constraints are tracked.

## Risks and Mitigations
- **WASM load failures / CORS issues:** Host assets correctly, test production paths early, add fallback error messaging.
- **Large-image memory pressure:** Set size limits, process one image at a time initially, aggressively release buffers/URLs.
- **Worker communication bugs:** Use strict typed message schema and centralized message handlers.
- **Browser inconsistencies:** Maintain compatibility matrix and test regularly in target browsers.
- **Slow first conversion:** Pre-warm worker on user intent (hover/click), cache initialized codec instance.
- **Scope creep:** Lock MVP to single-image conversion first; defer batch mode to post-release.

## Execution Checklist
- [x] Scaffold Next.js + TypeScript app with pnpm.
- [x] Add worker infrastructure and typed protocol.
- [x] Integrate `@jsquash/webp` WebP encode in worker.
- [x] Implement upload → convert → download happy path.
- [x] Add quality controls and preview UI.
- [x] Add accessibility pass and error UX.
- [x] Optimize transfer/memory/lazy loading.
- [x] Add local benchmark runner for small/medium/large cases.
- [ ] Run cross-browser validation.
- [x] Finalize docs and deployment checklist.
- [ ] Release and monitor basic runtime errors.

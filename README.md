# WebPify

Phase 5 documentation-ready implementation for a Next.js + TypeScript + pnpm WebP WASM app.

## Quick Start

1. Install dependencies:
   - `pnpm install`
2. Start development server:
   - `pnpm dev`
3. Build for production:
   - `pnpm build`
4. Start production server:
   - `pnpm start`
5. Run lint:
   - `pnpm lint`

## Notes

- The app performs **single-image conversion to WebP in-browser**.
- Encoding runs in a dedicated **Web Worker** using `@jsquash/webp` WebAssembly.
- Current scope is Phase 4: optimized one-file conversion with cancellation, transfer-aware worker messaging, and safer object URL cleanup.

## Current Flow (Phase 4)

1. Choose an image file (PNG/JPEG and other browser-supported image formats).
2. Adjust quality (1-100) or use Low/Medium/High presets.
3. Click Convert to WebP.
4. Review output stats and preview.
5. Download the generated `.webp` file.

## Benchmark Mode

- Open `/benchmark` from the app header.
- Click **Run Benchmark** to execute small/medium/large synthetic image tests.
- Review per-case input/output size, savings %, worker encode time, and wall-clock time.
- Use **Cancel** to stop an in-flight benchmark run.

## Performance-Oriented Behaviors

- Worker and WASM initialize lazily on first conversion (not on initial page load).
- In-flight conversion can be cancelled from the UI.
- Previous object URLs are revoked before new results and on teardown.
- Worker output is posted with transferable buffers to reduce copy overhead.

## Release Docs

- Release checklist: `plans/release-checklist.md`
- Browser validation matrix: `plans/browser-validation-matrix.md`
- Privacy-safe telemetry strategy: `plans/privacy-safe-telemetry.md`
- Issue tracker for final execution: `plans/release-issue-tracker.md`

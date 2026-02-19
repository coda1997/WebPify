# WebPify Release Checklist

## Scope
Final pre-release checklist for WebPify production launch.

## Pre-Release Gates
- [ ] `pnpm install` succeeds on clean machine.
- [ ] `pnpm lint` passes with no errors.
- [ ] `pnpm build` passes.
- [ ] Benchmark page `/benchmark` runs all 3 cases successfully.
- [ ] Manual conversion smoke test passes on home page.

## Functional Smoke Test
- [ ] Upload via file picker works.
- [ ] Upload via drag-and-drop works.
- [ ] Quality slider changes output size.
- [ ] Low/Medium/High presets apply correctly.
- [ ] Convert action completes and shows stats.
- [ ] Cancel action stops in-flight conversion.
- [ ] Download outputs a valid `.webp` file.
- [ ] Reset clears file/result/status safely.

## Performance & Stability
- [ ] First load is responsive before first conversion.
- [ ] Repeated convert/reset (10x) does not show obvious memory growth.
- [ ] Benchmark latencies are recorded and acceptable for target devices.
- [ ] No runtime errors during normal conversion flow.

## Deployment
- [ ] Production environment variables reviewed (if any).
- [ ] Static assets and wasm paths verified in production build.
- [ ] Deploy to hosting target (e.g., Vercel).
- [ ] Run post-deploy smoke test on live URL.
- [ ] Confirm HTTPS and caching headers are appropriate.

## Rollback Plan
- [ ] Keep previous stable deployment ready for rollback.
- [ ] Document rollback command/process for hosting provider.
- [ ] Define rollback trigger (critical regression, conversion failure, crash).

## Sign-off
- [ ] Engineering sign-off
- [ ] Product sign-off
- [ ] Release date/time recorded

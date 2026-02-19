# WebPify

[![Live Demo](https://img.shields.io/badge/Live%20Demo-WebPify-blue?style=for-the-badge)](https://coda1997.github.io/WebPify/)

WebPify is a browser-based image compressor that converts images to WebP locally using WebAssembly.

The app is built with Next.js + TypeScript and runs encoding inside a Web Worker so the UI stays responsive during conversion.

## Highlights

- In-browser conversion (no image upload required for core flow)
- Drag and drop + file picker support
- Quality slider (1-100) and Low/Medium/High presets
- Conversion stats (input size, output size, savings ratio, duration)
- Downloadable `.webp` output
- In-flight conversion cancel support
- Built-in benchmark page for small/medium/large test cases

## Tech Stack

- Framework: Next.js (App Router)
- Language: TypeScript
- Package manager: pnpm
- WebP encoder: `@jsquash/webp` (WASM)
- Processing model: Dedicated Web Worker

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install and Run

```bash
pnpm install
pnpm dev
```

Open:

- Home: `http://localhost:3000`
- Benchmark: `http://localhost:3000/benchmark`

### Build and Start (Production Mode)

```bash
pnpm build
pnpm start
```

### Lint

```bash
pnpm lint
```

## How It Works

1. User selects or drops an image.
2. UI reads the file as `ArrayBuffer`.
3. Buffer + quality settings are posted to a Web Worker.
4. Worker decodes image data and encodes WebP through WASM.
5. Worker returns compressed bytes + metrics.
6. UI renders preview/stats and enables download.

## Benchmark Mode

The `/benchmark` page runs 3 synthetic cases:

- Small (`800×600`)
- Medium (`1920×1080`)
- Large (`3840×2160`)

For each case it reports:

- Input/output size
- Savings %
- Worker encode time
- Wall-clock time

## Project Structure

```text
app/
   page.tsx                # Main converter page
   benchmark/page.tsx      # Benchmark page
components/
   upload-shell.tsx        # Converter UI
   benchmark-runner.tsx    # Benchmark UI and runner
lib/
   worker-client.ts        # Worker bridge + cancellation
   worker-protocol.ts      # Typed request/response protocol
workers/
   webp.worker.ts          # WASM encoding worker
plans/
   webp-wasm-roadmap.md
   release-checklist.md
   browser-validation-matrix.md
   privacy-safe-telemetry.md
   release-issue-tracker.md
```

## Debugging

VS Code launch configs are available in `.vscode/launch.json`.

If `pnpm dev` fails with a `NODE_OPTIONS` preload path error, clear stale debug injection and retry:

```bash
unset NODE_OPTIONS
pnpm dev
```

## Git Commit Policy

This repository enforces checks before each commit through Husky (`.husky/pre-commit`):

- `pnpm check:secrets` scans staged files for token/key/secret patterns
- `pnpm lint` runs project linting

If either check fails, the commit is blocked.

Emergency bypass (not recommended):

```bash
git commit --no-verify
```

## Release Docs

- Roadmap: `plans/webp-wasm-roadmap.md`
- Release checklist: `plans/release-checklist.md`
- Browser validation matrix: `plans/browser-validation-matrix.md`
- Privacy-safe telemetry strategy: `plans/privacy-safe-telemetry.md`
- Issue tracker: `plans/release-issue-tracker.md`

## Privacy Notes

- Core conversion runs locally in the browser.
- Do not collect raw image data in telemetry.
- See `plans/privacy-safe-telemetry.md` for suggested event policy.

## GitHub Pages Deployment (CI)

This project includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that:

1. Installs dependencies with pnpm
2. Runs lint
3. Builds a static export (`out/`)
4. Uploads the Pages artifact
5. Deploys to GitHub Pages

### One-time repository settings

In GitHub repository settings:

- Open **Settings → Pages**
- Under **Build and deployment**, choose **Source: GitHub Actions**

### How base path is handled

- For project pages (like `username/WebPify`), workflow sets `NEXT_PUBLIC_BASE_PATH=/WebPify`
- For user/org pages repos (like `username.github.io`), base path is empty

### Trigger

- Auto deploy on push to `main`
- Manual run via **Actions → Deploy to GitHub Pages → Run workflow**

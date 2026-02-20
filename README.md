# 🖼️ WebPify

[![Live Demo](https://img.shields.io/badge/Live%20Demo-WebPify-blue?style=for-the-badge)](https://coda1997.github.io/WebPify/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

**WebPify** is a lightning-fast, privacy-first browser-based image compressor. It converts your images to the highly optimized WebP format entirely locally using WebAssembly (WASM). 

Because all processing happens directly in your browser via Web Workers, your images never leave your device, ensuring **100% privacy** and a responsive user interface.

---

## ✨ Features

- **🔒 Privacy-First**: 100% in-browser conversion. No server uploads required.
- **⚡ Blazing Fast**: Powered by WebAssembly (`@jsquash/webp`) for near-native encoding speeds.
- **🧵 Non-Blocking UI**: Heavy lifting is offloaded to a dedicated Web Worker, keeping the app smooth.
- **🎛️ Fine-Grained Control**: Adjust quality (1-100) with a slider or use quick presets (Low/Medium/High).
- **📊 Real-Time Metrics**: Instantly see input/output sizes, savings ratio, and conversion duration.
- **🛑 Cancellable Operations**: Abort in-flight conversions instantly if you change your mind.
- **🧪 Built-in Benchmarking**: Test performance across different image sizes directly in the app.
- **🖱️ Intuitive UX**: Seamless drag-and-drop and file picker support.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+

### Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the development server:**
   ```bash
   pnpm dev
   ```

3. **Open in your browser:**
   - Main App: [http://localhost:3000](http://localhost:3000)
   - Benchmark Suite: [http://localhost:3000/benchmark](http://localhost:3000/benchmark)

### Production Build

```bash
pnpm build
pnpm start
```

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Package Manager:** pnpm
- **WebP Encoder:** `@jsquash/webp` (WASM)
- **Processing:** Dedicated Web Workers

---

## 🧠 How It Works

1. **Input:** You select or drag-and-drop an image.
2. **Read:** The UI reads the file into memory as an `ArrayBuffer`.
3. **Dispatch:** The buffer and your quality settings are sent to a background Web Worker.
4. **Process:** The Worker decodes the image and encodes it to WebP using WebAssembly.
5. **Return:** The Worker sends back the compressed bytes and performance metrics.
6. **Result:** The UI updates with a preview, stats, and a download button.

---

## 📊 Benchmark Mode

WebPify includes a dedicated `/benchmark` page to test encoding performance across three synthetic test cases:

- **Small:** `800 × 600`
- **Medium:** `1920 × 1080`
- **Large:** `3840 × 2160`

For each resolution, the benchmark reports:
- Input vs. Output size
- Compression savings (%)
- Worker encode time vs. Wall-clock time

---

## 📁 Project Structure

```text
app/
 ├── page.tsx                # Main converter UI
 └── benchmark/page.tsx      # Benchmark suite
components/
 ├── upload-shell.tsx        # Drag & drop / Converter component
 └── benchmark-runner.tsx    # Benchmark execution UI
lib/
 ├── worker-client.ts        # Worker bridge & cancellation logic
 └── worker-protocol.ts      # Typed request/response definitions
workers/
 └── webp.worker.ts          # WASM encoding Web Worker
plans/                       # Project documentation & roadmaps
 ├── webp-wasm-roadmap.md
 ├── release-checklist.md
 └── ...
```

---

## 🔒 Security & Privacy

### Privacy Notes
- **Zero Data Collection:** Core conversion runs locally. We do not collect raw image data.
- **Telemetry:** Any future telemetry will be strictly privacy-safe (see `plans/privacy-safe-telemetry.md`).

### Git Commit Policy
This repository uses Husky (`.husky/pre-commit`) to enforce quality and security:
- `pnpm check:secrets`: Scans staged files to prevent accidental commits of tokens/keys.
- `pnpm lint`: Ensures code quality.

*(Emergency bypass: `git commit --no-verify` - not recommended)*

---

## ☁️ Deployment (GitHub Pages)

WebPify is automatically deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy-pages.yml`).

**Workflow Steps:**
1. Installs dependencies via pnpm.
2. Runs linters.
3. Builds a static export (`out/`).
4. Deploys the artifact to GitHub Pages.

**Setup Instructions:**
1. Go to your repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow will automatically handle the `NEXT_PUBLIC_BASE_PATH` depending on whether it's a project page or a user page.

---

## 🐛 Debugging

VS Code launch configurations are provided in `.vscode/launch.json`.

If `pnpm dev` fails with a `NODE_OPTIONS` preload path error, clear the stale debug injection:
```bash
unset NODE_OPTIONS
pnpm dev
```

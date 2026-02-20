import Link from "next/link";
import { UploadShell } from "@/components/upload-shell";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-blue-100 selection:text-blue-900">
      {/* Modern Header/Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">WebPify</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/benchmark"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Benchmark
            </Link>
            <Link
              href="https://github.com/coda1997/WebPify"
              target="_blank"
              className="hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-md md:flex"
            >
              GitHub <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 md:pt-12 lg:pt-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-slate-50"></div>
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/50 px-3 py-1 text-sm font-medium text-blue-800 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
              100% Local Processing
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
              Convert images to WebP <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                lightning fast.
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 sm:text-xl">
              Optimize your images directly in your browser. No uploads, no server processing, complete privacy. Fast, secure, and free.
            </p>
          </div>
        </div>
      </section>

      {/* Main App Section */}
      <section className="container mx-auto px-4 pb-24 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-2 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <UploadShell />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

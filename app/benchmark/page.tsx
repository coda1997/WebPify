import Link from "next/link";
import { BenchmarkRunner } from "@/components/benchmark-runner";
import { ArrowLeft, Activity } from "lucide-react";

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-blue-100 selection:text-blue-900">
      {/* Modern Header/Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 text-white shadow-sm font-bold text-lg">
              W
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">WebPify Benchmark</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Converter
            </Link>
          </nav>
        </div>
      </header>

      {/* Main App Section */}
      <section className="container mx-auto px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-2 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <BenchmarkRunner />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

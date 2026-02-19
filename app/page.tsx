import Link from "next/link";
import { UploadShell } from "@/components/upload-shell";

export default function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <div className="row">
          <h1>WebPify</h1>
          <Link href="/benchmark" className="textLink">
            Open Benchmark
          </Link>
        </div>
        <p>Phase 4: in-browser conversion with worker cancellation and memory-safe cleanup.</p>
        <UploadShell />
      </section>
    </main>
  );
}

import Link from "next/link";
import { UploadShell } from "@/components/upload-shell";

export default function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <div className="row">
          <h1>WebPify</h1>
          <Link href="/benchmark" className="textLink">
            Benchmark (Advanced)
          </Link>
        </div>
        <p>Convert images to WebP locally in your browser with fast, private processing.</p>
        <UploadShell />
      </section>
    </main>
  );
}

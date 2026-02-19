import Link from "next/link";
import { UploadShell } from "@/components/upload-shell";

export default function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <div className="row topRow">
          <h1 className="pageTitle">WebPify</h1>
          <Link href="/benchmark" className="textLink">
            Benchmark (Advanced)
          </Link>
        </div>
        <p className="pageSubtitle">Convert images to WebP locally in your browser with fast, private processing.</p>
        <UploadShell />
      </section>
    </main>
  );
}

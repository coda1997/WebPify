import Link from "next/link";
import { BenchmarkRunner } from "@/components/benchmark-runner";

export default function BenchmarkPage() {
  return (
    <main className="page">
      <section className="card">
        <div className="row">
          <h1>WebPify Benchmark</h1>
          <Link href="/" className="textLink">
            Back to Converter
          </Link>
        </div>
        <BenchmarkRunner />
      </section>
    </main>
  );
}

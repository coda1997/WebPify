"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cancelActiveEncoding,
  disposeEncoderWorker,
  encodeImageWithWorker,
  isEncodingCancelledError,
} from "@/lib/worker-client";
import { formatBytes } from "@/lib/format";

type BenchmarkCase = {
  label: "Small" | "Medium" | "Large";
  width: number;
  height: number;
};

type BenchmarkRow = {
  label: BenchmarkCase["label"];
  dimensions: string;
  inputBytes: number;
  outputBytes: number;
  savingsPercent: number;
  workerMs: number;
  wallMs: number;
};

const CASES: BenchmarkCase[] = [
  { label: "Small", width: 800, height: 600 },
  { label: "Medium", width: 1920, height: 1080 },
  { label: "Large", width: 3840, height: 2160 },
];

const BENCHMARK_QUALITY = 75;

function createCanvasSample(caseItem: BenchmarkCase): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = caseItem.width;
  canvas.height = caseItem.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Unable to create canvas context for benchmark."));
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.35, "#0369a1");
  gradient.addColorStop(0.7, "#22c55e");
  gradient.addColorStop(1, "#f59e0b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.5;
  for (let i = 0; i < 250; i += 1) {
    const x = (i * 73) % canvas.width;
    const y = (i * 53) % canvas.height;
    const radius = 8 + ((i * 17) % 44);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = i % 2 === 0 ? "#ffffff" : "#111827";
    context.fill();
  }

  context.globalAlpha = 1;
  context.fillStyle = "rgba(17, 24, 39, 0.7)";
  context.fillRect(24, canvas.height - 84, 360, 56);
  context.fillStyle = "#ffffff";
  context.font = "600 30px -apple-system, BlinkMacSystemFont, Segoe UI";
  context.fillText(`${caseItem.label} ${caseItem.width}x${caseItem.height}`, 36, canvas.height - 46);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create benchmark source image."));
        return;
      }

      resolve(new File([blob], `${caseItem.label.toLowerCase()}-benchmark.png`, { type: "image/png" }));
    }, "image/png");
  });
}

export function BenchmarkRunner() {
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState("Ready to run benchmark.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cancelActiveEncoding();
      disposeEncoderWorker();
    };
  }, []);

  const averages = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }

    const totalSavings = rows.reduce((sum, item) => sum + item.savingsPercent, 0);
    const totalWorkerMs = rows.reduce((sum, item) => sum + item.workerMs, 0);
    const totalWallMs = rows.reduce((sum, item) => sum + item.wallMs, 0);

    return {
      avgSavings: totalSavings / rows.length,
      avgWorkerMs: totalWorkerMs / rows.length,
      avgWallMs: totalWallMs / rows.length,
    };
  }, [rows]);

  async function runBenchmark() {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    setRows([]);
    setErrorMessage(null);

    try {
      const nextRows: BenchmarkRow[] = [];

      for (const caseItem of CASES) {
        setStatusText(`Running ${caseItem.label} benchmark...`);

        const sourceFile = await createCanvasSample(caseItem);
        const inputBuffer = await sourceFile.arrayBuffer();
        const wallStart = performance.now();

        const response = await encodeImageWithWorker({
          fileName: sourceFile.name,
          mimeType: sourceFile.type,
          buffer: inputBuffer,
          quality: BENCHMARK_QUALITY,
        });

        const wallMs = Math.round(performance.now() - wallStart);
        const savingsPercent =
          response.inputBytes > 0
            ? ((response.inputBytes - response.outputBytes) / response.inputBytes) * 100
            : 0;

        nextRows.push({
          label: caseItem.label,
          dimensions: `${caseItem.width}×${caseItem.height}`,
          inputBytes: response.inputBytes,
          outputBytes: response.outputBytes,
          savingsPercent: Math.max(0, savingsPercent),
          workerMs: response.durationMs,
          wallMs,
        });

        setRows([...nextRows]);
      }

      setStatusText("Benchmark complete.");
    } catch (error) {
      if (isEncodingCancelledError(error)) {
        setStatusText("Benchmark cancelled.");
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Benchmark failed.");
        setStatusText("Benchmark failed.");
      }
    } finally {
      setIsRunning(false);
    }
  }

  function cancelBenchmark() {
    cancelActiveEncoding();
  }

  return (
    <section className="bench">
      <p className="benchDesc">
        One-click benchmark for three synthetic images at quality {BENCHMARK_QUALITY}. Use this to compare
        encode latency and size savings across devices.
      </p>

      <div className="row actions">
        <button type="button" onClick={runBenchmark} disabled={isRunning}>
          {isRunning ? "Running..." : "Run Benchmark"}
        </button>
        <button type="button" onClick={cancelBenchmark} disabled={!isRunning}>
          Cancel
        </button>
      </div>

      <p className="status" role="status" aria-live="polite">
        {errorMessage ?? statusText}
      </p>

      <div className="benchTableWrap">
        <table className="benchTable">
          <thead>
            <tr>
              <th>Case</th>
              <th>Dimensions</th>
              <th>Input</th>
              <th>Output</th>
              <th>Savings</th>
              <th>Worker</th>
              <th>Wall</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>No results yet.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.dimensions}</td>
                <td>{formatBytes(row.inputBytes)}</td>
                <td>{formatBytes(row.outputBytes)}</td>
                <td>{row.savingsPercent.toFixed(1)}%</td>
                <td>{row.workerMs} ms</td>
                <td>{row.wallMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {averages && (
        <p className="benchSummary">
          Average savings: {averages.avgSavings.toFixed(1)}% · Average worker time: {Math.round(averages.avgWorkerMs)} ms
          · Average wall time: {Math.round(averages.avgWallMs)} ms
        </p>
      )}
    </section>
  );
}

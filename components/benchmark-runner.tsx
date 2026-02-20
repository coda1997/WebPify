"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cancelActiveEncoding,
  disposeEncoderWorker,
  encodeImageWithWorker,
  isEncodingCancelledError,
} from "@/lib/worker-client";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, XCircle, Activity, Clock, HardDrive, Percent } from "lucide-react";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-slate-600">
          One-click benchmark for three synthetic images at quality <strong className="text-slate-900">{BENCHMARK_QUALITY}</strong>.
          Use this to compare encode latency and size savings across devices.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={runBenchmark}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          {isRunning ? (
            <><Activity className="mr-2 h-4 w-4 animate-pulse" /> Running...</>
          ) : (
            <><Play className="mr-2 h-4 w-4" /> Run Benchmark</>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancelBenchmark}
          disabled={!isRunning}
          className="text-slate-600"
        >
          <XCircle className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>

      <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
        errorMessage ? "bg-red-50 text-red-700 border border-red-100" :
        isRunning ? "bg-blue-50 text-blue-700 border border-blue-100" :
        rows.length > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
        "bg-slate-50 text-slate-600 border border-slate-100"
      }`} role="status" aria-live="polite">
        <Activity className={`h-4 w-4 mt-0.5 shrink-0 ${isRunning ? "animate-pulse" : ""}`} />
        <span className="leading-tight">{errorMessage ?? statusText}</span>
      </div>

      <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">Dimensions</th>
                <th className="px-4 py-3 font-semibold">Input</th>
                <th className="px-4 py-3 font-semibold">Output</th>
                <th className="px-4 py-3 font-semibold">Savings</th>
                <th className="px-4 py-3 font-semibold">Worker</th>
                <th className="px-4 py-3 font-semibold">Wall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No results yet. Click &quot;Run Benchmark&quot; to start.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-4 py-3 text-slate-600">{row.dimensions}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(row.inputBytes)}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{formatBytes(row.outputBytes)}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{row.savingsPercent.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-600">{row.workerMs} ms</td>
                  <td className="px-4 py-3 text-slate-600">{row.wallMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {averages && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Savings</p>
                <p className="text-xl font-bold text-slate-900">{averages.avgSavings.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Worker Time</p>
                <p className="text-xl font-bold text-slate-900">{Math.round(averages.avgWorkerMs)} ms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Wall Time</p>
                <p className="text-xl font-bold text-slate-900">{Math.round(averages.avgWallMs)} ms</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/format";
import { UploadCloud, Image as ImageIcon, Settings2, Download, CheckCircle2, AlertCircle, XCircle, RefreshCw, Trash2, FileImage, ArrowRight, Sparkles } from "lucide-react";
import {
  cancelActiveEncoding,
  disposeEncoderWorker,
  encodeImageWithWorker,
  isEncodingCancelledError,
} from "@/lib/worker-client";

type ConversionResult = {
  fileName: string;
  url: string;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
  width: number;
  height: number;
};

type QueueItem = {
  id: string;
  file: File;
  status: "queued" | "processing" | "done" | "error" | "cancelled";
  result?: ConversionResult;
  sourcePreviewUrl?: string;
  errorMessage?: string;
};

type QueueFilter = "all" | "processing" | "done" | "failed";

const QUALITY_PRESETS = [
  { label: "Web", value: 55 },
  { label: "Email", value: 72 },
  { label: "Max Quality", value: 90 },
] as const;

export function UploadShell() {
  const [quality, setQuality] = useState(75);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"side-by-side" | "compare">("compare");
  const [comparePosition, setComparePosition] = useState(50);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const compareCanvasRef = useRef<HTMLDivElement | null>(null);
  const isDraggingCompareRef = useRef(false);
  const resultUrlsRef = useRef<string[]>([]);
  const sourcePreviewUrlsRef = useRef<string[]>([]);
  const cancellationRequestedRef = useRef(false);

  const fileInfo = useMemo(() => {
    if (queueItems.length === 0) {
      return "No file selected";
    }

    if (queueItems.length === 1) {
      return `${queueItems[0].file.name} (${formatBytes(queueItems[0].file.size)})`;
    }

    const totalBytes = queueItems.reduce((sum, item) => sum + item.file.size, 0);
    return `${queueItems.length} files (${formatBytes(totalBytes)})`;
  }, [queueItems]);

  useEffect(() => {
    return () => {
      for (const url of resultUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      for (const url of sourcePreviewUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      cancelActiveEncoding();
      disposeEncoderWorker();
    };
  }, []);

  useEffect(() => {
    if (!selectedPreviewId) {
      return;
    }

    const hasSelectedDoneItem = queueItems.some((item) => item.id === selectedPreviewId && item.status === "done");
    if (!hasSelectedDoneItem) {
      setSelectedPreviewId(null);
    }
  }, [queueItems, selectedPreviewId]);

  const completedItems = queueItems.filter((item) => item.status === "done" && item.result);
  const completedCount = completedItems.length;
  const failedCount = queueItems.filter((item) => item.status === "error").length;
  const cancelledCount = queueItems.filter((item) => item.status === "cancelled").length;
  const executableCount = queueItems.filter((item) => item.status !== "done" && item.status !== "processing").length;

  const selectedResultItem = useMemo(() => {
    if (selectedPreviewId) {
      const selected = queueItems.find((item) => item.id === selectedPreviewId && item.status === "done" && item.result);
      if (selected) {
        return selected;
      }
    }

    for (let index = queueItems.length - 1; index >= 0; index -= 1) {
      const item = queueItems[index];
      if (item.status === "done" && item.result) {
        return item;
      }
    }

    return null;
  }, [queueItems, selectedPreviewId]);

  const latestResult = selectedResultItem?.result ?? null;
  const latestSourcePreviewUrl = selectedResultItem?.sourcePreviewUrl ?? null;
  const processingItem = queueItems.find((item) => item.status === "processing");
  const visibleQueueItems = queueItems.filter((item) => {
    if (queueFilter === "all") {
      return true;
    }
    if (queueFilter === "processing") {
      return item.status === "processing";
    }
    if (queueFilter === "done") {
      return item.status === "done";
    }
    return item.status === "error";
  });

  function revokeItemUrls(item: QueueItem) {
    if (item.result?.url) {
      URL.revokeObjectURL(item.result.url);
    }
    if (item.sourcePreviewUrl) {
      URL.revokeObjectURL(item.sourcePreviewUrl);
    }
  }

  function clearQueueResults() {
    for (const url of resultUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    resultUrlsRef.current = [];
    for (const url of sourcePreviewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    sourcePreviewUrlsRef.current = [];
    setSelectedPreviewId(null);
    setComparePosition(50);
    setQueueItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "queued",
        result: undefined,
        sourcePreviewUrl: undefined,
        errorMessage: undefined,
      })),
    );
  }

  function applySelectedFiles(files: File[]) {
    if (files.length === 0) {
      setQueueItems([]);
      setErrorMessage(null);
      return;
    }

    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    if (validFiles.length === 0) {
      setQueueItems([]);
      setErrorMessage("Please select an image file.");
      return;
    }

    const skipped = files.length - validFiles.length;

    clearQueueResults();
    setQueueItems(
      validFiles.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        status: "queued",
      })),
    );
    setErrorMessage(skipped > 0 ? `${skipped} non-image file(s) were skipped.` : null);
    setIsCancelled(false);
    setQueueFilter("all");
  }

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    applySelectedFiles(files);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    applySelectedFiles(files);
  }

  function onDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function onDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function onConvert() {
    if (queueItems.length === 0 || isConverting || executableCount === 0) {
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setIsCancelled(false);
    cancellationRequestedRef.current = false;
    let workingQueue: QueueItem[] = queueItems.map((item) => ({
      ...item,
      status: item.status === "done" ? "done" : "queued",
      result: item.status === "done" ? item.result : undefined,
      sourcePreviewUrl: item.status === "done" ? item.sourcePreviewUrl : undefined,
      errorMessage: undefined,
    }));
    setQueueItems(workingQueue);
    let firstError: string | null = null;

    try {
      for (let index = 0; index < workingQueue.length; index += 1) {
        if (workingQueue[index].status === "done") {
          continue;
        }

        if (cancellationRequestedRef.current) {
          workingQueue = workingQueue.map((item) =>
            item.status === "queued" ? { ...item, status: "cancelled" } : item,
          );
          setQueueItems([...workingQueue]);
          setIsCancelled(true);
          break;
        }

        const queueItem = workingQueue[index];
        workingQueue[index] = { ...queueItem, status: "processing", errorMessage: undefined, result: undefined };
        setQueueItems([...workingQueue]);

        try {
          const inputBuffer = await queueItem.file.arrayBuffer();
          const response = await encodeImageWithWorker({
            fileName: queueItem.file.name,
            mimeType: queueItem.file.type,
            buffer: inputBuffer,
            quality,
          });

          const outputBlob = new Blob([response.outputBuffer], { type: "image/webp" });
          const outputUrl = URL.createObjectURL(outputBlob);
          resultUrlsRef.current.push(outputUrl);
          const sourcePreviewUrl = URL.createObjectURL(queueItem.file);
          sourcePreviewUrlsRef.current.push(sourcePreviewUrl);

          const nextResult: ConversionResult = {
            fileName: response.fileName,
            url: outputUrl,
            inputBytes: response.inputBytes,
            outputBytes: response.outputBytes,
            durationMs: response.durationMs,
            width: response.width,
            height: response.height,
          };

          workingQueue[index] = {
            ...queueItem,
            status: "done",
            result: nextResult,
            sourcePreviewUrl,
          };

          setSelectedPreviewId(queueItem.id);
          setQueueItems([...workingQueue]);
        } catch (error) {
          if (isEncodingCancelledError(error)) {
            workingQueue[index] = { ...queueItem, status: "cancelled" };
            workingQueue = workingQueue.map((item) =>
              item.status === "queued" ? { ...item, status: "cancelled" } : item,
            );
            setQueueItems([...workingQueue]);
            setIsCancelled(true);
            break;
          }

          const fallback = "Failed to convert image. Please try a different file.";
          const message = error instanceof Error ? error.message : fallback;
          if (!firstError) {
            firstError = message;
          }

          workingQueue[index] = {
            ...queueItem,
            status: "error",
            errorMessage: message,
          };
          setQueueItems([...workingQueue]);
        }
      }

      if (firstError) {
        setErrorMessage(firstError);
      }
    } catch (error) {
      if (isEncodingCancelledError(error)) {
        setIsCancelled(true);
        return;
      }

      const fallback = "Failed to convert image. Please try a different file.";
      setErrorMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setIsConverting(false);
    }
  }

  function onReset() {
    if (isConverting) {
      cancellationRequestedRef.current = true;
      cancelActiveEncoding();
      return;
    }

    clearQueueResults();
    setQueueItems([]);
    setErrorMessage(null);
    setIsCancelled(false);
    setQueueFilter("all");
    setSelectedPreviewId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function onRemoveQueueItem(itemId: string) {
    if (isConverting) {
      return;
    }

    setQueueItems((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target) {
        revokeItemUrls(target);
      }
      return prev.filter((item) => item.id !== itemId);
    });
  }

  function onRetryFailed() {
    if (isConverting) {
      return;
    }

    setErrorMessage(null);
    setIsCancelled(false);
    setQueueItems((prev) =>
      prev.map((item) => (item.status === "error" || item.status === "cancelled" ? { ...item, status: "queued", errorMessage: undefined } : item)),
    );
  }

  function onClearCompleted() {
    if (isConverting) {
      return;
    }

    setQueueItems((prev) => {
      for (const item of prev) {
        if (item.status === "done") {
          revokeItemUrls(item);
        }
      }
      return prev.filter((item) => item.status !== "done");
    });
    setSelectedPreviewId(null);
    setComparePosition(50);
  }

  function onSelectPreview(item: QueueItem) {
    if (item.status !== "done") {
      setErrorMessage("Preview available after conversion.");
      return;
    }

    setErrorMessage(null);
    setSelectedPreviewId(item.id);
  }

  function triggerBrowserDownload(url: string, fileName: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  async function onDownloadAll() {
    if (isConverting || completedItems.length === 0 || isDownloadingAll) {
      return;
    }

    if (completedItems.length === 1) {
      const onlyItem = completedItems[0];
      if (!onlyItem.result) {
        return;
      }
      triggerBrowserDownload(onlyItem.result.url, onlyItem.result.fileName);
      return;
    }

    setIsDownloadingAll(true);
    setErrorMessage(null);

    try {
      const zip = new JSZip();

      for (const item of completedItems) {
        if (!item.result) {
          continue;
        }
        const response = await fetch(item.result.url);
        const blob = await response.blob();
        zip.file(item.result.fileName, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      triggerBrowserDownload(zipUrl, "webpify-exports.zip");
      window.setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
      }, 1000);
    } catch {
      setErrorMessage("Failed to prepare ZIP download. Please download files individually.");
    } finally {
      setIsDownloadingAll(false);
    }
  }

  function onDropzoneKeyDown(event: React.KeyboardEvent<HTMLLabelElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    inputRef.current?.click();
  }

  function updateComparePositionFromClientX(clientX: number) {
    const canvas = compareCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }

    const nextPosition = ((clientX - rect.left) / rect.width) * 100;
    setComparePosition(Math.min(100, Math.max(0, Math.round(nextPosition))));
  }

  function onComparePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    isDraggingCompareRef.current = true;
    updateComparePositionFromClientX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onComparePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingCompareRef.current) {
      return;
    }

    updateComparePositionFromClientX(event.clientX);
  }

  function onComparePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    isDraggingCompareRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const canConvert = queueItems.length > 0 && !isConverting && executableCount > 0;
  const canReset = queueItems.length > 0 || isConverting;
  const canRetryFailed = !isConverting && (failedCount > 0 || cancelledCount > 0);
  const canClearCompleted = !isConverting && completedCount > 0;
  const canDownloadAll = !isConverting && completedCount > 0 && !isDownloadingAll;
  const currentStep = latestResult ? 3 : queueItems.length > 0 ? 2 : 1;
  const ratio =
    latestResult && latestResult.inputBytes > 0
      ? Math.max(0, ((latestResult.inputBytes - latestResult.outputBytes) / latestResult.inputBytes) * 100)
      : 0;

  let statusText = "Ready. Select an image to begin.";
  if (isConverting) {
    statusText = processingItem
      ? `Converting ${processingItem.file.name} (${completedCount + 1}/${queueItems.length})... keep this tab open.`
      : "Converting images in Web Worker... keep this tab open.";
  } else if (isDownloadingAll) {
    statusText = "Preparing ZIP download...";
  } else if (isCancelled) {
    statusText = `Conversion cancelled. Completed ${completedCount}/${queueItems.length}.`;
  } else if (errorMessage) {
    statusText = errorMessage;
  } else if (latestResult) {
    if (failedCount > 0 || cancelledCount > 0) {
      statusText = `Completed ${completedCount}/${queueItems.length}. ${failedCount} failed.`;
    } else {
      statusText = `Done. Converted ${completedCount}/${queueItems.length} file(s).`;
    }
  } else {
    statusText = "Select or drop images to start. Processing stays in your browser.";
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* Left Panel: Configuration & Queue */}
      <div className="flex flex-col gap-6 sticky top-24">
        <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-5 flex flex-col gap-6">
            {/* Steps */}
            <ol className="flex items-center justify-between w-full text-sm font-medium text-slate-500" aria-label="Conversion steps">
              <li className={`flex items-center gap-2 ${currentStep >= 1 ? "text-blue-600" : ""}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${currentStep >= 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100"}`}>1</span>
                <span className="hidden sm:inline">Upload</span>
              </li>
              <li className="h-px w-8 bg-slate-200"></li>
              <li className={`flex items-center gap-2 ${currentStep >= 2 ? "text-blue-600" : ""}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${currentStep >= 2 ? "bg-blue-100 text-blue-700" : "bg-slate-100"}`}>2</span>
                <span className="hidden sm:inline">Tune</span>
              </li>
              <li className="h-px w-8 bg-slate-200"></li>
              <li className={`flex items-center gap-2 ${currentStep >= 3 ? "text-blue-600" : ""}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${currentStep >= 3 ? "bg-blue-100 text-blue-700" : "bg-slate-100"}`}>3</span>
                <span className="hidden sm:inline">Download</span>
              </li>
            </ol>

            {/* Dropzone */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="image-upload"
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer
                  ${isDragActive ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-slate-50"}
                  focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                tabIndex={0}
                onKeyDown={onDropzoneKeyDown}
                aria-describedby="upload-help"
              >
                <div className={`rounded-full p-3 ${isDragActive ? "bg-blue-100 text-blue-600" : "bg-white text-slate-400 shadow-sm"}`}>
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <strong className="block text-sm font-semibold text-slate-700">Drop images here or click</strong>
                  <small id="upload-help" className="text-xs text-slate-500">PNG, JPEG, WebP supported</small>
                </div>
              </label>
              <input
                ref={inputRef}
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={onSelectFile}
                className="sr-only"
              />
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1.5"><FileImage className="h-3.5 w-3.5" /> {fileInfo}</span>
                <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> Local</span>
              </div>
            </div>

            {/* Quality Settings */}
            <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between">
                <label htmlFor="quality" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-slate-400" /> Quality
                </label>
                <span className="inline-flex h-6 w-8 items-center justify-center rounded-md bg-white text-xs font-bold text-slate-700 shadow-sm border border-slate-200">
                  {quality}
                </span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[quality]}
                disabled={isConverting}
                onValueChange={(value) => setQuality(value[0] ?? quality)}
                aria-label="Quality"
                className="py-2"
              />
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quality presets">
                {QUALITY_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={quality === preset.value ? "default" : "outline"}
                    size="sm"
                    className={`h-8 text-xs ${quality === preset.value ? "bg-blue-600 hover:bg-blue-700" : "bg-white"}`}
                    disabled={isConverting}
                    onClick={() => setQuality(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {completedCount > 0 && !isConverting ? (
                <Button
                  type="button"
                  disabled={!canDownloadAll}
                  onClick={onDownloadAll}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-11"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isDownloadingAll ? "Preparing ZIP..." : completedCount > 1 ? "Download All (ZIP)" : "Download WebP"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!canConvert}
                  onClick={onConvert}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-11"
                >
                  {isConverting ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Converting...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Convert Images</>
                  )}
                </Button>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={!canReset} onClick={onReset} className="flex-1 h-9 text-xs">
                  {isConverting ? "Cancel" : "Reset"}
                </Button>
                {canRetryFailed && (
                  <Button type="button" variant="outline" onClick={onRetryFailed} className="flex-1 h-9 text-xs text-amber-600 hover:text-amber-700">
                    Retry Failed
                  </Button>
                )}
                {canClearCompleted && (
                  <Button type="button" variant="outline" onClick={onClearCompleted} className="flex-1 h-9 text-xs text-slate-500">
                    Clear Done
                  </Button>
                )}
              </div>
            </div>

            {/* Status Message */}
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              errorMessage ? "bg-red-50 text-red-700 border border-red-100" :
              isConverting ? "bg-blue-50 text-blue-700 border border-blue-100" :
              latestResult ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
              "bg-slate-50 text-slate-600 border border-slate-100"
            }`} role="status" aria-live="polite">
              {errorMessage ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> :
               isConverting ? <RefreshCw className="h-4 w-4 mt-0.5 shrink-0 animate-spin" /> :
               latestResult ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> :
               <ImageIcon className="h-4 w-4 mt-0.5 shrink-0" />}
              <span className="leading-tight">{statusText}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Results & Preview */}
      <div className="flex flex-col gap-6">
        {/* Queue List */}
        {queueItems.length > 0 && (
          <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm">Batch Queue</h3>
                <Badge variant="secondary" className="bg-white text-slate-500 font-normal text-xs">
                  {completedCount}/{queueItems.length} done
                </Badge>
              </div>
              <div className="flex bg-slate-200/50 p-0.5 rounded-lg" role="tablist">
                {(["all", "processing", "done", "failed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                      queueFilter === filter ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setQueueFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-[280px] overflow-y-auto p-2 space-y-1">
              {visibleQueueItems.map((item) => (
                <li
                  key={item.id}
                  className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                    selectedPreviewId === item.id
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => onSelectPreview(item)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      item.status === "done" ? "bg-emerald-100 text-emerald-600" :
                      item.status === "processing" ? "bg-blue-100 text-blue-600" :
                      item.status === "error" ? "bg-red-100 text-red-600" :
                      "bg-slate-100 text-slate-400"
                    }`}>
                      {item.status === "done" ? <CheckCircle2 className="h-4 w-4" /> :
                       item.status === "processing" ? <RefreshCw className="h-4 w-4 animate-spin" /> :
                       item.status === "error" ? <XCircle className="h-4 w-4" /> :
                       <ImageIcon className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm font-medium text-slate-700">{item.file.name}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        {formatBytes(item.file.size)}
                        {item.result && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-emerald-600 font-medium">{formatBytes(item.result.outputBytes)}</span>
                            <span className="text-slate-400">
                              (-{Math.max(0, ((item.result.inputBytes - item.result.outputBytes) / item.result.inputBytes) * 100).toFixed(0)}%)
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.result && (
                      <a
                        href={item.result.url}
                        download={item.result.fileName}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {!isConverting && item.status !== "processing" && (
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveQueueItem(item.id);
                        }}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {visibleQueueItems.length === 0 && (
                <li className="py-8 text-center text-sm text-slate-500">
                  No items found for this filter.
                </li>
              )}
            </ul>
          </Card>
        )}

        {/* Preview Area */}
        <Card className="border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
          {latestResult && latestSourcePreviewUrl ? (
            <>
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Savings</span>
                    <span className="text-lg font-bold text-emerald-600">{ratio.toFixed(1)}%</span>
                  </div>
                  <div className="h-8 w-px bg-slate-200"></div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Size</span>
                    <span className="text-sm font-medium text-slate-700">
                      {formatBytes(latestResult.inputBytes)} <ArrowRight className="inline h-3 w-3 text-slate-400" /> {formatBytes(latestResult.outputBytes)}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                  <div className="flex flex-col hidden sm:flex">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Time</span>
                    <span className="text-sm font-medium text-slate-700">{latestResult.durationMs}ms</span>
                  </div>
                </div>
                <Tabs
                  value={previewMode}
                  onValueChange={(value) => setPreviewMode(value as "side-by-side" | "compare")}
                  className="w-auto"
                >
                  <TabsList className="h-8 bg-slate-200/50">
                    <TabsTrigger value="compare" className="text-xs px-3 py-1">Compare</TabsTrigger>
                    <TabsTrigger value="side-by-side" className="text-xs px-3 py-1">Side by Side</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 relative bg-slate-100/50 p-4 flex items-center justify-center min-h-[300px]">
                {previewMode === "side-by-side" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full h-full">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Original</span>
                        <span className="text-xs text-slate-400">{latestResult.width}×{latestResult.height}</span>
                      </div>
                      <div className="relative flex-1 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm min-h-[200px]">
                        <Image
                          src={latestSourcePreviewUrl}
                          alt="Original preview"
                          className="object-contain"
                          fill
                          unoptimized
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">WebP</span>
                        <span className="text-xs text-slate-400">{latestResult.width}×{latestResult.height}</span>
                      </div>
                      <div className="relative flex-1 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm min-h-[200px]">
                        <Image
                          src={latestResult.url}
                          alt="Compressed preview"
                          className="object-contain"
                          fill
                          unoptimized
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col w-full h-full gap-4">
                    <div
                      className="relative flex-1 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm cursor-ew-resize select-none min-h-[300px]"
                      ref={compareCanvasRef}
                      onPointerDown={onComparePointerDown}
                      onPointerMove={onComparePointerMove}
                      onPointerUp={onComparePointerUp}
                      onPointerCancel={onComparePointerUp}
                    >
                      <Image
                        src={latestSourcePreviewUrl}
                        alt="Original preview"
                        className="object-contain"
                        fill
                        unoptimized
                        draggable={false}
                      />
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                      >
                        <Image
                          src={latestResult.url}
                          alt="Compressed preview"
                          className="object-contain"
                          fill
                          unoptimized
                          draggable={false}
                        />
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.3)] z-10"
                        style={{ left: `${comparePosition}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                        </div>
                      </div>

                      {/* Labels overlay */}
                      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium">
                        Original
                      </div>
                      <div className="absolute top-3 right-3 bg-blue-600/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium">
                        WebP
                      </div>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[comparePosition]}
                      onValueChange={(value) => setComparePosition(value[0] ?? comparePosition)}
                      aria-label="Compare position"
                      className="max-w-md mx-auto"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-400">
              <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">Upload and convert images to see the preview and stats here.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/format";
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
  errorMessage?: string;
};

const QUALITY_PRESETS = [
  { label: "Web", value: 55 },
  { label: "Email", value: 72 },
  { label: "Max Quality", value: 90 },
] as const;

export function UploadShell() {
  const [quality, setQuality] = useState(75);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ConversionResult | null>(null);
  const [latestSourcePreviewUrl, setLatestSourcePreviewUrl] = useState<string | null>(null);
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

  const completedCount = queueItems.filter((item) => item.status === "done").length;
  const processingItem = queueItems.find((item) => item.status === "processing");

  function clearQueueResults() {
    for (const url of resultUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    resultUrlsRef.current = [];
    for (const url of sourcePreviewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    sourcePreviewUrlsRef.current = [];
    setLatestSourcePreviewUrl(null);
    setComparePosition(50);
    setLatestResult(null);
    setQueueItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "queued",
        result: undefined,
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
    if (queueItems.length === 0 || isConverting) {
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setIsCancelled(false);
    cancellationRequestedRef.current = false;
    clearQueueResults();

    let workingQueue: QueueItem[] = queueItems.map((item) => ({
      ...item,
      status: "queued",
      result: undefined,
      errorMessage: undefined,
    }));
    setQueueItems(workingQueue);
    let firstError: string | null = null;

    try {
      for (let index = 0; index < workingQueue.length; index += 1) {
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
          };

          setLatestResult(nextResult);
          setLatestSourcePreviewUrl(sourcePreviewUrl);
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
    setLatestResult(null);
    setErrorMessage(null);
    setIsCancelled(false);
    if (inputRef.current) {
      inputRef.current.value = "";
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

  const canConvert = queueItems.length > 0 && !isConverting;
  const canReset = queueItems.length > 0 || Boolean(latestResult) || isConverting;
  const currentStep = latestResult ? 3 : queueItems.length > 0 ? 2 : 1;
  const ratio =
    latestResult && latestResult.inputBytes > 0
      ? Math.max(0, ((latestResult.inputBytes - latestResult.outputBytes) / latestResult.inputBytes) * 100)
      : 0;
  const outputName = latestResult?.fileName ?? "image.webp";

  let statusText = "Ready. Select an image to begin.";
  if (isConverting) {
    statusText = processingItem
      ? `Converting ${processingItem.file.name} (${completedCount + 1}/${queueItems.length})... keep this tab open.`
      : "Converting images in Web Worker... keep this tab open.";
  } else if (isCancelled) {
    statusText = "Conversion cancelled.";
  } else if (errorMessage) {
    statusText = errorMessage;
  } else if (latestResult) {
    statusText = `Done. Converted ${completedCount}/${queueItems.length} file(s). Download your latest WebP next.`;
  } else {
    statusText = "Select or drop an image to start. Processing stays in your browser.";
  }

  return (
    <div className="shell">
      <div className="shellLayout">
        <Card className="configPanel">
          <CardContent className="grid gap-4 p-4 pt-4">
          <ol className="steps" aria-label="Conversion steps">
            <li className={`step ${currentStep === 1 ? "active" : ""} ${currentStep > 1 ? "done" : ""}`}>
              Upload image
            </li>
            <li className={`step ${currentStep === 2 ? "active" : ""} ${currentStep > 2 ? "done" : ""}`}>
              Tune quality
            </li>
            <li className={`step ${currentStep === 3 ? "active" : ""}`}>
              Download WebP
            </li>
          </ol>

          <div className="field">
            <label
              htmlFor="image-upload"
              className={`dropzone ${isDragActive ? "dragActive" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              tabIndex={0}
              onKeyDown={onDropzoneKeyDown}
              aria-describedby="upload-help"
            >
              <strong>Drop image here or click to choose</strong>
              <small id="upload-help">PNG, JPEG, and browser-supported image files</small>
            </label>
            <input
              ref={inputRef}
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={onSelectFile}
              className="visuallyHidden"
            />
            <small>{fileInfo}</small>
            <p className="trust">Runs locally in your browser. No upload required.</p>
          </div>

          <div className="field">
            <div className="row">
              <label htmlFor="quality">Quality</label>
              <strong>{quality}</strong>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[quality]}
              disabled={isConverting}
              onValueChange={(value) => setQuality(value[0] ?? quality)}
              aria-label="Quality"
            />
            <small id="quality-help">Higher quality usually means larger files. Presets are intent-focused.</small>
            <div className="presets" role="group" aria-label="Quality presets">
              {QUALITY_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant={quality === preset.value ? "default" : "secondary"}
                  size="sm"
                  className="presetBtn"
                  disabled={isConverting}
                  onClick={() => setQuality(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="row actions actionsSticky">
            {latestResult && !isConverting ? (
              <a className="buttonLike" href={latestResult.url} download={outputName}>
                Download WebP
              </a>
            ) : (
              <Button type="button" disabled={!canConvert} onClick={onConvert}>
                {isConverting ? "Converting..." : "Convert to WebP"}
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={!canReset} onClick={onReset}>
              {isConverting ? "Cancel" : "Reset"}
            </Button>
          </div>

          <p className="status" role="status" aria-live="polite">
            {statusText}
          </p>

          {queueItems.length > 0 && (
            <section className="queue" aria-live="polite">
              <div className="row">
                <strong>Batch Queue</strong>
                <small>
                  {completedCount}/{queueItems.length} completed
                </small>
              </div>
              <ul className="queueList">
                {queueItems.map((item) => (
                  <li key={item.id} className="queueItem">
                    <div className="queueMeta">
                      <p className="queueName">{item.file.name}</p>
                      <small>{formatBytes(item.file.size)}</small>
                    </div>
                    <div className="queueState">
                      <span className={`statusPill status-${item.status}`}>{item.status}</span>
                      {item.result && (
                        <a className="queueDownload" href={item.result.url} download={item.result.fileName}>
                          Download
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </CardContent>
        </Card>

        <Card className="result resultPanel">
        <CardContent className="grid gap-4 p-4 pt-4" aria-live="polite">
        <div className="resultTop">
          {latestResult && (
            <div className="outcome">
              <Badge className="savingsBadge">You saved {ratio.toFixed(1)}%</Badge>
              <small>
                {formatBytes(latestResult.inputBytes)} → {formatBytes(latestResult.outputBytes)} in {latestResult.durationMs} ms
              </small>
            </div>
          )}

          <div className="field resultOutput">
            <small>Output</small>
            <span className="outputName">{outputName}</span>
          </div>
        </div>

        <div className="stats">
          <div>
            <small>Before</small>
            <p>{latestResult ? formatBytes(latestResult.inputBytes) : "-"}</p>
          </div>
          <div>
            <small>After</small>
            <p>{latestResult ? `${formatBytes(latestResult.outputBytes)} • ${ratio.toFixed(1)}% saved` : "-"}</p>
          </div>
          <div>
            <small>Duration</small>
            <p>{latestResult ? `${latestResult.durationMs} ms` : "-"}</p>
          </div>
        </div>

        {latestResult && latestSourcePreviewUrl && (
          <>
            <Tabs
              value={previewMode}
              onValueChange={(value) => setPreviewMode(value as "side-by-side" | "compare")}
              className="previewModeBar"
            >
              <TabsList>
                <TabsTrigger value="compare">Compare</TabsTrigger>
                <TabsTrigger value="side-by-side">Side by side</TabsTrigger>
              </TabsList>
            </Tabs>

            {previewMode === "side-by-side" ? (
              <div className="previewCompare">
                <div className="previewPane">
                  <div className="previewPaneMeta">
                    <strong>Original</strong>
                    <small>
                      {latestResult.width}×{latestResult.height}
                    </small>
                  </div>
                  <div className="previewWrap">
                    <Image
                      src={latestSourcePreviewUrl}
                      alt="Original preview for latest selected image"
                      className="preview"
                      width={1200}
                      height={900}
                      unoptimized
                    />
                  </div>
                </div>

                <div className="previewPane">
                  <div className="previewPaneMeta">
                    <strong>Compressed</strong>
                    <small>
                      {latestResult.width}×{latestResult.height}
                    </small>
                  </div>
                  <div className="previewWrap">
                    <Image
                      src={latestResult.url}
                      alt="Compressed preview for latest output"
                      className="preview"
                      width={1200}
                      height={900}
                      unoptimized
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="compareSection">
                <div
                  className="compareCanvas"
                  ref={compareCanvasRef}
                  onPointerDown={onComparePointerDown}
                  onPointerMove={onComparePointerMove}
                  onPointerUp={onComparePointerUp}
                  onPointerCancel={onComparePointerUp}
                >
                  <Image
                    src={latestSourcePreviewUrl}
                    alt="Original preview for compare mode"
                    className="compareImage"
                    fill
                    unoptimized
                  />
                  <div className="compareOverlay" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                    <Image
                      src={latestResult.url}
                      alt="Compressed preview for compare mode"
                      className="compareImage"
                      fill
                      unoptimized
                    />
                  </div>
                  <div className="compareDivider" style={{ left: `${comparePosition}%` }}>
                    <span className="compareHandle" />
                  </div>
                </div>
                <div className="row compareMeta">
                  <small>Original</small>
                  <small>
                    {latestResult.width}×{latestResult.height}
                  </small>
                  <small>Compressed</small>
                </div>
                <label className="compareSliderLabel" htmlFor="compare-slider">
                  Compare position: {comparePosition}%
                </label>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[comparePosition]}
                  onValueChange={(value) => setComparePosition(value[0] ?? comparePosition)}
                  aria-label="Compare position"
                />
              </div>
            )}
          </>
        )}

        {!latestResult && <small>Convert images to see latest output stats and preview.</small>}
      </CardContent>
      </Card>
      </div>
    </div>
  );
}

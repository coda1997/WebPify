"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultUrlsRef = useRef<string[]>([]);
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

          const nextResult: ConversionResult = {
            fileName: response.fileName,
            url: outputUrl,
            inputBytes: response.inputBytes,
            outputBytes: response.outputBytes,
            durationMs: response.durationMs,
          };

          workingQueue[index] = {
            ...queueItem,
            status: "done",
            result: nextResult,
          };

          setLatestResult(nextResult);
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
        <input
          id="quality"
          type="range"
          min={1}
          max={100}
          value={quality}
          disabled={isConverting}
          onChange={(event) => setQuality(Number(event.target.value))}
          aria-describedby="quality-help"
        />
        <small id="quality-help">Higher quality usually means larger files. Presets are intent-focused.</small>
        <div className="presets" role="group" aria-label="Quality presets">
          {QUALITY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`presetBtn ${quality === preset.value ? "active" : ""}`}
              disabled={isConverting}
              onClick={() => setQuality(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row actions actionsSticky">
        {latestResult && !isConverting ? (
          <a className="buttonLike" href={latestResult.url} download={outputName}>
            Download WebP
          </a>
        ) : (
          <button type="button" disabled={!canConvert} onClick={onConvert}>
            {isConverting ? "Converting..." : "Convert to WebP"}
          </button>
        )}
        <button type="button" disabled={!canReset} onClick={onReset}>
          {isConverting ? "Cancel" : "Reset"}
        </button>
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

      <section className="result" aria-live="polite">
        {latestResult && (
          <div className="outcome">
            <p className="savingsBadge">You saved {ratio.toFixed(1)}%</p>
            <small>
              {formatBytes(latestResult.inputBytes)} → {formatBytes(latestResult.outputBytes)} in {latestResult.durationMs} ms
            </small>
          </div>
        )}

        <div className="field">
          <strong>Output</strong>
          <span>{outputName}</span>
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

        {latestResult && (
          <div className="previewWrap">
            <Image
              src={latestResult.url}
              alt="Converted preview for latest output"
              className="preview"
              width={1200}
              height={900}
              unoptimized
            />
          </div>
        )}

        {!latestResult && <small>Convert images to see latest output stats and preview.</small>}
      </section>
    </div>
  );
}

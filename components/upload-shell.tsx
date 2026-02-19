"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toWebpFilename } from "@/lib/file-name";
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

const QUALITY_PRESETS = [
  { label: "Low", value: 45 },
  { label: "Medium", value: 70 },
  { label: "High", value: 85 },
] as const;

export function UploadShell() {
  const [quality, setQuality] = useState(75);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestResultUrlRef = useRef<string | null>(null);

  const fileInfo = useMemo(() => {
    if (!selectedFile) {
      return "No file selected";
    }

    return `${selectedFile.name} (${formatBytes(selectedFile.size)})`;
  }, [selectedFile]);

  useEffect(() => {
    latestResultUrlRef.current = result?.url ?? null;
  }, [result]);

  useEffect(() => {
    return () => {
      if (latestResultUrlRef.current) {
        URL.revokeObjectURL(latestResultUrlRef.current);
      }
      cancelActiveEncoding();
      disposeEncoderWorker();
    };
  }, []);

  function clearPreviousResult() {
    if (latestResultUrlRef.current) {
      URL.revokeObjectURL(latestResultUrlRef.current);
      latestResultUrlRef.current = null;
    }
    setResult(null);
  }

  function applySelectedFile(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      setErrorMessage(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      return;
    }

    clearPreviousResult();
    setSelectedFile(file);
    setErrorMessage(null);
    setIsCancelled(false);
  }

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    applySelectedFile(file);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    applySelectedFile(file);
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
    if (!selectedFile || isConverting) {
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setIsCancelled(false);
    clearPreviousResult();

    try {
      const inputBuffer = await selectedFile.arrayBuffer();
      const response = await encodeImageWithWorker({
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        buffer: inputBuffer,
        quality,
      });

      const outputBlob = new Blob([response.outputBuffer], { type: "image/webp" });
      const outputUrl = URL.createObjectURL(outputBlob);

      setResult({
        fileName: response.fileName,
        url: outputUrl,
        inputBytes: response.inputBytes,
        outputBytes: response.outputBytes,
        durationMs: response.durationMs,
      });
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
      cancelActiveEncoding();
      setIsConverting(false);
      setIsCancelled(true);
    }

    clearPreviousResult();
    setSelectedFile(null);
    setErrorMessage(null);
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

  const canConvert = Boolean(selectedFile) && !isConverting;
  const canReset = Boolean(selectedFile) || Boolean(result) || isConverting;
  const ratio =
    result && result.inputBytes > 0
      ? Math.max(0, ((result.inputBytes - result.outputBytes) / result.inputBytes) * 100)
      : 0;
  const downloadName = selectedFile ? toWebpFilename(selectedFile.name) : "image.webp";
  const outputName = result?.fileName ?? downloadName;

  let statusText = "Ready. Select an image to begin.";
  if (isConverting) {
    statusText = "Converting image in Web Worker...";
  } else if (isCancelled) {
    statusText = "Conversion cancelled.";
  } else if (errorMessage) {
    statusText = errorMessage;
  } else if (result) {
    statusText = `Done. Saved ${ratio.toFixed(1)}% (${formatBytes(result.outputBytes)}).`;
  }

  return (
    <div className="shell">
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
          onChange={onSelectFile}
          className="visuallyHidden"
        />
        <small>{fileInfo}</small>
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
        <small id="quality-help">Higher quality usually means larger file size.</small>
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

      <div className="row actions">
        <button type="button" disabled={!canConvert} onClick={onConvert}>
          {isConverting ? "Converting..." : "Convert to WebP"}
        </button>
        <button type="button" disabled={!canReset} onClick={onReset}>
          {isConverting ? "Cancel" : "Reset"}
        </button>
      </div>

      <p className="status" role="status" aria-live="polite">
        {statusText}
      </p>

      <section className="result" aria-live="polite">
        <div className="field">
          <strong>Output</strong>
          <span>{outputName}</span>
        </div>

        <div className="stats">
          <div>
            <small>Input</small>
            <p>{result ? formatBytes(result.inputBytes) : "-"}</p>
          </div>
          <div>
            <small>Output</small>
            <p>{result ? `${formatBytes(result.outputBytes)} • ${ratio.toFixed(1)}% saved` : "-"}</p>
          </div>
          <div>
            <small>Duration</small>
            <p>{result ? `${result.durationMs} ms` : "-"}</p>
          </div>
        </div>

        {result && (
          <div className="previewWrap">
            <Image
              src={result.url}
              alt={`Converted preview for ${selectedFile?.name ?? "image"}`}
              className="preview"
              width={1200}
              height={900}
              unoptimized
            />
          </div>
        )}

        <a
          className={`download ${result ? "" : "disabled"}`}
          href={result?.url}
          download={outputName}
          aria-disabled={!result}
          onClick={(event) => {
            if (!result) {
              event.preventDefault();
            }
          }}
        >
          Download WebP
        </a>

        {!result && <small>Convert an image to see output stats and preview.</small>}
      </section>

      <small>Conversion runs locally in your browser using WebAssembly.</small>
    </div>
  );
}

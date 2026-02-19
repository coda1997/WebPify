import { encode } from "@jsquash/webp";
import {
  type WorkerRequestMessage,
  type WorkerResponseMessage,
} from "@/lib/worker-protocol";

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequestMessage>) => void) | null;
  postMessage: (message: WorkerResponseMessage, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

function toWebpFilename(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${fileName}.webp`;
  }

  return `${fileName.slice(0, dotIndex)}.webp`;
}

async function encodeWebp(
  buffer: ArrayBuffer,
  mimeType: string,
  quality: number,
): Promise<{ outputBuffer: ArrayBuffer; width: number; height: number }> {
  const sourceBlob = new Blob([buffer], { type: mimeType || "application/octet-stream" });
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to create canvas context.");
    }

    context.drawImage(bitmap, 0, 0);
    const frame = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const outputBuffer = await encode(frame, { quality });
    return { outputBuffer, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequestMessage>) => {
  const message = event.data;

  if (!message || message.type !== "encode") {
    return;
  }

  const postMessage = (payload: WorkerResponseMessage) => {
    workerScope.postMessage(payload);
  };

  const inputBytes = message.buffer.byteLength;
  const startedAt = performance.now();

  try {
    postMessage({ type: "status", id: message.id, stage: "loading" });
    postMessage({ type: "status", id: message.id, stage: "encoding" });

    const { outputBuffer, width, height } = await encodeWebp(message.buffer, message.mimeType, message.quality);
    const durationMs = Math.round(performance.now() - startedAt);

    workerScope.postMessage(
      {
        type: "success",
        id: message.id,
        fileName: toWebpFilename(message.fileName),
        outputBuffer,
        width,
        height,
        inputBytes,
        outputBytes: outputBuffer.byteLength,
        durationMs,
      },
      [outputBuffer],
    );
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Failed to encode image.";
    postMessage({ type: "error", id: message.id, message: messageText });
  }
};

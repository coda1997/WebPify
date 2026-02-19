import type {
  EncodeRequestMessage,
  EncodeSuccessMessage,
  WorkerResponseMessage,
} from "@/lib/worker-protocol";

export type EncodeInput = {
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
  quality: number;
};

let workerInstance: Worker | null = null;
let activeRequestId: string | null = null;
let activeReject: ((reason?: unknown) => void) | null = null;

const CANCELLED_ERROR_CODE = "ENCODE_CANCELLED";

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL("../workers/webp.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  return workerInstance;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function encodeImageWithWorker(input: EncodeInput): Promise<EncodeSuccessMessage> {
  const worker = getWorker();
  const id = createRequestId();

  if (activeRequestId) {
    cancelActiveEncoding();
  }

  return new Promise<EncodeSuccessMessage>((resolve, reject) => {
    activeRequestId = id;
    activeReject = reject;

    const clearActiveRequest = () => {
      if (activeRequestId !== id) {
        return;
      }

      activeRequestId = null;
      activeReject = null;
    };

    const handleMessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const message = event.data;

      if (!message || message.id !== id) {
        return;
      }

      if (message.type === "status") {
        return;
      }

      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      clearActiveRequest();

      if (message.type === "success") {
        resolve(message);
        return;
      }

      reject(new Error(message.message));
    };

    const handleError = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      clearActiveRequest();
      reject(new Error("Worker failed while encoding image."));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const request: EncodeRequestMessage = {
      type: "encode",
      id,
      fileName: input.fileName,
      mimeType: input.mimeType,
      buffer: input.buffer,
      quality: input.quality,
    };

    worker.postMessage(request, [input.buffer]);
  });
}

export function cancelActiveEncoding(): void {
  if (!activeRequestId) {
    return;
  }

  const reject = activeReject;
  activeRequestId = null;
  activeReject = null;

  disposeEncoderWorker();

  if (reject) {
    const error = new Error("Encoding was cancelled.");
    error.name = CANCELLED_ERROR_CODE;
    reject(error);
  }
}

export function isEncodingCancelledError(error: unknown): boolean {
  return error instanceof Error && error.name === CANCELLED_ERROR_CODE;
}

export function disposeEncoderWorker(): void {
  if (!workerInstance) {
    return;
  }

  workerInstance.terminate();
  workerInstance = null;
}

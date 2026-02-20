export type EncodeRequestMessage = {
  type: "encode";
  id: string;
  baseOrigin?: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
  quality: number;
};

export type EncodeStatusMessage = {
  type: "status";
  id: string;
  stage: "loading" | "encoding";
};

export type EncodeSuccessMessage = {
  type: "success";
  id: string;
  fileName: string;
  outputBuffer: ArrayBuffer;
  width: number;
  height: number;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
};

export type EncodeErrorMessage = {
  type: "error";
  id: string;
  message: string;
};

export type WorkerRequestMessage = EncodeRequestMessage;

export type WorkerResponseMessage =
  | EncodeStatusMessage
  | EncodeSuccessMessage
  | EncodeErrorMessage;

export function isWorkerResponseMessage(value: unknown): value is WorkerResponseMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as { type?: string };
  return (
    maybeMessage.type === "status" ||
    maybeMessage.type === "success" ||
    maybeMessage.type === "error"
  );
}

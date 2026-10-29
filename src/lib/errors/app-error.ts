export type AppErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export type PublicErrorPayload = {
  error: {
    code: AppErrorCode;
    message: string;
    requestId?: string;
  };
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    status: number,
    options: { cause?: unknown; expose?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.expose = options.expose ?? status < 500;
  }
}

export function toPublicErrorPayload(
  error: unknown,
  requestId?: string,
): PublicErrorPayload {
  const knownError = error instanceof AppError && error.expose;

  return {
    error: {
      code: knownError ? error.code : "INTERNAL_ERROR",
      message: knownError
        ? error.message
        : "An unexpected error occurred. Please try again.",
      ...(requestId ? { requestId } : {}),
    },
  };
}

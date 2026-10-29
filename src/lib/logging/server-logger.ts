import "server-only";

export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogEvent = {
  level: ServerLogLevel;
  event: string;
  module: string;
  operation: string;
  outcome: "started" | "succeeded" | "rejected" | "failed";
  requestId?: string;
  errorCode?: string;
  errorName?: string;
};

/**
 * Emits an intentionally small, secret-safe structured record. Callers should
 * never include credentials, tokens, request bodies, or personal data in the
 * fixed metadata fields above.
 */
export function logServerEvent(event: ServerLogEvent): void {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });

  if (event.level === "error") {
    console.error(record);
    return;
  }

  if (event.level === "warn") {
    console.warn(record);
    return;
  }

  console.info(record);
}

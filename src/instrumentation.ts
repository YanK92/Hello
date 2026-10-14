import type { Instrumentation } from "next";

/**
 * Server error reporting. Logs one structured line per error (no query
 * strings, bodies or user content). If ERROR_WEBHOOK_URL is set, the same
 * record is POSTed there, e.g. to an error-monitoring service's intake.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const record = {
    level: "error",
    msg: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    digest: typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined,
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    at: new Date().toISOString(),
  };
  console.error(JSON.stringify(record));
  const url = process.env.ERROR_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
    } catch {
      // Reporting must never cause a second failure.
    }
  }
};

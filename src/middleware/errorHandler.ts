import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ApiError } from "../types/index.js";

/** Structural check for a Zod validation error — avoids instanceof issues across module instances. */
function isZodError(err: unknown): err is { issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Single place where every thrown/rejected error in the app is translated into
 * a JSON response. Route handlers just `throw` and let this catch it.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (isZodError(err)) {
    const [firstIssue] = err.issues;
    const field = firstIssue?.path.join(".");
    const message = field ? `Invalid value for '${field}': ${firstIssue.message}` : "Invalid request.";
    res.status(400).json({ error: message, details: err.issues });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Uploaded file exceeds the maximum allowed size." : err.message;
    res.status(400).json({ error: message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong while processing the image." });
};

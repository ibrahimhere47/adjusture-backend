import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Cached across invocations. On Vercel (and any serverless platform) a "warm"
 * function instance re-runs this module without re-executing top-level state,
 * so caching the connection promise on `global` avoids opening a new MongoDB
 * connection on every request (and exhausting Atlas's free-tier connection limit).
 */
declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
}

/** Connects to MongoDB (once per warm instance) and resolves once ready. */
export function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your .env (see .env.example).");
  }

  if (!global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      // Keep the pool small — serverless functions run many concurrent instances,
      // each with its own pool, and Atlas free-tier caps total connections at 500.
      maxPoolSize: 5,
    });
  }

  return global.__mongooseConn;
}

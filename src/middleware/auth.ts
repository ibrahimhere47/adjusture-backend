import type { NextFunction, Response } from "express";
import { ApiError } from "../types/index.js";
import type { AuthedRequest } from "../types/index.js";
import { verifyToken } from "../utils/jwt.js";

/** Protects a route: requires `Authorization: Bearer <token>` and attaches `req.user`. */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new ApiError(401, "Missing or invalid Authorization header.");
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired token.");
  }
}

import jwt, { type SignOptions } from "jsonwebtoken";

export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to your .env (see .env.example).");
  }
  return secret;
}

/** Signs a short-lived auth token for a user. */
export function signToken(payload: AuthTokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];
  return jwt.sign(payload, getSecret(), { expiresIn });
}

/** Verifies and decodes an auth token, throwing if invalid/expired. */
export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getSecret()) as AuthTokenPayload;
}

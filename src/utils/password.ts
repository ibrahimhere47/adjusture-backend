import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hashes a plaintext password for storage. Never store or log the plaintext. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compares a plaintext password against a stored bcrypt hash. */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

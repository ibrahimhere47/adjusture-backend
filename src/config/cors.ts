import type { CorsOptions } from "cors";

const defaultOrigins = ["http://localhost:5173", "https://darkroom-livid.vercel.app"];

const configuredOrigins = process.env.CORS_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins?.length ? configuredOrigins : defaultOrigins;

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

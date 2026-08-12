import multer from "multer";
import { ApiError } from "../types/index.js";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
]);

const storage = multer.memoryStorage();

/** Shared multer instance: files are kept in memory (never touch disk) and validated by MIME type. */
export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, `Unsupported image type '${file.mimetype}'.`));
      return;
    }
    cb(null, true);
  },
});

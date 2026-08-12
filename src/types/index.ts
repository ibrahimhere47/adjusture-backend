import type { Request } from "express";

/** A single uploaded file, as provided by multer's memory storage. */
export type UploadedFile = Express.Multer.File;

/** Request shape after multer has attached a single file under `file`. */
export interface SingleFileRequest extends Request {
  file?: UploadedFile;
}

/** Request shape after multer has attached named file fields (e.g. watermark route). */
export interface FieldsFileRequest extends Request {
  files?: Record<string, UploadedFile[]>;
}

export type ResizeMode = "fit" | "crop" | "exact";

export type SupportedOutputFormat = "jpeg" | "jpg" | "png" | "webp" | "avif";

export type FilterName = "grayscale" | "blackandwhite" | "sepia" | "vintage" | "invert";

export type WatermarkPosition = "topleft" | "topright" | "bottomleft" | "bottomright" | "center";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

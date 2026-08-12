import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  format: z.enum(["jpeg", "jpg", "png", "webp", "avif"]).optional().default("png"),
  quality: z.coerce.number().int().min(1).max(100).optional().default(90),
});

const CONTENT_TYPE_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

router.post("/convert", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { format, quality } = bodySchema.parse(req.body);
  const pipeline = sharp(req.file.buffer);

  const output = await (format === "jpeg" || format === "jpg"
    ? pipeline.jpeg({ quality })
    : format === "webp"
      ? pipeline.webp({ quality })
      : format === "avif"
        ? pipeline.avif({ quality })
        : pipeline.png()
  ).toBuffer();

  const extension = format === "jpg" ? "jpg" : format;
  const fileName = stripExtension(req.file.originalname);
  res.type(CONTENT_TYPE_BY_FORMAT[format]).attachment(`${fileName}-converted.${extension}`).send(output);
});

export default router;

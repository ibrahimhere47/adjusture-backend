import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  // All multipliers default to 1 (no change). 0 = fully desaturated/black, 2 = double.
  brightness: z.coerce.number().min(0).max(3).optional().default(1),
  contrast: z.coerce.number().min(0).max(3).optional().default(1),
  saturation: z.coerce.number().min(0).max(3).optional().default(1),
  // Hue rotation in degrees, any integer (sharp wraps internally).
  hue: z.coerce.number().optional().default(0),
  // Optional gamma correction. sharp requires 1.0-3.0; omit to skip entirely.
  gamma: z.coerce.number().min(1).max(3).optional(),
});

router.post("/color-correct", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { brightness, contrast, saturation, hue, gamma } = bodySchema.parse(req.body);

  let pipeline = sharp(req.file.buffer).modulate({
    brightness,
    saturation,
    hue,
  });

  // Contrast isn't part of modulate(), so apply it separately as a linear transform
  // pivoted around the midpoint (128) rather than around black, so increasing contrast
  // doesn't also brighten the image.
  if (contrast !== 1) {
    const offset = 128 * (1 - contrast);
    pipeline = pipeline.linear(contrast, offset);
  }

  if (gamma !== undefined) {
    pipeline = pipeline.gamma(gamma);
  }

  const output = await pipeline.png().toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-corrected.png`).send(output);
});

export default router;
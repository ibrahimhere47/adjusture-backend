import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  width: z.coerce.number().min(0),
  // Accepts any CSS-style colour string sharp/the underlying `color` package understands:
  // hex (#fff, #ff0000, #ff000080), rgb()/rgba(), hsl()/hsla(), or named colours (e.g. "red").
  color: z.string().trim().min(1).optional().default("#000000"),
});

router.post("/border", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { width, color } = bodySchema.parse(req.body);

  const base = sharp(req.file.buffer);
  const { width: imgWidth, height: imgHeight } = await base.metadata();
  if (!imgWidth || !imgHeight) throw new ApiError(400, "Could not read image dimensions.");

  const borderPx = Math.round(width);

  let output: Buffer;
  try {
    // extend() grows the canvas outward and fills the new area with `background`,
    // so the original image is preserved in full rather than being cropped into.
    output = await base
      .ensureAlpha()
      .extend({
        top: borderPx,
        bottom: borderPx,
        left: borderPx,
        right: borderPx,
        background: color,
      })
      .png()
      .toBuffer();
  } catch (err) {
    // sharp/the `color` package throws on an unparseable colour string.
    throw new ApiError(400, `Invalid color value: "${color}".`);
  }

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-bordered.png`).send(output);
});

export default router;
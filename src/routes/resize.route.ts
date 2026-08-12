import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest, ResizeMode } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  width: z.coerce.number().int().min(1),
  height: z.coerce.number().int().min(1),
  mode: z.enum(["fit", "crop", "exact"]).optional().default("fit"),
});

const FIT_BY_MODE: Record<ResizeMode, keyof sharp.FitEnum> = {
  fit: "inside", // scale down to fit within bounds, preserving aspect ratio
  crop: "cover", // fill bounds, cropping the overflow from the center
  exact: "fill", // stretch to the exact dimensions, ignoring aspect ratio
};

router.post("/resize", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { width, height, mode } = bodySchema.parse(req.body);

  const output = await sharp(req.file.buffer)
    .resize(width, height, { fit: FIT_BY_MODE[mode], position: "centre" })
    .png()
    .toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-resized.png`).send(output);
});

export default router;

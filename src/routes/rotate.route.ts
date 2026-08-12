import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  degrees: z.coerce.number(),
});

router.post("/rotate", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { degrees } = bodySchema.parse(req.body);

  // sharp expands the canvas automatically so nothing gets clipped; background fills the new corners.
  const output = await sharp(req.file.buffer)
    .rotate(degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-rotated.png`).send(output);
});

export default router;

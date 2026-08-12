import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  quality: z.coerce.number().int().min(1).max(100),
});

router.post("/compress", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { quality } = bodySchema.parse(req.body);

  const output = await sharp(req.file.buffer).jpeg({ quality, mozjpeg: true }).toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/jpeg").attachment(`${fileName}-compressed.jpg`).send(output);
});

export default router;

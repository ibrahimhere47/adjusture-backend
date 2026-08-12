import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { parseHexColor } from "../utils/color.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  color: z.string().optional().default("#FFFFFF"),
});

router.post("/add-background", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { color } = bodySchema.parse(req.body);
  const { r, g, b } = parseHexColor(color);

  // sharp's flatten() composites the alpha channel onto an opaque background in one pass.
  const output = await sharp(req.file.buffer)
    .flatten({ background: { r, g, b } })
    .png()
    .toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-with-bg.png`).send(output);
});

export default router;

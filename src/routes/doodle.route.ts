// src/routes/doodle.route.ts
import { Router } from "express";
import sharp from "sharp";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";

const router = Router();

router.post(
  "/doodle",
  upload.fields([{ name: "file", maxCount: 1 }, { name: "overlay", maxCount: 1 }]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const baseFile = files?.file?.[0];
    const overlayFile = files?.overlay?.[0];
    if (!baseFile || !overlayFile) throw new ApiError(400, "Both 'file' and 'overlay' are required.");

    const output = await sharp(baseFile.buffer)
      .composite([{ input: overlayFile.buffer }]) // overlay must match base image dimensions
      .png()
      .toBuffer();

    const fileName = stripExtension(baseFile.originalname);
    res.type("image/png").attachment(`${fileName}-doodled.png`).send(output);
  },
);

export default router
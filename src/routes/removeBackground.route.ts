// routes/removeBackground.ts
import { Router } from "express";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import { refineAlphaEdges } from "../utils/refineAlpha.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

// Previously hardcoded to 1024px, which is what was hurting quality on
// busy/multi-object images — the model was segmenting a heavily
// downscaled image and losing the detail it needed. This is now just a
// safety ceiling to prevent memory spikes on serverless, not a quality
// bottleneck. Override via env if you need to tune it for your host's
// memory limits.
const MAX_PROCESSING_DIMENSION = Number(process.env.MAX_BG_REMOVAL_DIMENSION ?? 2000);

router.post(
  "/remove-background",
  upload.single("image"),
  async (req: SingleFileRequest, res) => {
    if (!req.file) throw new ApiError(400, "No image file provided.");

    const metadata = await sharp(req.file.buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new ApiError(400, "Invalid image file.");
    }

    // Only downscale if the image actually exceeds the safety ceiling —
    // most uploads (product photos, portraits, etc.) will pass through
    // at full resolution now, which is what fixes the quality problem
    // on complex scenes.
    const processedBuffer = await sharp(req.file.buffer)
      .resize({
        width: MAX_PROCESSING_DIMENSION,
        height: MAX_PROCESSING_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat("png")
      .toBuffer();

    const inputBlob = new Blob([processedBuffer], { type: "image/png" });

    let resultBlob: Blob;
    try {
      resultBlob = await removeBackground(inputBlob, {
        model: "medium",
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/",
        output: { format: "image/png", quality: 1 },
      });
    } catch (err) {
      console.error("Background removal model failed:", err);
      throw new ApiError(500, "Failed to remove background.");
    }

    const rawOutputBuffer = Buffer.from(await resultBlob.arrayBuffer());

    // Clean up stray alpha noise and soften the cutout edge — this is
    // the other half of the quality fix, independent of resolution.
    const refinedBuffer = await refineAlphaEdges(rawOutputBuffer);

    // Scale back up to the original dimensions if we downscaled earlier.
    const finalImage = await sharp(refinedBuffer)
      .resize(metadata.width, metadata.height, { fit: "fill" })
      .png({ quality: 100 })
      .toBuffer();

    const fileName = stripExtension(req.file.originalname);
    res.type("image/png").attachment(`${fileName}-no-bg.png`).send(finalImage);
  }
);

export default router;

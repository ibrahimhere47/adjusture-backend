// routes/removeBackground.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  "/remove-background",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Invalid image file" });
      }

      // 1. Pre-process contrast so skin tones pop against beige backgrounds
      const preProcessedBuffer = await sharp(req.file.buffer)
        .modulate({ brightness: 1.02, saturation: 1.35 })
        .linear(1.2, -10)
        .toBuffer();

      const inputBlob = new Blob([new Uint8Array(preProcessedBuffer)], {
        type: req.file.mimetype || "image/png",
      });

      // 2. Run background removal directly
      const resultBlob = await removeBackground(inputBlob, {
        model: "medium",
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/",
        output: { format: "image/png", quality: 1 },
      });

      const rawArrayBuffer = await resultBlob.arrayBuffer();
      const outputBuffer = Buffer.from(new Uint8Array(rawArrayBuffer));

      // 3. Ensure dimensions match the original image
      const outMeta = await sharp(outputBuffer).metadata();
      let finalBuffer = outputBuffer;

      if (outMeta.width !== metadata.width || outMeta.height !== metadata.height) {
        const resized = await sharp(outputBuffer)
          .resize(metadata.width, metadata.height, { fit: "fill" })
          .png({ quality: 100 })
          .toBuffer();

        finalBuffer = Buffer.from(new Uint8Array(resized));
      }

      res.set("Content-Type", "image/png");
      res.set("Content-Disposition", "inline; filename=result.png");
      return res.send(finalBuffer);
    } catch (err) {
      console.error("Background removal failed:", err);
      return res.status(500).json({ error: "Failed to remove background" });
    }
  }
);

export default router;
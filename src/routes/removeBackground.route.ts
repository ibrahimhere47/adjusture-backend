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

      // 1. Get original metadata
      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Invalid image file" });
      }

      // 2. Pre-process contrast & saturation
      const sharpBuffer = await sharp(req.file.buffer)
        .modulate({
          brightness: 1.02,
          saturation: 1.35,
        })
        .linear(1.25, -15)
        .toBuffer();

      // Fix 1: Wrap Sharp Uint8Array/Buffer safely
      const contrastEnhancedBuffer = Buffer.from(new Uint8Array(sharpBuffer));

      // 3. Convert to Blob
      const inputBlob = new Blob([contrastEnhancedBuffer], {
        type: req.file.mimetype || "image/png",
      });

      // 4. Run AI background removal with 'large' model
      const resultBlob = await removeBackground(inputBlob, {
        model: "large",
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/",
        output: { format: "image/png", quality: 1 },
      });

      // Fix 2: Convert Blob ArrayBuffer to Uint8Array first
      const rawArrayBuffer = await resultBlob.arrayBuffer();
      const outputBuffer = Buffer.from(new Uint8Array(rawArrayBuffer));

      // 5. Ensure dimensions match original
      const outMeta = await sharp(outputBuffer).metadata();
      let finalBuffer = outputBuffer;

      if (outMeta.width !== metadata.width || outMeta.height !== metadata.height) {
        const resizedBuffer = await sharp(outputBuffer)
          .resize(metadata.width, metadata.height, { fit: "fill" })
          .png({ quality: 100 })
          .toBuffer();

        // Fix 3: Wrap resized buffer safely
        finalBuffer = Buffer.from(new Uint8Array(resizedBuffer));
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
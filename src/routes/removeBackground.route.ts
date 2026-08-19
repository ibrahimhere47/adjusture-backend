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

      // 1. Fetch metadata
      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Invalid image file" });
      }

      // 2. Downscale the image buffer for processing to prevent SIGABRT memory spikes
      const processedBuffer = await sharp(req.file.buffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .toFormat("png")
        .toBuffer();

      const inputBlob = new Blob([processedBuffer], { type: "image/png" });

      // 3. Process with 'small' or 'medium' model
      const resultBlob = await removeBackground(inputBlob, {
        model: "medium", // Use 'small' for serverless environments like Vercel
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/",
        output: { format: "image/png", quality: 1 },
      });

      const outputBuffer = Buffer.from(await resultBlob.arrayBuffer());

      // 4. Scale back up to original dimensions if required
      const finalImage = await sharp(outputBuffer)
        .resize(metadata.width, metadata.height, { fit: "fill" })
        .png({ quality: 100 })
        .toBuffer();

      res.set("Content-Type", "image/png");
      return res.send(finalImage);
    } catch (err) {
      console.error("Background removal failed:", err);
      return res.status(500).json({ error: "Failed to remove background" });
    }
  }
);

export default router;
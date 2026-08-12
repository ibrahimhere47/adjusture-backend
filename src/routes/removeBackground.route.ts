// routes/removeBackground.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";

const router = Router();

// Keep uploads in memory — avoids disk I/O and extra cleanup logic
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap, adjust as needed
});

router.post(
  "/remove-background",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Validate it's actually an image and grab original dimensions
      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ error: "Invalid image file" });
      }

      // Convert buffer to a Blob (the lib expects Blob/File/URL input)
      const inputBlob = new Blob([req.file.buffer], {
        type: req.file.mimetype,
      });

      // model: "medium" is a good quality/speed tradeoff; "large" for max fidelity
      const resultBlob = await removeBackground(inputBlob, {
        model: "medium",
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/",
        output: { format: "image/png", quality: 1 },
      });

      const outputBuffer = Buffer.from(await resultBlob.arrayBuffer());

      // Sanity check: confirm resolution wasn't altered
      const outMeta = await sharp(outputBuffer).metadata();
      if (
        outMeta.width !== metadata.width ||
        outMeta.height !== metadata.height
      ) {
        // Force back to original dimensions if the model ever resizes internally
        const resized = await sharp(outputBuffer)
          .resize(metadata.width, metadata.height, { fit: "fill" })
          .png({ quality: 100 })
          .toBuffer();

        res.set("Content-Type", "image/png");
        return res.send(resized);
      }

      res.set("Content-Type", "image/png");
      res.set("Content-Disposition", "inline; filename=result.png");
      return res.send(outputBuffer);
    } catch (err) {
      console.error("Background removal failed:", err);
      return res.status(500).json({ error: "Failed to remove background" });
    }
  }
);

export default router;
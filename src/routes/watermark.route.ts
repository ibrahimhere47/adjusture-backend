import { Router, type Request } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { resolvePosition } from "../utils/position.js";
import { stripExtension } from "../utils/filename.js";
import type { WatermarkPosition } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  text: z.string().optional(),
  position: z
    .enum(["topleft", "topright", "bottomleft", "bottomright", "center"])
    .optional()
    .default("bottomright"),
  opacity: z.coerce.number().min(0).max(100).optional().default(60),
  fontSize: z.coerce.number().positive().optional().default(32),
});

const MARGIN_PX = 24;
const MAX_WATERMARK_WIDTH_FRACTION = 0.25;

router.post(
  "/watermark",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "watermarkFile", maxCount: 1 },
  ]),
  async (req: Request, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const baseFile = files?.file?.[0];
    const watermarkFile = files?.watermarkFile?.[0];
    if (!baseFile) throw new ApiError(400, "A file is required.");

    const { text, position, opacity, fontSize } = bodySchema.parse(req.body);
    if (!text && !watermarkFile) {
      throw new ApiError(400, "Provide either 'text' or a 'watermarkFile'.");
    }

    const base = sharp(baseFile.buffer);
    const { width: canvasWidth, height: canvasHeight } = await base.metadata();
    if (!canvasWidth || !canvasHeight) throw new ApiError(400, "Could not read image dimensions.");

    const overlays: sharp.OverlayOptions[] = [];
    const opacityFraction = opacity / 100;

    if (watermarkFile) {
      overlays.push(await buildImageOverlay(watermarkFile.buffer, canvasWidth, canvasHeight, position, opacityFraction));
    }

    if (text) {
      overlays.push(buildTextOverlay(text, canvasWidth, canvasHeight, position, opacityFraction, fontSize));
    }

    const output = await base.composite(overlays).png().toBuffer();

    const fileName = stripExtension(baseFile.originalname);
    res.type("image/png").attachment(`${fileName}-watermarked.png`).send(output);
  },
);

async function buildImageOverlay(
  watermarkBuffer: Buffer,
  canvasWidth: number,
  canvasHeight: number,
  position: WatermarkPosition,
  opacityFraction: number,
): Promise<sharp.OverlayOptions> {
  const maxWidth = Math.round(canvasWidth * MAX_WATERMARK_WIDTH_FRACTION);

  const resized = await sharp(watermarkBuffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .ensureAlpha()
    // Scale down the alpha channel to bake the requested opacity into the pixels themselves,
    // since sharp's composite() has no per-layer opacity option.
    .linear([1, 1, 1, opacityFraction], [0, 0, 0, 0])
    .toBuffer({ resolveWithObject: true });

  const { width: wmWidth, height: wmHeight } = resized.info;
  const { left, top } = resolvePosition(position, canvasWidth, canvasHeight, wmWidth, wmHeight, MARGIN_PX);

  return { input: resized.data, left: Math.round(left), top: Math.round(top) };
}

function buildTextOverlay(
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  position: WatermarkPosition,
  opacityFraction: number,
  fontSize: number,
): sharp.OverlayOptions {
  const { x, anchor, y, baseline } = textAnchorFor(position, canvasWidth, canvasHeight, fontSize, MARGIN_PX);

  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}"
            font-family="sans-serif" font-size="${fontSize}"
            fill="white" fill-opacity="${opacityFraction}">${escapeXml(text)}</text>
    </svg>`;

  return { input: Buffer.from(svg), left: 0, top: 0 };
}

function textAnchorFor(position: WatermarkPosition, canvasWidth: number, canvasHeight: number, fontSize: number, margin: number) {
  switch (position) {
    case "topleft":
      return { x: margin, y: margin + fontSize, anchor: "start", baseline: "auto" };
    case "topright":
      return { x: canvasWidth - margin, y: margin + fontSize, anchor: "end", baseline: "auto" };
    case "bottomleft":
      return { x: margin, y: canvasHeight - margin, anchor: "start", baseline: "auto" };
    case "center":
      return { x: canvasWidth / 2, y: canvasHeight / 2, anchor: "middle", baseline: "middle" };
    case "bottomright":
    default:
      return { x: canvasWidth - margin, y: canvasHeight - margin, anchor: "end", baseline: "auto" };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;

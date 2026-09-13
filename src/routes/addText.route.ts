import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

// Must match font family names actually registered via FONTCONFIG_PATH in this
// deployment (see the watermark route's font-bundling setup) — arbitrary strings
// would silently fall back to tofu/missing-glyph rendering in the serverless env.
const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Playfair Display",
  "Bebas Neue",
  "JetBrains Mono",
] as const;

// Accepts "true"/"false" strings from multipart form fields as real booleans.
const boolString = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((v) => v === "true");

const bodySchema = z.object({
  text: z.string().min(1, "Text is required."),
  // Position as a percentage of canvas width/height (0-100), not raw pixels,
  // so the caller doesn't need to know the image's actual dimensions up front.
  // Represents the top-left anchor of the text block.
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  fontFamily: z.enum(FONT_FAMILIES).optional().default("Inter"),
  fontSize: z.coerce.number().positive().optional().default(32),
  bold: boolString,
  italic: boolString,
  align: z.enum(["left", "center", "right"]).optional().default("left"),
  color: z.string().trim().min(1).optional().default("#ffffff"),
  strokeColor: z.string().trim().min(1).optional(),
  strokeWidth: z.coerce.number().min(0).optional().default(0),
  opacity: z.coerce.number().min(0).max(100).optional().default(100),
  rotation: z.coerce.number().optional().default(0),
});

const LINE_HEIGHT_MULTIPLIER = 1.2;

router.post("/add-text", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const {
    text,
    x,
    y,
    fontFamily,
    fontSize,
    bold,
    italic,
    align,
    color,
    strokeColor,
    strokeWidth,
    opacity,
    rotation,
  } = bodySchema.parse(req.body);

  const base = sharp(req.file.buffer);
  const { width: canvasWidth, height: canvasHeight } = await base.metadata();
  if (!canvasWidth || !canvasHeight) throw new ApiError(400, "Could not read image dimensions.");

  const posX = (x / 100) * canvasWidth;
  const posY = (y / 100) * canvasHeight;

  let overlay: Buffer;
  try {
    overlay = buildTextOverlay({
      text,
      canvasWidth,
      canvasHeight,
      posX,
      posY,
      fontFamily,
      fontSize,
      bold,
      italic,
      align,
      color,
      strokeColor,
      strokeWidth,
      opacity,
      rotation,
    });
  } catch (err) {
    throw new ApiError(400, "Invalid color or stroke value.");
  }

  const output = await base
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-text.png`).send(output);
});

function buildTextOverlay(opts: {
  text: string;
  canvasWidth: number;
  canvasHeight: number;
  posX: number;
  posY: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
  strokeColor?: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
}): Buffer {
  const {
    text,
    canvasWidth,
    canvasHeight,
    posX,
    posY,
    fontFamily,
    fontSize,
    bold,
    italic,
    align,
    color,
    strokeColor,
    strokeWidth,
    opacity,
    rotation,
  } = opts;

  const lines = text.split("\n");
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;

  const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";

  // With dominant-baseline="hanging" on the <text> element, y is the top edge
  // of the first line's box, matching a draggable overlay's top-left corner.
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${posX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const hasStroke = !!strokeColor && strokeWidth > 0;
  const strokeAttrs = hasStroke
    ? `stroke="${escapeAttr(strokeColor!)}" stroke-width="${strokeWidth}" paint-order="stroke fill"`
    : "";

  const opacityFraction = opacity / 100;
  const transform = rotation ? `transform="rotate(${rotation} ${posX} ${posY})"` : "";

  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${posX}" y="${posY}" text-anchor="${textAnchor}" dominant-baseline="hanging"
            font-family="${escapeAttr(fontFamily)}" font-size="${fontSize}"
            font-weight="${bold ? "bold" : "normal"}" font-style="${italic ? "italic" : "normal"}"
            fill="${escapeAttr(color)}" opacity="${opacityFraction}"
            ${strokeAttrs} ${transform}>${tspans}</text>
    </svg>`;

  return Buffer.from(svg);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttr(value: string): string {
  // Same escaping as escapeXml, used for attribute values (color strings,
  // font family names) which sharp/librsvg will reject if they throw on parse.
  return escapeXml(value);
}

export default router;
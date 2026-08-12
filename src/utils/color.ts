import { ApiError } from "../types/index.js";

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** Parses #RGB, #RRGGBB, or #RRGGBBAA into an { r, g, b, alpha } object (alpha is 0-1). */
export function parseHexColor(hex: string | undefined): RgbaColor {
  if (!hex) throw new ApiError(400, "Color is required.");

  const normalized = hex.trim().replace(/^#/, "");
  const isShort = normalized.length === 3;
  const isFull = normalized.length === 6;
  const isFullWithAlpha = normalized.length === 8;

  if (!isShort && !isFull && !isFullWithAlpha) {
    throw new ApiError(400, `Invalid color '${hex}'. Use a hex value like #FFFFFF or #FF0000FF.`);
  }

  const expand = (value: string) => (isShort ? value + value : value);

  const r = parseInt(expand(normalized.slice(0, isShort ? 1 : 2)), 16);
  const g = parseInt(expand(normalized.slice(isShort ? 1 : 2, isShort ? 2 : 4)), 16);
  const b = parseInt(expand(normalized.slice(isShort ? 2 : 4, isShort ? 3 : 6)), 16);
  const alpha = isFullWithAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;

  if ([r, g, b].some(Number.isNaN) || Number.isNaN(alpha)) {
    throw new ApiError(400, `Invalid color '${hex}'. Use a hex value like #FFFFFF or #FF0000FF.`);
  }

  return { r, g, b, alpha };
}

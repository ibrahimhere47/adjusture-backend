import sharp from "sharp";
import { ApiError } from "../types/index.js";
import type { FilterName } from "../types/index.js";

type Matrix3x3 = [[number, number, number], [number, number, number], [number, number, number]];

const GRAYSCALE_MATRIX: Matrix3x3 = [
  [0.21, 0.72, 0.07],
  [0.21, 0.72, 0.07],
  [0.21, 0.72, 0.07],
];

const SEPIA_MATRIX: Matrix3x3 = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];

const SUPPORTED_FILTERS = new Set<FilterName>(["grayscale", "blackandwhite", "sepia", "vintage", "invert"]);

export function isSupportedFilter(name: string): name is FilterName {
  return SUPPORTED_FILTERS.has(name as FilterName);
}

/** Applies a named color filter to a sharp pipeline and returns the (still-chainable) pipeline. */
export function applyFilter(image: sharp.Sharp, name: FilterName): sharp.Sharp {
  switch (name) {
    case "grayscale":
    case "blackandwhite":
      // sharp's built-in greyscale() is a faster path than a manual recomb for this case.
      return image.greyscale();

    case "sepia":
      return image.recomb(SEPIA_MATRIX);

    case "vintage":
      // Sepia tone plus a slight brightness lift, mirroring the old +8 offset per channel.
      return image.recomb(SEPIA_MATRIX).linear(0.9, 8);

    case "invert":
      return image.negate({ alpha: false });

    default: {
      const exhaustiveCheck: never = name;
      throw new ApiError(400, `Unsupported filter '${exhaustiveCheck}'.`);
    }
  }
}

export function assertSupportedFilter(name: string): FilterName {
  if (!isSupportedFilter(name)) {
    throw new ApiError(
      400,
      `Unsupported filter '${name}'. Supported filters: grayscale, sepia, vintage, invert, blackandwhite.`,
    );
  }
  return name;
}

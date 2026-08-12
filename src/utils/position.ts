import type { WatermarkPosition } from "../types/index.js";

/**
 * Computes explicit pixel coordinates for placing an overlay of size (itemWidth, itemHeight)
 * on a canvas of size (canvasWidth, canvasHeight), honoring a fixed margin from the edges.
 * Explicit coordinates (rather than sharp's built-in `gravity`) let us support the margin.
 */
export function resolvePosition(
  position: WatermarkPosition,
  canvasWidth: number,
  canvasHeight: number,
  itemWidth: number,
  itemHeight: number,
  margin: number,
): { left: number; top: number } {
  switch (position) {
    case "topleft":
      return { left: margin, top: margin };
    case "topright":
      return { left: canvasWidth - itemWidth - margin, top: margin };
    case "bottomleft":
      return { left: margin, top: canvasHeight - itemHeight - margin };
    case "center":
      return { left: (canvasWidth - itemWidth) / 2, top: (canvasHeight - itemHeight) / 2 };
    case "bottomright":
    default:
      return { left: canvasWidth - itemWidth - margin, top: canvasHeight - itemHeight - margin };
  }
}

import sharp from "sharp";

/**
 * Cleans up a background-removal cutout's alpha channel.
 *
 * On tough images (multiple objects, low-contrast edges) segmentation
 * models tend to leave two artifacts:
 *  1. Stray alpha "islands" — small noisy patches of partial transparency
 *     scattered around a busy background.
 *  2. Hard, jagged edges that look "cut with scissors" once composited
 *     onto a real background, instead of a soft natural boundary.
 *
 * This pulls the alpha channel out on its own, denoises it with a
 * median filter (removes the stray islands without blurring the main
 * shape), then applies a very small gaussian blur to soften the edge,
 * and joins it back onto the RGB channels.
 *
 * Keep `feather` small (0.4–1.2). Too high and you get a visible halo.
 */
export async function refineAlphaEdges(
  pngBuffer: Buffer,
  feather = 0.6
): Promise<Buffer> {
  const base = sharp(pngBuffer);

  const alpha = await base
    .clone()
    .extractChannel("alpha")
    .median(3)
    .blur(feather)
    .toBuffer();

  return base.clone().removeAlpha().joinChannel(alpha).png().toBuffer();
}

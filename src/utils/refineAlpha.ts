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
 *
 * NOTE: this only fixes local edge noise. It does NOT fix a model being
 * genuinely *uncertain* about a whole region (e.g. a hand rendered as
 * uniformly semi-transparent because the model couldn't decide if it's
 * foreground). For that, see `boostAlphaConfidence` below, or better,
 * route the image through the BiRefNet-based pro service instead.
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

/**
 * Stopgap for low-confidence masks: pushes alpha values away from the
 * uncertain midpoint (~128) toward fully opaque or fully transparent,
 * instead of leaving large regions "ghosted" at partial opacity.
 *
 * This is a blunt instrument — it forces a decision on pixels the model
 * itself wasn't sure about, so some will land on the wrong side. It
 * trades "obviously see-through" for "possibly slightly wrong edge",
 * which is usually the better trade visually, but it's not a substitute
 * for a model that's actually confident. Use `/remove-background-pro`
 * (BiRefNet) for scenes where this keeps happening — that's a model-
 * level fix rather than a post-processing patch.
 *
 * `strength` > 1 increases contrast around the midpoint. 1 = no-op.
 * Start around 1.6–2.0; higher values are more aggressive.
 */
export async function boostAlphaConfidence(
  pngBuffer: Buffer,
  strength = 1.8
): Promise<Buffer> {
  const base = sharp(pngBuffer);

  // Linear contrast stretch around the 128 midpoint:
  // output = input * strength + (128 * (1 - strength)), clamped to 0-255.
  const offset = 128 * (1 - strength);

  const alpha = await base
    .clone()
    .extractChannel("alpha")
    .linear(strength, offset)
    .toBuffer();

  return base.clone().removeAlpha().joinChannel(alpha).png().toBuffer();
}

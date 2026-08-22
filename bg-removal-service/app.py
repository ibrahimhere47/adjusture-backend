"""
Darkroom - Background Removal Microservice
--------------------------------------------
Runs as a standalone Python service. Your Node.js backend calls this
over HTTP instead of trying to run the segmentation model in Node.

Why a separate service?
- The strong models (BiRefNet / RMBG-2.0) are PyTorch models. Node has
  no first-class runtime for them.
- Keeping it separate means you can scale/restart/replace the model
  service independently of your main API, and swap models later
  without touching your Node code at all.

Model used: rembg with the "birefnet-general" backend.
  - Much stronger than the default u2net model on:
      * multiple overlapping objects
      * low-contrast edges (similar shades between subject/background)
      * fine detail (hair, fur, thin structures)
  - Falls back gracefully to CPU if no GPU is available.

To upgrade further later: swap SESSION_MODEL to "isnet-general-use"
(faster, decent quality) or wire in Bria's RMBG-2.0 directly via
huggingface `transformers` if you want the absolute best quality
(it currently benchmarks above BiRefNet on complex backgrounds).
"""

import io
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageFilter
import numpy as np

from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bg-removal")

# ---- Model setup -----------------------------------------------------
# "birefnet-general" = strong general-purpose model, good on complex
# scenes. Swap to "isnet-general-use" if you need more speed and can
# accept slightly softer edges.
SESSION_MODEL = "birefnet-general"
session = new_session(SESSION_MODEL)

app = FastAPI(title="Darkroom Background Removal Service")


def refine_mask_edges(rgba_img: Image.Image, feather: int = 1) -> Image.Image:
    """
    Light post-processing pass on the alpha channel:
    - Removes tiny stray alpha islands (noise from busy/multi-object scenes)
    - Slightly feathers the edge so cutouts don't look "cut with scissors"
      against real-world backgrounds.
    Keep `feather` small (0-2). Too much and you get a soft halo.
    """
    r, g, b, a = rgba_img.split()
    a = a.filter(ImageFilter.MedianFilter(size=3))  # denoise stray pixels
    if feather > 0:
        a = a.filter(ImageFilter.GaussianBlur(radius=feather))
    return Image.merge("RGBA", (r, g, b, a))


@app.post("/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    refine: bool = True,
    feather: int = 1,
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image type")

    input_bytes = await file.read()

    try:
        input_img = Image.open(io.BytesIO(input_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image")

    # Guard against absurdly large uploads slowing the model down / OOM
    MAX_DIM = 2500
    if max(input_img.size) > MAX_DIM:
        input_img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)

    logger.info("Processing image size=%s model=%s", input_img.size, SESSION_MODEL)

    result = remove(
        input_img,
        session=session,
        alpha_matting=True,              # big win on tough edges
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=5,
    )

    if refine:
        result = refine_mask_edges(result, feather=feather)

    out_buffer = io.BytesIO()
    result.save(out_buffer, format="PNG")
    out_buffer.seek(0)

    return Response(content=out_buffer.getvalue(), media_type="image/png")


@app.get("/health")
async def health():
    return {"status": "ok", "model": SESSION_MODEL}

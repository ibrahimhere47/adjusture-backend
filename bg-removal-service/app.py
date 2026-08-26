"""
Darkroom - Background Removal Microservice (BiRefNet)
--------------------------------------------------------
Runs as a standalone Python service. Your Node.js backend calls this
over HTTP instead of trying to run the segmentation model in Node.

Model: BiRefNet, via `rembg`'s "birefnet-general" backend
  - MIT-licensed, no proprietary training, no gated model, no
    HF_TOKEN needed. Weights download automatically on first run from
    rembg's own release mirror, not from a gated Hugging Face repo.
  - Strong on complex/multi-object backgrounds and low-contrast edges
    — this is the case your fast in-Node model struggles with. Not
    quite as strong as RMBG-2.0 on the hardest scenes (RMBG-2.0 is
    Bria's proprietary fine-tune of this same architecture), but no
    licensing cost or commercial-use restriction.
  - Much lighter dependency footprint than RMBG-2.0: onnxruntime
    instead of torch + transformers + timm + kornia, which means
    smaller Docker images and faster cold starts on free-tier hosting.

Hardware: works fine on CPU. Expect a few seconds per image on CPU,
well under a second on GPU (rembg picks up CUDA automatically if
onnxruntime-gpu is installed instead of the CPU build).
"""

import io
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageFilter

from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bg-removal-birefnet")

# ---- Model setup -----------------------------------------------------
SESSION_MODEL = "birefnet-general"
logger.info("Loading rembg session model=%s ...", SESSION_MODEL)
session = new_session(SESSION_MODEL)
logger.info("Model loaded.")

app = FastAPI(title="Darkroom Background Removal Service (BiRefNet)")


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

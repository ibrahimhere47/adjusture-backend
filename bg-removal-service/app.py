"""
Darkroom - Background Removal Microservice (RMBG-2.0)
--------------------------------------------------------
Runs as a standalone Python service. Your Node.js backend calls this
over HTTP instead of trying to run the segmentation model in Node.

Model: briaai/RMBG-2.0 (via Hugging Face `transformers`)
  - Built on the BiRefNet architecture, trained further by Bria AI on
    a proprietary dataset. Benchmarks ahead of plain BiRefNet
    specifically on complex/multi-object backgrounds and low-contrast
    edges — this is the case your fast in-Node model struggles with.
  - LICENSE NOTE: RMBG-2.0 is free for non-commercial/research use.
    Commercial use requires a paid license from Bria AI. Check
    https://bria.ai/bria-huggingface-model-license-agreement/ and
    talk to Bria before using this in production on a commercial
    product. (Plain BiRefNet, without Bria's weights, is MIT-licensed
    if you need a fully open alternative — see the previous version of
    this file / git history.)
  - Uses `trust_remote_code=True`, which runs Bria's custom model code
    from their Hugging Face repo. Standard practice for this model,
    but worth knowing what that flag means.

Hardware: works on CPU, but this is a heavier transformer model than
BiRefNet-via-rembg — expect several seconds per image on CPU, well
under a second on a decent GPU.
"""

import io
import logging

import torch
from torchvision import transforms
from transformers import AutoModelForImageSegmentation
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageFilter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bg-removal-rmbg2")

# ---- Model setup -----------------------------------------------------
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
logger.info("Loading briaai/RMBG-2.0 on device=%s ...", DEVICE)

model = AutoModelForImageSegmentation.from_pretrained(
    "briaai/RMBG-2.0", trust_remote_code=True
)
torch.set_float32_matmul_precision("high")
model.to(DEVICE)
model.eval()

logger.info("Model loaded.")

# Preprocessing per Bria's model card: 1024x1024, ImageNet normalization.
IMAGE_SIZE = (1024, 1024)
transform_image = transforms.Compose(
    [
        transforms.Resize(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

app = FastAPI(title="Darkroom Background Removal Service (RMBG-2.0)")


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

    # Guard against absurdly large uploads slowing inference / OOM.
    # (The model internally works at 1024x1024 regardless, but we cap the
    # original here so we're not holding huge buffers in memory.)
    MAX_DIM = 3000
    if max(input_img.size) > MAX_DIM:
        input_img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)

    logger.info("Processing image size=%s", input_img.size)

    input_tensor = transform_image(input_img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        preds = model(input_tensor)[-1].sigmoid().cpu()

    pred = preds[0].squeeze()
    mask = transforms.ToPILImage()(pred).resize(input_img.size)

    result = input_img.copy()
    result.putalpha(mask)

    if refine:
        result = refine_mask_edges(result, feather=feather)

    out_buffer = io.BytesIO()
    result.save(out_buffer, format="PNG")
    out_buffer.seek(0)

    return Response(content=out_buffer.getvalue(), media_type="image/png")


@app.get("/health")
async def health():
    return {"status": "ok", "model": "briaai/RMBG-2.0", "device": DEVICE}

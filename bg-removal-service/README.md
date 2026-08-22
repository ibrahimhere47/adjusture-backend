# Darkroom Background Removal Service (RMBG-2.0)

A standalone Python microservice using Bria AI's RMBG-2.0 — currently
one of the strongest open-weight background removal models on complex,
multi-object, low-contrast scenes (the cases where the fast in-Node
model in this project falls short).

## ⚠️ License — read before deploying to production

RMBG-2.0 is **free for non-commercial/research use**. Commercial use
requires a paid license from Bria AI:
https://bria.ai/bria-huggingface-model-license-agreement/

Since Darkroom is a live product, talk to Bria about commercial terms
before pointing production traffic at this service. If you need a
fully open (MIT-licensed) alternative in the meantime, plain BiRefNet
via `rembg` (`birefnet-general` model) is the fallback — same
architecture, no proprietary fine-tuning, slightly lower quality on
the hardest scenes but no licensing question.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

First run downloads the RMBG-2.0 weights from Hugging Face (a few GB,
PyTorch model) — cached after that, no repeated downloads. You'll need
outbound access to huggingface.co the first time it starts.

Note: loading uses `trust_remote_code=True`, which runs Bria's custom
model code from their Hugging Face repo. That's expected/required for
this model — just be aware of what the flag does.

## Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

Test it:

```bash
curl -X POST http://localhost:8000/remove-background \
  -F "file=@test.jpg" \
  --output result.png
```

## GPU (strongly recommended for this model)

RMBG-2.0 is a heavier transformer model than the BiRefNet-via-rembg
version — CPU inference will run several seconds per image. It'll
auto-detect and use CUDA if available; no code changes needed, just
make sure `torch` is installed with CUDA support matching your box.

## Deployment notes

- This needs real memory and, ideally, a GPU — don't try to run it in
  the same place as Vercel serverless functions. A small GPU instance
  (Render, Lambda Labs, RunPod, a cloud GPU box) will give you the
  speed this model is capable of; CPU works for low-volume/batch use.
- Run as its own service/container, called by `/remove-background-pro`
  in the main API (set `BG_REMOVAL_PRO_URL` there to this service's URL).
- Add a request queue or concurrency limit for production — one worker
  processes one image at a time comfortably.

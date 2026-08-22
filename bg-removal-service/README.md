---
title: Darkroom BG Removal (BiRefNet)
emoji: 🖼️
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
---

# Darkroom Background Removal Service (BiRefNet)

A standalone FastAPI microservice using BiRefNet (via `rembg`), deployed
as a Hugging Face Space (Docker SDK). Your Node.js backend (`darkroom`)
calls this over HTTP as its `/remove-background-pro` upstream.

## License

BiRefNet is MIT-licensed, and `rembg`'s `birefnet-general` weights are
distributed openly — no gated model, no HF token, no commercial-use
restriction, no fees. This is what's used here instead of RMBG-2.0
(Bria's proprietary fine-tune of the same architecture), which requires
a paid commercial license. Quality on the hardest scenes (multiple
objects, low-contrast edges) is a notch below RMBG-2.0, but still well
above the fast in-Node model, at zero licensing cost.

## Setup — nothing extra needed

Unlike the RMBG-2.0 version, there's no license to accept and no
`HF_TOKEN` secret to configure. Weights download automatically on first
run from `rembg`'s own release mirror.

## What this Space gives you vs. localhost/ngrok

- A stable public HTTPS URL your deployed frontend (or Node backend) can
  actually reach — no tunnel to keep alive.
- Free CPU Basic hardware (2 vCPU / 16GB RAM) — comfortably enough for
  this model, which is lighter than the RMBG-2.0/transformers stack.

## Known limitations of the free tier

- **No uptime guarantee, and it sleeps after ~48h of inactivity**,
  waking on the next request with a cold start. Fine for testing, not
  for production SLAs.
- **Non-persistent disk.** Model weights don't survive a restart/sleep
  cycle — every cold start re-downloads them. Lighter weights than
  RMBG-2.0 means this is faster than before, but still adds delay.
- **CPU only.** Expect a few seconds per image, not sub-second.

## API

Same interface as before — no client-side changes needed if you already
wired up `/remove-background-pro`:

```bash
curl -X POST https://<your-space>.hf.space/remove-background \
  -F "file=@test.jpg" \
  --output result.png
```

```
GET  /health              -> { status, model }
POST /remove-background   -> multipart form field "file", returns PNG
     ?refine=true&feather=1  (optional query params, see app.py)
```

## Wiring it into the Node backend

Set, on your Node API's host (Vercel, etc.):

```
BG_REMOVAL_PRO_URL=https://<your-space>.hf.space
```

Redeploy the Node API, then `/remove-background-pro` will route here.

## Deploying / updating this Space

Push this folder's contents (`Dockerfile`, `app.py`, `requirements.txt`,
this `README.md`) to the Space's git repo:

```bash
git remote add space https://huggingface.co/spaces/<your-username>/<space-name>
git push space main
```

Or drag-and-drop the files in the Space's **Files** tab in the browser.
The Space rebuilds automatically on push.

## GPU (optional, if you move off the free tier later)

```bash
pip uninstall onnxruntime
pip install onnxruntime-gpu
```

No code changes needed — `rembg` auto-detects CUDA if available.

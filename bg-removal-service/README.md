# Darkroom Background Removal Service

A standalone Python microservice using BiRefNet (via `rembg`) for
high-accuracy background removal — built to handle multi-object scenes
and low-contrast edges much better than the default `u2net` model.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

First run will download the BiRefNet model weights (~1 file, cached
after that — no repeated downloads).

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

## GPU (optional, big speed boost)

CPU works fine for background jobs (a few seconds per image). If you
later get a GPU box:

```bash
pip uninstall onnxruntime
pip install onnxruntime-gpu
pip uninstall rembg
pip install "rembg[gpu]"
```

No code changes needed — `rembg` auto-detects CUDA if available.

## Deployment notes

- This is CPU/RAM heavy per request (model inference). Run it as its
  own service/container, not inside your main Node process.
- Add a request queue (or just limit concurrency) if you expect bursty
  traffic — one worker can only process one image at a time
  comfortably on CPU.
- For scale, put this behind something like Docker + a process
  manager (gunicorn workers behind uvicorn, or a simple queue with
  Redis + a worker pool) rather than raw uvicorn in production.

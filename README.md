# darkroom-api

Node.js/TypeScript port of the Darkroom image toolkit backend (previously ASP.NET + SkiaSharp),
built on [Express](https://expressjs.com/) and [sharp](https://sharp.pixelplumbing.com/) (libvips).

## Why this is leaner than the C# version

- **sharp does the heavy lifting.** libvips is a streaming, SIMD-accelerated image library —
  resize/compress/convert/flatten/rotate are single built-in calls instead of hand-rolled
  pixel-matrix code, and it's typically faster and more memory-efficient than SkiaSharp for
  these operations.
- **AVIF actually works.** The old server had to reject AVIF because of a SkiaSharp build
  limitation. sharp supports AVIF encoding natively, so `/convert` now supports it for real.
- **`add-background` is one call.** `flatten()` composites transparency onto a solid color
  directly, replacing the manual canvas-clear-then-draw approach.
- **Validation is declarative.** Each route validates its form fields with a small
  [zod](https://zod.dev/) schema instead of scattered manual checks, and a single
  `ApiError` type + error-handling middleware turns any thrown error into a consistent
  JSON response.
- **Files never touch disk.** Uploads are held in memory (multer `memoryStorage`) and streamed
  straight into sharp, then the response buffer — no temp file cleanup to worry about.

## Setup

```bash
npm install
cp .env.example .env
npm run dev      # ts-node/tsx dev server with watch mode
```

```bash
npm run build     # compile to dist/
npm start         # run the compiled server
```

## Endpoints

All endpoints accept `multipart/form-data` and return the processed image as a file download.

| Route              | Method | Key fields                                                                 |
|---------------------|--------|-----------------------------------------------------------------------------|
| `/resize`           | POST   | `file`, `width`, `height`, `mode` (`fit` \| `crop` \| `exact`, default `fit`) |
| `/compress`         | POST   | `file`, `quality` (1–100)                                                   |
| `/convert`          | POST   | `file`, `format` (`jpeg` \| `png` \| `webp` \| `avif`), `quality` (default 90) |
| `/add-filter`       | POST   | `file`, `filter` (`grayscale` \| `sepia` \| `vintage` \| `invert` \| `blackandwhite`) |
| `/watermark`        | POST   | `file`, `text` and/or `watermarkFile`, `position`, `opacity` (0–100), `fontSize` |
| `/rotate`           | POST   | `file`, `degrees`                                                           |
| `/round-corners`    | POST   | `file`, `radius`                                                            |
| `/add-background`   | POST   | `file`, `color` (hex, e.g. `#FFFFFF`)                                       |
| `/remove-background`| POST   | `image` — fast, in-process removal (`@imgly/background-removal-node`)      |
| `/remove-background-pro` | POST | `image` — higher-quality removal for tough images, see below           |
| `/health`           | GET    | —                                                                            |

## Configuration

Set via `.env` (see `.env.example`):

- `PORT` — server port (default `8080`)
- `CORS_ORIGINS` — comma-separated allowed origins
- `MAX_UPLOAD_BYTES` — max upload size in bytes (default 25 MB)
- `MAX_BG_REMOVAL_DIMENSION` — safety ceiling (px) for `/remove-background` before it downscales (default `2000`)
- `BG_REMOVAL_PRO_URL` — URL of a deployed `bg-removal-service` instance, enables `/remove-background-pro`

## Background removal: two tiers

**`/remove-background`** — fast, runs in the same Node process using `@imgly/background-removal-node`.
Good for typical product photos and portraits. Processes at up to `MAX_BG_REMOVAL_DIMENSION`px
(previously hardcoded to 1024px, which was the main cause of poor results on busy/multi-object
images — that ceiling has been raised, and the cutout now gets an alpha edge-refinement pass
(`src/utils/refineAlpha.ts`) to remove stray noise and soften hard edges).

**`/remove-background-pro`** — for images that are still tough after the above: multiple
overlapping objects, low-contrast edges (subject and background in similar shades), fine detail
like hair/fur. This proxies to a separate Python microservice (`/bg-removal-service`) running
BiRefNet, which benchmarks meaningfully better than the in-Node model on complex scenes, at the
cost of being slower (seconds rather than milliseconds, especially on CPU).

To enable it:
1. Deploy `bg-removal-service` (see its own README) — it needs a persistent Python process, so
   it won't run on the same Vercel serverless functions as this API. A small always-on box
   (Render, Railway, Fly.io, a droplet, etc.) works well; add a GPU later if you need more speed.
2. Set `BG_REMOVAL_PRO_URL` in this project's `.env` to that service's URL.
3. Point your "tough image" UI action (or a retry-with-better-quality button) at
   `/remove-background-pro` instead of `/remove-background`.

If `BG_REMOVAL_PRO_URL` isn't set, `/remove-background-pro` returns a `503` rather than failing
silently.

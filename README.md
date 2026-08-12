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
| `/health`           | GET    | —                                                                            |

## Configuration

Set via `.env` (see `.env.example`):

- `PORT` — server port (default `8080`)
- `CORS_ORIGINS` — comma-separated allowed origins
- `MAX_UPLOAD_BYTES` — max upload size in bytes (default 25 MB)

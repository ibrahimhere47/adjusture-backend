// routes/removeBackgroundPro.ts
//
// Higher-quality background removal for tough images (multiple objects,
// low-contrast/similar-shade edges, fine detail like hair or fur).
// Proxies to a standalone Python microservice running BiRefNet, which
// benchmarks meaningfully above the in-Node model on complex scenes.
// See /bg-removal-service in the project root for that service.
//
// This route is separate from /remove-background on purpose: BiRefNet
// is slower (seconds, not milliseconds, especially on CPU), so it's
// opt-in for cases where /remove-background isn't good enough, rather
// than replacing the fast default path.

import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const BG_REMOVAL_PRO_URL = process.env.BG_REMOVAL_PRO_URL;

router.post(
  "/remove-background-pro",
  upload.single("image"),
  async (req: SingleFileRequest, res) => {
    if (!req.file) throw new ApiError(400, "No image file provided.");

    if (!BG_REMOVAL_PRO_URL) {
      throw new ApiError(
        503,
        "High-quality background removal isn't configured. Set BG_REMOVAL_PRO_URL to your deployed bg-removal-service instance."
      );
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );

    let serviceResponse: Response;
    try {
      serviceResponse = await fetch(
        `${BG_REMOVAL_PRO_URL}/remove-background?refine=true&feather=1`,
        { method: "POST", body: form }
      );
    } catch (err) {
      console.error("bg-removal-service unreachable:", err);
      throw new ApiError(502, "Background removal service is unreachable.");
    }

    if (!serviceResponse.ok) {
      const errText = await serviceResponse.text().catch(() => "");
      console.error("bg-removal-service error:", serviceResponse.status, errText);
      throw new ApiError(502, "Background removal failed.");
    }

    const resultBuffer = Buffer.from(await serviceResponse.arrayBuffer());
    const fileName = stripExtension(req.file.originalname);
    res.type("image/png").attachment(`${fileName}-no-bg.png`).send(resultBuffer);
  }
);

export default router;

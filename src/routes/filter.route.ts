import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../types/index.js";
import { applyFilter, assertSupportedFilter } from "../utils/filters.js";
import { stripExtension } from "../utils/filename.js";
import type { SingleFileRequest } from "../types/index.js";

const router = Router();

const bodySchema = z.object({
  filter: z.string().min(1),
});

router.post("/add-filter", upload.single("file"), async (req: SingleFileRequest, res) => {
  if (!req.file) throw new ApiError(400, "A file is required.");

  const { filter } = bodySchema.parse(req.body);
  const filterName = assertSupportedFilter(filter.toLowerCase());

  const output = await applyFilter(sharp(req.file.buffer), filterName).png().toBuffer();

  const fileName = stripExtension(req.file.originalname);
  res.type("image/png").attachment(`${fileName}-${filterName}.png`).send(output);
});

export default router;

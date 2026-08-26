import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../config/db.js";
import { UserModel } from "../models/User.model.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../types/index.js";
import type { AuthedRequest } from "../types/index.js";

const router = Router();

// Only /auth/* routes touch the database — other tools (resize, compress, etc.)
// stay fully independent of Mongo being configured or reachable.
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: "Account service is unavailable right now." });
  }
});

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

router.post("/auth/register", async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);

  const existing = await UserModel.findOne({ email });
  if (existing) throw new ApiError(409, "An account with that email already exists.");

  const passwordHash = await hashPassword(password);
  const user = await UserModel.create({ email, passwordHash });

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, plan: user.plan },
  });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);

  const user = await UserModel.findOne({ email });
  if (!user) throw new ApiError(401, "Invalid email or password.");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password.");

  const token = signToken({ sub: user.id, email: user.email });
  res.json({
    token,
    user: { id: user.id, email: user.email, plan: user.plan },
  });
});

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  // requireAuth guarantees req.user is set, but re-fetch so plan/email stay current.
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw new ApiError(404, "Account no longer exists.");

  res.json({ user: { id: user.id, email: user.email, plan: user.plan } });
});

export default router;

import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Free vs. paid tier — handy hook for gating premium tools/limits later.
    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);

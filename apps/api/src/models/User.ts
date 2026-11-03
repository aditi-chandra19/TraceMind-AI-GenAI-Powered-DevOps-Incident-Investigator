import { model, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "analyst", "viewer"], default: "analyst", required: true },
  disabled: { type: Boolean, default: false }
}, { timestamps: true });

export type UserRecord = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);

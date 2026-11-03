import { model, Schema } from 'mongoose';

const sessionSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false },
);

export const SessionModel = model('Session', sessionSchema);

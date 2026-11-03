import { model, Schema } from 'mongoose';

const logSourceSchema = new Schema(
  {
    originalName: { type: String, required: true, maxlength: 180 },
    sizeBytes: { type: Number, required: true, min: 0 },
    lineCount: { type: Number, required: true, min: 0 },
    incidentId: { type: String, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    redacted: { type: Boolean, default: true },
    format: { type: String, enum: ['jsonl', 'json', 'text'], required: true },
  },
  { timestamps: true, versionKey: false },
);

export const LogSourceModel = model('LogSource', logSourceSchema);

import { model, Schema } from "mongoose";

const logEntrySchema = new Schema({
  sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
  incidentId: { type: String, index: true },
  lineNumber: { type: Number, required: true },
  timestamp: { type: String, maxlength: 100 },
  level: { type: String, index: true },
  service: { type: String, maxlength: 160, index: true },
  message: { type: String, required: true, maxlength: 12000 }
}, { timestamps: true, versionKey: false });
logEntrySchema.index({ sourceId: 1, lineNumber: 1 }, { unique: true });

export const LogEntryModel = model("LogEntry", logEntrySchema);

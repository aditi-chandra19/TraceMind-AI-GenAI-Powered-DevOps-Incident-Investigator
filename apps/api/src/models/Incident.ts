import { model, Schema } from "mongoose";

const incidentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  service: { type: String, required: true, trim: true, maxlength: 100 },
  severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true, index: true },
  status: { type: String, enum: ["investigating", "identified", "monitoring", "resolved"], default: "investigating", required: true, index: true },
  startedAt: { type: String, required: true },
  duration: { type: String, default: "just now" },
  affectedUsers: { type: String, default: "0" },
  summary: { type: String, default: "", maxlength: 4000 },
  rootCause: { type: String, default: "Under investigation", maxlength: 1000 },
  confidence: { type: Number, default: 0, min: 0, max: 100 },
  signals: [{ label: String, value: Number, color: String }],
  timeline: [{ time: String, title: String, detail: String, kind: { type: String, enum: ["alert", "analysis", "action"] } }]
}, { timestamps: true, versionKey: false });

export const IncidentModel = model("Incident", incidentSchema);

import { model, Schema } from "mongoose";

const auditLogSchema = new Schema({
  actorId: { type: String, index: true },
  actorEmail: { type: String, maxlength: 254 },
  action: { type: String, required: true, maxlength: 100 },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, maxlength: 160 },
  details: { type: Schema.Types.Mixed }
}, { timestamps: true, versionKey: false });
auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = model("AuditLog", auditLogSchema);

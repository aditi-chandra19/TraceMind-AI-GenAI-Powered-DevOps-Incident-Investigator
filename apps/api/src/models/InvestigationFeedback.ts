import { model, Schema } from 'mongoose';

const investigationFeedbackSchema = new Schema(
  {
    incidentId: { type: String, required: true, index: true, maxlength: 40 },
    actorId: { type: String, required: true, maxlength: 100 },
    actorEmail: { type: String, required: true, maxlength: 254 },
    rating: { type: String, required: true, enum: ['helpful', 'not-helpful'] },
    comment: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);

export const InvestigationFeedbackModel = model(
  'InvestigationFeedback',
  investigationFeedbackSchema,
);

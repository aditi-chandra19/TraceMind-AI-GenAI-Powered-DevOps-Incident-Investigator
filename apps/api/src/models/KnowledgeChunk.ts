import { model, Schema } from 'mongoose';

const knowledgeChunkSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    sourcePath: { type: String, required: true },
    lineStart: { type: Number, required: true },
    lineEnd: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true, versionKey: false },
);

export const KnowledgeChunkModel = model('KnowledgeChunk', knowledgeChunkSchema);

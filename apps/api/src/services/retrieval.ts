import { embed, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { runbookSections, type RunbookSection } from '../data/runbooks.js';
import { KnowledgeChunkModel } from '../models/KnowledgeChunk.js';
import { databaseReady } from './memoryStore.js';

export interface RetrievedSection extends RunbookSection {
  score: number;
}
const memoryEmbeddings = new Map<string, number[]>();
const terms = (input: string) => input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
function lexicalScore(query: string, text: string) {
  const q = new Set(terms(query));
  const d = new Set(terms(text));
  if (!q.size || !d.size) return 0;
  let common = 0;
  for (const term of q) if (d.has(term)) common += 1;
  return common / Math.sqrt(q.size * d.size);
}

async function queryEmbedding(query: string) {
  if (!process.env.OPENAI_API_KEY) return undefined;
  try {
    const { embedding } = await embed({
      model: openai.embedding(process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'),
      value: query.slice(0, 2000),
      abortSignal: AbortSignal.timeout(8000),
    });
    return embedding;
  } catch {
    return undefined;
  }
}

export async function searchKnowledge(
  query: string,
  limit = 4,
): Promise<{ results: RetrievedSection[]; mode: 'semantic' | 'keyword' }> {
  const vector = await queryEmbedding(query);
  let chunks: (RunbookSection & { embedding?: number[] })[];
  if (databaseReady()) {
    chunks = (await KnowledgeChunkModel.find().lean()).map((chunk) => ({
      id: chunk.key,
      title: chunk.title,
      sourcePath: chunk.sourcePath,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      text: chunk.text,
      embedding: chunk.embedding,
    }));
  } else {
    chunks = runbookSections.map((chunk) => ({
      ...chunk,
      embedding: memoryEmbeddings.get(chunk.id),
    }));
  }
  if (vector) {
    const missing = chunks.filter((chunk) => !chunk.embedding?.length);
    if (missing.length) {
      try {
        const { embeddings } = await import('ai').then(({ embedMany }) =>
          embedMany({
            model: openai.embedding(process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'),
            values: missing.map((chunk) => chunk.text.slice(0, 6000)),
            abortSignal: AbortSignal.timeout(12000),
          }),
        );
        for (const [index, chunk] of missing.entries()) {
          const embedding = embeddings[index];
          if (!embedding) continue;
          if (databaseReady())
            await KnowledgeChunkModel.updateOne({ key: chunk.id }, { $set: { embedding } });
          else memoryEmbeddings.set(chunk.id, embedding);
          chunk.embedding = embedding;
        }
      } catch {
        /* keyword retrieval remains available */
      }
    }
    const ranked = chunks
      .filter((chunk) => chunk.embedding?.length)
      .map((chunk) => ({ ...chunk, score: cosineSimilarity(vector, chunk.embedding!) }));
    if (ranked.length)
      return {
        results: ranked.sort((a, b) => b.score - a.score).slice(0, limit),
        mode: 'semantic',
      };
  }
  return {
    results: chunks
      .map((chunk) => ({ ...chunk, score: lexicalScore(query, `${chunk.title} ${chunk.text}`) }))
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
    mode: 'keyword',
  };
}

export async function seedKnowledge() {
  if (!databaseReady()) return;
  for (const chunk of runbookSections) {
    await KnowledgeChunkModel.updateOne(
      { key: chunk.id },
      { $setOnInsert: { ...chunk, key: chunk.id } },
      { upsert: true },
    );
  }
}

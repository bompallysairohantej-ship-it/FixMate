import mongoose from 'mongoose';
import { env, assertConfig } from '../config/env.js';
import { KnowledgeChunk, ServiceListing } from '../models/index.js';
assertConfig();
await mongoose.connect(env.mongo);
try {
  for (const [model, name, flag] of [
    [KnowledgeChunk, env.knowledgeIndex, 'approved'],
    [ServiceListing, env.serviceIndex, 'published'],
  ]) {
    await model.createCollection();
    const definition = {
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: Number(process.env.VECTOR_DIMENSIONS || 768),
          similarity: 'cosine',
        },
        { type: 'filter', path: 'category' },
        { type: 'filter', path: flag },
      ],
    };
    const existing = await model.listSearchIndexes();
    if (existing.some((i) => i.name === name)) await model.updateSearchIndex(name, definition);
    else await model.createSearchIndex({ name, type: 'vectorSearch', definition });
    console.log(`${name}: submitted. Wait until the Atlas index is queryable before testing RAG.`);
  }
} finally {
  await mongoose.disconnect();
}

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
export const env = {
  port: Number(process.env.PORT || 4000),
  production: process.env.NODE_ENV === 'production',
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwt: process.env.JWT_SECRET,
  mongo: process.env.MONGODB_URI,
  ai: process.env.AI_ENABLED === 'true',
  ollama: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2',
  embedding: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  knowledgeIndex: process.env.KNOWLEDGE_INDEX || 'knowledge_vector',
  serviceIndex: process.env.SERVICE_INDEX || 'services_vector',
};
export function assertConfig() {
  if (!env.jwt || env.jwt.length < 32)
    throw new Error(
      'JWT_SECRET must contain at least 32 random characters. Copy .env.example to .env or run npm run demo.'
    );
  if (!env.mongo) throw new Error('MONGODB_URI is required. Configure Atlas or run npm run demo.');
}

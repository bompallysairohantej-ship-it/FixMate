import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { ZodError } from 'zod';
import { env, root } from './config/env.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import repairRoutes from './routes/repairs.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';
import aiRoutes from './routes/ai.js';
const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: env.origin, credentials: true }));
app.use(express.json({ limit: '120kb' }), cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== env.origin)
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    if (!origin && req.get('sec-fetch-site') === 'cross-site')
      return res.status(403).json({ error: 'Cross-site request rejected.' });
  }
  next();
});
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: process.env.NODE_ENV === 'test' ? 5000 : 240,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);
app.get('/api/health', (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? 'ready' : 'database-unavailable',
    demo: process.env.FIXMATE_DEMO === 'true',
    aiEnabled: env.ai,
    product: 'FixMate',
  })
);
app.use('/api/auth', authRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', catalogRoutes, uploadRoutes, aiRoutes);
// Compatibility paths use the same authorization middleware as their canonical routes.
app.patch('/api/shops/:id/verification', (req, res, next) => {
  req.url = `/shops/${req.params.id}/verification`;
  adminRoutes(req, res, next);
});
app.post('/api/shop-documents', (req, res, next) => {
  req.url = '/uploads';
  uploadRoutes(req, res, next);
});
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
const dist = path.join(root, 'client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (err.code === 11000)
    return res
      .status(409)
      .json({ error: 'This record already exists. Use a different email or refresh the page.' });
  if (err.name === 'CastError')
    return res.status(400).json({ error: 'Invalid record identifier.' });
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ error: 'Files must be 5 MB or smaller.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Something went wrong. Please retry or contact support.',
  });
});
export default app;

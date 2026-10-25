import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { auth, fail } from '../middleware/auth.js';
import {
  FileUpload,
  TechnicianProfile,
  RepairRequest,
  CustomerAppliance,
} from '../models/index.js';
import { id, z } from '../validators/index.js';
import { root } from '../config/env.js';
import { accessRepair } from '../services/repairs.js';
const router = Router();
router.use(auth);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
router.post('/uploads', upload.single('file'), async (req, res) => {
  const purpose = z.enum(['appliance', 'repair', 'verification']).parse(req.body.purpose);
  if (
    (purpose === 'verification' && req.user.role !== 'technician') ||
    (purpose !== 'verification' && req.user.role !== 'customer')
  )
    throw fail(403, 'This upload type is not available for your role.');
  if (!req.file) throw fail(400, 'Choose a file.');
  const type = await fileTypeFromBuffer(req.file.buffer);
  const allowed =
    purpose === 'verification'
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp'];
  if (!type || !allowed.includes(type.mime))
    throw fail(400, 'Upload a PNG, JPEG or WebP image, or a PDF verification document.');
  const dir = path.join(root, '.data/uploads');
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${type.ext}`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, req.file.buffer, { mode: 0o600 });
  let file;
  try {
    file = await FileUpload.create({
      owner: req.user._id,
      name: path.basename(req.file.originalname).slice(0, 200),
      mime: type.mime,
      purpose,
      path: filepath,
      size: req.file.size,
    });
    if (purpose === 'verification')
      await TechnicianProfile.updateOne(
        { user: req.user._id },
        { $addToSet: { documents: file._id } }
      );
  } catch (error) {
    await fs.unlink(filepath);
    throw error;
  }
  res.status(201).json({ _id: file._id, name: file.name, url: `/api/uploads/${file._id}` });
});
router.get('/uploads/:id', async (req, res) => {
  const file = await FileUpload.findById(id.parse(req.params.id));
  if (!file) throw fail(404, 'File not found.');
  let allowed =
    String(file.owner) === String(req.user._id) ||
    (req.user.role === 'admin' && file.purpose === 'verification');
  if (!allowed && file.purpose !== 'verification') {
    const appliance = await CustomerAppliance.findOne({ image: file._id });
    const repair = await RepairRequest.findOne({
      $or: [{ photos: file._id }, ...(appliance ? [{ appliance: appliance._id }] : [])],
    });
    if (repair) {
      await accessRepair(req.user, repair._id, true);
      allowed = true;
    }
  }
  if (!allowed) throw fail(403, 'This file is private.');
  res
    .set('Content-Type', file.mime)
    .set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
    .set('Cache-Control', 'private, no-store');
  res.sendFile(file.path, { dotfiles: 'allow' });
});
export default router;

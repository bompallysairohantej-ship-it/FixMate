import { transaction } from '../services/transaction.js';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { User, TechnicianProfile, RepairShop, ApplianceCategory } from '../models/index.js';
import { auth, fail, publicUser, session } from '../middleware/auth.js';
import { z, short, password, email } from '../validators/index.js';
import { env, root } from '../config/env.js';
const router = Router();
router.use(
  rateLimit({
    windowMs: 15 * 60000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 80,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  })
);
const register = z.object({
  name: short,
  email,
  phone: z.string().regex(/^[+\d ()-]{7,20}$/),
  password,
  city: short,
  address: short,
  shopName: short.optional(),
  categories: z.array(short).min(1).max(30).optional(),
  experience: z.number().int().min(0).max(70).optional(),
});
router.post('/:role/register', async (req, res) => {
  if (!['customer', 'technician'].includes(req.params.role))
    throw fail(404, 'Registration is not available.');
  const data = register.parse(req.body);
  const technician = req.params.role === 'technician';
  if (technician && (!data.shopName || !data.categories?.length))
    throw fail(400, 'Shop name and supported appliances are required.');
  if (
    technician &&
    (await ApplianceCategory.countDocuments({ slug: { $in: data.categories }, active: true })) !==
      data.categories.length
  )
    throw fail(400, 'Select supported appliance categories.');
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await transaction(async (s) => {
    const [u] = await User.create(
      [
        {
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: data.city,
          address: data.address,
          passwordHash,
          role: req.params.role,
        },
      ],
      { session: s }
    );
    if (technician) {
      await RepairShop.create(
        [
          {
            owner: u._id,
            name: data.shopName,
            address: data.address,
            city: data.city,
            categories: data.categories,
          },
        ],
        { session: s }
      );
      await TechnicianProfile.create(
        [{ user: u._id, experience: data.experience || 0, categories: data.categories }],
        { session: s }
      );
    }
    return u;
  });
  session(res, user);
  res.status(201).json({ user: publicUser(user) });
});
const dummyHash = bcrypt.hashSync('constant-time-missing-account-check', 12);
router.post('/:role/login', async (req, res) => {
  const data = z.object({ email, password: z.string().min(1).max(100) }).parse(req.body);
  const user = await User.findOne({ email: data.email, role: req.params.role }).select(
    '+passwordHash'
  );
  const valid = await bcrypt.compare(data.password, user?.passwordHash || dummyHash);
  if (!user || !valid) throw fail(401, 'Email or password is incorrect for this portal.');
  session(res, user);
  res.json({ user: publicUser(user) });
});
router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
router.post('/logout', auth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie('fixmate_session', { path: '/' });
  res.json({ ok: true });
});
router.post('/forgot-password', async (req, res) => {
  const data = z.object({ email }).parse(req.body);
  const user = await User.findOne({ email: data.email });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetExpires = new Date(Date.now() + 30 * 60000);
    await user.save();
    const url = `${env.origin}/reset-password?token=${token}`;
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: 'Reset your FixMate password',
        text: `Reset your password within 30 minutes: ${url}`,
      });
    } else if (process.env.FIXMATE_DEMO === 'true') {
      await fs.mkdir(path.join(root, '.data'), { recursive: true });
      await fs.writeFile(
        path.join(root, '.data/password-reset.txt'),
        `Demo-only recovery for ${user.email}\n${url}\n`,
        { mode: 0o600 }
      );
    }
  }
  res.json({
    message:
      'If this account exists, recovery instructions will be sent. Demo installations save recovery links in .data/password-reset.txt.',
  });
});
router.post('/reset-password', async (req, res) => {
  const data = z.object({ token: z.string().regex(/^[a-f\d]{64}$/), password }).parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.findOneAndUpdate(
    {
      resetHash: crypto.createHash('sha256').update(data.token).digest('hex'),
      resetExpires: { $gt: new Date() },
    },
    { $set: { passwordHash }, $unset: { resetHash: 1, resetExpires: 1 }, $inc: { tokenVersion: 1 } }
  );
  if (!user) throw fail(400, 'This recovery link is invalid or has expired.');
  res.json({ ok: true });
});
export default router;

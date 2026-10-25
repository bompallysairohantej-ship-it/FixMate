import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
export function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
export async function auth(req, res, next) {
  try {
    const token = req.cookies.fixmate_session;
    if (!token) throw fail(401, 'Please sign in to continue.');
    const claims = jwt.verify(token, env.jwt, {
      algorithms: ['HS256'],
      issuer: 'fixmate',
      audience: 'fixmate-web',
    });
    const user = await User.findById(claims.sub);
    if (!user || user.tokenVersion !== claims.v) throw fail(401, 'Your session has expired.');
    req.user = user;
    next();
  } catch (e) {
    next(e.status ? e : fail(401, 'Your session has expired. Please sign in again.'));
  }
}
export const role =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : next(fail(403, 'This action is not available for your role.'));
export function session(res, user) {
  const token = jwt.sign({ v: user.tokenVersion }, env.jwt, {
    subject: String(user._id),
    expiresIn: '8h',
    issuer: 'fixmate',
    audience: 'fixmate-web',
  });
  res.cookie('fixmate_session', token, {
    httpOnly: true,
    secure: env.production,
    sameSite: 'strict',
    maxAge: 8 * 3600000,
    path: '/',
  });
}
export const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  city: u.city,
  address: u.address,
});

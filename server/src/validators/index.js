import { z } from 'zod';
export { z };
export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record identifier');
export const short = z.string().trim().min(1).max(200);
export const prose = z.string().trim().min(3).max(4000);
export const password = z
  .string()
  .min(10)
  .max(72)
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes');
export const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const date = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
export const amount = z
  .number()
  .finite()
  .min(0)
  .max(1000000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-7, 'Use at most two decimal places');
export const parse = (schema, body) => schema.parse(body);

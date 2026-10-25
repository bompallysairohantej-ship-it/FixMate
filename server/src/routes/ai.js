import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth, role, fail } from '../middleware/auth.js';
import { z, short, prose, id } from '../validators/index.js';
import { assist, matchShops, detectCategory } from '../ai/rag.js';
import { ChatSession, RepairRequest, SupportInvestigation, AuditLog } from '../models/index.js';
const router = Router();
router.use(auth);
router.post('/shop-matching', async (req, res) => {
  const data = z
    .object({
      message: z.string().max(4000).default(''),
      category: short.optional(),
      city: z.string().max(200).default(''),
    })
    .parse(req.body);
  res.json(await matchShops(data));
});
router.use(
  ['/repair-chat', '/repair-agent'],
  role('customer'),
  rateLimit({
    windowMs: 60000,
    limit: 20,
    message: { error: 'Please wait a moment before sending another message.' },
  })
);
router.post(['/repair-chat', '/repair-agent'], async (req, res) => {
  const data = z
    .object({
      message: prose,
      category: short.optional(),
      sessionId: id.optional(),
      history: z.boolean().default(false),
    })
    .parse(req.body);
  let chat = data.sessionId
    ? await ChatSession.findOne({ _id: data.sessionId, user: req.user._id })
    : await ChatSession.create({ user: req.user._id, messages: [] });
  if (!chat) throw fail(404, 'Conversation not found.');
  if (chat.messages.length >= 60) throw fail(400, 'Start a new conversation to continue.');
  let result;
  if (data.history) {
    const repairs = await RepairRequest.find({ customer: req.user._id })
      .populate('appliance', 'brand model')
      .sort('-createdAt')
      .limit(15);
    result = {
      mode: 'private-history',
      sources: [],
      answer: repairs.length
        ? repairs
            .map(
              (r) =>
                `${r.appliance?.brand} ${r.appliance?.model}: ${r.status.replaceAll('_', ' ')}${r.finalTotal !== undefined ? `; final charge INR ${r.finalTotal}` : ''}.`
            )
            .join('\n')
        : 'You have no repair requests yet.',
      question: 'Open My Requests to view findings, quotations, and the full timeline.',
    };
  } else {
    let category = data.category;
    if (!category && !(await detectCategory(data.message))) {
      for (const m of [...chat.messages].reverse().filter((m) => m.role === 'user')) {
        const found = await detectCategory(m.content);
        if (found) {
          category = found.slug;
          break;
        }
      }
    }
    result = await assist(data.message, category);
  }
  await ChatSession.updateOne(
    { _id: chat._id, user: req.user._id },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: data.message, at: new Date() },
            {
              role: 'assistant',
              content: result.answer,
              sources: result.sources.map((s) => s.title),
              at: new Date(),
            },
          ],
        },
      },
    }
  );
  res.json({ ...result, sessionId: chat._id });
});
router.get('/chat-sessions/:id', role('customer'), async (req, res) => {
  const chat = await ChatSession.findOne({ _id: id.parse(req.params.id), user: req.user._id });
  if (!chat) throw fail(404, 'Conversation not found.');
  res.json(chat);
});
router.get('/support-requests', role('customer'), async (req, res) => {
  const repairs = await RepairRequest.find({ customer: req.user._id }).select('_id');
  res.json(
    await SupportInvestigation.find({
      repair: { $in: repairs.map((r) => r._id) },
      status: 'pending',
    })
  );
});
router.post('/support-requests/:id/authorize', role('customer'), async (req, res) => {
  const inv = await SupportInvestigation.findById(id.parse(req.params.id));
  if (!inv || !(await RepairRequest.exists({ _id: inv.repair, customer: req.user._id })))
    throw fail(404, 'Support request not found.');
  if (inv.status !== 'pending') throw fail(409, 'This request is no longer pending.');
  inv.status = 'authorized';
  inv.authorizedBy = req.user._id;
  inv.authorizedAt = new Date();
  inv.expiresAt = new Date(Date.now() + 24 * 3600000);
  await inv.save();
  await AuditLog.create({
    actor: req.user._id,
    action: 'investigation.authorize',
    target: String(inv._id),
    reason: inv.reason,
  });
  res.json(inv);
});
export default router;

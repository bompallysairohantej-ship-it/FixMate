import { transaction } from '../services/transaction.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import { auth, role, fail } from '../middleware/auth.js';
import { z, id, short, prose, date, amount } from '../validators/index.js';
import {
  RepairRequest,
  RepairShop,
  CustomerAppliance,
  ApplianceCategory,
  ServiceListing,
  Inspection,
  Quotation,
  RepairStatusHistory,
  FileUpload,
  Notification,
  Review,
} from '../models/index.js';
import { accessRepair, verifiedShop, recordStatus, transition } from '../services/repairs.js';
const router = Router();
router.use(auth);
router.get('/', async (req, res) => {
  let filter;
  if (req.user.role === 'customer') filter = { customer: req.user._id };
  else if (req.user.role === 'technician') {
    const shop = await RepairShop.findOne({ owner: req.user._id });
    filter = { shop: shop?._id || null };
  } else
    throw fail(
      403,
      'Use aggregated administrator analytics or an authorized support investigation.'
    );
  res.json(
    await RepairRequest.find(filter)
      .populate('appliance')
      .populate('shop', 'name city')
      .sort('-createdAt')
      .limit(200)
  );
});
router.post('/', role('customer'), async (req, res) => {
  const data = z
    .object({
      appliance: id,
      shop: id,
      symptoms: prose,
      city: short,
      address: prose,
      appointment: date,
      photos: z.array(id).max(5).default([]),
    })
    .parse(req.body);
  if (data.appointment < new Date()) throw fail(400, 'Choose a future preferred appointment.');
  const appliance = await CustomerAppliance.findOne({
    _id: data.appliance,
    owner: req.user._id,
    archived: false,
  });
  if (!appliance) throw fail(404, 'Appliance not found.');
  if (!(await ApplianceCategory.exists({ slug: appliance.category, active: true })))
    throw fail(400, 'This appliance category is unavailable.');
  const shop = await RepairShop.findOne({
    _id: data.shop,
    verification: 'approved',
    active: true,
    categories: appliance.category,
  });
  if (
    !shop ||
    shop.city.toLowerCase() !== data.city.toLowerCase() ||
    !(await ServiceListing.exists({
      shop: shop._id,
      category: appliance.category,
      published: true,
    }))
  )
    throw fail(400, 'Choose an active verified shop with a published service in your city.');
  if (
    (await FileUpload.countDocuments({
      _id: { $in: data.photos },
      owner: req.user._id,
      purpose: 'repair',
    })) !== data.photos.length
  )
    throw fail(403, 'Invalid repair photos.');
  const repair = await transaction(async (session) => {
    const [r] = await RepairRequest.create(
      [{ ...data, customer: req.user._id, category: appliance.category }],
      { session }
    );
    await RepairStatusHistory.create(
      [
        {
          repair: r._id,
          actor: req.user._id,
          status: 'REQUESTED',
          note: 'Appointment preference submitted; confirmation awaits shop acceptance.',
        },
      ],
      { session }
    );
    await Notification.create(
      [{ user: shop.owner, repair: r._id, message: 'A new repair request is ready to review.' }],
      { session }
    );
    return r;
  });
  res.status(201).json(repair);
});
router.get('/:id', async (req, res) => {
  const repair = await accessRepair(req.user, id.parse(req.params.id), true);
  await repair.populate([
    { path: 'appliance' },
    { path: 'shop', select: 'name city address' },
    { path: 'customer', select: 'name phone' },
  ]);
  const [history, inspection, quotes, review] = await Promise.all([
    RepairStatusHistory.find({ repair: repair._id }).sort('createdAt'),
    Inspection.findOne({ repair: repair._id }),
    Quotation.find({ repair: repair._id }).sort('-revision'),
    Review.findOne({ repair: repair._id }),
  ]);
  res.json({ repair, history, inspection, quotes, review });
});
router.patch('/:id/status', async (req, res) => {
  const data = z
    .object({
      status: short,
      note: prose,
      finalWork: prose.optional(),
      replacedParts: z.string().max(2000).optional(),
      finalTotal: amount.optional(),
    })
    .parse(req.body);
  if (data.status === 'REPAIR_COMPLETED' && data.finalTotal === undefined)
    throw fail(400, 'Final charges are required.');
  res.json(await transition(req.user, id.parse(req.params.id), data.status, data.note, data));
});
router.post('/:id/inspection', role('technician'), async (req, res) => {
  const repair = await accessRepair(req.user, id.parse(req.params.id));
  await verifiedShop(req.user);
  const data = z
    .object({
      symptoms: prose,
      findings: prose,
      diagnosis: prose,
      parts: z.string().max(2000).default(''),
      estimatedHours: z.number().min(0.1).max(1000),
    })
    .parse(req.body);
  const result = await transaction(async (session) => {
    const current = await RepairRequest.findById(repair._id).session(session);
    if (current.status !== 'INSPECTION_SCHEDULED')
      throw fail(409, 'Schedule the inspection before recording findings.');
    const [inspection] = await Inspection.create(
      [{ ...data, repair: current._id, technician: req.user._id }],
      { session }
    );
    await recordStatus(current, 'INSPECTED', req.user._id, data.findings, session);
    return inspection;
  });
  res.status(201).json(result);
});
router.get('/:id/quotes', async (req, res) => {
  await accessRepair(req.user, id.parse(req.params.id), true);
  res.json(await Quotation.find({ repair: req.params.id }).sort('-revision'));
});
router.post('/:id/quotes', role('technician'), async (req, res) => {
  await accessRepair(req.user, id.parse(req.params.id));
  await verifiedShop(req.user);
  const data = z
    .object({
      items: z
        .array(z.object({ label: short, amount }))
        .min(1)
        .max(25),
      estimatedCompletion: date,
      validUntil: date,
    })
    .parse(req.body);
  if (data.validUntil < new Date() || data.estimatedCompletion < data.validUntil)
    throw fail(400, 'Quote validity must be in the future and no later than estimated completion.');
  const result = await transaction(async (session) => {
    const repair = await RepairRequest.findById(req.params.id).session(session);
    if (!['INSPECTED', 'QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_REJECTED'].includes(repair.status))
      throw fail(409, 'A quotation cannot be issued at this stage.');
    const inspection = await Inspection.findOne({ repair: repair._id }).session(session);
    if (!inspection) throw fail(409, 'Record the inspection first.');
    const revision = (await Quotation.countDocuments({ repair: repair._id }).session(session)) + 1;
    await Quotation.updateMany(
      { repair: repair._id, status: 'pending' },
      { status: 'superseded' },
      { session }
    );
    const [quote] = await Quotation.create(
      [
        {
          ...data,
          total: data.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,
          findings: inspection.findings,
          diagnosis: inspection.diagnosis,
          repair: repair._id,
          technician: req.user._id,
          revision,
        },
      ],
      { session }
    );
    await recordStatus(
      repair,
      'QUOTE_SENT',
      req.user._id,
      `Quotation revision ${revision} sent for customer approval.`,
      session
    );
    return quote;
  });
  res.status(201).json(result);
});
router.post('/:id/quote-approval', role('customer'), async (req, res) => {
  await accessRepair(req.user, id.parse(req.params.id));
  const data = z
    .object({
      quoteId: id,
      decision: z.enum(['approved', 'rejected', 'clarification']),
      note: z.string().trim().max(2000).default(''),
    })
    .parse(req.body);
  const result = await transaction(async (session) => {
    const repair = await RepairRequest.findById(req.params.id).session(session);
    const quote = await Quotation.findOne({
      _id: data.quoteId,
      repair: repair._id,
      status: 'pending',
    }).session(session);
    if (!quote || repair.status !== 'QUOTE_SENT')
      throw fail(409, 'This quotation is no longer pending. Refresh to see the latest revision.');
    if (data.decision === 'clarification') {
      if (data.note.length < 3) throw fail(400, 'Enter your question.');
      quote.clarification = data.note;
      await quote.save({ session });
      const shop = await RepairShop.findById(repair.shop).session(session);
      await Notification.create(
        [
          {
            user: shop.owner,
            repair: repair._id,
            message: `Quotation clarification: ${data.note}`,
          },
        ],
        { session }
      );
      return quote;
    }
    if (data.decision === 'approved' && quote.validUntil < new Date())
      throw fail(409, 'The quotation has expired. Ask your technician for a new revision.');
    quote.status = data.decision;
    quote.decisionNote = data.note;
    quote.decidedAt = new Date();
    await quote.save({ session });
    if (data.decision === 'approved')
      await RepairRequest.updateOne({ _id: repair._id }, { approvedQuote: quote._id }, { session });
    await recordStatus(
      repair,
      data.decision === 'approved' ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
      req.user._id,
      data.note || `Customer ${data.decision} quotation revision ${quote.revision}.`,
      session
    );
    return quote;
  });
  res.json(result);
});
export default router;

import { Router } from 'express';
import { auth, role, fail, publicUser } from '../middleware/auth.js';
import { z, id, short, prose } from '../validators/index.js';
import {
  User,
  RepairShop,
  ApplianceCategory,
  RepairRequest,
  TechnicianProfile,
  AuditLog,
  Notification,
  Review,
  KnowledgeDocument,
  SupportInvestigation,
  ServiceListing,
} from '../models/index.js';
import { indexKnowledge, indexServices } from '../ai/rag.js';
const router = Router();
router.use(auth, role('admin'));
const audit = (req, action, target, reason) =>
  AuditLog.create({ actor: req.user._id, action, target: String(target), reason });
router.get('/overview', async (req, res) => {
  const [customers, technicians, verified, pending, active, completed] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'technician' }),
    RepairShop.countDocuments({ verification: 'approved', active: true }),
    RepairShop.countDocuments({ verification: 'pending' }),
    RepairRequest.countDocuments({ status: { $nin: ['CLOSED', 'CANCELLED', 'DECLINED'] } }),
    RepairRequest.countDocuments({ status: 'CLOSED' }),
  ]);
  res.json({ customers, technicians, verified, pending, active, completed });
});
router.get('/analytics', async (req, res) => {
  const [categories, monthly, workload, verification, statuses] = await Promise.all([
    RepairRequest.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    RepairRequest.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    RepairRequest.aggregate([
      { $match: { status: { $nin: ['CLOSED', 'CANCELLED', 'DECLINED'] } } },
      { $group: { _id: '$shop', count: { $sum: 1 } } },
      { $lookup: { from: 'repairshops', localField: '_id', foreignField: '_id', as: 'shop' } },
      { $project: { _id: 0, name: { $arrayElemAt: ['$shop.name', 0] }, count: 1 } },
    ]),
    RepairShop.aggregate([{ $group: { _id: '$verification', count: { $sum: 1 } } }]),
    RepairRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({ categories, monthly, workload, verification, statuses });
});
router.get('/pending-shops', async (req, res) =>
  res.json(await RepairShop.find({ verification: 'pending' }).populate('owner', 'name email phone'))
);
router.get('/shops', async (req, res) => {
  const shops = await RepairShop.find().populate('owner', 'name email phone').lean();
  res.json(
    await Promise.all(
      shops.map(async (shop) => ({
        ...shop,
        profile: await TechnicianProfile.findOne({ user: shop.owner._id }),
        services: await ServiceListing.find({ shop: shop._id }),
      }))
    )
  );
});
router.patch('/shops/:id/verification', async (req, res) => {
  const data = z
    .object({ verification: z.enum(['approved', 'rejected']), reason: prose })
    .parse(req.body);
  const shop = await RepairShop.findById(id.parse(req.params.id));
  if (!shop) throw fail(404, 'Shop not found.');
  const profile = await TechnicianProfile.findOne({ user: shop.owner });
  if (data.verification === 'approved' && !shop.demo && !profile?.documents?.length)
    throw fail(409, 'Review at least one uploaded verification document before approval.');
  Object.assign(shop, data);
  await shop.save();
  await audit(req, `shop.${data.verification}`, shop._id, data.reason);
  await Notification.create({
    user: shop.owner,
    message: `Shop verification ${data.verification}: ${data.reason}`,
  });
  res.json(shop);
});
router.patch('/shops/:id/active', async (req, res) => {
  const data = z.object({ active: z.boolean(), reason: prose }).parse(req.body);
  const shop = await RepairShop.findByIdAndUpdate(
    id.parse(req.params.id),
    { active: data.active, reason: data.reason },
    { returnDocument: 'after' }
  );
  if (!shop) throw fail(404, 'Shop not found.');
  await audit(req, data.active ? 'shop.activate' : 'shop.suspend', shop._id, data.reason);
  res.json(shop);
});
router.get('/customers', async (req, res) =>
  res.json((await User.find({ role: 'customer' }).limit(200)).map(publicUser))
);
router.get('/categories', async (req, res) =>
  res.json(await ApplianceCategory.find().sort('group name'))
);
const category = z.object({
  slug: z
    .string()
    .regex(/^[a-z]+(?:-[a-z]+)*$/)
    .max(80),
  name: short,
  group: z.enum(['Cooling', 'Laundry', 'Kitchen', 'Household electrical']),
  description: prose,
  symptoms: z.array(short).min(1).max(10),
  active: z.boolean().default(true),
});
router.post('/categories', async (req, res) => {
  const data = category.parse(req.body);
  const c = await ApplianceCategory.create(data);
  await audit(req, 'category.create', c._id, c.name);
  res.status(201).json(c);
});
router.patch('/categories/:id', async (req, res) => {
  const data = category.omit({ slug: true }).partial().parse(req.body);
  const c = await ApplianceCategory.findByIdAndUpdate(id.parse(req.params.id), data, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!c) throw fail(404, 'Category not found.');
  await audit(req, 'category.update', c._id, JSON.stringify(data));
  res.json(c);
});
router.get('/reviews', async (req, res) =>
  res.json(await Review.find({ 'reports.0': { $exists: true } }).sort('-updatedAt'))
);
router.patch('/reviews/:id', async (req, res) => {
  const data = z.object({ hidden: z.boolean(), moderationReason: prose }).parse(req.body);
  const review = await Review.findByIdAndUpdate(id.parse(req.params.id), data, {
    returnDocument: 'after',
  });
  if (!review) throw fail(404, 'Review not found.');
  await audit(req, 'review.moderate', review._id, data.moderationReason);
  res.json(review);
});
router.get('/knowledge-documents', async (req, res) =>
  res.json(await KnowledgeDocument.find().sort('-createdAt'))
);
router.post('/knowledge-documents', async (req, res) => {
  const data = z
    .object({
      title: short,
      category: short,
      source: short,
      content: z.string().trim().min(30).max(80000),
    })
    .parse(req.body);
  if (!(await ApplianceCategory.exists({ slug: data.category, active: true })))
    throw fail(400, 'Choose a supported category.');
  const doc = await KnowledgeDocument.create({ ...data, uploadedBy: req.user._id });
  await audit(req, 'knowledge.approve', doc._id, doc.title);
  res.status(201).json(doc);
});
router.post('/knowledge-documents/reindex', async (req, res) => {
  const documents = await KnowledgeDocument.find({ approved: true });
  for (const doc of documents) await indexKnowledge(doc);
  const services = await indexServices();
  await audit(
    req,
    'knowledge.reindex',
    'all',
    `${documents.length} documents, ${services} services`
  );
  res.json({ documents: documents.length, services });
});
router.get('/audit-logs', async (req, res) =>
  res.json(await AuditLog.find().populate('actor', 'name role').sort('-createdAt').limit(200))
);
router.get('/investigations', async (req, res) =>
  res.json(await SupportInvestigation.find({ requestedBy: req.user._id }).sort('-createdAt'))
);
router.post('/investigations', async (req, res) => {
  const data = z.object({ repair: id, reason: prose }).parse(req.body);
  if (!(await RepairRequest.exists({ _id: data.repair }))) throw fail(404, 'Repair not found.');
  const inv = await SupportInvestigation.create({ ...data, requestedBy: req.user._id });
  await audit(req, 'investigation.request', inv._id, data.reason);
  res.status(201).json(inv);
});
router.post('/investigations/:id/close', async (req, res) => {
  const inv = await SupportInvestigation.findOneAndUpdate(
    { _id: id.parse(req.params.id), requestedBy: req.user._id },
    { status: 'closed' },
    { returnDocument: 'after' }
  );
  if (!inv) throw fail(404, 'Investigation not found.');
  await audit(req, 'investigation.close', inv._id, inv.reason);
  res.json(inv);
});
export default router;

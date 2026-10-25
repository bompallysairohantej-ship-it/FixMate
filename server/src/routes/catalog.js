import { Router } from 'express';
import { auth, role, fail, publicUser } from '../middleware/auth.js';
import { z, id, short, prose, amount } from '../validators/index.js';
import {
  ApplianceCategory,
  CustomerAppliance,
  RepairShop,
  TechnicianProfile,
  ServiceListing,
  Review,
  RepairRequest,
  Notification,
  User,
  FileUpload,
} from '../models/index.js';
const router = Router();
router.get('/categories', async (req, res) =>
  res.json(await ApplianceCategory.find({ active: true }).sort('group name'))
);
router.get('/shops', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  let shops = await RepairShop.find({
    verification: 'approved',
    active: true,
    ...(category ? { categories: category } : {}),
  })
    .select('-reason')
    .lean();
  if (city) shops = shops.filter((s) => s.city.toLowerCase() === city.toLowerCase());
  const result = await Promise.all(
    shops.map(async (shop) => {
      const services = await ServiceListing.find({
        shop: shop._id,
        published: true,
        ...(category ? { category } : {}),
      });
      const stats = await Review.aggregate([
        { $match: { shop: shop._id, hidden: false } },
        { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      return {
        ...shop,
        services,
        rating: stats[0]?.rating || null,
        reviewCount: stats[0]?.count || 0,
      };
    })
  );
  res.json(result.filter((s) => s.services.length));
});
router.get('/shops/:id/reviews', async (req, res) => {
  const shop = await RepairShop.exists({
    _id: id.parse(req.params.id),
    verification: 'approved',
    active: true,
  });
  if (!shop) throw fail(404, 'Shop not found.');
  res.json(
    await Review.find({ shop: req.params.id, hidden: false })
      .select('rating comment createdAt')
      .sort('-createdAt')
      .limit(100)
  );
});
router.get('/shops/:id', async (req, res) => {
  const shop = await RepairShop.findOne({
    _id: id.parse(req.params.id),
    verification: 'approved',
    active: true,
  }).select('-reason');
  if (!shop) throw fail(404, 'Shop not found.');
  res.json({ shop, services: await ServiceListing.find({ shop: shop._id, published: true }) });
});
router.use(auth);
router.get('/profile', async (req, res) =>
  res.json({
    user: publicUser(req.user),
    shop: req.user.role === 'technician' ? await RepairShop.findOne({ owner: req.user._id }) : null,
    technician:
      req.user.role === 'technician'
        ? await TechnicianProfile.findOne({ user: req.user._id })
        : null,
  })
);
router.patch('/profile', async (req, res) => {
  const data = z
    .object({ name: short, phone: z.string().max(30), city: short, address: short })
    .parse(req.body);
  const user = await User.findByIdAndUpdate(req.user._id, data, {
    returnDocument: 'after',
    runValidators: true,
  });
  res.json(publicUser(user));
});
router.get('/notifications', async (req, res) =>
  res.json(await Notification.find({ user: req.user._id }).sort('-createdAt').limit(100))
);
router.patch('/notifications/:id', async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: id.parse(req.params.id), user: req.user._id },
    { read: true },
    { returnDocument: 'after' }
  );
  if (!n) throw fail(404, 'Notification not found.');
  res.json(n);
});
const applianceSchema = z.object({
  category: short,
  brand: short,
  model: short,
  purchaseYear: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
  serial: z.string().max(200).optional(),
  image: id.optional(),
  warranty: z.string().max(1000).optional(),
});
async function checkAppliance(data, user) {
  if (!(await ApplianceCategory.exists({ slug: data.category, active: true })))
    throw fail(400, 'Select a supported appliance.');
  if (
    data.image &&
    !(await FileUpload.exists({ _id: data.image, owner: user._id, purpose: 'appliance' }))
  )
    throw fail(403, 'Invalid appliance image.');
}
router.get('/appliances', role('customer'), async (req, res) =>
  res.json(
    await CustomerAppliance.find({ owner: req.user._id, archived: false }).sort('-createdAt')
  )
);
router.post('/appliances', role('customer'), async (req, res) => {
  const data = applianceSchema.parse(req.body);
  await checkAppliance(data, req.user);
  res.status(201).json(await CustomerAppliance.create({ ...data, owner: req.user._id }));
});
router.get('/appliances/:id', role('customer'), async (req, res) => {
  const a = await CustomerAppliance.findOne({
    _id: id.parse(req.params.id),
    owner: req.user._id,
    archived: false,
  });
  if (!a) throw fail(404, 'Appliance not found.');
  res.json(a);
});
router.patch('/appliances/:id', role('customer'), async (req, res) => {
  const data = applianceSchema.parse(req.body);
  await checkAppliance(data, req.user);
  if (
    await RepairRequest.exists({
      appliance: req.params.id,
      status: { $nin: ['CLOSED', 'CANCELLED', 'DECLINED'] },
    })
  )
    throw fail(409, 'Appliances with active requests cannot be changed.');
  const a = await CustomerAppliance.findOneAndUpdate(
    { _id: id.parse(req.params.id), owner: req.user._id, archived: false },
    data,
    { returnDocument: 'after', runValidators: true }
  );
  if (!a) throw fail(404, 'Appliance not found.');
  res.json(a);
});
router.delete('/appliances/:id', role('customer'), async (req, res) => {
  if (
    await RepairRequest.exists({
      appliance: req.params.id,
      customer: req.user._id,
      status: { $nin: ['CLOSED', 'CANCELLED', 'DECLINED'] },
    })
  )
    throw fail(409, 'Close or cancel active repairs before archiving this appliance.');
  const a = await CustomerAppliance.findOneAndUpdate(
    { _id: id.parse(req.params.id), owner: req.user._id },
    { archived: true }
  );
  if (!a) throw fail(404, 'Appliance not found.');
  res.json({ ok: true });
});
router.get('/my-shop', role('technician'), async (req, res) => {
  const shop = await RepairShop.findOne({ owner: req.user._id });
  res.json({ shop, services: shop ? await ServiceListing.find({ shop: shop._id }) : [] });
});
router.post('/shops', role('technician'), async (req, res) => {
  if (await RepairShop.exists({ owner: req.user._id }))
    throw fail(409, 'Your account already has a shop.');
  const data = z
    .object({ name: short, address: prose, city: short, categories: z.array(short).min(1) })
    .parse(req.body);
  if (
    (await ApplianceCategory.countDocuments({ slug: { $in: data.categories }, active: true })) !==
    data.categories.length
  )
    throw fail(400, 'Unsupported appliance category.');
  res.status(201).json(await RepairShop.create({ ...data, owner: req.user._id }));
});
router.patch('/shops/:id', role('technician'), async (req, res) => {
  const data = z.object({ name: short, address: prose, city: short }).parse(req.body);
  const shop = await RepairShop.findOneAndUpdate(
    { _id: id.parse(req.params.id), owner: req.user._id },
    {
      ...data,
      verification: 'pending',
      reason: 'Shop identity changed; re-verification required.',
    },
    { returnDocument: 'after' }
  );
  if (!shop) throw fail(404, 'Shop not found.');
  res.json(shop);
});
router.post('/services', role('technician'), async (req, res) => {
  const data = z
    .object({
      category: short,
      title: short,
      description: prose,
      inspectionPrice: amount,
      published: z.boolean().default(true),
    })
    .parse(req.body);
  const shop = await RepairShop.findOne({ owner: req.user._id });
  if (
    !shop?.categories.includes(data.category) ||
    !(await ApplianceCategory.exists({ slug: data.category, active: true }))
  )
    throw fail(400, 'Choose a supported category registered for your shop.');
  res.status(201).json(await ServiceListing.create({ ...data, shop: shop._id }));
});
router.patch('/services/:id', role('technician', 'admin'), async (req, res) => {
  const data = z.object({ published: z.boolean() }).parse(req.body);
  const service = await ServiceListing.findById(id.parse(req.params.id));
  if (!service) throw fail(404, 'Service not found.');
  if (
    req.user.role === 'technician' &&
    !(await RepairShop.exists({ _id: service.shop, owner: req.user._id }))
  )
    throw fail(403, 'This service belongs to another shop.');
  service.published = data.published;
  await service.save();
  res.json(service);
});
router.post('/reviews', role('customer'), async (req, res) => {
  const data = z
    .object({ repair: id, rating: z.number().int().min(1).max(5), comment: prose })
    .parse(req.body);
  const repair = await RepairRequest.findOne({
    _id: data.repair,
    customer: req.user._id,
    status: 'CLOSED',
  });
  if (!repair) throw fail(403, 'Only your own closed repairs can be reviewed.');
  res.status(201).json(await Review.create({ ...data, shop: repair.shop, customer: req.user._id }));
});
router.post('/reviews/:id/report', async (req, res) => {
  const { reason } = z.object({ reason: prose }).parse(req.body);
  const review = await Review.findOneAndUpdate(
    { _id: id.parse(req.params.id), 'reports.by': { $ne: req.user._id } },
    { $push: { reports: { by: req.user._id, reason, at: new Date() } } },
    { returnDocument: 'after' }
  );
  if (!review) throw fail(409, 'Review not found or already reported.');
  res.json({ ok: true });
});
export default router;

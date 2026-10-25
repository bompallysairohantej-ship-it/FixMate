import bcrypt from 'bcrypt';
import {
  User,
  TechnicianProfile,
  RepairShop,
  ApplianceCategory,
  CustomerAppliance,
  RepairRequest,
  Inspection,
  Quotation,
  RepairStatusHistory,
  ServiceListing,
  KnowledgeDocument,
  Review,
} from '../models/index.js';
const groups = {
  Cooling: ['Refrigerator', 'Air conditioner', 'Air cooler', 'Freezer'],
  Laundry: ['Washing machine', 'Clothes dryer'],
  Kitchen: [
    'Microwave oven',
    'Mixer grinder',
    'Induction stove',
    'Electric kettle',
    'Electric chimney',
    'Toaster',
    'Dishwasher',
    'Rice cooker',
    'Air fryer',
    'Coffee maker',
  ],
  'Household electrical': [
    'Television',
    'Electric fan',
    'Vacuum cleaner',
    'Water purifier',
    'Electric iron',
    'Water heater',
    'Room heater',
  ],
};
export async function seed({
  password,
  adminEmail = 'admin@fixmate.demo',
  adminPassword = password,
}) {
  for (const [group, names] of Object.entries(groups))
    for (const name of names) {
      const slug = name.toLowerCase().replaceAll(' ', '-');
      await ApplianceCategory.updateOne(
        { slug },
        {
          $setOnInsert: {
            slug,
            name,
            group,
            description: `Inspection, servicing, and repair for your ${name.toLowerCase()}.`,
            symptoms: ['Not starting', 'Unusual noise', 'Reduced performance'],
            active: true,
          },
        },
        { upsert: true }
      );
    }
  const hash = await bcrypt.hash(password, 12);
  const adminHash = adminPassword === password ? hash : await bcrypt.hash(adminPassword, 12);
  const users = [];
  for (const [name, email, role] of [
    ['Aarav Sharma', 'customer@fixmate.demo', 'customer'],
    ['Rohan Mehta', 'technician@fixmate.demo', 'technician'],
    ['Meera Patel', 'pending@fixmate.demo', 'technician'],
    ['FixMate Administrator', adminEmail, 'admin'],
  ]) {
    let user = await User.findOne({ email });
    if (!user)
      user = await User.create({
        name,
        email,
        role,
        passwordHash: role === 'admin' ? adminHash : hash,
        phone: '9000000000',
        city: 'Bengaluru',
        address: '24 Example Avenue, Indiranagar, Bengaluru',
      });
    users.push(user);
  }
  const [customer, tech, pending, admin] = users;
  const categories = [
    'washing-machine',
    'refrigerator',
    'air-conditioner',
    'microwave-oven',
    'television',
  ];
  const shops = [];
  for (const [owner, name, verification] of [
    [tech, 'Green Circuit Repairs', 'approved'],
    [pending, 'HomeSpark Workshop', 'pending'],
  ]) {
    let shop = await RepairShop.findOne({ owner: owner._id });
    if (!shop)
      shop = await RepairShop.create({
        owner: owner._id,
        name,
        city: 'Bengaluru',
        address: '12 Demo Street, Indiranagar, Bengaluru',
        categories,
        verification,
        demo: true,
      });
    shops.push(shop);
    await TechnicianProfile.updateOne(
      { user: owner._id },
      { $setOnInsert: { user: owner._id, categories, experience: 7, documents: [] } },
      { upsert: true }
    );
    for (const category of categories)
      await ServiceListing.updateOne(
        { shop: shop._id, category },
        {
          $setOnInsert: {
            shop: shop._id,
            category,
            title: `${category.replaceAll('-', ' ')} inspection & repair`,
            description:
              'Professional fault inspection, itemized quotation, and repair only after your approval.',
            inspectionPrice: 299,
            published: true,
          },
        },
        { upsert: true }
      );
  }
  const shop = shops[0];
  let appliance = await CustomerAppliance.findOne({ owner: customer._id });
  if (!appliance) {
    appliance = await CustomerAppliance.create({
      owner: customer._id,
      category: 'washing-machine',
      brand: 'DemoHome',
      model: 'Front Load 7 kg',
      purchaseYear: 2023,
      warranty: 'Sample appliance — no actual warranty.',
    });
    await CustomerAppliance.create({
      owner: customer._id,
      category: 'refrigerator',
      brand: 'DemoHome',
      model: 'Frost Free 260L',
      purchaseYear: 2022,
    });
  }
  if (!(await RepairRequest.exists({ customer: customer._id }))) {
    const repair = await RepairRequest.create({
      customer: customer._id,
      shop: shop._id,
      appliance: appliance._id,
      category: appliance.category,
      symptoms: 'Loud vibration and noise during the spin cycle. Sample completed service.',
      city: 'Bengaluru',
      address: customer.address,
      appointment: new Date(Date.now() - 3 * 86400000),
      status: 'CLOSED',
      finalWork: 'Sample service: balanced the appliance and replaced worn shock absorbers.',
      replacedParts: 'Shock absorber pair',
      finalTotal: 1499,
    });
    await Inspection.create({
      repair: repair._id,
      technician: tech._id,
      symptoms: repair.symptoms,
      findings: 'Sample inspection: worn suspension components.',
      diagnosis: 'Sample diagnosis: worn shock absorbers.',
      parts: 'Shock absorber pair',
      estimatedHours: 2,
    });
    const quote = await Quotation.create({
      repair: repair._id,
      technician: tech._id,
      revision: 1,
      findings: 'Sample inspection: worn suspension components.',
      diagnosis: 'Sample diagnosis: worn shock absorbers.',
      items: [
        { label: 'Inspection', amount: 299 },
        { label: 'Parts', amount: 800 },
        { label: 'Labor', amount: 400 },
      ],
      total: 1499,
      estimatedCompletion: new Date(),
      validUntil: new Date(),
      status: 'approved',
      decidedAt: new Date(Date.now() - 86400000),
    });
    repair.approvedQuote = quote._id;
    await repair.save();
    const statuses = [
      'REQUESTED',
      'ACCEPTED',
      'INSPECTION_SCHEDULED',
      'INSPECTED',
      'QUOTE_PENDING',
      'QUOTE_SENT',
      'QUOTE_APPROVED',
      'REPAIR_IN_PROGRESS',
      'REPAIR_COMPLETED',
      'READY_FOR_COLLECTION',
      'CLOSED',
    ];
    await RepairStatusHistory.insertMany(
      statuses.map((status, i) => ({
        repair: repair._id,
        actor: ['REQUESTED', 'QUOTE_APPROVED', 'CLOSED'].includes(status) ? customer._id : tech._id,
        status,
        note: 'Clearly labeled sample service history.',
        createdAt: new Date(Date.now() - (12 - i) * 3600000),
      }))
    );
    await Review.create({
      repair: repair._id,
      customer: customer._id,
      shop: shop._id,
      rating: 5,
      comment: 'Sample review: clear pricing and helpful updates throughout the repair.',
    });
  }
  for (const category of categories)
    await KnowledgeDocument.updateOne(
      { category, title: `Safe ${category.replaceAll('-', ' ')} symptom checklist` },
      {
        $setOnInsert: {
          category,
          title: `Safe ${category.replaceAll('-', ' ')} symptom checklist`,
          source: 'FixMate demonstration knowledge — administrator-reviewed sample guidance',
          content:
            category === 'washing-machine'
              ? 'Unusual noise during spinning can have several possible causes, including an uneven load, an unstable installation, or worn components. Observe whether the noise happens only during spinning and note any displayed error code. Follow only the normal user checks in your manufacturer’s manual. Do not open the machine or touch wiring. A qualified technician must inspect the appliance before confirming a fault or a repair price.'
              : `Poor performance in a ${category.replaceAll('-', ' ')} may have several causes. Note when the symptom occurs and any visible error code. Follow only the normal user checks in the manufacturer’s manual. Do not open the casing, touch wiring, or service high-voltage or refrigerant components. A qualified technician must inspect the appliance before confirming a fault or price.`,
          approved: true,
          uploadedBy: admin._id,
        },
      },
      { upsert: true }
    );
  return users.map((u) => ({ email: u.email, role: u.role }));
}

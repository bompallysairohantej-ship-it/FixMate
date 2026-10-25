import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const text = (required = false) => ({ type: String, trim: true, maxlength: 5000, required });
const money = { type: Number, min: 0, max: 10000000 };
const make = (name, fields, indexes = []) => {
  const s = new Schema(fields, { timestamps: true, strict: 'throw' });
  indexes.forEach(([keys, options]) => s.index(keys, options));
  return mongoose.model(name, s);
};
export const STATUSES = [
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
  'DECLINED',
  'CANCELLED',
  'QUOTE_REJECTED',
];
export const User = make('User', {
  name: text(true),
  email: { type: String, lowercase: true, trim: true, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'technician', 'admin'], required: true },
  phone: text(),
  city: text(),
  address: text(),
  tokenVersion: { type: Number, default: 0 },
  resetHash: { type: String, select: false },
  resetExpires: { type: Date, select: false },
});
export const TechnicianProfile = make('TechnicianProfile', {
  user: { ...ref('User'), unique: true },
  experience: { type: Number, min: 0, max: 70 },
  categories: [String],
  documents: [{ type: Schema.Types.ObjectId, ref: 'FileUpload' }],
});
export const RepairShop = make(
  'RepairShop',
  {
    owner: { ...ref('User'), unique: true },
    name: text(true),
    address: text(true),
    city: text(true),
    categories: [String],
    verification: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    active: { type: Boolean, default: true },
    reason: text(),
    demo: { type: Boolean, default: false },
  },
  [[{ city: 1, verification: 1, active: 1 }]]
);
export const ApplianceCategory = make('ApplianceCategory', {
  slug: { type: String, unique: true, required: true },
  name: text(true),
  group: text(true),
  description: text(true),
  symptoms: [String],
  active: { type: Boolean, default: true },
});
export const CustomerAppliance = make(
  'CustomerAppliance',
  {
    owner: ref('User'),
    category: text(true),
    brand: text(true),
    model: text(true),
    purchaseYear: { type: Number, min: 1950, max: 2100 },
    serial: text(),
    image: ref('FileUpload', false),
    warranty: text(),
    archived: { type: Boolean, default: false },
  },
  [[{ owner: 1, archived: 1 }]]
);
export const RepairRequest = make(
  'RepairRequest',
  {
    customer: ref('User'),
    shop: ref('RepairShop'),
    appliance: ref('CustomerAppliance'),
    category: text(true),
    symptoms: text(true),
    address: text(true),
    city: text(true),
    appointment: { type: Date, required: true },
    photos: [{ type: Schema.Types.ObjectId, ref: 'FileUpload' }],
    status: { type: String, enum: STATUSES, default: 'REQUESTED' },
    approvedQuote: ref('Quotation', false),
    finalWork: text(),
    replacedParts: text(),
    finalTotal: money,
  },
  [[{ customer: 1, createdAt: -1 }], [{ shop: 1, status: 1 }]]
);
export const Inspection = make('Inspection', {
  repair: { ...ref('RepairRequest'), unique: true },
  technician: ref('User'),
  symptoms: text(true),
  findings: text(true),
  diagnosis: text(true),
  parts: text(),
  estimatedHours: { type: Number, min: 0, max: 1000 },
});
export const Quotation = make(
  'Quotation',
  {
    repair: ref('RepairRequest'),
    technician: ref('User'),
    revision: { type: Number, required: true },
    findings: text(true),
    diagnosis: text(true),
    items: [{ label: { type: String, required: true }, amount: money }],
    total: money,
    estimatedCompletion: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'superseded'],
      default: 'pending',
    },
    clarification: text(),
    decisionNote: text(),
    decidedAt: Date,
  },
  [[{ repair: 1, revision: 1 }, { unique: true }]]
);
export const RepairStatusHistory = make(
  'RepairStatusHistory',
  {
    repair: ref('RepairRequest'),
    actor: ref('User'),
    status: { type: String, enum: STATUSES, required: true },
    note: text(),
  },
  [[{ repair: 1, createdAt: 1 }]]
);
export const Review = make('Review', {
  repair: { ...ref('RepairRequest'), unique: true },
  customer: ref('User'),
  shop: ref('RepairShop'),
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: text(true),
  hidden: { type: Boolean, default: false },
  reports: [{ by: ref('User'), reason: text(true), at: Date }],
  moderationReason: text(),
});
export const Notification = make(
  'Notification',
  {
    user: ref('User'),
    message: text(true),
    repair: ref('RepairRequest', false),
    read: { type: Boolean, default: false },
  },
  [[{ user: 1, createdAt: -1 }]]
);
export const ServiceListing = make('ServiceListing', {
  shop: ref('RepairShop'),
  category: text(true),
  title: text(true),
  description: text(true),
  inspectionPrice: money,
  published: { type: Boolean, default: true },
  embedding: { type: [Number], select: false },
});
export const KnowledgeDocument = make('KnowledgeDocument', {
  title: text(true),
  category: text(true),
  content: { type: String, maxlength: 80000, required: true },
  source: text(true),
  approved: { type: Boolean, default: true },
  uploadedBy: ref('User'),
  indexedAt: Date,
});
export const KnowledgeChunk = make('KnowledgeChunk', {
  document: ref('KnowledgeDocument'),
  category: text(true),
  title: text(true),
  source: text(true),
  content: text(true),
  approved: { type: Boolean, default: true },
  embedding: { type: [Number], select: false },
});
export const ChatSession = make('ChatSession', {
  user: ref('User'),
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'] },
      content: text(true),
      sources: [String],
      at: Date,
    },
  ],
});
export const SupportInvestigation = make('SupportInvestigation', {
  repair: ref('RepairRequest'),
  requestedBy: ref('User'),
  reason: text(true),
  authorizedBy: ref('User', false),
  authorizedAt: Date,
  expiresAt: Date,
  status: { type: String, enum: ['pending', 'authorized', 'closed'], default: 'pending' },
});
export const AuditLog = make(
  'AuditLog',
  { actor: ref('User'), action: text(true), target: text(true), reason: text() },
  [[{ createdAt: -1 }]]
);
export const FileUpload = make('FileUpload', {
  owner: ref('User'),
  name: text(true),
  mime: text(true),
  path: text(true),
  purpose: { type: String, enum: ['appliance', 'repair', 'verification'], required: true },
  size: Number,
});

import { transaction } from './transaction.js';
import mongoose from 'mongoose';
import {
  RepairRequest,
  RepairShop,
  Quotation,
  RepairStatusHistory,
  Notification,
  AuditLog,
  SupportInvestigation,
} from '../models/index.js';
import { fail } from '../middleware/auth.js';
export const NEXT = {
  REQUESTED: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['INSPECTION_SCHEDULED'],
  INSPECTION_SCHEDULED: ['INSPECTED'],
  INSPECTED: ['QUOTE_PENDING'],
  QUOTE_PENDING: [],
  QUOTE_SENT: [],
  QUOTE_APPROVED: ['REPAIR_IN_PROGRESS'],
  REPAIR_IN_PROGRESS: ['REPAIR_COMPLETED'],
  REPAIR_COMPLETED: ['READY_FOR_COLLECTION'],
  READY_FOR_COLLECTION: ['CLOSED'],
  QUOTE_REJECTED: ['QUOTE_PENDING'],
};
export async function verifiedShop(user) {
  const shop = await RepairShop.findOne({ owner: user._id });
  if (!shop || shop.verification !== 'approved' || !shop.active)
    throw fail(403, 'An active, administrator-verified shop is required.');
  return shop;
}
export async function accessRepair(user, id, readOnly = false) {
  const repair = await RepairRequest.findById(id);
  if (!repair) throw fail(404, 'Repair not found.');
  if (user.role === 'customer' && String(repair.customer) === String(user._id)) return repair;
  if (user.role === 'technician') {
    const shop = await RepairShop.findOne({ owner: user._id });
    if (shop && String(shop._id) === String(repair.shop)) return repair;
  }
  if (user.role === 'admin' && readOnly) {
    const investigation = await SupportInvestigation.findOne({
      repair: id,
      requestedBy: user._id,
      status: 'authorized',
      expiresAt: { $gt: new Date() },
    });
    if (investigation) {
      await AuditLog.create({
        actor: user._id,
        action: 'investigation.read',
        target: id,
        reason: investigation.reason,
      });
      return repair;
    }
  }
  throw fail(403, 'You do not have access to this repair.');
}
export async function recordStatus(repair, status, actor, note, session) {
  const updated = await RepairRequest.findOneAndUpdate(
    { _id: repair._id, status: repair.status },
    { $set: { status }, $inc: { __v: 1 } },
    { returnDocument: 'after', session }
  );
  if (!updated) throw fail(409, 'This repair changed. Refresh and try again.');
  await RepairStatusHistory.create([{ repair: repair._id, status, actor, note }], { session });
  const shop = await RepairShop.findById(repair.shop).session(session);
  await Notification.create(
    [repair.customer, shop.owner]
      .filter((u) => String(u) !== String(actor))
      .map((user) => ({
        user,
        repair: repair._id,
        message: `Repair updated: ${status.toLowerCase().replaceAll('_', ' ')}.`,
      })),
    { session }
  );
  await AuditLog.create(
    [{ actor, action: `repair.${status}`, target: String(repair._id), reason: note }],
    { session }
  );
  return updated;
}
export async function transition(user, repairId, status, note, completion) {
  await accessRepair(user, repairId);
  if (user.role === 'technician') await verifiedShop(user);
  return transaction(async (session) => {
    const repair = await RepairRequest.findById(repairId).session(session);
    if (user.role === 'customer') {
      if (
        status === 'CANCELLED' &&
        [
          'REQUESTED',
          'ACCEPTED',
          'INSPECTION_SCHEDULED',
          'INSPECTED',
          'QUOTE_PENDING',
          'QUOTE_SENT',
          'QUOTE_REJECTED',
        ].includes(repair.status)
      )
        return recordStatus(repair, status, user._id, note, session);
      if (status === 'CLOSED' && repair.status === 'READY_FOR_COLLECTION')
        return recordStatus(repair, status, user._id, note, session);
      throw fail(403, 'Customers may cancel before approval or close a ready repair.');
    }
    if (
      user.role !== 'technician' ||
      !(NEXT[repair.status] || []).includes(status) ||
      status === 'INSPECTED'
    )
      throw fail(
        409,
        'This status transition is not allowed. Record an inspection or quotation when required.'
      );
    if (status === 'REPAIR_IN_PROGRESS') {
      const quote = await Quotation.findOne({
        _id: repair.approvedQuote,
        repair: repair._id,
        status: 'approved',
      }).session(session);
      if (!quote) throw fail(409, 'Customer approval is required before billable work.');
    }
    if (status === 'REPAIR_COMPLETED') {
      if (!completion?.finalWork)
        throw fail(400, 'Record the work performed before completing a repair.');
      const quote = await Quotation.findById(repair.approvedQuote).session(session);
      if (!quote || completion.finalTotal > quote.total)
        throw fail(409, 'Final charges cannot exceed the approved quotation.');
      await RepairRequest.updateOne(
        { _id: repairId },
        {
          finalWork: completion.finalWork,
          replacedParts: completion.replacedParts,
          finalTotal: completion.finalTotal,
        },
        { session }
      );
    }
    return recordStatus(repair, status, user._id, note, session);
  });
}

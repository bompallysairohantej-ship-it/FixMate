import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import crypto from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.AI_ENABLED = 'false';
const { default: app } = await import('../app.js');
const M = await import('../models/index.js');
const { seed } = await import('../seeds/data.js');
let db, customer, tech, admin, other, pending, shop, appliance, repairId, quoteId;
const password = 'IntegrationTest!123',
  future = (days) => new Date(Date.now() + days * 86400000).toISOString();
before(
  async () => {
    db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(db.getUri('fixmate_test'));
    await Promise.all(
      Object.values(M)
        .filter((m) => m?.init)
        .map((m) => m.init())
    );
    await seed({ password });
    customer = request.agent(app);
    tech = request.agent(app);
    admin = request.agent(app);
    other = request.agent(app);
    pending = request.agent(app);
    for (const [agent, role, email] of [
      [customer, 'customer', 'customer@fixmate.demo'],
      [tech, 'technician', 'technician@fixmate.demo'],
      [admin, 'admin', 'admin@fixmate.demo'],
      [pending, 'technician', 'pending@fixmate.demo'],
    ]) {
      const r = await agent.post(`/api/auth/${role}/login`).send({ email, password });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    const r = await other.post('/api/auth/customer/register').send({
      name: 'Other Customer',
      email: 'other@example.test',
      password,
      phone: '9000000001',
      city: 'Bengaluru',
      address: '24 Other Avenue',
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    shop = await M.RepairShop.findOne({ verification: 'approved' });
    appliance = await M.CustomerAppliance.findOne({ category: 'washing-machine' });
  },
  { timeout: 300000 }
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
test('public discovery includes only verified shops with published services', async () => {
  const r = await request(app).get('/api/shops?category=washing-machine');
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].verification, 'approved');
  assert.ok(r.body[0].services.length);
  assert.equal(r.body[0].demo, true);
});
test('admin registration is unavailable; roles, sessions and request origins are enforced', async () => {
  assert.equal((await request(app).post('/api/auth/admin/register').send({})).status, 404);
  assert.equal(
    (
      await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'customer@fixmate.demo', password })
    ).status,
    401
  );
  assert.equal((await request(app).get('/api/appliances')).status, 401);
  assert.equal((await customer.get('/api/admin/overview')).status, 403);
  assert.equal(
    (await customer.post('/api/auth/logout').set('Origin', 'https://evil.example').send({})).status,
    403
  );
});
test('appliance ownership and supported categories are enforced', async () => {
  assert.equal((await other.get(`/api/appliances/${appliance._id}`)).status, 404);
  assert.equal(
    (await customer.post('/api/appliances').send({ category: 'car', brand: 'Other', model: 'Car' }))
      .status,
    400
  );
  assert.equal(
    (
      await other.post('/api/repairs').send({
        appliance: String(appliance._id),
        shop: String(shop._id),
        symptoms: 'Noisy spin cycle',
        city: 'Bengaluru',
        address: '24 Test Lane',
        appointment: future(1),
      })
    ).status,
    404
  );
});
test('booking creates a shared record without exposing private data to outsiders', async () => {
  const r = await customer.post('/api/repairs').send({
    appliance: String(appliance._id),
    shop: String(shop._id),
    symptoms: 'Very noisy spin cycle',
    city: 'Bengaluru',
    address: '24 Test Lane',
    appointment: future(1),
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  repairId = r.body._id;
  for (const outsider of [other, admin, pending])
    assert.equal((await outsider.get(`/api/repairs/${repairId}`)).status, 403);
  assert.equal((await tech.get(`/api/repairs/${repairId}`)).status, 200);
});
test('no skipping inspection, technician self-approval or unauthorized status updates', async () => {
  assert.equal(
    (
      await tech
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'REPAIR_IN_PROGRESS', note: 'Attempted early start' })
    ).status,
    409
  );
  assert.equal((await tech.post(`/api/repairs/${repairId}/quote-approval`).send({})).status, 403);
  assert.equal(
    (
      await admin
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'ACCEPTED', note: 'Admin cannot update' })
    ).status,
    403
  );
  assert.equal(
    (
      await customer
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'ACCEPTED', note: 'Customer cannot accept' })
    ).status,
    403
  );
});
test('technician accepts, schedules, inspects and issues itemized quote', async () => {
  for (const status of ['ACCEPTED', 'INSPECTION_SCHEDULED']) {
    const r = await tech
      .patch(`/api/repairs/${repairId}/status`)
      .send({ status, note: `Updated to ${status}` });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const r = await tech.post(`/api/repairs/${repairId}/inspection`).send({
    symptoms: 'Loud noise during spinning',
    findings: 'Worn suspension components observed',
    diagnosis: 'Shock absorber replacement required',
    parts: 'Shock absorber pair',
    estimatedHours: 2,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const q = await tech.post(`/api/repairs/${repairId}/quotes`).send({
    items: [
      { label: 'Inspection', amount: 299 },
      { label: 'Parts', amount: 800 },
      { label: 'Labor', amount: 400 },
    ],
    validUntil: future(2),
    estimatedCompletion: future(3),
  });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  quoteId = q.body._id;
  assert.equal(q.body.total, 1499);
  assert.equal(q.body.revision, 1);
});
test('clarification, rejection and revisions preserve quotation history', async () => {
  assert.equal(
    (
      await customer
        .post(`/api/repairs/${repairId}/quote-approval`)
        .send({ quoteId, decision: 'clarification', note: 'Which replacement part is included?' })
    ).status,
    200
  );
  assert.equal(
    (
      await customer
        .post(`/api/repairs/${repairId}/quote-approval`)
        .send({ quoteId, decision: 'rejected', note: 'Please reduce the parts charge' })
    ).status,
    200
  );
  const q = await tech.post(`/api/repairs/${repairId}/quotes`).send({
    items: [
      { label: 'Inspection', amount: 299 },
      { label: 'Parts', amount: 700 },
      { label: 'Labor', amount: 400 },
    ],
    validUntil: future(2),
    estimatedCompletion: future(3),
  });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  assert.equal(q.body.revision, 2);
  assert.equal(q.body.total, 1399);
  const old = quoteId;
  quoteId = q.body._id;
  assert.equal(
    (
      await customer
        .post(`/api/repairs/${repairId}/quote-approval`)
        .send({ quoteId: old, decision: 'approved' })
    ).status,
    409
  );
  assert.equal((await customer.get(`/api/repairs/${repairId}/quotes`)).body.length, 2);
});
test('only owning customer approves; duplicate concurrent decisions cannot race', async () => {
  assert.equal(
    (
      await other
        .post(`/api/repairs/${repairId}/quote-approval`)
        .send({ quoteId, decision: 'approved' })
    ).status,
    403
  );
  const results = await Promise.all(
    [1, 2].map(() =>
      customer
        .post(`/api/repairs/${repairId}/quote-approval`)
        .send({ quoteId, decision: 'approved' })
    )
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await M.RepairRequest.findById(repairId)).status, 'QUOTE_APPROVED');
});
test('completion is capped at approved charges and customer closes the service', async () => {
  let r = await tech
    .patch(`/api/repairs/${repairId}/status`)
    .send({ status: 'REPAIR_IN_PROGRESS', note: 'Customer approved; beginning repair' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await tech.patch(`/api/repairs/${repairId}/status`).send({
    status: 'REPAIR_COMPLETED',
    note: 'Attempted excess charge',
    finalWork: 'Replaced shock absorbers',
    replacedParts: 'Shock absorber pair',
    finalTotal: 2000,
  });
  assert.equal(r.status, 409);
  r = await tech.patch(`/api/repairs/${repairId}/status`).send({
    status: 'REPAIR_COMPLETED',
    note: 'Work completed and tested',
    finalWork: 'Replaced shock absorbers and confirmed normal operation',
    replacedParts: 'Shock absorber pair',
    finalTotal: 1399,
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(
    (
      await tech
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'READY_FOR_COLLECTION', note: 'Ready for collection' })
    ).status,
    200
  );
  assert.equal(
    (
      await customer
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'CLOSED', note: 'Collected and confirmed' })
    ).status,
    200
  );
  const d = (await customer.get(`/api/repairs/${repairId}`)).body;
  assert.equal(d.repair.finalTotal, 1399);
  assert.equal(d.repair.status, 'CLOSED');
  assert.ok(d.history.length >= 10);
});
test('completed-service reviews enforce ownership and uniqueness', async () => {
  assert.equal(
    (
      await other
        .post('/api/reviews')
        .send({ repair: repairId, rating: 5, comment: 'Not my repair' })
    ).status,
    403
  );
  assert.equal(
    (
      await customer
        .post('/api/reviews')
        .send({ repair: repairId, rating: 5, comment: 'Helpful updates and transparent charges' })
    ).status,
    201
  );
  assert.equal(
    (
      await customer
        .post('/api/reviews')
        .send({ repair: repairId, rating: 4, comment: 'Duplicate review' })
    ).status,
    409
  );
});
test('support needs customer authorization and private reads are audited', async () => {
  const r = await admin.post('/api/admin/investigations').send({
    repair: repairId,
    reason: 'Investigate a customer question about the completed repair',
  });
  assert.equal(r.status, 201);
  assert.equal((await admin.get(`/api/repairs/${repairId}`)).status, 403);
  assert.equal((await other.post(`/api/support-requests/${r.body._id}/authorize`)).status, 404);
  assert.equal((await customer.post(`/api/support-requests/${r.body._id}/authorize`)).status, 200);
  assert.equal((await admin.get(`/api/repairs/${repairId}`)).status, 200);
  assert.ok(await M.AuditLog.exists({ action: 'investigation.read', target: repairId }));
  await admin.post(`/api/admin/investigations/${r.body._id}/close`);
  assert.equal((await admin.get(`/api/repairs/${repairId}`)).status, 403);
});
test('AI reference grounding, hazard response and private history', async () => {
  const r = await customer
    .post('/api/repair-chat')
    .send({ message: 'My washing machine makes a loud noise during spinning' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.mode, 'approved-guidance');
  assert.ok(r.body.sources.length);
  assert.equal(r.body.category, 'washing-machine');
  assert.equal((await other.get(`/api/chat-sessions/${r.body.sessionId}`)).status, 404);
  const hazard = await customer
    .post('/api/repair-chat')
    .send({ message: 'My washing machine is smoking with exposed wiring' });
  assert.equal(hazard.body.mode, 'safety');
  assert.equal(hazard.body.sources.length, 0);
  const history = await other
    .post('/api/repair-chat')
    .send({ message: 'Show my repair history', history: true });
  assert.match(history.body.answer, /no repair requests/);
});
test('uploads validate magic bytes and enforce file ownership', async () => {
  const bad = await customer
    .post('/api/uploads')
    .field('purpose', 'repair')
    .attach('file', Buffer.from('<script>alert(1)</script>'), 'photo.png');
  assert.equal(bad.status, 400);
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7wAAAABJRU5ErkJggg==',
    'base64'
  );
  const r = await customer
    .post('/api/uploads')
    .field('purpose', 'appliance')
    .attach('file', image, 'test.png');
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await other.get(`/api/uploads/${r.body._id}`)).status, 403);
  assert.equal((await customer.get(`/api/uploads/${r.body._id}`)).status, 200);
});
test('suspending shop removes public listing and prevents repair mutation', async () => {
  await admin
    .patch(`/api/admin/shops/${shop._id}/active`)
    .send({ active: false, reason: 'Temporary quality investigation' });
  assert.equal((await request(app).get('/api/shops')).body.length, 0);
  assert.equal(
    (
      await tech
        .patch(`/api/repairs/${repairId}/status`)
        .send({ status: 'REPAIR_IN_PROGRESS', note: 'Should be blocked' })
    ).status,
    403
  );
  await admin
    .patch(`/api/admin/shops/${shop._id}/active`)
    .send({ active: true, reason: 'Investigation resolved' });
});
test('database metrics and logout session revocation', async () => {
  const r = await admin.get('/api/admin/overview');
  assert.equal(r.status, 200);
  assert.equal(r.body.completed, 2);
  assert.equal(r.body.customers, 2);
  const cookie = (
    await request(app)
      .post('/api/auth/customer/login')
      .send({ email: 'other@example.test', password })
  ).headers['set-cookie'];
  await other.post('/api/auth/logout');
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookie)).status, 401);
});

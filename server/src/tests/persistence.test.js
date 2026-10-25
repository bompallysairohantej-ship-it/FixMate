import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { startLocalDatabase } from '../config/local-database.js';

test(
  'WiredTiger records survive a real local database process restart',
  { timeout: 90000 },
  async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fixmate-persistence-'));
    let local, client;
    try {
      local = await startLocalDatabase(directory, { port: 0, replicaSet: 'fixmate-persistence' });
      client = new mongoose.mongo.MongoClient(local.uri);
      await client.connect();
      await client
        .db('fixmate')
        .collection('persistence_checks')
        .insertOne({ marker: 'saved-before-restart', value: 42 });
      await client.close();
      client = null;
      await local.database.stop({ doCleanup: false, force: false });
      local = await startLocalDatabase(directory, { port: 0, replicaSet: 'fixmate-persistence' });
      client = new mongoose.mongo.MongoClient(local.uri);
      await client.connect();
      const document = await client
        .db('fixmate')
        .collection('persistence_checks')
        .findOne({ marker: 'saved-before-restart' });
      assert.equal(document.value, 42);
    } finally {
      if (client) await client.close();
      if (local) await local.database.stop({ doCleanup: false, force: false });
      const resolved = path.resolve(directory),
        temp = path.resolve(os.tmpdir());
      if (
        path.dirname(resolved) === temp &&
        path.basename(resolved).startsWith('fixmate-persistence-')
      )
        await fs.rm(resolved, { recursive: true, force: true });
    }
  }
);

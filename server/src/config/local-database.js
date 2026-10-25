import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
// The launcher manages a real mongod process. WiredTiger files survive shutdown.
// Reconcile the member address on restart, even if another process took the port.
export async function startLocalDatabase(dbPath, { port = 27018, replicaSet = 'testset' } = {}) {
  const database = await MongoMemoryServer.create({
    instance: {
      dbPath,
      port,
      storageEngine: 'wiredTiger',
      replSet: replicaSet,
      launchTimeout: 30000,
    },
  });
  const client = new mongoose.mongo.MongoClient(database.getUri(), { directConnection: true });
  try {
    await client.connect();
    const admin = client.db('admin');
    const host = `127.0.0.1:${database.instanceInfo.port}`;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        let config;
        try {
          ({ config } = await admin.command({ replSetGetConfig: 1 }));
        } catch (error) {
          if (error.code !== 94) throw error;
          await admin.command({
            replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host }] },
          });
        }
        if (config && (config.members.length !== 1 || config.members[0].host !== host)) {
          config.members = [{ _id: 0, host }];
          config.version += 1;
          await admin.command({ replSetReconfig: config, force: true });
        }
        break;
      } catch (error) {
        // Startup/reconfiguration can close sockets while the saved replica config loads.
        if (
          attempt === 14 ||
          (![23, 94, 11600, 11602].includes(error.code) && error.name !== 'MongoNetworkError')
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    await database.stop({ doCleanup: false });
    throw error;
  } finally {
    await client.close();
  }
  return {
    database,
    uri: `${database.getUri('fixmate')}?replicaSet=${replicaSet}&w=majority&journal=true`,
  };
}

import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
if (!uri) throw new Error('Missing MONGO_URL');

const globalForMongo = globalThis;
const clientPromise = globalForMongo.__mongoClientPromise || new MongoClient(uri).connect();
globalForMongo.__mongoClientPromise = clientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db(process.env.DB_NAME || 'aihiringpath');
}

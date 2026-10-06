const { MongoClient } = require('mongodb');

let clientPromise;

// Lazily create a single MongoClient, reused across invocations of the same
// warm serverless instance. Reads MONGODB_URI (MongoDB Atlas connection string)
// and uses the database named by MONGODB_DB (default "agz").
function getDb() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }
    clientPromise = new MongoClient(uri).connect().catch((err) => {
      clientPromise = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return clientPromise.then((client) => client.db(process.env.MONGODB_DB || 'agz'));
}

// Users keep small integer ids (the frontend passes them unquoted in onclick
// handlers), so they're allocated from a counter document.
async function nextUserId(db) {
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: 'users' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return result.seq;
}

module.exports = { getDb, nextUserId };

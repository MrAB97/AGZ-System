// AGZ Game Zone - Data API (Vercel serverless function + MongoDB)
//
// Usage:
//   GET  /api/data?resource=prices        -> returns a JSON array of all records
//   POST /api/data?resource=prices        -> body is a JSON array; replaces ALL records for that resource
//
// Valid resources: prices, media, tournaments, customers, stations, sales
//
// Auth: every request requires a valid session cookie (see api/auth.js).
// Write access (POST) to prices/media/tournaments is restricted to admins -
// staff can still read them, but can't create/edit/delete tournaments, the
// media catalog, or pricing. customers/stations/sales stay writable by staff
// since starting sessions, billing, and loyalty point redemption legitimately
// need to update those.
//
// This intentionally does a full "replace all records" on POST rather than
// granular create/update/delete per item, to match how the frontend already
// keeps its whole dataset in memory and saves it as one call after any change.

const { getDb } = require('../lib/db');
const { getUserFromRequest } = require('../lib/auth');

const VALID_RESOURCES = ['prices', 'media', 'tournaments', 'customers', 'stations', 'sales'];
const ADMIN_ONLY_WRITE = ['prices', 'media', 'tournaments'];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const currentUser = getUserFromRequest(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Not logged in.' });
    return;
  }

  const resource = req.query.resource || '';
  if (!VALID_RESOURCES.includes(resource)) {
    res.status(400).json({
      error: `Invalid or missing "resource" parameter. Must be one of: ${VALID_RESOURCES.join(', ')}`,
    });
    return;
  }

  // Each record is stored as { _id: <record id>, data: <record>, updated_at }.
  const collection = (await getDb()).collection(resource);

  if (req.method === 'GET') {
    const docs = await collection.find({}, { projection: { data: 1 } }).toArray();
    res.status(200).json(docs.map((d) => d.data));
    return;
  }

  if (req.method === 'POST') {
    if (ADMIN_ONLY_WRITE.includes(resource) && currentUser.role !== 'admin') {
      // Exception: allow the very first seed write even from a non-admin session, so a
      // brand new empty database still gets populated if a staff account happens to be
      // the first to log in. Once the collection has data, admin-only kicks in for real.
      const isEmpty = (await collection.estimatedDocumentCount()) === 0;
      if (!isEmpty) {
        res.status(403).json({ error: `Admin access required to modify ${resource}.` });
        return;
      }
    }

    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON array of records.' });
      return;
    }

    // sales is an append-only log: a browser tab holding an older copy must never be able to
    // wipe records written by another device, so saves only add/update records. Clearing the
    // log requires an explicit ?reset=1 from an admin (the "Reset to default" button).
    const appendOnly = resource === 'sales' && req.query.reset !== '1';
    if (resource === 'sales' && !appendOnly && currentUser.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required to clear sales history.' });
      return;
    }

    // skip malformed entries rather than failing the whole save
    const items = body.filter((item) => item && typeof item === 'object' && item.id !== undefined);
    const ids = items.map((item) => String(item.id));
    const now = new Date();

    try {
      if (items.length) {
        await collection.bulkWrite(items.map((item) => ({
          replaceOne: {
            filter: { _id: String(item.id) },
            replacement: { data: item, updated_at: now },
            upsert: true,
          },
        })), { ordered: false });
      }
      if (!appendOnly) {
        await collection.deleteMany({ _id: { $nin: ids } });
      }
      res.status(200).json({ success: true, count: items.length });
    } catch (err) {
      res.status(500).json({ error: 'Save failed.', details: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};

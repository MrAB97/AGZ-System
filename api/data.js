// AGZ Game Zone - Data API (Vercel serverless function + Postgres)
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

const { getPool } = require('../lib/db');
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

  // Safe to interpolate directly into SQL: validated against the fixed
  // whitelist above, never taken verbatim from user input.
  const table = resource;
  const pool = getPool();

  if (req.method === 'GET') {
    const { rows } = await pool.query(`SELECT data FROM "${table}"`);
    res.status(200).json(rows.map((r) => r.data));
    return;
  }

  if (req.method === 'POST') {
    if (ADMIN_ONLY_WRITE.includes(resource) && currentUser.role !== 'admin') {
      // Exception: allow the very first seed write even from a non-admin session, so a
      // brand new empty database still gets populated if a staff account happens to be
      // the first to log in. Once the table has data, admin-only kicks in for real.
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
      const isEmpty = parseInt(countResult.rows[0].count, 10) === 0;

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM "${table}"`);

      for (const item of body) {
        if (!item || typeof item !== 'object' || item.id === undefined) {
          continue; // skip malformed entries rather than failing the whole save
        }
        await client.query(
          `INSERT INTO "${table}" (id, data) VALUES ($1, $2)`,
          [String(item.id), JSON.stringify(item)]
        );
      }

      await client.query('COMMIT');
      res.status(200).json({ success: true, count: body.length });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Save failed.', details: err.message });
    } finally {
      client.release();
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};

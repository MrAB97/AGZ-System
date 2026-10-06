// AGZ Game Zone - First-Time Admin Setup (Vercel serverless function + MongoDB)
//
// Run this ONCE after the schema is created, to create (or reset) an admin
// account with a properly hashed password:
//
//   POST /api/setup
//   { "token": "<SETUP_TOKEN>", "username": "admin", "password": "...", "displayName": "Administrator" }
//
// Gated by the SETUP_TOKEN environment variable (set it in Vercel's project
// settings, matching what you pass in the request body). Unlike the old
// setup.php - which you deleted from disk after running once - a serverless
// endpoint can't delete itself, so instead: after you've created your admin
// account, remove the SETUP_TOKEN env var (or change it) to lock this route
// back down. With no SETUP_TOKEN configured, this endpoint always refuses.

const bcrypt = require('bcryptjs');
const { getDb, nextUserId } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const configuredToken = process.env.SETUP_TOKEN;
  if (!configuredToken) {
    res.status(403).json({ error: 'Setup is disabled (no SETUP_TOKEN configured).' });
    return;
  }

  const body = req.body || {};
  if (body.token !== configuredToken) {
    res.status(403).json({ error: 'Invalid setup token.' });
    return;
  }

  const username = (body.username || 'admin').trim();
  const password = body.password || '';
  const displayName = (body.displayName || 'Administrator').trim();

  if (!username || password.length < 4) {
    res.status(400).json({ error: 'Username is required and password must be at least 4 characters.' });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const db = await getDb();
  const users = db.collection('users');

  const existing = await users.findOne({ username });
  if (existing) {
    await users.updateOne(
      { username },
      { $set: { password_hash: hash, display_name: displayName, role: 'admin' } }
    );
  } else {
    await users.insertOne({
      id: await nextUserId(db),
      username,
      password_hash: hash,
      display_name: displayName,
      role: 'admin',
      created_at: new Date(),
    });
  }

  res.status(200).json({
    success: true,
    message: `Admin account "${username}" is ready. Remove or change SETUP_TOKEN now to lock this endpoint back down.`,
  });
};

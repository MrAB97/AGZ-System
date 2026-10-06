// AGZ Game Zone - Authentication API (Vercel serverless function + MongoDB)
//
// Actions (via ?action=...):
//   POST login          { username, password } -> sets an httpOnly JWT cookie
//   POST logout         -> clears the cookie
//   GET  me             -> current logged-in user, or 401 if not logged in
//   GET  list_users     -> (admin only) all user accounts
//   POST create_user    { username, password, displayName, role } -> (admin only)
//   POST delete_user    { id } -> (admin only)
//
// Auth is a signed JWT in an httpOnly cookie rather than a PHP-style server
// session, since serverless function instances don't share in-memory state.

const bcrypt = require('bcryptjs');
const { getDb, nextUserId } = require('../lib/db');
const { signToken, setAuthCookie, clearAuthCookie, getUserFromRequest } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action = req.query.action || '';
  const users = (await getDb()).collection('users');

  if (action === 'login' && req.method === 'POST') {
    const body = req.body || {};
    const username = (body.username || '').trim();
    const password = body.password || '';

    const user = await users.findOne({ username });

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const publicUser = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    setAuthCookie(res, signToken(publicUser));
    res.status(200).json({ success: true, user: publicUser });
    return;
  }

  if (action === 'logout') {
    clearAuthCookie(res);
    res.status(200).json({ success: true });
    return;
  }

  const currentUser = getUserFromRequest(req);

  if (action === 'me') {
    if (!currentUser) {
      res.status(401).json({ error: 'Not logged in.' });
      return;
    }
    res.status(200).json({ user: currentUser });
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (action === 'list_users' && req.method === 'GET') {
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const rows = await users
      .find({}, { projection: { _id: 0, password_hash: 0 } })
      .sort({ created_at: 1 })
      .toArray();
    res.status(200).json(rows);
    return;
  }

  if (action === 'create_user' && req.method === 'POST') {
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const body = req.body || {};
    const username = (body.username || '').trim();
    const password = body.password || '';
    const displayName = (body.displayName || username || '').trim();
    const role = ['admin', 'staff'].includes(body.role) ? body.role : 'staff';

    if (!username || password.length < 4) {
      res.status(400).json({ error: 'Username is required and password must be at least 4 characters.' });
      return;
    }

    if (await users.findOne({ username })) {
      res.status(400).json({ error: 'That username is already taken.' });
      return;
    }
    const hash = bcrypt.hashSync(password, 10);
    await users.insertOne({
      id: await nextUserId(await getDb()),
      username,
      password_hash: hash,
      display_name: displayName,
      role,
      created_at: new Date(),
    });
    res.status(200).json({ success: true });
    return;
  }

  if (action === 'delete_user' && req.method === 'POST') {
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const body = req.body || {};
    const id = parseInt(body.id, 10) || 0;

    if (id === parseInt(currentUser.id, 10)) {
      res.status(400).json({ error: "You can't delete the account you're currently logged in as." });
      return;
    }

    await users.deleteOne({ id });
    res.status(200).json({ success: true });
    return;
  }

  res.status(400).json({ error: 'Unknown action.' });
};

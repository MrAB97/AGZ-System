const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'agz_token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, displayName: user.displayName, role: user.role },
    getSecret(),
    { expiresIn: MAX_AGE_SECONDS }
  );
}

function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  }));
}

function getUserFromRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getSecret());
    return {
      id: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      role: payload.role,
    };
  } catch (err) {
    return null;
  }
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, getUserFromRequest };

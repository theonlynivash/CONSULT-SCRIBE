import jwt from 'jsonwebtoken';



const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = '7d';

export function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: EXPIRES_IN });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'not authenticated' });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

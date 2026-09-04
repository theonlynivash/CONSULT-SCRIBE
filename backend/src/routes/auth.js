import { Router } from 'express';
import { randomUUID, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { sendPasswordResetOtp } from '../lib/mailer.js';

export const authRouter = Router();

const OTP_TTL_MS = 10 * 60 * 1000;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
    specialty: user.specialty ?? null,
    workplaceType: user.workplaceType ?? null,
    workplaceName: user.workplaceName ?? null,
    workplaceAddress: user.workplaceAddress ?? null,
    workplacePhone: user.workplacePhone ?? null,
    workplaceEmail: user.workplaceEmail ?? null,
    workplaceLogo: user.workplaceLogo ?? null,
  };
}

const MAX_AVATAR_LENGTH = 4_000_000; // ~3MB image as base64

authRouter.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const normalizedEmail = email.trim().toLowerCase();

  await db.read();
  if (db.data.users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'an account with this email already exists' });
  }

  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };

  db.data.users.push(user);
  await db.write();

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const normalizedEmail = email.trim().toLowerCase();

  await db.read();
  const user = db.data.users.find((u) => u.email === normalizedEmail);
  if (!user) return res.status(401).json({ error: 'no account found for this email', code: 'no_account' });

  if (!user.passwordHash) {
    return res.status(401).json({ error: 'this account uses Google sign-in', code: 'google_account' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'invalid credentials', code: 'invalid_credentials' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// Google Identity Services returns a signed ID token straight to the
// frontend (no server-side redirect/callback needed) — we just verify it
// came from Google and matches our client ID, then create-or-link the user
// by email. Google already re-verifies email ownership on their end, so
// linking to an existing password account by matching email is safe.
authRouter.post('/google', async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google sign-in is not configured on this server' });

  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential is required' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'invalid Google credential' });
  }

  if (!payload?.email_verified) return res.status(401).json({ error: 'Google email is not verified' });

  const normalizedEmail = payload.email.trim().toLowerCase();

  await db.read();
  let user = db.data.users.find((u) => u.email === normalizedEmail);

  if (user) {
    if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatar) user.avatar = payload.picture ?? null;
      await db.write();
    }
  } else {
    user = {
      id: randomUUID(),
      name: payload.name || payload.email,
      email: normalizedEmail,
      googleId: payload.sub,
      avatar: payload.picture ?? null,
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    await db.write();
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// Always responds the same way regardless of whether the email exists, so
// this endpoint can't be used to check which emails have accounts.
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const normalizedEmail = email.trim().toLowerCase();

  await db.read();
  const user = db.data.users.find((u) => u.email === normalizedEmail);
  if (user) {
    const otp = String(randomInt(100000, 1000000));
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await db.write();
    await sendPasswordResetOtp({ to: user.email, otp });
  }

  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'email, otp and newPassword are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const normalizedEmail = email.trim().toLowerCase();

  await db.read();
  const user = db.data.users.find((u) => u.email === normalizedEmail);
  const expired = !user?.resetOtpExpiresAt || new Date(user.resetOtpExpiresAt) < new Date();
  const valid = user?.resetOtpHash && !expired && (await bcrypt.compare(otp, user.resetOtpHash));
  if (!valid) return res.status(400).json({ error: 'invalid or expired code' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  delete user.resetOtpHash;
  delete user.resetOtpExpiresAt;
  await db.write();

  res.json({ ok: true });
});

authRouter.patch('/avatar', requireAuth, async (req, res) => {
  const { avatar } = req.body;
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return res.status(400).json({ error: 'avatar must be an image data URL' });
  }
  if (avatar.length > MAX_AVATAR_LENGTH) {
    return res.status(413).json({ error: 'image is too large' });
  }

  await db.read();
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });

  user.avatar = avatar;
  await db.write();

  res.json(publicUser(user));
});

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const {
    specialty,
    workplaceType,
    workplaceName,
    workplaceAddress,
    workplacePhone,
    workplaceEmail,
    workplaceLogo,
  } = req.body;

  await db.read();
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });

  // PATCH semantics: only fields actually sent by the caller are changed.
  // This prevents saving one Settings section (for example Specialty) from
  // silently clearing the saved hospital/clinic letterhead.
  if (Object.prototype.hasOwnProperty.call(req.body, 'specialty')) {
    user.specialty = typeof specialty === 'string' ? specialty.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplaceType')) {
    user.workplaceType = workplaceType === 'clinic' || workplaceType === 'hospital' ? workplaceType : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplaceName')) {
    user.workplaceName = typeof workplaceName === 'string' ? workplaceName.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplaceAddress')) {
    user.workplaceAddress = typeof workplaceAddress === 'string' ? workplaceAddress.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplacePhone')) {
    user.workplacePhone = typeof workplacePhone === 'string' ? workplacePhone.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplaceEmail')) {
    user.workplaceEmail = typeof workplaceEmail === 'string' ? workplaceEmail.trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'workplaceLogo')) {
    if (workplaceLogo !== null && (typeof workplaceLogo !== 'string' || !workplaceLogo.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'workplace logo must be an image data URL or null' });
    }
    if (typeof workplaceLogo === 'string' && workplaceLogo.length > MAX_AVATAR_LENGTH) {
      return res.status(413).json({ error: 'workplace logo is too large' });
    }
    user.workplaceLogo = workplaceLogo;
  }
  await db.write();

  res.json(publicUser(user));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(publicUser(user));
});

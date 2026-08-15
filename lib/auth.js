import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)); } catch { return false; }
}

export function signToken(payload, days = 30) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + days * 86400000 }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (sig !== expected) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// Central access resolution per business rule priority.
export function computeAccess(user) {
  const now = Date.now();
  const roles = ['SUPER_ADMIN', 'ADMIN'];
  if (user && roles.includes(user.role)) {
    return { tier: 'premium', source: 'admin', label: 'Admin Full Access', trialDaysLeft: null, active: true };
  }
  if (user?.manualGrant && (!user.manualGrant.expiresAt || new Date(user.manualGrant.expiresAt).getTime() > now)) {
    return { tier: user.manualGrant.plan, source: 'manual_grant', label: `Granted: ${user.manualGrant.plan}`, note: user.manualGrant.note, active: true };
  }
  if (user?.subscription && user.subscription.status === 'active' && (!user.subscription.currentPeriodEnd || new Date(user.subscription.currentPeriodEnd).getTime() > now)) {
    return { tier: user.subscription.plan, source: 'subscription', label: `${user.subscription.plan} (paid)`, active: true };
  }
  if (user?.trialEndsAt && new Date(user.trialEndsAt).getTime() > now) {
    const daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - now) / 86400000);
    return { tier: 'premium', source: 'trial', label: 'Premium Trial', trialDaysLeft: daysLeft, trialEndsAt: user.trialEndsAt, active: true };
  }
  return { tier: 'free', source: 'free', label: 'Free Tier', active: false };
}

// Feature -> minimum tier required
export const FEATURE_TIER = {
  ats_basic: 'starter',
  resume_builder: 'professional',
  resume_rewrite: 'professional',
  roadmap: 'professional',
  unlimited_interviews: 'premium',
  career_coach: 'premium',
  portfolio: 'premium',
};
const TIER_RANK = { free: 0, starter: 1, professional: 2, premium: 3 };
export function hasFeature(access, feature) {
  const need = FEATURE_TIER[feature] || 'free';
  return (TIER_RANK[access.tier] ?? 0) >= (TIER_RANK[need] ?? 0);
}

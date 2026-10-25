
import {
  ANONYMOUS_SESSION_COOKIE,
  createAnonymousSessionCookie,
  createAnonymousSessionCookieValue,
  getFingerprintIdentityFromRequest,
  normalizeFingerprint,
  verifyAnonymousSessionCookieValue,
} from './current-user';
import { test, expect } from 'vitest';

const SECRET = 'test-secret-for-anonymous-session-binding';

function requestWith(headers: Record<string, string>) {
  return new Request('https://jadeai.test/api/resume', { headers });
}

test('fingerprint normalization preserves existing safe identifiers', () => {
  expect(normalizeFingerprint(' demo-fingerprint ')).toBe('demo-fingerprint');
  expect(normalizeFingerprint('7f7f9f8a9b8c7d6e5f4a')).toBe('7f7f9f8a9b8c7d6e5f4a');
  expect(normalizeFingerprint('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
});

test('fingerprint normalization rejects missing blank and garbage boundaries', () => {
  expect(normalizeFingerprint(undefined)).toBe(null);
  expect(normalizeFingerprint(null)).toBe(null);
  expect(normalizeFingerprint('')).toBe(null);
  expect(normalizeFingerprint('   ')).toBe(null);
  expect(normalizeFingerprint('short')).toBe(null);
  expect(normalizeFingerprint('visitor id with spaces')).toBe(null);
  expect(normalizeFingerprint('{"visitorId":"client-garbage"}')).toBe(null);
  expect(normalizeFingerprint('a'.repeat(129))).toBe(null);
});

test('signed anonymous session cookie round-trips normalized fingerprint', () => {
  const cookieValue = createAnonymousSessionCookieValue(' demo-fingerprint ', {
    secret: SECRET,
    issuedAt: 1,
  });

  expect(cookieValue).toBeTruthy();
  expect(verifyAnonymousSessionCookieValue(cookieValue, SECRET)).toBe('demo-fingerprint');
});

test('signed anonymous session cookie rejects tampering and wrong secrets', () => {
  const cookieValue = createAnonymousSessionCookieValue('demo-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });

  expect(cookieValue).toBeTruthy();
  expect(verifyAnonymousSessionCookieValue(`${cookieValue}tampered`, SECRET)).toBe(null);
  expect(verifyAnonymousSessionCookieValue(cookieValue, 'different-secret')).toBe(null);
});

test('current user seam resolves identity from signed cookie when present', () => {
  const cookieValue = createAnonymousSessionCookieValue('trusted-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });
  expect(cookieValue).toBeTruthy();

  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
    }),
    { secret: SECRET }
  );

  expect(identity).toEqual({
    type: 'fingerprint',
    source: 'cookie',
    fingerprint: 'trusted-fingerprint',
  });
});

test('current user seam keeps the signed cookie authoritative when the header differs', () => {
  const cookieValue = createAnonymousSessionCookieValue('trusted-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });
  expect(cookieValue).toBeTruthy();

  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      'x-fingerprint': 'different-fingerprint',
    }),
    { secret: SECRET }
  );

  expect(identity).toEqual({
    type: 'fingerprint',
    source: 'cookie',
    fingerprint: 'trusted-fingerprint',
  });
});

test('current user seam keeps x-fingerprint fallback when cookie is missing or invalid', () => {
  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=not-a-valid-cookie`,
      'x-fingerprint': 'fallback-fingerprint',
    }),
    { secret: SECRET }
  );

  expect(identity).toEqual({
    type: 'fingerprint',
    source: 'header',
    fingerprint: 'fallback-fingerprint',
  });
});

test('anonymous cookie binding is only created when a signing secret is available', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

  try {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(createAnonymousSessionCookie('demo-fingerprint')).toBe(null);
  } finally {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
    if (originalNextAuthSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
    }
  }

  const cookie = createAnonymousSessionCookie('demo-fingerprint', {
    secret: SECRET,
    secure: true,
  });

  if (!cookie) throw new Error('expected a cookie');
  expect(cookie.name).toBe(ANONYMOUS_SESSION_COOKIE);
  expect(cookie.options.httpOnly).toBe(true);
  expect(cookie.options.sameSite).toBe('lax');
  expect(cookie.options.secure).toBe(true);
});

import { afterEach, describe, expect, it } from 'vitest';
import { getClientIp } from './rate-limit';

const originalTrustProxy = process.env.TRUST_PROXY;

afterEach(() => {
  if (originalTrustProxy === undefined) {
    delete process.env.TRUST_PROXY;
  } else {
    process.env.TRUST_PROXY = originalTrustProxy;
  }
});

describe('getClientIp', () => {
  it('ignores proxy headers unless a trusted proxy is configured', () => {
    delete process.env.TRUST_PROXY;
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.10' },
    });
    // A spoofed X-Forwarded-For must not mint a fresh rate-limit bucket.
    expect(getClientIp(request)).toBe('direct');
  });

  it('uses the address appended by the trusted proxy', () => {
    process.env.TRUST_PROXY = 'true';
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
    });
    expect(getClientIp(request)).toBe('203.0.113.9');

    // A forged leftmost value must not change the bucket.
    const forged = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.9' },
    });
    expect(getClientIp(forged)).toBe('203.0.113.9');
  });

  it('falls back to unknown when the trusted header is not an IP', () => {
    process.env.TRUST_PROXY = 'true';
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    });
    expect(getClientIp(request)).toBe('unknown');
  });
});

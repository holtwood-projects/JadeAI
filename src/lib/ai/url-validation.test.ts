import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import { lookup } from 'node:dns/promises';
import { AI_ALLOW_PRIVATE_HOSTS_ENV } from '@/lib/constants';
import { validateAIBaseUrl } from './url-validation';

// lookup() is overloaded; the mocked module always returns the `all: true` shape.
const lookupMock = lookup as unknown as ReturnType<typeof vi.fn>;
const originalAllowPrivate = process.env[AI_ALLOW_PRIVATE_HOSTS_ENV];

beforeEach(() => {
  lookupMock.mockReset();
  delete process.env[AI_ALLOW_PRIVATE_HOSTS_ENV];
});

afterEach(() => {
  if (originalAllowPrivate === undefined) {
    delete process.env[AI_ALLOW_PRIVATE_HOSTS_ENV];
  } else {
    process.env[AI_ALLOW_PRIVATE_HOSTS_ENV] = originalAllowPrivate;
  }
});

describe('validateAIBaseUrl', () => {
  it('allows a public host that resolves to a public address', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(validateAIBaseUrl('https://api.example.com/v1')).resolves.toEqual({ ok: true });
  });

  it('rejects literal private addresses', async () => {
    const result = await validateAIBaseUrl('http://169.254.169.254/latest/meta-data');
    expect(result.ok).toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that resolves into a private range', async () => {
    // The classic bypass: the hostname is not an IP, so the string check passes.
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const result = await validateAIBaseUrl('http://169.254.169.254.nip.io');
    expect(result.ok).toBe(false);
  });

  it('rejects hosts that cannot be resolved', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validateAIBaseUrl('https://does-not-exist.example');
    expect(result.ok).toBe(false);
  });

  it('keeps loopback available for local runtimes', async () => {
    await expect(validateAIBaseUrl('http://localhost:11434/v1')).resolves.toEqual({ ok: true });
  });

  it('honours the explicit private-network escape hatch', async () => {
    process.env[AI_ALLOW_PRIVATE_HOSTS_ENV] = 'true';
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(validateAIBaseUrl('http://internal.example:8080')).resolves.toEqual({ ok: true });
  });
});

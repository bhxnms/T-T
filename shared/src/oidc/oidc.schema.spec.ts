import { oidcCallbackQuerySchema, oidcExchangeQuerySchema, oidcLoginQuerySchema } from './oidc.schema';

import { describe, it, expect } from 'vitest';

describe('oidcLoginQuerySchema', () => {
  it('accepts invite and remember flags, both optional', () => {
    expect(oidcLoginQuerySchema.safeParse({}).success).toBe(true);
    expect(oidcLoginQuerySchema.safeParse({ invite: 'tok' }).success).toBe(true);
    expect(oidcLoginQuerySchema.safeParse({ remember: '1' }).success).toBe(true);
    expect(oidcLoginQuerySchema.safeParse({ invite: 'tok', remember: '0' }).success).toBe(true);
  });

  it('rejects remember values other than the "0"/"1" wire flags', () => {
    expect(oidcLoginQuerySchema.safeParse({ remember: 'yes' }).success).toBe(false);
    expect(oidcLoginQuerySchema.safeParse({ remember: 'true' }).success).toBe(false);
    expect(oidcLoginQuerySchema.safeParse({ remember: 1 }).success).toBe(false);
  });
});

describe('oidcCallbackQuerySchema', () => {
  it('accepts code+state, an error, or nothing (all optional)', () => {
    expect(oidcCallbackQuerySchema.safeParse({ code: 'c', state: 's' }).success).toBe(true);
    expect(oidcCallbackQuerySchema.safeParse({ error: 'access_denied' }).success).toBe(true);
    expect(oidcCallbackQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe('oidcExchangeQuerySchema', () => {
  it('requires a code', () => {
    expect(oidcExchangeQuerySchema.safeParse({ code: 'c' }).success).toBe(true);
    expect(oidcExchangeQuerySchema.safeParse({}).success).toBe(false);
  });
});

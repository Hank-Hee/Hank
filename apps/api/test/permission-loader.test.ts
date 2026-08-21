import { describe, expect, it } from 'vitest';
import { parsePermissionContext } from '../src/auth/permission-loader';
import { AppError } from '../src/lib/app-error';

const identity = { userId: '00000000-0000-4000-8000-000000000001' };
const valid = {
  email: 'user@example.com',
  permissions: ['platform.access'],
  roles: ['sales_bd'],
  userId: identity.userId,
};

describe('parsePermissionContext', () => {
  it('accepts the strict context for the verified identity', () => {
    expect(parsePermissionContext(identity, valid)).toEqual(valid);
  });

  it.each([null, undefined])('maps absent context %s to an explicit forbidden error', (value) => {
    let caught: unknown;
    try {
      parsePermissionContext(identity, value);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Access is not permitted.',
      status: 403,
    });
  });

  it.each([
    { ...valid, extra: true },
    { ...valid, permissions: ['unknown.permission'] },
    { ...valid, userId: '00000000-0000-4000-8000-000000000002' },
  ])('rejects malformed or mismatched database context as an internal invariant failure', (value) => {
    expect(() => parsePermissionContext(identity, value)).toThrow('Permission context is invalid.');
  });
});

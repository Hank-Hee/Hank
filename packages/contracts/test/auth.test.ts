import { describe, expect, it } from 'vitest';
import {
  PermissionSchema,
  RoleSchema,
  UserContextSchema,
  permissionValues,
  roleValues,
} from '../src/index';

const baseContext = {
  userId: '7c786f9f-704f-4df0-b766-2199284ca34d',
  email: 'sales@example.com',
  roles: ['sales_bd'],
  permissions: ['platform.access'],
};

describe('published role and permission vocabulary', () => {
  it('contains exactly the approved values', () => {
    expect(roleValues).toEqual([
      'sales_bd',
      'research_admin',
      'content_editor',
      'content_reviewer',
      'management_readonly',
      'super_admin',
    ]);
    expect(permissionValues).toEqual([
      'platform.access',
      'admin.user.manage',
      'admin.authorization.manage',
      'admin.policy.manage',
      'audit.read',
    ]);
    expect(RoleSchema.parse('research_admin')).toBe('research_admin');
    expect(PermissionSchema.parse('audit.read')).toBe('audit.read');
  });
});

describe('UserContextSchema', () => {
  it('accepts a normal non-empty explicit context', () => {
    expect(UserContextSchema.parse(baseContext)).toEqual(baseContext);
  });

  it('accepts empty roles and permissions as default deny', () => {
    const parsed = UserContextSchema.parse({ ...baseContext, roles: [], permissions: [] });
    expect(parsed.roles).toEqual([]);
    expect(parsed.permissions).toEqual([]);
  });

  it('does not derive permissions from super_admin', () => {
    const parsed = UserContextSchema.parse({
      ...baseContext,
      roles: ['super_admin'],
      permissions: [],
    });
    expect(parsed.permissions).toEqual([]);
  });

  it.each([
    { ...baseContext, roles: ['unknown_role'] },
    { ...baseContext, permissions: ['database.drop'] },
    { ...baseContext, roles: ['sales_bd', 'sales_bd'] },
    { ...baseContext, permissions: ['platform.access', 'platform.access'] },
  ])('rejects unknown or duplicate authorization data', (value) => {
    expect(() => UserContextSchema.parse(value)).toThrow();
  });

  it('rejects an extra field independently', () => {
    expect(() => UserContextSchema.parse({ ...baseContext, extra: true })).toThrow();
  });

  it.each([
    { ...baseContext, userId: 'not-a-uuid' },
    { ...baseContext, email: 'not-an-email' },
    { ...baseContext, email: `${'x'.repeat(243)}@example.com` },
  ])('rejects malformed identity data', (value) => {
    expect(() => UserContextSchema.parse(value)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { email: _email, ...missingEmail } = baseContext;
    expect(() => UserContextSchema.parse(missingEmail)).toThrow();
  });
});

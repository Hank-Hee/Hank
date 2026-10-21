import { z } from 'zod';

export const permissionValues = [
  'platform.access',
  'admin.user.manage',
  'admin.authorization.manage',
  'admin.policy.manage',
  'audit.read',
] as const;

export const roleValues = [
  'sales_bd',
  'research_admin',
  'content_editor',
  'content_reviewer',
  'management_readonly',
  'super_admin',
] as const;

export const PermissionSchema = z.enum(permissionValues);
export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.enum(roleValues);
export type Role = z.infer<typeof RoleSchema>;

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const UserContextSchema = z.strictObject({
  userId: z.uuid(),
  email: z.email().max(254),
  roles: z.array(RoleSchema).refine(uniqueValues, 'Roles must be unique.'),
  permissions: z
    .array(PermissionSchema)
    .refine(uniqueValues, 'Permissions must be unique.'),
});

export type UserContext = z.infer<typeof UserContextSchema>;

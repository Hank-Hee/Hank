import { z } from 'zod';

export const securityLevelValues = ['L1', 'L2', 'L3', 'L4'] as const;
export const SecurityLevelSchema = z.enum(securityLevelValues);
export type SecurityLevel = z.infer<typeof SecurityLevelSchema>;

export const rightsTypeValues = [
  'OWNED',
  'PUBLIC_THIRD_PARTY',
  'LICENSED_RESTRICTED',
  'DERIVED_REVIEW_REQUIRED',
] as const;
export const RightsTypeSchema = z.enum(rightsTypeValues);
export type RightsType = z.infer<typeof RightsTypeSchema>;

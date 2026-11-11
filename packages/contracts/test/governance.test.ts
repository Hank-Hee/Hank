import { describe, expect, it } from 'vitest';
import {
  RightsTypeSchema,
  SecurityLevelSchema,
  rightsTypeValues,
  securityLevelValues,
} from '../src/index';

describe('governance vocabulary', () => {
  it('contains exactly the approved security levels and rights types', () => {
    expect(securityLevelValues).toEqual(['L1', 'L2', 'L3', 'L4']);
    expect(rightsTypeValues).toEqual([
      'OWNED',
      'PUBLIC_THIRD_PARTY',
      'LICENSED_RESTRICTED',
      'DERIVED_REVIEW_REQUIRED',
    ]);
  });

  it.each(['PUBLIC', 'L5'])('rejects unpublished security value %s', (value) => {
    expect(() => SecurityLevelSchema.parse(value)).toThrow();
  });

  it.each(['UNKNOWN', 'PUBLIC_DOMAIN'])('rejects unpublished rights value %s', (value) => {
    expect(() => RightsTypeSchema.parse(value)).toThrow();
  });
});

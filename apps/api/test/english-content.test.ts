import { describe, expect, it } from 'vitest';
import { englishReportTitle } from '../src/content/english-content';

describe('versioned English report content', () => {
  it('supplies an offline English title for reports whose database subtitle is missing', () => {
    expect(englishReportTitle('rystad-6a4de0f8c3776c4645229bee', null))
      .toBe('Reuters x Rystad - Powering the AI Era');
  });
});

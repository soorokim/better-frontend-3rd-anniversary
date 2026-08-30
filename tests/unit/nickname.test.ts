import { describe, expect, it } from 'vitest';
import { normalizeNickname } from '@/lib/validation/nickname';

describe('nickname-key-v1', () => {
  it.each([
    ['  FrontEnd  ', 'FrontEnd', 'frontend'],
    ['ＦＥ', 'ＦＥ', 'ｆｅ'],
    ['Cafe\u0301', 'Café', 'café'],
    ['김개발', '김개발', '김개발'],
  ])('normalizes %j to a stable display and key', (input, display, key) => {
    expect(normalizeNickname(input)).toEqual({ display, key, version: 'nickname-key-v1' });
  });

  it('maps case and surrounding whitespace variants to one duplicate key', () => {
    expect(normalizeNickname(' Player ').key).toBe(normalizeNickname('player').key);
  });

  it.each(['', '   ', 'line\nbreak', 'zero\u200bwidth', '\u0000name'])('rejects empty or forbidden input %j', (input) => {
    expect(() => normalizeNickname(input)).toThrow();
  });

  it('counts grapheme clusters rather than UTF-16 code units', () => {
    expect(normalizeNickname('🧑🏻').display).toBe('🧑🏻');
    expect(() => normalizeNickname('가'.repeat(25))).toThrow('1~24');
  });
});

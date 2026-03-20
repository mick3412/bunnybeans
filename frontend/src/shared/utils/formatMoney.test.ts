import { describe, it, expect } from 'vitest';
import { formatMoney, formatInt, formatMoneyFromString } from './formatMoney';

describe('formatMoney', () => {
  it('formats numbers as TWD currency', () => {
    expect(formatMoney(1234)).toMatch(/1,?234/);
    expect(formatMoney(0)).toContain('0');
    expect(formatMoney(999999)).toMatch(/999,?999/);
  });

  it('handles string input', () => {
    expect(formatMoney('1234')).toMatch(/1,?234/);
  });

  it('returns original string for NaN', () => {
    expect(formatMoney('invalid')).toBe('invalid');
  });
});

describe('formatInt', () => {
  it('formats integers with locale', () => {
    expect(formatInt(1234)).toMatch(/1,?234/);
    expect(formatInt(0)).toBe('0');
  });
});

describe('formatMoneyFromString', () => {
  it('converts string to money format', () => {
    expect(formatMoneyFromString('1234')).toMatch(/1,?234/);
  });

  it('returns original for NaN', () => {
    expect(formatMoneyFromString('x')).toBe('x');
  });
});

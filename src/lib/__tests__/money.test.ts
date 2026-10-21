import { describe, expect, it } from 'vitest';
import { evaluateAmountExpression, formatAmountExpression } from '../money';

describe('amount expressions', () => {
  it('evaluates additions and subtractions', () => {
    expect(evaluateAmountExpression('12+3.5')).toBe(15.5);
    expect(evaluateAmountExpression('100-20-5')).toBe(75);
    expect(evaluateAmountExpression('0.1+0.2')).toBe(0.3);
  });

  it('supports multiplication and division with precedence', () => {
    expect(evaluateAmountExpression('2+3*4')).toBe(14);
    expect(evaluateAmountExpression('10/4')).toBe(2.5);
    expect(evaluateAmountExpression('18.8*0.5')).toBe(9.4);
  });

  it('rejects incomplete, malformed and division-by-zero expressions', () => {
    expect(evaluateAmountExpression('')).toBeNull();
    expect(evaluateAmountExpression('2+')).toBeNull();
    expect(evaluateAmountExpression('2++3')).toBeNull();
    expect(evaluateAmountExpression('abc')).toBeNull();
    expect(evaluateAmountExpression('1/0')).toBeNull();
  });

  it('formats operators and thousands separators for the amount display', () => {
    expect(formatAmountExpression('1000+35.5')).toBe('1,000 + 35.5');
    expect(formatAmountExpression('2*3')).toBe('2 × 3');
    expect(formatAmountExpression('10/4')).toBe('10 ÷ 4');
    expect(formatAmountExpression('')).toBe('0.00');
  });
});

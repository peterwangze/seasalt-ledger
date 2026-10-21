export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatAmount(value: number): string {
  return formatNumber(value, 2);
}

export function formatAmountSmart(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2);
}

export function formatAmountInput(raw: string): string {
  if (raw === '') return '0.00';
  const [intPart, decimalPart] = raw.split('.');
  const grouped = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(intPart || 0));
  if (raw.includes('.')) {
    return `${grouped}.${(decimalPart ?? '').slice(0, 2)}`;
  }
  return grouped;
}

/**
 * Evaluates a simple amount expression with + - * / and conventional
 * multiplication/division precedence. Returns null for incomplete or
 * malformed expressions so callers can keep the save button disabled.
 */
export function evaluateAmountExpression(expression: string): number | null {
  const normalized = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').trim();
  if (!normalized) return null;
  const tokens = normalized.match(/\d+(?:\.\d{0,2})?|[+\-*/]/g);
  if (!tokens || tokens.join('') !== normalized) return null;
  if (tokens.length % 2 === 0 || /[+\-*/]$/.test(normalized)) return null;

  const terms: number[] = [Number(tokens[0])];
  const plusMinus: string[] = [];
  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const value = Number(tokens[index + 1]);
    if (!Number.isFinite(value)) return null;
    if (operator === '*' || operator === '/') {
      if (operator === '/' && value === 0) return null;
      const previous = terms.pop();
      if (previous === undefined) return null;
      terms.push(operator === '*' ? previous * value : previous / value);
    } else {
      plusMinus.push(operator);
      terms.push(value);
    }
  }

  let result = terms[0];
  for (let index = 0; index < plusMinus.length; index += 1) {
    result = plusMinus[index] === '+' ? result + terms[index + 1] : result - terms[index + 1];
  }
  return Number.isFinite(result) ? roundMoney(result) : null;
}

/** Formats an amount expression for display while keeping the raw value for editing. */
export function formatAmountExpression(raw: string): string {
  if (!raw) return '0.00';
  const normalized = raw.replace(/,/g, '');
  const tokens = normalized.match(/\d+(?:\.\d{0,2})?|[+\-*/]/g);
  if (!tokens || tokens.join('') !== normalized) return raw;
  return tokens
    .map((token) => {
      if (token === '*') return ' × ';
      if (token === '/') return ' ÷ ';
      if (token === '+' || token === '-') return ` ${token} `;
      return formatAmountInput(token);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.abs(roundMoney(value)) : null;
  }
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (!text) return null;
  const negativeParentheses = /^\(.*\)$/.test(text);
  text = text
    .replace(/[¥￥$€£]/g, '')
    .replace(/(人民币|元|块|rmb|cny)/gi, '')
    .replace(/[,\s，]/g, '')
    .replace(/[（(]/g, '-')
    .replace(/[）)]/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(roundMoney(negativeParentheses ? -parsed : parsed));
}

export function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

export function signedAmount(type: 'expense' | 'income', amount: number): number {
  return type === 'expense' ? -amount : amount;
}

export function formatSigned(type: 'expense' | 'income' | 'transfer', amount: number): string {
  if (type === 'expense') return `−¥${formatAmount(amount)}`;
  if (type === 'income') return `+¥${formatAmount(amount)}`;
  return `¥${formatAmount(amount)}`;
}

/**
 * Parse what a student types into a number. Accepts a typographic minus
 * (−), an en dash, a decimal comma, a leading "+", and a trailing unit
 * ("2.35 cm"). Returns NaN for anything else, including an empty box.
 */
export function parseNumberInput(raw: string): number {
  const s = raw
    .trim()
    .replace(/[−–‒]/g, '-')
    .replace(',', '.')
    .replace(/\s*(mm|cm)\s*$/i, '')
    .replace(/\s+/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Parse a whole number of divisions (rejects decimals). */
export function parseDivisionInput(raw: string): number {
  const v = parseNumberInput(raw);
  return Number.isInteger(v) ? v : NaN;
}

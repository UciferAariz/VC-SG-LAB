/**
 * Seeded pseudo-random numbers (mulberry32) and human-friendly seed codes.
 *
 * A seed is a 30-bit integer shown as a 6-character Crockford base-32 code,
 * e.g. "K7Q2-9F". Typing the same code reproduces the same objects and zero
 * errors, so a whole class can work on identical data. Math.random() is never
 * used in core/.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
const CODE_LEN = 6;
const SEED_BITS = 30;
const SEED_MASK = 2 ** SEED_BITS - 1;

/** FNV-1a 32-bit hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Encode a seed as "XXXX-XX". */
export function seedToCode(seed: number): string {
  let v = (seed >>> 0) & SEED_MASK;
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out = ALPHABET[v & 31] + out;
    v >>>= 5;
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Decode a seed code. Case, spaces and dashes are ignored; I/L read as 1 and
 * O as 0. Any other text (e.g. "class 11B") is hashed, so every input is a
 * valid, reproducible seed.
 */
export function codeToSeed(code: string): number {
  const clean = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (clean.length === CODE_LEN && [...clean].every((c) => ALPHABET.includes(c))) {
    let v = 0;
    for (const c of clean) v = v * 32 + ALPHABET.indexOf(c);
    return v;
  }
  return hashString(code.trim()) & SEED_MASK;
}

/** Turn arbitrary entropy (e.g. from crypto.getRandomValues in the UI) into a seed. */
export function normaliseSeed(entropy: number): number {
  return (entropy >>> 0) & SEED_MASK;
}

export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Uniform in [0, 1). mulberry32. */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** +1 or −1 with equal probability. */
  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /**
   * Independent, reproducible sub-stream. fork('vernier-objects') always gives
   * the same sequence for the same session seed, regardless of how many
   * numbers other parts of the app have drawn.
   */
  fork(label: string): Rng {
    return new Rng(hashString(`${this.seed}:${label}`));
  }
}

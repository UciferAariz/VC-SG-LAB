import { describe, expect, it } from 'vitest';
import {
  createObject,
  DEFAULT_PLACEMENT,
  getDimension,
  imperfectionBand,
  moveAlong,
  randomPlacement,
  rotate90,
  SCREW_OBJECT_KINDS,
  trueSize,
  VERNIER_OBJECT_KINDS,
} from '../src/core/objects';
import { codeToSeed, hashString, normaliseSeed, Rng, seedToCode } from '../src/core/rng';

describe('Seeded RNG (SPEC §4.4)', () => {
  it('is reproducible and in range', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const n = r.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      expect([1, -1]).toContain(r.sign());
      expect(r.range(2, 3)).toBeGreaterThanOrEqual(2);
    }
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    expect(() => r.pick([])).toThrow();
  });

  it('forks are independent of draw order but reproducible', () => {
    const s1 = new Rng(99);
    const s2 = new Rng(99);
    s2.next();
    s2.next();
    expect(s1.fork('objects').next()).toBe(s2.fork('objects').next());
    expect(s1.fork('objects').next()).not.toBe(s1.fork('zero').next());
  });

  it('seed codes round-trip and look like K7Q2-9F', () => {
    for (const seed of [0, 1, 123456, 2 ** 30 - 1, 987654321 & (2 ** 30 - 1)]) {
      const code = seedToCode(seed);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/);
      expect(codeToSeed(code)).toBe(seed);
      expect(codeToSeed(code.toLowerCase().replace('-', ' '))).toBe(seed);
    }
    expect(codeToSeed('K7Q2-9F')).toBe(codeToSeed('k7q29f'));
    expect(codeToSeed('0O1I-L0')).toBe(codeToSeed('0011-10'));
    // Free text is hashed into a valid seed.
    expect(codeToSeed('class 11B')).toBe(codeToSeed('class 11B'));
    expect(codeToSeed('class 11B')).toBeLessThan(2 ** 30);
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(normaliseSeed(2 ** 32 - 1)).toBe(2 ** 30 - 1);
  });
});

describe('Measurable objects (SPEC §5.6, §6.6)', () => {
  const ranges: Record<string, Record<string, [number, number]>> = {
    bob: { diameter: [15, 25] },
    cylinder: { diameter: [12, 25], length: [25, 60] },
    beaker: { internalDiameter: [40, 60], depth: [50, 80] },
    block: { length: [10, 60], breadth: [10, 60], height: [10, 60] },
    wire: { diameter: [0.3, 1.5] },
    sheet: { thickness: [0.5, 2] },
    slide: { thickness: [0.9, 1.3] },
    ball: { diameter: [3, 8] },
    marble: { diameter: [14, 17] },
    battery: { diameter: [13.9, 14.4], length: [49.8, 50.4] },
    tube: { externalDiameter: [18, 26], internalDiameter: [13, 23.6], length: [40, 70] },
    matchbox: { length: [47, 53], breadth: [34, 38], height: [14, 17] },
    hair: { diameter: [0.05, 0.11] },
    blade: { thickness: [0.09, 0.11] },
    needle: { diameter: [0.6, 0.9] },
    lead: { diameter: [0.55, 0.92] },
    card: { thickness: [0.74, 0.8] },
  };
  const bands: Record<string, number> = {
    bob: 0.15, cylinder: 0.07, beaker: 0.1, block: 0.05, marble: 0.08, battery: 0.04, tube: 0.08, matchbox: 0.1,
    wire: 0.025, sheet: 0.01, slide: 0.005, ball: 0.002, paper: 0.004, hair: 0.014, blade: 0.003, needle: 0.007, lead: 0.007, card: 0.011,
  };

  it('nominal sizes are in range; true sizes stay within the imperfection band', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Rng(seed);
      for (const kind of [...VERNIER_OBJECT_KINDS, ...SCREW_OBJECT_KINDS]) {
        const obj = createObject(kind, rng);
        for (const d of obj.dimensions) {
          const range = ranges[kind]?.[d.id];
          if (range) {
            expect(d.nominalMm).toBeGreaterThanOrEqual(range[0]);
            expect(d.nominalMm).toBeLessThanOrEqual(range[1]);
          }
          expect(imperfectionBand(d)).toBeLessThanOrEqual(bands[kind]! + 1e-12);
          for (let i = 0; i < 5; i++) {
            const pl = randomPlacement(rng);
            expect(Math.abs(trueSize(obj, d.id, pl) - d.nominalMm)).toBeLessThanOrEqual(imperfectionBand(d) + 1e-12);
          }
        }
        if (obj.instrument === 'screw') expect(obj.dimensions[0]!.nominalMm).toBeLessThan(25);
      }
    }
  });

  it('paper stack: 20–100 sheets of 0.08–0.12 mm', () => {
    const p = createObject('paper', new Rng(5));
    expect(p.sheets).toBeGreaterThanOrEqual(20);
    expect(p.sheets).toBeLessThanOrEqual(100);
    const per = p.dimensions[0]!.nominalMm / p.sheets!;
    expect(per).toBeGreaterThanOrEqual(0.08);
    expect(per).toBeLessThanOrEqual(0.12);
  });

  it('repositioning changes the true value; same seed → same object', () => {
    const obj = createObject('bob', new Rng(3));
    const rng = new Rng(4);
    const values = new Set<number>();
    let pl = DEFAULT_PLACEMENT;
    for (let i = 0; i < 10; i++) {
      pl = randomPlacement(rng, pl);
      values.add(trueSize(obj, 'diameter', pl));
    }
    expect(values.size).toBe(10);
    expect(createObject('bob', new Rng(3))).toEqual(obj);
    expect(createObject('wire', new Rng(3)).compressionPerDeg).toBeCloseTo(0.02 / 45, 15);
  });

  it('wire: move along and rotate 90° (∥/⊥) give different diameters', () => {
    const wire = createObject('wire', new Rng(11));
    const p0 = DEFAULT_PLACEMENT;
    const perp = rotate90(p0);
    expect(perp.perpendicular).toBe(true);
    expect(rotate90(perp).perpendicular).toBe(false);
    expect(trueSize(wire, 'diameter', perp)).not.toBe(trueSize(wire, 'diameter', p0));
    const moved = moveAlong(new Rng(1), perp);
    expect(moved.perpendicular).toBe(true);
    expect(moved.angleDeg).toBe(perp.angleDeg);
    expect(randomPlacement(new Rng(2), perp).perpendicular).toBe(true);
  });

  it('hollow tube: the bore is always smaller than the outside, through every placement', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const tube = createObject('tube', new Rng(seed));
      const rng = new Rng(seed + 1000);
      for (let i = 0; i < 5; i++) {
        const pl = randomPlacement(rng);
        const wall = (trueSize(tube, 'externalDiameter', pl) - trueSize(tube, 'internalDiameter', pl)) / 2;
        expect(wall).toBeGreaterThan(1);
      }
    }
  });

  it('every object has a known jaw for each dimension', () => {
    for (const kind of VERNIER_OBJECT_KINDS) {
      for (const d of createObject(kind, new Rng(1)).dimensions) expect(['outer', 'inner', 'depth']).toContain(d.jaw);
    }
    for (const kind of SCREW_OBJECT_KINDS) {
      const obj = createObject(kind, new Rng(1));
      expect(obj.dimensions).toHaveLength(1);
      expect(obj.dimensions[0]!.jaw).toBe('spindle');
      expect(obj.maxCompressionMm).toBeGreaterThan(0);
    }
  });

  it('unknown dimension throws', () => {
    expect(() => getDimension(createObject('ball', new Rng(1)), 'length')).toThrow();
  });
});

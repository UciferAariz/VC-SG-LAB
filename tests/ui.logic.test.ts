import { describe, expect, it } from 'vitest';
import { createStore, changed } from '../src/ui/store';
import { vernierKeyAction } from '../src/input/keyboard';
import { constrainGap, derive, initialState, objectFor, placementFor, startingGap, zeroOffsetFor, type VernierState } from '../src/ui/vernierModel';
import { VERNIER_PRESETS } from '../src/core/vernier/config';
import { trueSize } from '../src/core/objects';
import { readVernier } from '../src/core/vernier/reading';

const key = (k: string, mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('store', () => {
  it('batches notifications and skips no-op sets', () => {
    let scheduled: (() => void) | null = null;
    const store = createStore({ a: 1, b: 'x' }, (cb) => (scheduled = cb));
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.a));
    store.set({ a: 2 });
    store.set((s) => ({ a: s.a + 1 }));
    store.set({ b: 'x' }); // unchanged: no extra schedule
    expect(seen).toEqual([]);
    scheduled!();
    expect(seen).toEqual([3]);
    store.flush();
    expect(seen).toEqual([3]);
    expect(changed({ a: 1, b: 2 }, { a: 1, b: 3 }, 'a')).toBe(false);
    expect(changed({ a: 1, b: 2 }, { a: 1, b: 3 }, 'a', 'b')).toBe(true);
  });
});

describe('vernier keyboard map (SPEC §5.7)', () => {
  it('arrows: 0.01 mm, Shift 1 mm, Alt 0.001 mm', () => {
    expect(vernierKeyAction(key('ArrowRight'))).toEqual({ type: 'move', mm: 0.01 });
    expect(vernierKeyAction(key('ArrowLeft', { shiftKey: true }))).toEqual({ type: 'move', mm: -1 });
    expect(vernierKeyAction(key('ArrowRight', { altKey: true }))).toEqual({ type: 'move', mm: 0.001 });
    expect(vernierKeyAction(key('l'))).toEqual({ type: 'lock' });
    expect(vernierKeyAction(key('M'))).toEqual({ type: 'loupe' });
    expect(vernierKeyAction(key('+'))).toEqual({ type: 'zoom', factor: 1.25 });
    expect(vernierKeyAction(key('ArrowRight', { ctrlKey: true }))).toBeNull();
    expect(vernierKeyAction(key('x'))).toBeNull();
  });
});

describe('vernier page model (all values via core/)', () => {
  const base = (): VernierState => initialState(12345);

  it('derived reading equals the core reading of x = gap + e', () => {
    const s = { ...base(), zeroSettings: { mode: 'positive' as const } };
    s.zeroOffsetMm = zeroOffsetFor(s.seed, s.zeroSettings, VERNIER_PRESETS.standard);
    const d = derive(s);
    expect(d.reading).toEqual(readVernier(s.gapMm + s.zeroOffsetMm, VERNIER_PRESETS.standard));
    expect(d.correctedMm).toBeCloseTo(d.reading.observedMm - d.ze.zeMm, 9);
    // Same seed + settings → same zero offset (whole class gets identical data).
    expect(zeroOffsetFor(s.seed, s.zeroSettings, VERNIER_PRESETS.standard)).toBe(s.zeroOffsetMm);
  });

  it('outer jaws cannot close through an object; inner/depth cannot open past it', () => {
    const s: VernierState = { ...base(), objectKind: 'bob', dimId: 'diameter' };
    const size = trueSize(objectFor(s.seed, 'bob'), 'diameter', s.placement);
    expect(constrainGap(s, 0)).toBe(size);
    expect(startingGap(s)).toBeCloseTo(size + 4, 9);
    const b: VernierState = { ...base(), objectKind: 'beaker', dimId: 'internalDiameter' };
    const D = trueSize(objectFor(b.seed, 'beaker'), 'internalDiameter', b.placement);
    expect(constrainGap(b, 200)).toBe(D);
    expect(derive({ ...b, gapMm: D }).touching).toBe(true);
  });

  it('repositioning is reproducible and changes the true size', () => {
    const p1 = placementFor(7, 1, base().placement);
    expect(placementFor(7, 1, base().placement)).toEqual(p1);
    expect(placementFor(7, 2, base().placement)).not.toEqual(p1);
    const obj = objectFor(7, 'bob');
    expect(trueSize(obj, 'diameter', p1)).not.toBe(trueSize(obj, 'diameter', placementFor(7, 2, p1)));
  });
});

import { describe, expect, it } from 'vitest';
import { screwKeyAction, RATCHET_KEY_DEG } from '../src/input/keyboard';
import { SCREW_PRESETS } from '../src/core/screw/config';
import { readScrew } from '../src/core/screw/reading';
import { trueSize } from '../src/core/objects';
import {
  backlashDegFor,
  derive,
  initialState,
  objectFor,
  paramsFor,
  placementFor,
  settle,
  startingGap,
  turnRatchet,
  turnThimble,
  withGap,
  zeroOffsetFor,
  type ScrewState,
} from '../src/ui/screwModel';

const key = (k: string, mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key: k,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('screw gauge keyboard map (SPEC §6.7)', () => {
  it('↑/↓ one division, Shift 0.1, PageUp/PageDown one turn', () => {
    expect(screwKeyAction(key('ArrowUp'))).toEqual({ type: 'thimble', divisions: 1 });
    expect(screwKeyAction(key('ArrowDown', { shiftKey: true }))).toEqual({ type: 'thimble', divisions: -0.1 });
    expect(screwKeyAction(key('PageUp'))).toEqual({ type: 'turns', turns: 1 });
    expect(screwKeyAction(key('PageDown'))).toEqual({ type: 'turns', turns: -1 });
    expect(screwKeyAction(key('r'))).toEqual({ type: 'ratchet', deg: -RATCHET_KEY_DEG });
    expect(screwKeyAction(key('R', { shiftKey: true }))).toEqual({ type: 'ratchet', deg: RATCHET_KEY_DEG });
    expect(screwKeyAction(key('o'))).toEqual({ type: 'open' });
    expect(screwKeyAction(key('L'))).toEqual({ type: 'lock' });
    expect(screwKeyAction(key('ArrowUp', { metaKey: true }))).toBeNull();
    expect(screwKeyAction(key('q'))).toBeNull();
  });
});

describe('screw page model (all values via core/)', () => {
  const base = (): ScrewState => initialState(4242);

  it('the reading is the core reading of p = s + e', () => {
    const s: ScrewState = { ...base(), zeroSettings: { mode: 'negative' } };
    s.zeroOffsetMm = zeroOffsetFor(s.seed, s.zeroSettings, SCREW_PRESETS.standard);
    const d = derive(s);
    expect(d.reading).toEqual(readScrew(s.mech.gapMm + s.zeroOffsetMm, SCREW_PRESETS.standard));
    expect(d.correctedMm).toBeCloseTo(d.reading.observedMm - d.ze.zeMm, 9);
    expect(d.ze.kind).toBe('negative');
  });

  it('thimble turns move the spindle by pitch × turns; the frame limits the opening', () => {
    const s = base();
    const t = turnThimble(s, 360);
    expect(t.mech.gapMm - s.mech.gapMm).toBeCloseTo(0.5, 12);
    const wide = turnThimble(s, 360 * 100);
    expect(wide.mech.gapMm).toBe(paramsFor(s).maxGapMm);
    expect(wide.events).toContainEqual({ type: 'limit' });
  });

  it('ratchet stops on the object and slips; the thimble squashes it', () => {
    const s: ScrewState = { ...base(), objectKind: 'wire' };
    const size = trueSize(objectFor(s.seed, 'wire'), 'diameter', s.placement);
    const open = { ...s, mech: { ...s.mech, gapMm: startingGap(s) } };
    expect(open.mech.gapMm).toBeCloseTo(size + 0.6, 12);
    const r = turnRatchet(open, -360 * 5);
    expect(r.mech.gapMm).toBe(size);
    expect(r.events.some((e) => e.type === 'contact')).toBe(true);
    expect(r.events.some((e) => e.type === 'ratchet-click')).toBe(true);
    const squash = turnThimble({ ...open, mech: r.mech }, -90);
    expect(derive({ ...open, mech: squash.mech }).compressionMm).toBeCloseTo(objectFor(s.seed, 'wire').maxCompressionMm, 12);
  });

  it('a thicker measuring point pushes the spindle back', () => {
    const s: ScrewState = { ...base(), objectKind: 'wire' };
    const size = trueSize(objectFor(s.seed, 'wire'), 'diameter', s.placement);
    const tight = { ...s, mech: withGap({ ...s, objectKind: null }, size - 0.1) };
    expect(settle(tight).gapMm).toBe(size);
  });

  it('backlash and repositioning are reproducible from the seed', () => {
    const b = backlashDegFor(99);
    expect(b).toBeGreaterThanOrEqual(3);
    expect(b).toBeLessThanOrEqual(12);
    expect(backlashDegFor(99)).toBe(b);
    const p = base().placement;
    expect(placementFor(1, 1, p, 'rotate').perpendicular).toBe(true);
    expect(placementFor(1, 2, p, 'along')).toEqual(placementFor(1, 2, p, 'along'));
    expect(placementFor(1, 2, p, 'along').angleDeg).toBe(p.angleDeg);
  });
});

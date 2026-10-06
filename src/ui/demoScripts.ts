/**
 * Auto-demo scripts for Presentation mode (SPEC §8.5): LC → zero error →
 * reading → correction, one per instrument. Captions are the same worked
 * solutions Practice mode uses, built from the live instrument snapshot.
 */
import type { LabAdapter } from './lab';
import type { DemoStep } from './presentationMode';
import { workedSolution } from './practiceText';
import { sleep } from './anim';

async function onObject(lab: LabAdapter, kind: string, dimId?: string): Promise<void> {
  const s = lab.snapshot();
  if (s.objectKind !== kind || (dimId && s.dimId !== dimId)) lab.setObject(kind, dimId);
  if (!lab.snapshot().touching) await lab.closeOnObject();
}

/** Zoom the whole view onto the scales (on a projector this beats a small loupe) and highlight the lines. */
function magnify(lab: LabAdapter): void {
  lab.setLoupe(false);
  lab.setAids(true);
  lab.view('scale');
}

export function vernierDemo(): DemoStep[] {
  const ze = { mode: 'custom', custom: { divisions: 3, sign: -1 } } as const;
  return [
    {
      title: 'Vernier callipers',
      async run(lab) {
        lab.setLocked(false);
        lab.guided.setSpan?.(null);
        lab.setZeroSettings({ mode: 'none' });
        lab.setObject(null);
        lab.setLoupe(false);
        lab.setAids(false);
        await lab.animateGap(30, 500);
        lab.view('default');
      },
      caption: () => 'A main scale in millimetres on the fixed beam, and a vernier scale on the sliding jaw. Outer jaws for outside sizes, inner jaws for inside sizes, the depth rod for depths.',
    },
    {
      title: 'Step 1 · Least count',
      async run(lab) {
        lab.setLocked(false);
        lab.setZeroSettings({ mode: 'none' });
        lab.setLoupe(false);
        lab.setAids(false);
        lab.guided.alignZero?.();
        lab.guided.setSpan?.(lab.snapshot().N);
        await sleep(60);
        lab.view('scale');
      },
      caption: (lab) => `The shaded lengths are equal: ${workedSolution('lc', lab.snapshot())}`,
    },
    {
      title: 'Step 2 · Zero error',
      async run(lab) {
        lab.setLocked(false);
        lab.guided.setSpan?.(null);
        lab.setObject(null);
        lab.setZeroSettings(ze);
        await lab.animateGap(0, 700);
        magnify(lab);
      },
      caption: (lab) => `Jaws closed on nothing. ${workedSolution('ze', lab.snapshot())}`,
    },
    {
      title: 'Step 3 · Place the object',
      async run(lab) {
        lab.setLocked(false);
        lab.setZeroSettings(ze);
        lab.setLoupe(false);
        lab.setAids(false);
        lab.setObject('bob');
        lab.view('default');
      },
      caption: () => 'Open the jaws and place the pendulum bob between the outer jaws.',
    },
    {
      title: 'Step 4 · Close the jaws',
      async run(lab) {
        lab.setZeroSettings(ze);
        lab.setLoupe(false);
        await onObject(lab, 'bob');
        lab.view('default');
      },
      caption: () => 'Slide the jaw gently until it just touches the bob. Do not press. Lock the slider before reading.',
    },
    {
      title: 'Step 5 · Read the scales',
      async run(lab) {
        lab.setZeroSettings(ze);
        await onObject(lab, 'bob');
        magnify(lab);
      },
      caption: (lab) => {
        const s = lab.snapshot();
        return `${workedSolution('msr', s)} ${workedSolution('vsr', s)} ${workedSolution('observed', s)}`;
      },
    },
    {
      title: 'Step 6 · Zero correction',
      async run(lab) {
        lab.setZeroSettings(ze);
        await onObject(lab, 'bob');
        magnify(lab);
      },
      caption: (lab) => `${workedSolution('corrected', lab.snapshot())} Remember: corrected = observed − zero error.`,
    },
  ];
}

export function screwDemo(): DemoStep[] {
  const ze = { mode: 'custom', custom: { divisions: 4, sign: 1 } } as const;
  return [
    {
      title: 'Screw gauge',
      async run(lab) {
        lab.setLocked(false);
        lab.guided.markStart?.(false);
        lab.setZeroSettings({ mode: 'none' });
        lab.setObject(null);
        lab.setLoupe(false);
        lab.setAids(false);
        await lab.animateGap(5, 500);
        lab.view('default');
      },
      caption: () => 'A U-shaped frame with a fixed anvil and a spindle driven by a fine screw. The linear (pitch) scale is on the sleeve; the circular scale is on the thimble. Always finish with the ratchet.',
    },
    {
      title: 'Step 1 · Pitch and least count',
      async run(lab) {
        lab.setLocked(false);
        lab.setZeroSettings({ mode: 'none' });
        lab.setObject(null);
        lab.setLoupe(false);
        lab.setAids(false);
        await lab.animateGap(5, 0);
        lab.guided.markStart?.(true);
        lab.view('scale');
        await lab.animateGap(5 + (lab.snapshot().pitchMm ?? 0.5), 1600);
      },
      caption: (lab) => `One full turn moved the thimble edge from the start mark by one pitch, ${lab.snapshot().pitchMm} mm. ${workedSolution('lc', lab.snapshot())}`,
    },
    {
      title: 'Step 2 · Zero error',
      async run(lab) {
        lab.setLocked(false);
        lab.guided.markStart?.(false);
        lab.setObject(null);
        lab.setZeroSettings(ze);
        await lab.animateGap(1, 400);
        await lab.closeOnObject();
        magnify(lab);
      },
      caption: (lab) => `Faces touching (closed with the ratchet). ${workedSolution('ze', lab.snapshot())}`,
    },
    {
      title: 'Step 3 · Place the wire',
      async run(lab) {
        lab.setLocked(false);
        lab.setZeroSettings(ze);
        lab.setLoupe(false);
        lab.setAids(false);
        lab.setObject('wire');
        lab.view('default');
      },
      caption: () => 'Open the gauge and place the wire between the anvil and the spindle.',
    },
    {
      title: 'Step 4 · Close with the ratchet',
      async run(lab) {
        lab.setZeroSettings(ze);
        lab.setLoupe(false);
        await onObject(lab, 'wire');
        lab.view('default');
      },
      caption: () => 'Turn the thimble until the spindle is close, then use the ratchet until it clicks. The ratchet slips, so the wire is never squashed.',
    },
    {
      title: 'Step 5 · Read the scales',
      async run(lab) {
        lab.setZeroSettings(ze);
        await onObject(lab, 'wire');
        magnify(lab);
      },
      caption: (lab) => {
        const s = lab.snapshot();
        return `${workedSolution('msr', s)} ${workedSolution('vsr', s)} ${workedSolution('observed', s)}`;
      },
    },
    {
      title: 'Step 6 · Zero correction',
      async run(lab) {
        lab.setZeroSettings(ze);
        await onObject(lab, 'wire');
        magnify(lab);
      },
      caption: (lab) => `${workedSolution('corrected', lab.snapshot())} Remember: corrected = observed − zero error.`,
    },
  ];
}

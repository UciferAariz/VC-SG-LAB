/**
 * Sound effects synthesised with the Web Audio API (SPEC §11). No audio files.
 *
 * The AudioContext is created lazily on the first user gesture (autoplay
 * policy). Everything is a no-op when sound is muted or Web Audio is missing.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let hapticsEnabled = true;
let unlocked = false;

function audio(): AudioContext | null {
  if (!enabled || !unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // 50 ms of white noise, reused for every click.
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once at start-up: audio becomes available after the first gesture. */
export function initAudio(): void {
  const unlock = () => {
    unlocked = true;
    audio();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on && ctx) void ctx.suspend();
}

export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}

/** Short noise burst through a band-pass filter. */
function burst(freq: number, q: number, durMs: number, gain: number, delay = 0): void {
  const a = audio();
  if (!a || !noise) return;
  const t0 = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noise;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + durMs / 1000 + 0.01);
}

function tone(freq: number, durMs: number, gain: number, type: OscillatorType = 'sine', delay = 0, endFreq?: number): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durMs / 1000);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.02);
}

export function vibrate(ms = 5): void {
  if (hapticsEnabled && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export const sfx = {
  /** Ratchet slip: short, high, dry click (≈ 3 ms noise burst at ~3 kHz). */
  ratchetClick(count = 1): void {
    for (let i = 0; i < Math.min(count, 6); i++) burst(3000, 6, 3, 0.5, i * 0.035);
    vibrate(5);
  },
  /** Jaw / spindle contact: soft low "tock". */
  contact(): void {
    tone(220, 70, 0.25, 'sine', 0, 140);
    burst(900, 2, 12, 0.15);
    vibrate(5);
  },
  /** Lock toggle: small mechanical click. */
  lock(): void {
    burst(1800, 4, 6, 0.35);
    burst(1200, 4, 5, 0.25, 0.04);
  },
  /** Correct answer: gentle two-note chime. */
  correct(): void {
    tone(784, 180, 0.18, 'sine');
    tone(1175, 260, 0.16, 'sine', 0.12);
  },
  /** Wrong answer: soft low blip. */
  wrong(): void {
    tone(196, 160, 0.18, 'triangle', 0, 150);
  },
};

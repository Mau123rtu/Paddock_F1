/** Sonidos sintetizados con WebAudio (sin archivos): motor, luces de salida, radio, boxes y accidente. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
let enabled = true;
export const soundOn = () => enabled;
function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.25; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
export function setSound(v: boolean) { enabled = v; if (!v) stopEngine(); }
export function unlock() { if (enabled) ac(); }
export function beep(freq: number, dur = 0.15, type: OscillatorType = 'sine', vol = 0.4) {
  const c = enabled ? ac() : null;
  if (!c || !master) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}
export function startEngine() {
  const c = enabled ? ac() : null;
  if (!c || !master || engine) return;
  const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 90; o2.frequency.value = 181; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.12;
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
  engine = { o1, o2, g, f };
}
/** frac 0..1 según la velocidad del coche seguido. */
export function setEngine(frac: number) {
  if (!engine || !ctx) return;
  const f = 70 + Math.max(0, Math.min(1, frac)) * 260, t = ctx.currentTime;
  engine.o1.frequency.setTargetAtTime(f, t, 0.08); engine.o2.frequency.setTargetAtTime(f * 2.01, t, 0.08); engine.f.frequency.setTargetAtTime(500 + frac * 2200, t, 0.1);
}
export function stopEngine() {
  if (!engine) return;
  try { engine.o1.stop(); engine.o2.stop(); } catch { /* ya detenido */ }
  engine = null;
}
export const startLight = (n: number) => beep(420 + n * 45, 0.18, 'square', 0.25);
export const lightsOut = () => beep(900, 0.35, 'sawtooth', 0.3);
export const radio = () => { beep(1250, 0.06, 'square', 0.15); setTimeout(() => beep(950, 0.08, 'square', 0.15), 90); };
export const pitBeeps = () => { [0, 110, 220].forEach((d) => setTimeout(() => beep(700 + d, 0.07, 'square', 0.2), d)); };
export function crashSound() {
  const c = enabled ? ac() : null;
  if (!c || !master) return;
  const n = c.sampleRate * 0.4, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf; src.connect(master); src.start();
}
/** Fanfarria corta para victorias, títulos y logros. */
export const fanfare = () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'triangle', 0.3), i * 130));

/**
 * Money-counting sound — the rapid paper flutter of a note-counting machine,
 * synthesized with the Web Audio API (no audio asset, nothing to download).
 * Each "note" is a short burst of bandpass-filtered noise; ~28 ticks/second
 * with slight randomization so it sounds mechanical, not robotic.
 *
 * One flutter plays at a time: the dashboard animates several KPI cards at
 * once and overlapping flutters would be a cacophony.
 * Silently does nothing when the browser blocks audio (no user gesture yet).
 */
let ctx = null;
let playingUntil = 0;

export function playMoneyCount(durationMs = 900) {
  const now = performance.now();
  if (now < playingUntil) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (ctx.state !== 'running') return;
    playingUntil = now + durationMs;

    const t0 = ctx.currentTime + 0.02;
    const dur = durationMs / 1000;

    // Master volume with a fade-out tail so the flutter ends softly.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.4, t0);
    master.gain.setValueAtTime(0.4, t0 + dur * 0.7);
    master.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    master.connect(ctx.destination);

    // One shared noise buffer, replayed per tick.
    const tickLen = 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * tickLen), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const rate = 28; // notes per second
    for (let t = 0; t < dur; t += 1 / (rate * (0.9 + Math.random() * 0.2))) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500 + Math.random() * 1500;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25 + Math.random() * 0.35, t0 + t);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + tickLen);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t0 + t);
    }
  } catch {
    // no audio available — stay silent
  }
}

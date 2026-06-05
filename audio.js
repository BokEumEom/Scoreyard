// audio.js — synthesized WebAudio sound effects. No asset files.
//
// Browsers suspend an AudioContext until a user gesture, so call unlock() from
// the first click/keypress (start button, mute toggle). Every SFX is a short
// oscillator+gain envelope created and stopped per sound — no nodes accumulate.
//
//   unlock() ─▶ AudioContext (resumed)
//   sfx.collect()/powerup()/hit()/boss()/newBest()/start() ─▶ blip(s)
//   setMuted(true) ─▶ blip() returns early (no sound), context stays alive

let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = value === true;
}

export function isMuted() {
  return muted;
}

// Create or resume the AudioContext. Safe to call repeatedly; must be invoked
// from a user gesture or the context starts suspended and nothing plays.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (error) {
      ctx = null;
      return;
    }
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// One short tone with an attack/decay envelope and optional pitch sweep.
function blip({ freq = 440, type = "sine", dur = 0.12, gain = 0.18, sweep = 0, delay = 0 }) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03); // node is released after stop; nothing accumulates
}

export const sfx = {
  // Crystal pickup — pitch rises with combo for a satisfying ladder.
  collect(combo = 1) {
    blip({ freq: 520 + Math.min(combo, 8) * 45, type: "triangle", dur: 0.1, gain: 0.16, sweep: 130 });
  },
  // Power-up grab — two-note rising chirp.
  powerup() {
    blip({ freq: 440, type: "square", dur: 0.09, gain: 0.14, sweep: 240 });
    blip({ freq: 680, type: "square", dur: 0.12, gain: 0.12, sweep: 180, delay: 0.06 });
  },
  // Taking damage — low descending buzz.
  hit() {
    blip({ freq: 190, type: "sawtooth", dur: 0.22, gain: 0.2, sweep: -120 });
  },
  // Boss appears — heavy two-layer drone.
  boss() {
    blip({ freq: 90, type: "sawtooth", dur: 0.5, gain: 0.22, sweep: 60 });
    blip({ freq: 150, type: "square", dur: 0.4, gain: 0.16, delay: 0.1 });
  },
  // New best — triumphant three-note arpeggio.
  newBest() {
    [0, 0.11, 0.22].forEach((d, i) =>
      blip({ freq: 523 + i * 175, type: "triangle", dur: 0.18, gain: 0.18, delay: d })
    );
  },
  // Run start — short confirming blip.
  start() {
    blip({ freq: 330, type: "square", dur: 0.08, gain: 0.12, sweep: 300 });
  },
};

export default { setMuted, isMuted, unlock, sfx };

import { playOsc, playNoise, audioReady, actx, bus } from './audio.js';

// One procedural recipe per sound effect. Signature: (detail, vol) — vol is the
// distance attenuation applied by the game's sfx dispatcher.

const MATERIAL_FREQ = { stone: 2400, dirt: 750, wood: 1300, leaf: 3200 };

export const SFX = {
  break(material, vol = 1) {
    playNoise({ dur: 0.12, freq: MATERIAL_FREQ[material] ?? 1000, q: 1.4, gain: 0.45 * vol });
    playOsc({ type: 'triangle', freq: 220, freqEnd: 90, dur: 0.08, gain: 0.15 * vol });
  },
  place(material, vol = 1) {
    playNoise({ dur: 0.05, freq: (MATERIAL_FREQ[material] ?? 1000) * 0.6, gain: 0.25 * vol });
    playOsc({ type: 'triangle', freq: 170, freqEnd: 120, dur: 0.09, gain: 0.22 * vol });
  },
  step(_speed, vol = 1) {
    playNoise({ dur: 0.045, freq: 380 + Math.random() * 160, filterType: 'lowpass', gain: 0.1 * vol });
  },
  playerHurt(_d, vol = 1) {
    playOsc({ type: 'square', freq: 300, freqEnd: 110, dur: 0.2, gain: 0.35 * vol });
    playNoise({ dur: 0.12, freq: 900, gain: 0.2 * vol });
  },
  whoosh(_d, vol = 1) {
    playNoise({ dur: 0.16, freq: 700, freqEnd: 2400, q: 2.5, gain: 0.22 * vol });
  },
  meleeHit(_d, vol = 1) {
    playOsc({ type: 'sine', freq: 120, freqEnd: 70, dur: 0.12, gain: 0.5 * vol });
    playNoise({ dur: 0.07, freq: 1900, gain: 0.3 * vol });
  },
  // rising saw cluster — fired once when a chase begins
  stinger(_d, vol = 1) {
    for (const f of [200, 267, 301]) {
      playOsc({ type: 'sawtooth', freq: f, freqEnd: f * 4.2, dur: 0.8, gain: 0.16 * vol, attack: 0.02 });
    }
    playNoise({ dur: 0.9, freq: 400, freqEnd: 3200, q: 0.8, gain: 0.18 * vol, attack: 0.1 });
  },
  // the jumpscare
  screech(_d, vol = 1) {
    playOsc({ type: 'sawtooth', freq: 1200, freqEnd: 180, dur: 1.0, gain: 0.55 * vol, attack: 0.01 });
    playOsc({ type: 'square', freq: 890, freqEnd: 140, dur: 1.0, gain: 0.3 * vol, attack: 0.01 });
    playNoise({ dur: 1.0, freq: 2400, freqEnd: 500, q: 0.6, gain: 0.5 * vol, attack: 0.01 });
  },
  giggle(_d, vol = 1) {
    // descending FM-ish blips — a small thing laughing somewhere it shouldn't be
    const base = 640 + Math.random() * 120;
    for (let i = 0; i < 4; i++) {
      playOsc({ type: 'triangle', freq: base * Math.pow(0.85, i), freqEnd: base * Math.pow(0.85, i) * 0.8,
                dur: 0.09, gain: 0.2 * vol, delay: i * 0.11 });
    }
  },
  teleport(_d, vol = 1) {
    playNoise({ dur: 0.35, freq: 2600, freqEnd: 240, q: 3, gain: 0.22 * vol, attack: 0.02 });
  },
  nunTeleport(_d, vol = 1) {
    playOsc({ type: 'sine', freq: 60, freqEnd: 34, dur: 0.7, gain: 0.5 * vol, attack: 0.01 });
    playNoise({ dur: 0.4, freq: 1800, freqEnd: 200, q: 2, gain: 0.2 * vol });
  },
  staticBurst(_d, vol = 1) {
    playNoise({ dur: 0.45, freq: 3000, filterType: 'highpass', gain: 0.45 * vol, attack: 0.005 });
  },
  dusk() {
    playOsc({ type: 'sine', freq: 98, freqEnd: 49, dur: 2.4, gain: 0.4, attack: 0.05 });
    playOsc({ type: 'sine', freq: 147, freqEnd: 73, dur: 2.4, gain: 0.2, attack: 0.05, delay: 0.12 });
  },
  dawn() {
    for (let i = 0; i < 3; i++) {
      playOsc({ type: 'sine', freq: 392 * Math.pow(1.26, i), dur: 0.9, gain: 0.14, attack: 0.08, delay: i * 0.22 });
    }
  },
};

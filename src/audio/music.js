import { audioReady, actx, bus, noiseSource, playOsc } from './audio.js';

// Continuous layers: day wind, night breathing drone, chase shriek + stabs,
// proximity heartbeat, The Butcher's chainsaw, The Tall One's static.
// All layers idle at zero gain and are steered every frame from game state.

export class MusicSystem {
  constructor() {
    this.built = false;
    this.heartTimer = 0;
    this.stabTimer = 0;
    this.birdTimer = 4;
  }

  build() {
    if (this.built || !audioReady()) return;
    const ctx = actx();
    const music = bus('music');

    // day: lowpassed wind
    this.dayGain = ctx.createGain();
    this.dayGain.gain.value = 0;
    const wind = noiseSource();
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 420;
    wind.connect(windLp); windLp.connect(this.dayGain); this.dayGain.connect(music);
    wind.start();

    // night: two detuned saws, lowpassed — a slow breathing drone
    this.nightGain = ctx.createGain();
    this.nightGain.gain.value = 0;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 210;
    for (const f of [55, 55.6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(droneLp);
      osc.start();
    }
    droneLp.connect(this.nightGain); this.nightGain.connect(music);

    // chase: shrieking high bandpassed noise (stabs are scheduled in update)
    this.chaseGain = ctx.createGain();
    this.chaseGain.gain.value = 0;
    const shriek = noiseSource();
    const shriekBp = ctx.createBiquadFilter();
    shriekBp.type = 'bandpass';
    shriekBp.frequency.value = 2800;
    shriekBp.Q.value = 9;
    shriek.connect(shriekBp); shriekBp.connect(this.chaseGain); this.chaseGain.connect(music);
    shriek.start();

    // chainsaw: saw + detuned square through a peaking filter
    this.sawGain = ctx.createGain();
    this.sawGain.gain.value = 0;
    const sawPeak = ctx.createBiquadFilter();
    sawPeak.type = 'peaking';
    sawPeak.frequency.value = 420;
    sawPeak.gain.value = 8;
    const saw1 = ctx.createOscillator(); saw1.type = 'sawtooth'; saw1.frequency.value = 88;
    const saw2 = ctx.createOscillator(); saw2.type = 'square'; saw2.frequency.value = 178;
    saw1.connect(sawPeak); saw2.connect(sawPeak);
    sawPeak.connect(this.sawGain); this.sawGain.connect(music);
    saw1.start(); saw2.start();

    // static: harsh highpassed noise for the gaze meter
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    const st = noiseSource();
    const stHp = ctx.createBiquadFilter();
    stHp.type = 'highpass';
    stHp.frequency.value = 1800;
    st.connect(stHp); stHp.connect(this.staticGain); this.staticGain.connect(bus('sfx'));
    st.start();

    this.built = true;
  }

  // state: { isNight, anyChasing, nearestDist, staticLevel, chainsawLevel, time }
  update(dt, state) {
    this.build();
    if (!this.built || !audioReady()) return;
    const t = actx().currentTime;

    this.dayGain.gain.setTargetAtTime(state.isNight ? 0 : 0.1, t, 2.5);
    const breathe = 0.13 + Math.sin(state.time * 0.85) * 0.045;
    this.nightGain.gain.setTargetAtTime(state.isNight ? breathe : 0, t, state.isNight ? 0.8 : 2.5);
    this.chaseGain.gain.setTargetAtTime(state.anyChasing ? 0.1 : 0, t, state.anyChasing ? 0.4 : 1.6);
    this.sawGain.gain.setTargetAtTime((state.chainsawLevel ?? 0) * 0.35, t, 0.2);
    this.staticGain.gain.setTargetAtTime((state.staticLevel ?? 0) * 0.3, t, 0.08);

    // tritone stabs at ~140 BPM while anything is chasing
    if (state.anyChasing) {
      this.stabTimer -= dt;
      if (this.stabTimer <= 0) {
        this.stabTimer = 0.428;
        playOsc({ type: 'sawtooth', freq: 196, dur: 0.13, gain: 0.14, busName: 'music' });
        playOsc({ type: 'sawtooth', freq: 277, dur: 0.13, gain: 0.12, busName: 'music' });
      }
    }

    // sparse birds by day — their absence at dusk registers subconsciously
    if (!state.isNight) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 5 + Math.random() * 9;
        const f = 2200 + Math.random() * 1400;
        playOsc({ type: 'sine', freq: f, freqEnd: f * 0.8, dur: 0.1, gain: 0.05, busName: 'music' });
        playOsc({ type: 'sine', freq: f * 1.1, freqEnd: f * 0.85, dur: 0.09, gain: 0.04, busName: 'music', delay: 0.16 });
      }
    }

    // proximity heartbeat: distance 24 -> 3 blocks maps to interval 1.2s -> 0.35s
    const d = state.nearestDist;
    if (d < 24) {
      const u = Math.min(1, (24 - d) / 21);
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 1.2 - u * 0.85;
        const g = 0.25 + 0.5 * u;
        playOsc({ type: 'triangle', freq: 58, freqEnd: 38, dur: 0.1, gain: g, busName: 'heart' });
        playOsc({ type: 'triangle', freq: 52, freqEnd: 34, dur: 0.09, gain: g * 0.8, busName: 'heart', delay: 0.13 });
      }
    }
  }
}

// WebAudio foundation. The context is created on the Play click (autoplay policy);
// every play call no-ops safely when audio is unavailable (headless tests).

let ctx = null;
const buses = {};
let noiseBuffer = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0.7;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  master.connect(comp);
  comp.connect(ctx.destination);
  buses.master = master;

  for (const name of ['sfx', 'music', 'heart']) {
    buses[name] = ctx.createGain();
    buses[name].connect(master);
  }
  buses.sfx.gain.value = 0.9;
  buses.music.gain.value = 0.8;
  buses.heart.gain.value = 1.0;

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export const audioReady = () => !!ctx && ctx.state === 'running';
export const actx = () => ctx;
export const bus = (name) => buses[name];

export function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

// One-shot oscillator with an AD envelope and optional pitch glide.
export function playOsc({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, gain = 0.3,
                          busName = 'sfx', attack = 0.005, delay = 0 } = {}) {
  if (!audioReady()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(buses[busName]);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// One-shot filtered noise burst.
export function playNoise({ dur = 0.1, gain = 0.3, filterType = 'bandpass', freq = 1000,
                            freqEnd = null, q = 1, busName = 'sfx', attack = 0.003, delay = 0 } = {}) {
  if (!audioReady()) return;
  const t0 = ctx.currentTime + delay;
  const src = noiseSource();
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, t0);
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t0 + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(buses[busName]);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// timeOfDay t runs [0,1): t=0 is 6:00 AM (dawn), t=DAY_FRAC is 9:00 PM (dusk).
const DAY_FRAC = CONFIG.DAY_LENGTH / (CONFIG.DAY_LENGTH + CONFIG.NIGHT_LENGTH);
const CYCLE = CONFIG.DAY_LENGTH + CONFIG.NIGHT_LENGTH;

// Sky/fog/light keyframes over the cycle. Night fog closing in is the single
// scariest renderer setting we have — keep it tight.
const KEYS = [
  { t: 0.00, sky: '#c96f3f', fog: '#c98a5f', near: 20, far: 95,  sun: 1.0, hemi: 0.55, sunColor: '#ffd9a8' },
  { t: 0.08, sky: '#7fb6e8', fog: '#aecde4', near: 35, far: 140, sun: 2.0, hemi: 0.95, sunColor: '#fff2dd' },
  { t: 0.30, sky: '#8ec2ef', fog: '#b8d4ea', near: 38, far: 150, sun: 2.2, hemi: 1.0,  sunColor: '#fff6e8' },
  { t: 0.50, sky: '#83b4de', fog: '#b0c8dd', near: 34, far: 130, sun: 1.8, hemi: 0.9,  sunColor: '#ffedc8' },
  { t: 0.56, sky: '#d97a3a', fog: '#c07040', near: 26, far: 95,  sun: 1.2, hemi: 0.6,  sunColor: '#ffb066' },
  { t: 0.60, sky: '#4a1812', fog: '#38120c', near: 16, far: 62,  sun: 0.45, hemi: 0.3, sunColor: '#ff7744' },
  { t: 0.65, sky: '#05060f', fog: '#04040c', near: 9,  far: 42,  sun: 0.28, hemi: 0.14, sunColor: '#9db4ff' },
  { t: 0.95, sky: '#05060f', fog: '#04040c', near: 9,  far: 42,  sun: 0.28, hemi: 0.14, sunColor: '#9db4ff' },
  { t: 1.00, sky: '#c96f3f', fog: '#c98a5f', near: 20, far: 95,  sun: 1.0, hemi: 0.55, sunColor: '#ffd9a8' },
];

const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _ca = new THREE.Color();
const _cb = new THREE.Color();

function makeMoonCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      if (d > 14) continue;
      let col = '#d8dce8';
      if ((x * 7 + y * 13) % 23 < 3) col = '#b8bccc';
      if (d > 12.5) col = '#c4c8d8';
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function makeSunCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.5, 'rgba(255,210,130,0.9)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.01;   // just after 6:00 AM
    this.day = 1;       // day/night counter: night N belongs to day N
    this.isNight = false;
    this.onDusk = null; // (night) => void
    this.onDawn = null; // (completedNight) => void
    this.lightDim = 0;  // 0..1, set per-frame by killer effects (The Nun)

    scene.background = new THREE.Color('#7fb6e8');
    scene.fog = new THREE.Fog('#aecde4', 35, 140);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5f, 1.0);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    this.ambient = new THREE.AmbientLight(0x404050, 0.35);
    scene.add(this.hemi, this.sun, this.ambient);

    const sunTex = new THREE.CanvasTexture(makeSunCanvas());
    const moonTex = new THREE.CanvasTexture(makeMoonCanvas());
    moonTex.magFilter = THREE.NearestFilter;
    moonTex.generateMipmaps = false;
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    this.sunSprite.scale.setScalar(30);
    this.moonSprite.scale.setScalar(16);
    scene.add(this.sunSprite, this.moonSprite);
  }

  reset() {
    this.time = 0.01;
    this.day = 1;
    this.isNight = false;
  }

  // Debug/test hook: jump the clock. Events fire on the next update tick.
  setTime(t) {
    const wasNight = this.isNight;
    this.time = Math.min(Math.max(t, 0), 0.999);
    const nowNight = this.time >= DAY_FRAC;
    if (!wasNight && nowNight) {
      this.isNight = true;
      if (this.onDusk) this.onDusk(this.day);
    } else if (wasNight && !nowNight) {
      this.isNight = false;
      if (this.onDawn) this.onDawn(this.day);
      this.day++;
    }
  }

  update(dt, cameraPos) {
    const prev = this.time;
    this.time += dt / CYCLE;

    if (prev < DAY_FRAC && this.time >= DAY_FRAC) {
      this.isNight = true;
      if (this.onDusk) this.onDusk(this.day);
    }
    if (this.time >= 1) {
      this.time -= 1;
      this.isNight = false;
      if (this.onDawn) this.onDawn(this.day);
      this.day++;
    }

    // keyframe lerp
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (this.time >= KEYS[i].t && this.time <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const f = (this.time - a.t) / Math.max(1e-6, b.t - a.t);
    _skyColor.lerpColors(_ca.set(a.sky), _cb.set(b.sky), f);
    _fogColor.lerpColors(_ca.set(a.fog), _cb.set(b.fog), f);
    _sunColor.lerpColors(_ca.set(a.sunColor), _cb.set(b.sunColor), f);

    const dim = 1 - this.lightDim * 0.65;
    this.scene.background.copy(_skyColor).multiplyScalar(dim);
    this.scene.fog.color.copy(_fogColor).multiplyScalar(dim);
    this.scene.fog.near = (a.near + (b.near - a.near) * f) * (1 - this.lightDim * 0.4);
    this.scene.fog.far = (a.far + (b.far - a.far) * f) * (1 - this.lightDim * 0.4);
    this.sun.intensity = (a.sun + (b.sun - a.sun) * f) * dim;
    this.hemi.intensity = (a.hemi + (b.hemi - a.hemi) * f) * dim;
    this.ambient.intensity = 0.35 * dim;
    this.sun.color.copy(_sunColor);

    // sun & moon travel opposite arcs; the directional light follows whichever is up
    const dayProg = this.time < DAY_FRAC ? this.time / DAY_FRAC : 0;
    const nightProg = this.time >= DAY_FRAC ? (this.time - DAY_FRAC) / (1 - DAY_FRAC) : 0;
    const sunTheta = Math.PI * dayProg;
    const moonTheta = Math.PI * nightProg;
    const sunDir = { x: Math.cos(sunTheta), y: Math.sin(sunTheta) * 0.9 + 0.05, z: 0.25 };
    const moonDir = { x: Math.cos(moonTheta), y: Math.sin(moonTheta) * 0.9 + 0.05, z: -0.2 };
    const lightDir = this.isNight ? moonDir : sunDir;
    this.sun.position.set(lightDir.x * 100, Math.max(lightDir.y, 0.06) * 100, lightDir.z * 100);

    if (cameraPos) {
      this.sunSprite.visible = !this.isNight;
      this.moonSprite.visible = this.isNight;
      this.sunSprite.position.set(cameraPos.x + sunDir.x * 220, cameraPos.y + sunDir.y * 220, cameraPos.z + sunDir.z * 220);
      this.moonSprite.position.set(cameraPos.x + moonDir.x * 220, cameraPos.y + moonDir.y * 220, cameraPos.z + moonDir.z * 220);
    }
  }

  // How deep into the night we are, 0..1. 0 during the day.
  nightProgress() {
    if (!this.isNight) return 0;
    return (this.time - DAY_FRAC) / (1 - DAY_FRAC);
  }

  // "9:42 PM" style clock readout.
  clockString() {
    let hour;
    if (this.time < DAY_FRAC) {
      hour = CONFIG.DAWN_HOUR + (this.time / DAY_FRAC) * (CONFIG.DUSK_HOUR - CONFIG.DAWN_HOUR);
    } else {
      const nightHours = 24 - CONFIG.DUSK_HOUR + CONFIG.DAWN_HOUR;
      hour = CONFIG.DUSK_HOUR + this.nightProgress() * nightHours;
    }
    hour = hour % 24;
    const h24 = Math.floor(hour);
    const m = Math.floor((hour - h24) * 60);
    const ampm = h24 < 12 ? 'AM' : 'PM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
}

import * as THREE from 'three';
import { SkinPainter, REGIONS } from './painter.js';

// Declarative Minecraft-style humanoid: head/torso/arms/legs as boxes, one skin
// texture, one material. def.proportions tweaks silhouettes (Slender is thin and
// long-limbed, Chucky is small with a big head) without new code.

const BASE = { legH: 0.75, legW: 0.25, torsoH: 0.75, torsoW: 0.5, torsoD: 0.25, headS: 0.5, armW: 0.25, armH: 0.75 };

const FACE_ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const PART_REGIONS = {
  head: { px: 'headLeft', nx: 'headRight', py: 'headTop', ny: 'headBottom', pz: 'headFront', nz: 'headBack' },
  torso: { px: 'torsoLeft', nx: 'torsoRight', py: 'torsoTop', ny: 'torsoBottom', pz: 'torsoFront', nz: 'torsoBack' },
  arm: { px: 'armLeft', nx: 'armRight', py: 'armTop', ny: 'armBottom', pz: 'armFront', nz: 'armBack' },
  leg: { px: 'legLeft', nx: 'legRight', py: 'legTop', ny: 'legBottom', pz: 'legFront', nz: 'legBack' },
};

function setBoxUVs(geo, part) {
  const uv = geo.attributes.uv;
  const inset = 0.5 / 64;
  FACE_ORDER.forEach((face, fi) => {
    const r = REGIONS[PART_REGIONS[part][face]];
    const u0 = r.x / 64 + inset, u1 = (r.x + r.w) / 64 - inset;
    const vT = 1 - r.y / 64 - inset, vB = 1 - (r.y + r.h) / 64 + inset;
    const o = fi * 4;
    uv.setXY(o + 0, u0, vT);
    uv.setXY(o + 1, u1, vT);
    uv.setXY(o + 2, u0, vB);
    uv.setXY(o + 3, u1, vB);
  });
  uv.needsUpdate = true;
}

// ---- prop builders: character-defining accessories, all plain boxes ----
function mat(color) { return new THREE.MeshLambertMaterial({ color }); }

const PROPS = {
  knife(scale = 1) {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), mat(0x3a2a1a));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.34), mat(0xd4d8de));
    blade.position.set(0, -0.09, 0.17);
    g.add(handle, blade);
    g.scale.setScalar(scale);
    return g;
  },
  machete() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.07), mat(0x2a2018));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.55), mat(0xb8bec6));
    blade.position.set(0, -0.05, 0.3);
    g.add(handle, blade);
    return g;
  },
  claws() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.3, 0.03), mat(0xc8ccd4));
      blade.position.set(-0.09 + i * 0.06, -0.14, 0.05);
      blade.rotation.x = -0.25;
      g.add(blade);
    }
    return g;
  },
  fedora() {
    const g = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.66), mat(0x4a2c14));
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42), mat(0x3d2410));
    crown.position.y = 0.12;
    g.add(brim, crown);
    return g;
  },
  balloon() {
    const g = new THREE.Group();
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.62, 0.012), mat(0xd8d8d8));
    string.position.y = 0.31;
    const ball = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), mat(0xc01818));
    ball.position.y = 0.75;
    g.add(string, ball);
    return g;
  },
  chainsaw() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.3), mat(0x8a2b1a));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.62), mat(0x6e6e72));
    bar.position.set(0, 0, 0.42);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), mat(0x222));
    handle.position.set(0, 0.14, -0.05);
    g.add(body, bar, handle);
    return g;
  },
  longHair() {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.95, 0.09), mat(0x0c0c0c));
    back.position.set(0, -0.2, -0.29);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.4), mat(0x0e0e0e));
    left.position.set(-0.3, -0.12, -0.06);
    const right = left.clone();
    right.position.x = 0.3;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), mat(0x0a0a0a));
    front.position.set(-0.06, 0.02, 0.29);
    g.add(back, left, right, front);
    return g;
  },
  veil() {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.78, 0.12), mat(0x0a0a0c));
    back.position.set(0, -0.05, -0.3);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.62), mat(0x0a0a0c));
    top.position.y = 0.3;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.5), mat(0x0c0c0e));
    sideL.position.set(-0.31, 0, -0.08);
    const sideR = sideL.clone();
    sideR.position.x = 0.31;
    g.add(back, top, sideL, sideR);
    return g;
  },
  hairTufts() {
    const g = new THREE.Group();
    const tuftL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.34), mat(0xc44414));
    tuftL.position.set(-0.31, 0.06, -0.06);
    const tuftR = tuftL.clone();
    tuftR.position.x = 0.31;
    g.add(tuftL, tuftR);
    return g;
  },
};

// Default placement of each prop kind, relative to its attach pivot.
const PROP_DEFAULTS = {
  knife: { attach: 'armR', position: [0, -BASE.armH + 0.08, 0.08], rotation: [0.2, 0, 0] },
  machete: { attach: 'armR', position: [0, -BASE.armH + 0.08, 0.1], rotation: [0.25, 0, 0] },
  claws: { attach: 'armR', position: [0, -BASE.armH + 0.12, 0.04], rotation: [0, 0, 0] },
  fedora: { attach: 'head', position: [0, BASE.headS + 0.02, 0], rotation: [0, 0, 0] },
  balloon: { attach: 'armL', position: [0, -BASE.armH + 0.1, 0.12], rotation: [0, 0, 0] },
  chainsaw: { attach: 'hips', position: [0, 0.35, 0.42], rotation: [0, 0, 0] },
  longHair: { attach: 'head', position: [0, 0.28, 0], rotation: [0, 0, 0] },
  veil: { attach: 'head', position: [0, 0.22, 0], rotation: [0, 0, 0] },
  hairTufts: { attach: 'head', position: [0, 0.25, 0], rotation: [0, 0, 0] },
};

export function buildRig(def) {
  const painter = new SkinPainter();
  def.paintSkin(painter);
  const texture = painter.getTexture();
  const material = new THREE.MeshLambertMaterial({ map: texture });

  const p = { armLen: 1, legLen: 1, thin: 1, head: 1, ...(def.proportions || {}) };
  const legH = BASE.legH * p.legLen;
  const legW = BASE.legW * p.thin;
  const torsoW = BASE.torsoW * p.thin;
  const torsoD = BASE.torsoD * p.thin;
  const armW = BASE.armW * p.thin;
  const armH = BASE.armH * p.armLen;
  const headS = BASE.headS * p.head;

  const box = (w, h, d, part) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    setBoxUVs(geo, part);
    return new THREE.Mesh(geo, material);
  };

  const group = new THREE.Group();   // world placement; rotation.y = facing
  const body = new THREE.Group();    // hover/crouch offset lives here
  group.add(body);

  // legs hang from hip pivots
  const legL = new THREE.Group();
  legL.position.set(-legW / 2 - 0.005, legH, 0);
  const legLMesh = box(legW, legH, legW, 'leg');
  legLMesh.position.y = -legH / 2;
  legL.add(legLMesh);
  const legR = new THREE.Group();
  legR.position.set(legW / 2 + 0.005, legH, 0);
  const legRMesh = box(legW, legH, legW, 'leg');
  legRMesh.position.y = -legH / 2;
  legR.add(legRMesh);
  body.add(legL, legR);

  // everything above the waist tilts together (crouch/lunge lean)
  const hips = new THREE.Group();
  hips.position.y = legH;
  body.add(hips);

  const torso = box(torsoW, BASE.torsoH, torsoD, 'torso');
  torso.position.y = BASE.torsoH / 2;
  hips.add(torso);

  const shoulderY = BASE.torsoH - armW / 2;
  const armL = new THREE.Group();
  armL.position.set(-torsoW / 2 - armW / 2 - 0.005, shoulderY, 0);
  const armLMesh = box(armW, armH, armW, 'arm');
  armLMesh.position.y = -armH / 2 + armW / 2;
  armL.add(armLMesh);
  const armR = new THREE.Group();
  armR.position.set(torsoW / 2 + armW / 2 + 0.005, shoulderY, 0);
  const armRMesh = box(armW, armH, armW, 'arm');
  armRMesh.position.y = -armH / 2 + armW / 2;
  armR.add(armRMesh);
  hips.add(armL, armR);

  const head = new THREE.Group();
  head.position.y = BASE.torsoH;
  const headMesh = box(headS, headS, headS, 'head');
  headMesh.position.y = headS / 2;
  head.add(headMesh);
  hips.add(head);

  const pivots = { body, hips, legL, legR, armL, armR, head };

  for (const propSpec of def.props || []) {
    const spec = typeof propSpec === 'string' ? { kind: propSpec } : propSpec;
    const d = PROP_DEFAULTS[spec.kind];
    const obj = PROPS[spec.kind](spec.scale);
    const at = spec.attach || d.attach;
    obj.position.fromArray(spec.position || d.position);
    obj.rotation.fromArray(spec.rotation || d.rotation);
    pivots[at].add(obj);
  }

  group.scale.setScalar(def.scale || 1);

  return {
    def, group, pivots, painter, texture, material,
    phase: Math.random() * Math.PI * 2,
    baseLegH: legH,
  };
}

// Shared animation: walk swing, arm poses, head tracking, crouch, hover, attack lunge.
// state: { moveSpeed, headYaw, headPitch, crouch, attackT, time }
export function animateRig(rig, dt, state) {
  const anim = rig.def.anim || {};
  const amp = anim.swingAmp ?? 0.7;
  rig.phase += state.moveSpeed * dt * 2.4;
  const speedFactor = Math.min(1, state.moveSpeed / 3);
  const swing = Math.sin(rig.phase) * amp * speedFactor;
  const { legL, legR, armL, armR, head, hips, body } = rig.pivots;

  if (anim.hover) {
    body.position.y = 0.35 + Math.sin(state.time * 2.1) * 0.12;
    legL.rotation.x = legR.rotation.x = 0.08;
  } else {
    body.position.y = 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
  }

  const pose = anim.armPose || 'down';
  if (pose === 'forward') {
    armL.rotation.x = -Math.PI / 2 + Math.sin(rig.phase) * 0.05;
    armR.rotation.x = -Math.PI / 2 + Math.cos(rig.phase) * 0.05;
  } else {
    armL.rotation.x = -swing * 0.75;
    armR.rotation.x = swing * 0.75;
  }

  // attack: right arm hoists up then slashes down across attackT 0->1
  if (state.attackT > 0) {
    const t = state.attackT;
    armR.rotation.x = t < 0.4 ? -Math.PI * (t / 0.4) : -Math.PI * (1 - (t - 0.4) / 0.6) - 0.4;
    hips.rotation.x = 0.18 * Math.sin(t * Math.PI);
  } else if (state.crouch) {
    hips.rotation.x = 0.55;
    body.position.y = -0.3;
  } else if (!anim.hover) {
    hips.rotation.x = Math.sin(state.time * 1.3) * 0.02; // idle sway
  }

  // head tracks the player even when the body doesn't — free creepiness
  if (anim.headTrack !== false) {
    head.rotation.y += (Math.max(-1.15, Math.min(1.15, state.headYaw)) - head.rotation.y) * Math.min(1, dt * 8);
    head.rotation.x += (Math.max(-0.6, Math.min(0.6, state.headPitch)) - head.rotation.x) * Math.min(1, dt * 8);
  }
}

export function disposeRig(rig) {
  rig.group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material && obj.material.map) obj.material.map.dispose();
    if (obj.material) obj.material.dispose();
  });
}

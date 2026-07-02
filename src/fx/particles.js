import * as THREE from 'three';

// Pooled voxel-debris particles: one InstancedMesh of tiny cubes, one draw call.
// Everything that crumbles, splashes, sparks or smokes goes through burst().

const MAX = 256;
const _color = new THREE.Color();

export class Particles {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.pool = [];
    this.dummy = new THREE.Object3D();
  }

  // colors: array of css/int colors sampled per emitter (block palette, sparks, ink...)
  burst({ x, y, z, colors, count = 12, speed = 2.6, up = 3.2, ttl = 0.7, size = 1, spread = 0.35, gravity = 18 }) {
    for (let i = 0; i < count; i++) {
      if (this.pool.length >= MAX) this.pool.shift();
      this.pool.push({
        x: x + (Math.random() - 0.5) * spread * 2,
        y: y + (Math.random() - 0.5) * spread * 2,
        z: z + (Math.random() - 0.5) * spread * 2,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: Math.random() * up + 0.5,
        vz: (Math.random() - 0.5) * speed * 2,
        age: 0,
        ttl: ttl * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        size: size * (0.7 + Math.random() * 0.6),
        gravity,
      });
    }
  }

  update(dt) {
    if (this.pool.length === 0 && this.mesh.count === 0) return;
    this.pool = this.pool.filter((p) => p.age < p.ttl);
    let n = 0;
    for (const p of this.pool) {
      p.age += dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = Math.max(0.05, p.size * (1 - (p.age / p.ttl) * 0.75));
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.age * 6, p.age * 8, 0);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      this.mesh.setColorAt(n, _color.set(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Handy shared palettes for non-block bursts.
export const SPARK_COLORS = ['#ffffff', '#ffd0d0', '#ff5050', '#c8ccd4'];
export const SMOKE_COLORS = ['#1a1a22', '#26262e', '#0e0e14'];
export const INK_COLORS = ['#16141a', '#221e28', '#0a080e', '#2e2a36'];
export const EMBER_COLORS = ['#ffb028', '#ff7818', '#fff4c0'];

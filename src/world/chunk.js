import * as THREE from 'three';
import { BLOCKS, AIR, faceVisible } from './blocks.js';
import { CONFIG } from '../config.js';

const CS = CONFIG.CHUNK_SIZE;
const CH = CONFIG.WORLD_HEIGHT;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CS * CS * CH);
    this.group = null; // THREE.Group of this chunk's meshes, managed by World
  }
  index(x, y, z) { return x + z * CS + y * CS * CS; }
  get(x, y, z) { return this.data[this.index(x, y, z)]; }
  set(x, y, z, id) { this.data[this.index(x, y, z)] = id; }
}

// Culled-face mesher. One quad per visible face, merged into up to three
// BufferGeometries (opaque / cutout / water). Baked directional shading goes
// into a color attribute so MeshLambertMaterial still reacts to scene lights.
const FACES = [
  { dir: [-1, 0, 0], shade: 0.70, corners: [{ pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] }] },
  { dir: [1, 0, 0],  shade: 0.70, corners: [{ pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] }, { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] }] },
  { dir: [0, -1, 0], shade: 0.50, corners: [{ pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] }] },
  { dir: [0, 1, 0],  shade: 1.00, corners: [{ pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] }] },
  { dir: [0, 0, -1], shade: 0.82, corners: [{ pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] }] },
  { dir: [0, 0, 1],  shade: 0.82, corners: [{ pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] }] },
];

class GeoBuilder {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.colors = []; this.indices = []; }
  quad(face, wx, wy, wz, rect) {
    const base = this.positions.length / 3;
    for (const { pos, uv } of face.corners) {
      this.positions.push(wx + pos[0], wy + pos[1], wz + pos[2]);
      this.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      this.uvs.push(rect.u0 + uv[0] * (rect.u1 - rect.u0), rect.v0 + uv[1] * (rect.v1 - rect.v0));
      this.colors.push(face.shade, face.shade, face.shade);
    }
    this.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  build() {
    if (this.indices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setIndex(this.indices);
    return geo;
  }
}

export function buildChunkGeometries(world, chunk, uvRect) {
  const opaque = new GeoBuilder();
  const cutout = new GeoBuilder();
  const water = new GeoBuilder();
  const ox = chunk.cx * CS, oz = chunk.cz * CS;

  for (let y = 0; y < CH; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const id = chunk.get(x, y, z);
        if (id === AIR) continue;
        const def = BLOCKS[id];
        const wx = ox + x, wz = oz + z;
        for (const face of FACES) {
          const nid = world.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
          if (!faceVisible(id, nid)) continue;
          const tile = face.dir[1] > 0 ? def.tiles.top : face.dir[1] < 0 ? def.tiles.bottom : def.tiles.side;
          const builder = def.liquid ? water : def.cutout ? cutout : opaque;
          builder.quad(face, wx, y, wz, uvRect(tile));
        }
      }
    }
  }

  return { opaque: opaque.build(), cutout: cutout.build(), water: water.build() };
}

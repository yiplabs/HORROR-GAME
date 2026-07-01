import * as THREE from 'three';
import { Chunk, buildChunkGeometries } from './chunk.js';
import { BLOCKS, AIR, STONE } from './blocks.js';
import { CONFIG } from '../config.js';

const CS = CONFIG.CHUNK_SIZE;
const CH = CONFIG.WORLD_HEIGHT;
const NC = CONFIG.WORLD_CHUNKS;
export const WORLD_SIZE = CS * NC; // blocks per side

export class World {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.chunks = [];
    for (let cz = 0; cz < NC; cz++)
      for (let cx = 0; cx < NC; cx++)
        this.chunks.push(new Chunk(cx, cz));

    this.dirty = new Set();          // chunk indices queued for remesh
    this.playerPlaced = new Set();   // packed coords of player-built blocks

    this.materials = {
      opaque: new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true }),
      cutout: new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.65, depthWrite: false }),
    };
  }

  chunkIndex(cx, cz) { return cx + cz * NC; }
  chunkAt(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= NC || cz >= NC) return null;
    return this.chunks[this.chunkIndex(cx, cz)];
  }

  inBoundsXZ(x, z) { return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE; }

  getBlock(x, y, z) {
    if (y < 0) return STONE;
    if (y >= CH) return AIR;
    if (!this.inBoundsXZ(x, z)) return AIR;
    const chunk = this.chunks[this.chunkIndex(x >> 4, z >> 4)];
    return chunk.get(x & 15, y, z & 15);
  }

  // Physics view of the world: the rim is an invisible wall (mesher above still
  // treats outside as air so edge faces render), the floor below y=0 is solid.
  isSolid(x, y, z) {
    if (y < 0) return true;
    if (y >= CH) return false;
    if (!this.inBoundsXZ(x, z)) return true;
    const chunk = this.chunks[this.chunkIndex(x >> 4, z >> 4)];
    return BLOCKS[chunk.get(x & 15, y, z & 15)].solid;
  }

  packCoord(x, y, z) { return (y * WORLD_SIZE + z) * WORLD_SIZE + x; }
  isPlayerPlaced(x, y, z) { return this.playerPlaced.has(this.packCoord(x, y, z)); }

  // Direct write during worldgen — no dirty tracking (everything meshes after).
  setBlockSilent(x, y, z, id) {
    if (y < 0 || y >= CH || !this.inBoundsXZ(x, z)) return;
    this.chunks[this.chunkIndex(x >> 4, z >> 4)].set(x & 15, y, z & 15, id);
  }

  setBlock(x, y, z, id, byPlayer = false) {
    if (y < 0 || y >= CH || !this.inBoundsXZ(x, z)) return;
    const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
    this.chunks[this.chunkIndex(cx, cz)].set(lx, y, lz, id);

    const packed = this.packCoord(x, y, z);
    if (id === AIR) this.playerPlaced.delete(packed);
    else if (byPlayer) this.playerPlaced.add(packed);

    this.dirty.add(this.chunkIndex(cx, cz));
    if (lx === 0 && cx > 0) this.dirty.add(this.chunkIndex(cx - 1, cz));
    if (lx === 15 && cx < NC - 1) this.dirty.add(this.chunkIndex(cx + 1, cz));
    if (lz === 0 && cz > 0) this.dirty.add(this.chunkIndex(cx, cz - 1));
    if (lz === 15 && cz < NC - 1) this.dirty.add(this.chunkIndex(cx, cz + 1));
  }

  // Highest solid block's y at column (x, z), or -1 if none.
  surfaceHeight(x, z) {
    if (!this.inBoundsXZ(x, z)) return -1;
    const chunk = this.chunks[this.chunkIndex(x >> 4, z >> 4)];
    const lx = x & 15, lz = z & 15;
    for (let y = CH - 1; y >= 0; y--) {
      if (BLOCKS[chunk.get(lx, y, lz)].solid) return y;
    }
    return -1;
  }

  remeshChunk(chunk) {
    if (chunk.group) {
      for (const mesh of chunk.group.children) mesh.geometry.dispose();
      this.scene.remove(chunk.group);
      chunk.group = null;
    }
    const geos = buildChunkGeometries(this, chunk, this.atlas.uvRect);
    const group = new THREE.Group();
    for (const kind of ['opaque', 'cutout', 'water']) {
      if (!geos[kind]) continue;
      const mesh = new THREE.Mesh(geos[kind], this.materials[kind]);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    if (group.children.length > 0) {
      chunk.group = group;
      this.scene.add(group);
    }
  }

  meshAll() {
    for (const chunk of this.chunks) this.remeshChunk(chunk);
    this.dirty.clear();
  }

  update() {
    let budget = CONFIG.MAX_REMESH_PER_FRAME;
    for (const idx of this.dirty) {
      this.remeshChunk(this.chunks[idx]);
      this.dirty.delete(idx);
      if (--budget <= 0) break;
    }
  }

  dispose() {
    for (const chunk of this.chunks) {
      if (!chunk.group) continue;
      for (const mesh of chunk.group.children) mesh.geometry.dispose();
      this.scene.remove(chunk.group);
      chunk.group = null;
    }
  }

  // Wipe all block data for a fresh run (worldgen fills it again).
  clear() {
    for (const chunk of this.chunks) chunk.data.fill(0);
    this.playerPlaced.clear();
    this.dirty.clear();
  }
}

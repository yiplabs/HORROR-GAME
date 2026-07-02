import * as THREE from 'three';
import { hash2D } from '../core/rng.js';

// Single 256x256 canvas texture atlas, 16px tiles, painted at startup.
// Tile indices: 0 grass_top, 1 grass_side, 2 dirt, 3 stone, 4 sand,
//               5 log_side, 6 log_top, 7 leaves, 8 planks, 9 water.

const ATLAS_SIZE = 256;
export const TILE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE;

function ditherPick(x, y, seed, colors, weights) {
  const r = hash2D(x, y, seed);
  let acc = 0;
  for (let i = 0; i < colors.length; i++) {
    acc += weights[i];
    if (r < acc) return colors[i];
  }
  return colors[colors.length - 1];
}

const TILE_PAINTERS = {
  0: (px) => px((x, y) => ditherPick(x, y, 10, ['#5d9c3f', '#4f8a34', '#68aa48', '#578f3a'], [0.45, 0.25, 0.15, 0.15])),
  1: (px) => px((x, y) => {
    if (y < 3 + (hash2D(x, 0, 11) * 2 | 0)) return ditherPick(x, y, 12, ['#5d9c3f', '#4f8a34'], [0.6, 0.4]);
    return ditherPick(x, y, 13, ['#79553a', '#6b4a2e', '#86613f'], [0.5, 0.3, 0.2]);
  }),
  2: (px) => px((x, y) => ditherPick(x, y, 14, ['#79553a', '#6b4a2e', '#86613f', '#5e4128'], [0.45, 0.25, 0.2, 0.1])),
  3: (px) => px((x, y) => {
    // gray base with darker crack seams
    if (hash2D(x >> 1, y >> 1, 15) < 0.12) return '#5f5f5f';
    return ditherPick(x, y, 16, ['#7e7e7e', '#8a8a8a', '#737373'], [0.5, 0.25, 0.25]);
  }),
  4: (px) => px((x, y) => ditherPick(x, y, 17, ['#d9cd90', '#cfc283', '#e2d69c'], [0.5, 0.25, 0.25])),
  5: (px) => px((x, y) => {
    // vertical bark ridges
    const ridge = hash2D(x, 0, 18) < 0.4;
    if (ridge && hash2D(x, y, 19) < 0.85) return '#4e3620';
    return ditherPick(x, y, 20, ['#6b4a2e', '#5f4126', '#755233'], [0.5, 0.3, 0.2]);
  }),
  6: (px) => px((x, y) => {
    const dx = x - 7.5, dy = y - 7.5;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 7) return '#4e3620';
    return ((r | 0) % 2 === 0) ? '#a87e4e' : '#8d6a3f';
  }),
  7: (px) => px((x, y) => {
    if (hash2D(x, y, 21) < 0.16) return null; // transparent holes (cutout)
    return ditherPick(x, y, 22, ['#3e6b2a', '#356023', '#477a31', '#2e541e'], [0.4, 0.25, 0.2, 0.15]);
  }),
  8: (px) => px((x, y) => {
    if (y % 4 === 3) return '#5e4128';                       // board seams
    if (x === 0 || (y < 4 && x === 8) || (y >= 4 && y < 8 && x === 4) || (y >= 8 && y < 12 && x === 12)) return '#6b4a2e';
    return ditherPick(x, y, 23, ['#9c7748', '#92703f', '#a67f50'], [0.55, 0.25, 0.2]);
  }),
  9: (px) => px((x, y) => {
    if (hash2D(x, (y * 3) | 0, 24) < 0.1) return '#5b8ae6';
    return ditherPick(x, y, 25, ['#3d6dd8', '#3563c8', '#4577e0'], [0.55, 0.25, 0.2]);
  }),
  10: (px) => px((x, y) => {
    // torch: transparent tile, stick up the middle with a glowing tip
    if (x >= 7 && x <= 8 && y >= 6) return ditherPick(x, y, 26, ['#6b4a2e', '#5a3d24'], [0.6, 0.4]);
    if (x >= 6 && x <= 9 && y >= 2 && y <= 5) {
      const core = x >= 7 && x <= 8 && y >= 3 && y <= 4;
      return core ? '#fff4c0' : '#ffb028';
    }
    return null;
  }),
  11: (px) => px((x, y) => {
    // reinforced: planks with dark steel banding and rivets
    if (x === 0 || x === 15 || y === 0 || y === 15) return '#3a3a42';
    if (Math.abs(x - y) < 2 || Math.abs(x - (15 - y)) < 2) return '#4a4a54';
    if ((x === 3 || x === 12) && (y === 3 || y === 12)) return '#8a8a96';
    if (y % 4 === 3) return '#5e4128';
    return ditherPick(x, y, 27, ['#8a6a40', '#7e6038', '#946f45'], [0.55, 0.25, 0.2]);
  }),
  12: (px) => px((x, y) => {
    // spikes: dark base with pale spike teeth rising from it
    if (y >= 12) return ditherPick(x, y, 28, ['#4e4e54', '#44444a'], [0.6, 0.4]);
    const tooth = x % 4;
    const heightAt = tooth === 1 || tooth === 2 ? 4 : 10;
    if (y >= heightAt) {
      const tip = y < heightAt + 3;
      return tip ? '#c8ccd4' : '#8e929c';
    }
    return null;
  }),
};

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');

  for (const [tileStr, painter] of Object.entries(TILE_PAINTERS)) {
    const tile = Number(tileStr);
    const ox = (tile % TILES_PER_ROW) * TILE;
    const oy = Math.floor(tile / TILES_PER_ROW) * TILE;
    painter((colorFn) => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const c = colorFn(x, y);
          if (c === null) continue;
          ctx.fillStyle = c;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  // uvRect: left/bottom/right/top in texture space, inset half a texel to stop bleed.
  // CanvasTexture flips Y, so canvas row 0 is at v=1.
  const inset = 0.5 / ATLAS_SIZE;
  const uvRect = (tile) => {
    const tx = (tile % TILES_PER_ROW) * TILE;
    const ty = Math.floor(tile / TILES_PER_ROW) * TILE;
    return {
      u0: tx / ATLAS_SIZE + inset,
      u1: (tx + TILE) / ATLAS_SIZE - inset,
      v0: 1 - (ty + TILE) / ATLAS_SIZE + inset,
      v1: 1 - ty / ATLAS_SIZE - inset,
    };
  };

  // Small standalone canvas copy of one tile — used for hotbar icons.
  const tileToCanvas = (tile) => {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const tx = (tile % TILES_PER_ROW) * TILE;
    const ty = Math.floor(tile / TILES_PER_ROW) * TILE;
    c.getContext('2d').drawImage(canvas, tx, ty, TILE, TILE, 0, 0, TILE, TILE);
    return c;
  };

  // Representative colors of a tile, sampled from its pixels — block-break
  // debris is tinted with the block's own texture palette.
  const paletteCache = new Map();
  const tilePalette = (tile) => {
    if (paletteCache.has(tile)) return paletteCache.get(tile);
    const data = tileToCanvas(tile).getContext('2d').getImageData(0, 0, TILE, TILE).data;
    const colors = [];
    for (let i = 0; i < 14; i++) {
      const p = ((Math.random() * TILE * TILE) | 0) * 4;
      if (data[p + 3] < 128) continue; // skip transparent pixels
      colors.push(`rgb(${data[p]},${data[p + 1]},${data[p + 2]})`);
    }
    if (colors.length === 0) colors.push('#888888');
    paletteCache.set(tile, colors);
    return colors;
  };

  return { canvas, texture, uvRect, tileToCanvas, tilePalette };
}

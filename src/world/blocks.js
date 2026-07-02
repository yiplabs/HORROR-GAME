// Block registry. Tile numbers index into the texture atlas (see atlas.js).

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const SAND = 4;
export const LOG = 5;
export const LEAVES = 6;
export const PLANKS = 7;
export const WATER = 8;
export const TORCH = 9;      // crafted: cross-mesh light source, not solid
export const REINFORCED = 10; // crafted: killers take 3x longer to chew through
export const SPIKES = 11;    // crafted: one-use trap, stuns any killer that touches it

export const BLOCKS = [
  { name: 'air',    solid: false },
  { name: 'grass',  solid: true, tiles: { top: 0, side: 1, bottom: 2 }, breakTime: 0.55, sfx: 'dirt',  drops: DIRT },
  { name: 'dirt',   solid: true, tiles: { top: 2, side: 2, bottom: 2 }, breakTime: 0.5,  sfx: 'dirt',  drops: DIRT },
  { name: 'stone',  solid: true, tiles: { top: 3, side: 3, bottom: 3 }, breakTime: 1.6,  sfx: 'stone', drops: STONE },
  { name: 'sand',   solid: true, tiles: { top: 4, side: 4, bottom: 4 }, breakTime: 0.5,  sfx: 'dirt',  drops: SAND },
  { name: 'log',    solid: true, tiles: { top: 6, side: 5, bottom: 6 }, breakTime: 1.0,  sfx: 'wood',  drops: LOG },
  { name: 'leaves', solid: true, cutout: true, tiles: { top: 7, side: 7, bottom: 7 }, breakTime: 0.25, sfx: 'leaf', drops: AIR },
  { name: 'planks', solid: true, tiles: { top: 8, side: 8, bottom: 8 }, breakTime: 0.9,  sfx: 'wood',  drops: PLANKS },
  { name: 'water',  solid: false, liquid: true, tiles: { top: 9, side: 9, bottom: 9 } },
  { name: 'torch',  solid: false, cross: true, tiles: { top: 10, side: 10, bottom: 10 }, breakTime: 0.1, sfx: 'wood', drops: TORCH },
  { name: 'reinforced', solid: true, tiles: { top: 11, side: 11, bottom: 11 }, breakTime: 2.2, sfx: 'wood', drops: REINFORCED, killerBreakMult: 3 },
  { name: 'spikes', solid: true, cutout: true, tiles: { top: 12, side: 12, bottom: 12 }, breakTime: 0.7, sfx: 'stone', drops: SPIKES },
];

export const isSolid = (id) => BLOCKS[id].solid;
export const isOpaque = (id) => BLOCKS[id].solid && !BLOCKS[id].cutout;

// Should a face of `id` facing neighbor `nid` be rendered?
export function faceVisible(id, nid) {
  if (BLOCKS[id].cross) return false; // cross blocks emit their own diagonal quads
  if (isOpaque(id)) return !isOpaque(nid);
  if (BLOCKS[id].cutout) return !isOpaque(nid) && nid !== id;
  if (BLOCKS[id].liquid) return nid === AIR;
  return false;
}

// Can the player's targeting ray stop on this block? (solid blocks + torches)
export const isTargetable = (id) => BLOCKS[id].solid || !!BLOCKS[id].cross;

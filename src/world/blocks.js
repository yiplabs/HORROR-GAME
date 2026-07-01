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
];

export const isSolid = (id) => BLOCKS[id].solid;
export const isOpaque = (id) => BLOCKS[id].solid && !BLOCKS[id].cutout;

// Should a face of `id` facing neighbor `nid` be rendered?
export function faceVisible(id, nid) {
  if (isOpaque(id)) return !isOpaque(nid);
  if (BLOCKS[id].cutout) return !isOpaque(nid) && nid !== id;
  if (BLOCKS[id].liquid) return nid === AIR;
  return false;
}

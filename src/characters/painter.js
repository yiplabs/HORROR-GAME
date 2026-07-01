import * as THREE from 'three';
import { hash2D } from '../core/rng.js';

// Every killer paints one 64x64 skin canvas through this fixed region layout
// (Minecraft-skin-like). rig.js maps each box face to its region's UV rect.
export const REGIONS = {
  headFront:   { x: 0,  y: 0,  w: 8, h: 8 },
  headBack:    { x: 8,  y: 0,  w: 8, h: 8 },
  headLeft:    { x: 16, y: 0,  w: 8, h: 8 },
  headRight:   { x: 24, y: 0,  w: 8, h: 8 },
  headTop:     { x: 32, y: 0,  w: 8, h: 8 },
  headBottom:  { x: 40, y: 0,  w: 8, h: 8 },
  torsoFront:  { x: 0,  y: 8,  w: 8, h: 12 },
  torsoBack:   { x: 8,  y: 8,  w: 8, h: 12 },
  torsoLeft:   { x: 16, y: 8,  w: 4, h: 12 },
  torsoRight:  { x: 20, y: 8,  w: 4, h: 12 },
  torsoTop:    { x: 24, y: 8,  w: 8, h: 4 },
  torsoBottom: { x: 32, y: 8,  w: 8, h: 4 },
  armFront:    { x: 0,  y: 20, w: 4, h: 12 },
  armBack:     { x: 4,  y: 20, w: 4, h: 12 },
  armLeft:     { x: 8,  y: 20, w: 4, h: 12 },
  armRight:    { x: 12, y: 20, w: 4, h: 12 },
  armTop:      { x: 16, y: 20, w: 4, h: 4 },
  armBottom:   { x: 20, y: 20, w: 4, h: 4 },
  legFront:    { x: 0,  y: 32, w: 4, h: 12 },
  legBack:     { x: 4,  y: 32, w: 4, h: 12 },
  legLeft:     { x: 8,  y: 32, w: 4, h: 12 },
  legRight:    { x: 12, y: 32, w: 4, h: 12 },
  legTop:      { x: 16, y: 32, w: 4, h: 4 },
  legBottom:   { x: 20, y: 32, w: 4, h: 4 },
};

export const PART_FACES = {
  head: ['headFront', 'headBack', 'headLeft', 'headRight', 'headTop', 'headBottom'],
  torso: ['torsoFront', 'torsoBack', 'torsoLeft', 'torsoRight', 'torsoTop', 'torsoBottom'],
  arm: ['armFront', 'armBack', 'armLeft', 'armRight', 'armTop', 'armBottom'],
  leg: ['legFront', 'legBack', 'legLeft', 'legRight', 'legTop', 'legBottom'],
};

export class SkinPainter {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d');
    this.seed = 1;
  }

  fill(region, color) {
    const r = REGIONS[region];
    this.ctx.fillStyle = color;
    this.ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Fill every face of a whole part ('head' | 'torso' | 'arm' | 'leg').
  fillPart(part, color) {
    for (const face of PART_FACES[part]) this.fill(face, color);
  }

  px(region, x, y, color) {
    const r = REGIONS[region];
    if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(r.x + x, r.y + y, 1, 1);
  }

  rect(region, x, y, w, h, color) {
    const r = REGIONS[region];
    this.ctx.fillStyle = color;
    this.ctx.fillRect(r.x + x, r.y + y, Math.min(w, r.w - x), Math.min(h, r.h - y));
  }

  // Sprinkle colorB over the region's current paint. density 0..1.
  dither(region, colorB, density) {
    const r = REGIONS[region];
    this.ctx.fillStyle = colorB;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (hash2D(r.x + x, r.y + y, this.seed++ & 0xffff) < density) {
          this.ctx.fillRect(r.x + x, r.y + y, 1, 1);
        }
      }
    }
    this.seed += 31;
  }

  ditherPart(part, colorB, density) {
    for (const face of PART_FACES[part]) this.dither(face, colorB, density);
  }

  // ASCII pixel art: rows of characters, palette maps char -> color.
  // '.' (or any unmapped char) leaves the existing paint untouched.
  sprite(region, rows, palette) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (color) this.px(region, x, y, color);
      }
    }
  }

  // Horizontal stripes down a region: colors cycle every `bandH` rows.
  stripes(region, colors, bandH = 2) {
    const r = REGIONS[region];
    for (let y = 0; y < r.h; y++) {
      this.ctx.fillStyle = colors[Math.floor(y / bandH) % colors.length];
      this.ctx.fillRect(r.x, r.y + y, r.w, 1);
    }
  }

  getTexture() {
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Standalone copy of one region (the jumpscare blows headFront up to fullscreen).
  getFaceCanvas(region) {
    const r = REGIONS[region];
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    c.getContext('2d').drawImage(this.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c;
  }
}

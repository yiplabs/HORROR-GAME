import { mulberry32 } from './rng.js';

// Seeded 2D value noise with fBM. Small, dependency-free, plenty for an island heightmap.

export function makeNoise2D(seed) {
  // Permutation-based lattice values.
  const rand = mulberry32(seed);
  const SIZE = 256;
  const values = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < values.length; i++) values[i] = rand();

  const lattice = (ix, iz) => values[((iz & 255) * SIZE + (ix & 255))];
  const smooth = (t) => t * t * (3 - 2 * t);

  // Returns noise in [-1, 1].
  return function noise2D(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = smooth(fx), sz = smooth(fz);
    const v00 = lattice(ix, iz), v10 = lattice(ix + 1, iz);
    const v01 = lattice(ix, iz + 1), v11 = lattice(ix + 1, iz + 1);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return (a + (b - a) * sz) * 2 - 1;
  };
}

// Fractal Brownian motion over a noise function. Returns roughly [-1, 1].
export function fbm2D(noise, x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

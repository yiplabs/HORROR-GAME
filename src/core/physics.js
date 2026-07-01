// Shared AABB-vs-voxel mover, used by the player and every killer.
// entity: { pos: Vector3 (feet center), vel: Vector3, width, height, onGround, blockedXZ }
// Resolves each axis independently; substeps keep per-move displacement < 0.4 blocks
// so only the leading voxel layer can be newly penetrated (no tunneling).

const MAX_STEP = 0.4;

export function moveAABB(world, entity, dt) {
  entity.onGround = false;
  entity.blockedXZ = false;
  const v = entity.vel;
  const maxDisp = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
  const steps = Math.max(1, Math.ceil(maxDisp / MAX_STEP));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    moveAxis(world, entity, 'x', v.x * sdt);
    moveAxis(world, entity, 'y', v.y * sdt);
    moveAxis(world, entity, 'z', v.z * sdt);
  }
}

function moveAxis(world, e, axis, d) {
  if (d === 0) return;
  e.pos[axis] += d;

  const half = e.width / 2;
  const x0 = Math.floor(e.pos.x - half + 1e-7), x1 = Math.floor(e.pos.x + half - 1e-7);
  const y0 = Math.floor(e.pos.y + 1e-7),        y1 = Math.floor(e.pos.y + e.height - 1e-7);
  const z0 = Math.floor(e.pos.z - half + 1e-7), z1 = Math.floor(e.pos.z + half - 1e-7);

  let hit = false;
  outer:
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (world.isSolid(x, y, z)) { hit = true; break outer; }
  if (!hit) return;

  // Only the leading layer along `axis` can be newly overlapped: clamp to it.
  if (axis === 'y') {
    if (d < 0) { e.pos.y = y0 + 1; e.onGround = true; }
    else { e.pos.y = y1 - e.height; }
    e.vel.y = 0;
  } else if (axis === 'x') {
    e.pos.x = d > 0 ? x1 - half : x0 + 1 + half;
    e.vel.x = 0;
    e.blockedXZ = true;
  } else {
    e.pos.z = d > 0 ? z1 - half : z0 + 1 + half;
    e.vel.z = 0;
    e.blockedXZ = true;
  }
}

// True if an entity-sized AABB at pos overlaps no solid voxel. Used to validate
// spawns, teleports and block placement.
export function aabbFree(world, pos, width, height) {
  const half = width / 2;
  const x0 = Math.floor(pos.x - half + 1e-7), x1 = Math.floor(pos.x + half - 1e-7);
  const y0 = Math.floor(pos.y + 1e-7),        y1 = Math.floor(pos.y + height - 1e-7);
  const z0 = Math.floor(pos.z - half + 1e-7), z1 = Math.floor(pos.z + half - 1e-7);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (world.isSolid(x, y, z)) return false;
  return true;
}

// Does this entity's AABB overlap the given voxel cell?
export function entityOverlapsBlock(entity, bx, by, bz) {
  const half = entity.width / 2;
  return entity.pos.x + half > bx && entity.pos.x - half < bx + 1 &&
         entity.pos.y + entity.height > by && entity.pos.y < by + 1 &&
         entity.pos.z + half > bz && entity.pos.z - half < bz + 1;
}

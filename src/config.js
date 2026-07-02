// Every gameplay tunable in one place.
export const CONFIG = {
  // --- world ---
  WORLD_CHUNKS: 12,        // world is N x N chunks
  CHUNK_SIZE: 16,
  WORLD_HEIGHT: 64,
  WATER_Y: 12,             // sea level
  SEED: 1408,              // default seed; each run re-rolls

  // --- day/night (seconds of real time) ---
  DAY_LENGTH: 180,
  NIGHT_LENGTH: 120,
  DAWN_HOUR: 6,            // clock time the night ends
  DUSK_HOUR: 21,           // clock time the night begins
  WIN_NIGHTS: 7,           // survive this many nights to win

  // --- player ---
  PLAYER_WIDTH: 0.6,
  PLAYER_HEIGHT: 1.8,
  EYE_HEIGHT: 1.62,
  WALK_SPEED: 4.3,
  SPRINT_SPEED: 6.6,
  JUMP_SPEED: 8.6,
  GRAVITY: 28,
  MAX_HEALTH: 10,          // 5 hearts, 2 hp each
  HEALTH_REGEN_DAY: 0.2,   // hp per second, daytime only
  STAMINA_DRAIN: 26,       // per second while sprinting (stamina 0..100)
  STAMINA_REGEN: 16,

  // --- interaction ---
  REACH: 6,
  MELEE_RANGE: 2.9,
  MELEE_CONE: 0.45,        // dot(lookDir, dirToKiller) must exceed this
  MELEE_COOLDOWN: 0.45,
  MELEE_KNOCKBACK: 9,
  STUN_IMMUNITY: 5,        // seconds after a stun ends before the next can land
  // you start with NOTHING but the axe — every block in the pack was gathered or crafted
  BACKPACK_TIERS: [64, 192, 576], // carry capacity: pockets -> Backpack -> Rucksack (crafted)

  // --- AI / director ---
  MAX_KILLERS: 5,
  KILLER_GRAVITY: 28,
  KILLER_JUMP: 8.2,
  SPAWN_MIN_DIST: 28,
  SPAWN_MAX_DIST: 48,
  DESPAWN_DIST: 70,
  THINK_HZ: 8,
  // per-night scaling
  SPEED_SCALE_PER_NIGHT: 0.06,
  SPEED_SCALE_MAX: 1.45,
  SIGHT_BONUS_PER_NIGHT: 2,

  // --- rendering ---
  FOV: 75,
  PIXEL_RATIO_CAP: 1.5,
  MAX_REMESH_PER_FRAME: 2,
  DT_CLAMP: 0.05,
};

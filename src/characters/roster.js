import * as THREE from 'three';
import { STATES } from '../ai/killer.js';
import { teleportUnseen, teleportBehindPlayer, randomSpotAround, surfaceSpot } from '../ai/behaviors.js';
import { AIR, PLANKS } from '../world/blocks.js';
import { INK_COLORS, SMOKE_COLORS } from '../fx/particles.js';
import { CONFIG } from '../config.js';

const THINK_DT = 1 / CONFIG.THINK_HZ;

// The ten. Each entry is declarative: a skin painter, props, anim params, stats and
// small behavior hooks over the shared FSM. Names are homages — you know who they are.

export const ROSTER = [
  // ============ THE GHOST FACE (Scream) ============
  {
    id: 'ghostface',
    name: 'The Ghost Face',
    scale: 1.0,
    props: ['knife'],
    anim: { swingAmp: 0.7 },
    stats: {
      speedStalk: 2.2, speedChase: 5.6, damage: 1, attackRange: 1.7,
      sightRange: 40, stalkRange: 26, stalkTime: 9, loseSightTime: 6,
      stunTime: 2.0, firstNight: 1,
    },
    paintSkin(p) {
      p.fillPart('head', '#0e0e12');
      p.ditherPart('head', '#16161c', 0.25);
      p.sprite('headFront', [
        'KWWWWWWK',
        'WBBWWBBW',
        'WWBWWBWW',
        'WWWWWWWW',
        'WWWBBWWW',
        'WWBBBBWW',
        'WWBBBBWW',
        'KWWBBWWK',
      ], { K: '#0e0e12', W: '#e8e8ea', B: '#0a0a0a' });
      p.fillPart('torso', '#101014');
      p.ditherPart('torso', '#1e1e26', 0.3);
      p.fillPart('arm', '#101014');
      p.ditherPart('arm', '#1e1e26', 0.3);
      p.fillPart('leg', '#0c0c10');
      p.ditherPart('leg', '#181820', 0.3);
    },
    behavior: {
      // Crouch-stalks while watched, speeds up unobserved. Inside 8 blocks the
      // chase comes in lunge bursts with hanging pauses between them.
      think(k, ctx) {
        if (k.state === STATES.STALK || k.state === STATES.CHASE) {
          if (k.observed) { k.crouching = true; k.moveSpeed *= 0.45; }
          else k.moveSpeed *= 1.25;
          if (k.state === STATES.CHASE && k.distToPlayer < 8) {
            const cycle = ctx.time % 4;
            k.moveSpeed = cycle < 3 ? k.stats.speedChase * 1.3 : k.stats.speedChase * 0.25;
          }
        }
      },
    },
  },

  // ============ THE CAMPER (Jason Voorhees) ============
  {
    id: 'camper',
    name: 'The Camper',
    scale: 1.12,
    props: ['machete'],
    anim: { swingAmp: 0.55 },
    stats: {
      speedStalk: 2.0, speedChase: 3.6, damage: 2, attackRange: 2.0,
      sightRange: 44, stalkRange: 30, stalkTime: 5, loseSightTime: 20,
      stunTime: 1.4, attackCooldown: 1.5, firstNight: 1,
    },
    paintSkin(p) {
      p.fillPart('head', '#2a2620');
      p.sprite('headFront', [
        '.MMMMMM.',
        'MMMRRMMM',
        'MDMMMMDM',
        'MMMMMMMM',
        'MRMDDMRM',
        'MMMMMMMM',
        'MDMDDMDM',
        '.MDMMDM.',
      ], { M: '#e8e4da', D: '#1c1c1c', R: '#a02020' });
      p.fillPart('torso', '#4a5540');
      p.ditherPart('torso', '#3d4735', 0.35);
      p.rect('torsoFront', 0, 0, 8, 1, '#33402c');
      p.fillPart('arm', '#4a5540');
      p.ditherPart('arm', '#3d4735', 0.35);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 10, 4, 2, '#b09878');
      p.fillPart('leg', '#33302a');
      p.ditherPart('leg', '#2a2822', 0.3);
    },
    behavior: {
      // Slow tank. Your walls mean nothing: when stuck he chops through
      // player-placed blocks.
      onStuck(k, ctx) {
        if (!k.startBreakingAhead(1.0, (x, y, z) => k.world.isPlayerPlaced(x, y, z))) {
          k.defaultUnstuck();
        }
      },
    },
  },

  // ============ THE DREAM DEMON (Freddy Krueger) ============
  {
    id: 'dreamdemon',
    name: 'The Dream Demon',
    scale: 1.0,
    props: ['fedora', 'claws'],
    anim: { swingAmp: 0.65 },
    stats: {
      speedStalk: 2.4, speedChase: 5.2, damage: 1, attackRange: 1.7,
      sightRange: 40, stalkRange: 24, stalkTime: 7, loseSightTime: 8,
      stunTime: 2.0, firstNight: 3,
    },
    paintSkin(p) {
      p.fillPart('head', '#8a4a30');
      p.ditherPart('head', '#6e3a24', 0.4);
      p.ditherPart('head', '#a05a3a', 0.15);
      p.sprite('headFront', [
        '..S..S..',
        '.EE..EE.',
        '.E....E.',
        'S......S',
        '...EE...',
        '.EEEEEE.',
        '.WEWEWE.',
        '..S..S..',
      ], { S: '#5e2e1a', E: '#141414', W: '#e0d8c8' });
      for (const f of ['torsoFront', 'torsoBack', 'torsoLeft', 'torsoRight']) p.stripes(f, ['#8a1f1f', '#2e4a28'], 2);
      p.fill('torsoTop', '#8a1f1f');
      p.fill('torsoBottom', '#2e4a28');
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) {
        p.stripes(f, ['#8a1f1f', '#2e4a28'], 2);
        p.rect(f, 0, 10, 4, 2, '#8a4a30');
      }
      p.fill('armTop', '#8a1f1f');
      p.fill('armBottom', '#8a4a30');
      p.fillPart('leg', '#2a2018');
      p.ditherPart('leg', '#221a12', 0.3);
    },
    behavior: {
      // Weeping Angel: frozen while you look at him. Look away long enough and
      // he blinks closer.
      think(k, ctx) {
        if (k.state !== STATES.STALK && k.state !== STATES.CHASE) return;
        k.data.tpCd = (k.data.tpCd ?? 0) - THINK_DT;
        if (k.observed) {
          k.moveSpeed = 0;
          k.data.unseen = 0;
        } else {
          k.data.unseen = (k.data.unseen ?? 0) + THINK_DT;
          if (k.data.unseen > 4 && k.data.tpCd <= 0 && Math.random() < 0.35) {
            const p = ctx.player.pos;
            const dx = p.x - k.pos.x, dz = p.z - k.pos.z;
            const dist = Math.hypot(dx, dz) || 1;
            const newDist = Math.max(5, dist - 7);
            const spot = surfaceSpot(k.world, p.x - (dx / dist) * newDist, p.z - (dz / dist) * newDist, k);
            if (spot && !ctx.playerCanSeePoint(spot)) {
              k.teleportTo(spot);
              if (ctx.sfx) ctx.sfx('teleport', null, k.pos);
              k.data.tpCd = 6;
            }
          }
        }
      },
    },
  },

  // ============ THE SHAPE (Michael Myers) ============
  {
    id: 'shape',
    name: 'The Shape',
    scale: 1.05,
    props: ['knife'],
    anim: { swingAmp: 0.45 },
    stats: {
      speedStalk: 2.6, speedChase: 4.15, damage: 2, attackRange: 1.8,
      sightRange: 50, stalkRange: 34, stalkTime: 999, loseSightTime: Infinity,
      stunTime: 1.2, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#2a2018');
      p.sprite('headFront', [
        'HHHHHHHH',
        'HPPPPPPH',
        'PPEPPEPP',
        'PPPPPPPP',
        'PPPEPPPP',
        'PPPPPPPP',
        'PPMMMMPP',
        'HPPPPPPH',
      ], { H: '#2a2018', P: '#e6e2dc', E: '#101010', M: '#c8c4be' });
      p.fillPart('torso', '#23262e');
      p.ditherPart('torso', '#1c1e26', 0.35);
      p.fillPart('arm', '#23262e');
      p.ditherPart('arm', '#1c1e26', 0.35);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 10, 4, 2, '#d8ccc0');
      p.fillPart('leg', '#23262e');
      p.ditherPart('leg', '#1c1e26', 0.35);
    },
    behavior: {
      // Circles at ~18 blocks, head locked on you. Accumulate 20s of eye contact
      // (or let him close in) and he walks at you forever. He never runs. He
      // never stops. loseSightTime is Infinity.
      think(k, ctx) {
        if (k.state === STATES.STALK) {
          k.data.orbit = k.data.orbit ?? Math.random() * Math.PI * 2;
          k.data.orbit += THINK_DT * 0.12;
          const p = ctx.player.pos;
          k.target.set(p.x + Math.cos(k.data.orbit) * 18, 0, p.z + Math.sin(k.data.orbit) * 18);
          k.moveSpeed = k.stats.speedStalk;
          if (k.observed && k.canSee) k.data.gaze = (k.data.gaze ?? 0) + THINK_DT;
          if ((k.data.gaze ?? 0) > 20 || k.distToPlayer < 8) k.setState(STATES.CHASE, ctx);
        }
      },
    },
  },

  // ============ THE GOOD GUY (Chucky) ============
  {
    id: 'goodguy',
    name: 'The Good Guy',
    scale: 0.55,
    aabb: { w: 0.45, h: 0.95 }, // under 1 block tall — really does fit through 1-block gaps
    proportions: { head: 1.35 },
    props: [{ kind: 'knife', scale: 1.8 }],
    anim: { swingAmp: 1.0 },
    stats: {
      speedStalk: 3.0, speedChase: 7.0, damage: 1, attackRange: 1.3,
      sightRange: 34, stalkRange: 20, stalkTime: 4, loseSightTime: 5,
      stunTime: 2.2, attackCooldown: 0.7, firstNight: 1,
    },
    paintSkin(p) {
      p.fillPart('head', '#c23c1e');
      p.ditherPart('head', '#a83318', 0.3);
      p.sprite('headFront', [
        'RRRRRRRR',
        'RRPPPPRR',
        'PEBPPBEP',
        'PPPFFPPP',
        'SSPPPPFP',
        'PPWWWWPP',
        'PPPPPPPP',
        'PPPPPPPP',
      ], { R: '#c23c1e', P: '#e8c4a8', E: '#ffffff', B: '#3a66cc', F: '#c08858', S: '#8a2018', W: '#ffffff' });
      p.fillPart('torso', '#3a5a9c');
      p.rect('torsoFront', 0, 0, 8, 1, '#d8d0c0');
      p.rect('torsoFront', 0, 1, 8, 1, '#c03028');
      p.rect('torsoFront', 0, 2, 8, 1, '#d8d0c0');
      p.px('torsoFront', 1, 4, '#e8d840');
      p.px('torsoFront', 6, 4, '#e8d840');
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) {
        p.stripes(f, ['#d8d0c0', '#c03028'], 2);
        p.rect(f, 0, 10, 4, 2, '#e8c4a8');
      }
      p.fillPart('leg', '#3a5a9c');
      for (const f of ['legFront', 'legBack', 'legLeft', 'legRight']) p.rect(f, 0, 10, 4, 2, '#c03028');
    },
    behavior: {
      // Tiny hitbox, fits through 1-block gaps, fastest chase in the game.
      // You'll hear the giggling first.
      effects(k, ctx, dt) {
        if (k.despawned || ctx.player.dead) return;
        k.data.giggleCd = (k.data.giggleCd ?? 3) - dt;
        if (k.data.giggleCd <= 0 && k.distToPlayer < 20) {
          k.data.giggleCd = 6 + Math.random() * 6;
          if (ctx.sfx) ctx.sfx('giggle', null, k.pos);
        }
      },
    },
  },

  // ============ THE DANCING CLOWN (Pennywise) ============
  {
    id: 'clown',
    name: 'The Dancing Clown',
    scale: 1.18,
    props: ['hairTufts', 'balloon'],
    anim: { swingAmp: 0.8 },
    stats: {
      speedStalk: 2.4, speedChase: 5.4, damage: 1.5, attackRange: 1.8,
      sightRange: 42, stalkRange: 26, stalkTime: 7, loseSightTime: 3.5,
      stunTime: 2.0, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#ece8e4');
      p.dither('headBack', '#ded8d2', 0.3);
      p.sprite('headFront', [
        'WWWWWWWW',
        'WRWWWWRW',
        'WYYWWYYW',
        'WRWWWWRW',
        'WWWRRWWW',
        'WRWRRWRW',
        'WWRRRRWW',
        'WWWWWWWW',
      ], { W: '#ece8e4', R: '#c01818', Y: '#e8a020' });
      p.fillPart('torso', '#c8c4bc');
      p.ditherPart('torso', '#b4b0a8', 0.3);
      p.rect('torsoFront', 0, 0, 8, 1, '#f0ece8');
      p.rect('torsoFront', 3, 2, 2, 1, '#c01818');
      p.rect('torsoFront', 3, 5, 2, 1, '#c01818');
      p.rect('torsoFront', 3, 8, 2, 1, '#c01818');
      p.fillPart('arm', '#c8c4bc');
      p.ditherPart('arm', '#b4b0a8', 0.3);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) {
        p.rect(f, 0, 9, 4, 1, '#c01818');
        p.rect(f, 0, 10, 4, 2, '#f0f0ec');
      }
      p.fillPart('leg', '#c8c4bc');
      p.ditherPart('leg', '#b4b0a8', 0.3);
    },
    behavior: {
      // Ties balloons around the area when it arrives. Break line of sight for a
      // few seconds and it is suddenly at the balloon closest to you.
      onSpawn(k, ctx) {
        k.data.balloons = [];
        for (let i = 0; i < 3; i++) {
          const spot = randomSpotAround(k.world, ctx.player.pos, 8, 24, null);
          if (!spot) continue;
          const g = new THREE.Group();
          const ball = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.44, 0.36),
            new THREE.MeshLambertMaterial({ color: 0xc01818 })
          );
          ball.position.y = 1.9;
          const string = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 1.7, 0.02),
            new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
          );
          string.position.y = 0.85;
          g.add(ball, string);
          g.position.set(spot.x, spot.y, spot.z);
          k.scene.add(g);
          k.data.balloons.push(g);
        }
      },
      onDespawn(k) {
        for (const g of k.data.balloons ?? []) {
          k.scene.remove(g);
          g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        }
        k.data.balloons = [];
      },
      think(k, ctx) {
        if (k.state !== STATES.CHASE || k.canSee) return;
        if (k.unseenTime < 3) return;
        const balloons = k.data.balloons ?? [];
        let best = null, bestDist = Infinity;
        for (const g of balloons) {
          const d = g.position.distanceTo(ctx.player.pos);
          if (d > 6 && d < bestDist) { best = g; bestDist = d; }
        }
        if (best) {
          const spot = surfaceSpot(k.world, best.position.x + 0.6, best.position.z + 0.6, k);
          if (spot) {
            k.teleportTo(spot);
            k.unseenTime = 0;
            if (ctx.sfx) { ctx.sfx('giggle', null, k.pos); ctx.sfx('teleport', null, k.pos); }
          }
        }
      },
      effects(k, ctx, dt) {
        for (let i = 0; i < (k.data.balloons ?? []).length; i++) {
          const g = k.data.balloons[i];
          g.children[0].position.y = 1.9 + Math.sin(ctx.time * 1.6 + i * 2.1) * 0.14;
        }
      },
    },
  },

  // ============ THE TALL ONE (Slenderman) ============
  {
    id: 'tallone',
    name: 'The Tall One',
    scale: 1.38,
    aabb: { w: 0.65, h: 2.7 },
    proportions: { thin: 0.72, armLen: 1.45, legLen: 1.15 },
    props: [],
    anim: { swingAmp: 0.25 },
    stats: {
      speedStalk: 2.6, speedChase: 3.0, damage: 2, attackRange: 2.3,
      sightRange: 48, stalkRange: 30, stalkTime: 6, loseSightTime: 12,
      stunTime: 1.5, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#e4e0da');       // no face. nothing at all.
      p.ditherPart('head', '#dad6d0', 0.2);
      p.fillPart('torso', '#0c0c10');
      p.rect('torsoFront', 3, 0, 2, 7, '#e8e8e8');
      p.fillPart('arm', '#0c0c10');
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 10, 4, 2, '#e4e0da');
      p.fillPart('leg', '#0c0c10');
    },
    behavior: {
      // Never moves while watched. Watching HIM fills a static meter that ends
      // in damage — and he vanishes to somewhere worse.
      think(k, ctx) {
        if (k.state === STATES.SPAWNING || k.state === STATES.STUNNED) return;
        if (k.observed) {
          k.moveSpeed = 0;
        } else {
          k.data.tpClock = (k.data.tpClock ?? 0) + THINK_DT;
          if (k.data.tpClock > 4.5 && k.distToPlayer > 8) {
            k.data.tpClock = 0;
            const p = ctx.player.pos;
            const dx = p.x - k.pos.x, dz = p.z - k.pos.z;
            const dist = Math.hypot(dx, dz) || 1;
            const newDist = Math.max(6, dist - (4 + Math.random() * 4));
            const spot = surfaceSpot(k.world, p.x - (dx / dist) * newDist, p.z - (dz / dist) * newDist, k);
            if (spot && !ctx.playerCanSeePoint(spot)) k.teleportTo(spot);
          }
        }
      },
      effects(k, ctx, dt) {
        if (k.despawned || ctx.player.dead) return;
        if (k.observed && k.distToPlayer < 45) {
          k.data.gaze = Math.min(1, (k.data.gaze ?? 0) + dt * (1.1 - k.distToPlayer / 50));
          if (k.data.gaze >= 1) {
            k.data.gaze = 0;
            ctx.player.damage(1, null, k);
            if (ctx.sfx) ctx.sfx('staticBurst');
            teleportUnseen(k, ctx, ctx.player.pos, 14, 26, null);
          }
        } else {
          k.data.gaze = Math.max(0, (k.data.gaze ?? 0) - dt * 0.6);
        }
        ctx.effects.static = Math.max(ctx.effects.static, k.data.gaze);
      },
    },
  },

  // ============ THE NUN (Valak) ============
  {
    id: 'nun',
    name: 'The Nun',
    scale: 1.15,
    props: ['veil'],
    anim: { swingAmp: 0.2, hover: true },
    stats: {
      speedStalk: 2.6, speedChase: 4.9, damage: 1.5, attackRange: 1.9,
      sightRange: 42, stalkRange: 26, stalkTime: 7, loseSightTime: 8,
      stunTime: 2.0, firstNight: 3,
    },
    paintSkin(p) {
      p.fillPart('head', '#0a0a0c');
      p.sprite('headFront', [
        'WWWWWWWW',
        'WPPPPPPW',
        'PEEPPEEP',
        'PPPPPPPP',
        'PPPEEPPP',
        'PPMMMMPP',
        'PPMMMMPP',
        'WPPPPPPW',
      ], { W: '#e8e2d8', P: '#d8d0c4', E: '#141014', M: '#4a1414' });
      p.fillPart('torso', '#0a0a0c');
      p.ditherPart('torso', '#131315', 0.25);
      p.rect('torsoFront', 2, 0, 4, 2, '#e8e2d8');
      p.fillPart('arm', '#0a0a0c');
      p.fillPart('leg', '#0a0a0c');
    },
    behavior: {
      // Hover-glides. Dims the world near her. Every 20 seconds she is suddenly
      // six blocks BEHIND you.
      think(k, ctx) {
        if (k.state !== STATES.STALK && k.state !== STATES.CHASE) return;
        k.data.tpClock = (k.data.tpClock ?? 12) + THINK_DT;
        if (k.data.tpClock > 20) {
          k.data.tpClock = 0;
          teleportBehindPlayer(k, ctx, 6, 'nunTeleport');
        }
      },
      effects(k, ctx, dt) {
        if (k.despawned) return;
        if (k.distToPlayer < 12) {
          ctx.effects.lightDim = Math.max(ctx.effects.lightDim, (1 - k.distToPlayer / 12) * 0.9);
        }
      },
    },
  },

  // ============ THE DROWNED GIRL (Samara / The Ring) ============
  {
    id: 'drowned',
    name: 'The Drowned Girl',
    scale: 0.95,
    props: ['longHair'],
    anim: { swingAmp: 0.15, stutter: true },
    stats: {
      speedStalk: 2.2, speedChase: 4.6, damage: 1.5, attackRange: 1.6,
      sightRange: 38, stalkRange: 24, stalkTime: 6, loseSightTime: 9,
      stunTime: 2.0, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#0c0c0c');
      p.sprite('headFront', [
        'KKKKKKKK',
        'KKKKKKKK',
        'KKKPPKKK',
        'KKPPPKKK',
        'KKPEPKKK',
        'KKPPPKKK',
        'KKKPKKKK',
        'KKKKKKKK',
      ], { K: '#0c0c0c', P: '#cfd8ce', E: '#101810' });
      p.fillPart('torso', '#d8dcd4');
      p.ditherPart('torso', '#aab8a8', 0.3);
      p.fillPart('arm', '#d8dcd4');
      p.ditherPart('arm', '#aab8a8', 0.25);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 10, 4, 2, '#cfd8ce');
      p.fillPart('leg', '#d0d4cc');
      p.ditherPart('leg', '#a8b4a4', 0.35);
    },
    behavior: {
      // Motion arrives in quantized snaps (the rig only updates ~3 times a
      // second) and the world drains of color when she's close.
      effects(k, ctx, dt) {
        if (k.despawned) return;
        if (k.distToPlayer < 12) {
          ctx.effects.desat = Math.max(ctx.effects.desat, 1 - k.distToPlayer / 12);
        }
      },
    },
  },

  // ============ THE BUTCHER (Leatherface) ============
  {
    id: 'butcher',
    name: 'The Butcher',
    scale: 1.15,
    turnRate: 2.6,
    props: ['chainsaw'],
    anim: { swingAmp: 0.5, armPose: 'forward' },
    stats: {
      speedStalk: 2.6, speedChase: 7.4, damage: 2, attackRange: 2.0,
      sightRange: 46, stalkRange: 28, stalkTime: 5, loseSightTime: 10,
      stunTime: 1.8, attackCooldown: 1.4, firstNight: 4,
    },
    paintSkin(p) {
      p.fillPart('head', '#2a1c10');
      p.sprite('headFront', [
        '.UTTUTT.',
        'UTSSTUTT',
        'TETTTTET',
        'SSTUTSST',
        'TTUEETUT',
        'UTTTTUTT',
        'TTEEEETT',
        'UTTUTTUT',
      ], { T: '#c8a070', U: '#b08858', S: '#5a3a20', E: '#181410' });
      p.fillPart('torso', '#b8b0a0');
      p.ditherPart('torso', '#a89f8e', 0.3);
      p.rect('torsoFront', 2, 2, 4, 10, '#6e5540');
      p.px('torsoFront', 3, 4, '#7a1414');
      p.px('torsoFront', 4, 6, '#7a1414');
      p.px('torsoFront', 2, 8, '#7a1414');
      p.px('torsoFront', 5, 9, '#7a1414');
      p.fillPart('arm', '#b8b0a0');
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 6, 4, 6, '#c8a070');
      p.fillPart('leg', '#4e4438');
      p.ditherPart('leg', '#443c30', 0.3);
    },
    behavior: {
      // Straight-line sprints with a terrible turning circle, and NOTHING stops
      // him — he saws through any block in his path. You hear the chainsaw from
      // 40 blocks out.
      think(k, ctx) {
        if (k.state === STATES.CHASE && k.blockedXZ && !k.breaking) {
          k.startBreakingAhead(0.45);
        }
      },
      onStuck(k, ctx) {
        if (!k.startBreakingAhead(0.45)) k.defaultUnstuck();
      },
      effects(k, ctx, dt) {
        if (k.despawned) return;
        const chasing = k.state === STATES.CHASE || k.state === STATES.ATTACK;
        const range = chasing ? 40 : 22;
        const base = chasing ? 1 : 0.35;
        if (k.distToPlayer < range) {
          ctx.effects.chainsaw = Math.max(ctx.effects.chainsaw, base * (1 - k.distToPlayer / range));
        }
      },
    },
  },
  // ============ THE TEACHER (Baldi) ============
  {
    id: 'teacher',
    name: 'The Teacher',
    scale: 1.05,
    proportions: { thin: 0.9 },
    props: ['ruler'],
    anim: { swingAmp: 0.6 },
    stats: {
      speedStalk: 2.2, speedChase: 3.4, damage: 1.5, attackRange: 1.8,
      sightRange: 42, stalkRange: 30, stalkTime: 6, loseSightTime: 8,
      stunTime: 2.0, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#e8c8a0');
      p.dither('headTop', '#f0d4ae', 0.3); // shine
      p.sprite('headFront', [
        '........',
        '.WW..WW.',
        '.WB..BW.',
        '........',
        '...FF...',
        '.RRRRRR.',
        '.R....R.',
        '........',
      ], { W: '#ffffff', B: '#101010', R: '#c02020', F: '#d0a878' });
      p.fillPart('torso', '#2e8a3a');
      p.ditherPart('torso', '#277531', 0.3);
      p.fillPart('arm', '#2e8a3a');
      p.ditherPart('arm', '#277531', 0.3);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 10, 4, 2, '#e8c8a0');
      p.fillPart('leg', '#3a4048');
      p.ditherPart('leg', '#31363d', 0.3);
    },
    behavior: {
      // He doesn't see you. He HEARS you. Every block you break or place tells
      // him exactly where you are — and makes him angrier. And faster.
      think(k, ctx) {
        const heard = ctx.time - ctx.noise.time < 6;
        if (ctx.noise.time > 0 && ctx.noise.time !== k.data.lastNoise) {
          k.data.lastNoise = ctx.noise.time;
          k.data.noiseCount = (k.data.noiseCount ?? 0) + 1;
          if (ctx.sfx) ctx.sfx('rulerSlap', null, k.pos);
        }
        if (k.state === STATES.ROAM && heard) k.setState(STATES.STALK, ctx);
        if (k.state === STATES.STALK || k.state === STATES.CHASE) {
          const rage = Math.min(3.5, (k.data.noiseCount ?? 0) * 0.3);
          if (k.moveSpeed > 0) k.moveSpeed += rage;
          if (heard) {
            k.canSee = true; // hearing counts as seeing — noise reveals YOU, not the block
            k.unseenTime = 0;
            k.target.copy(ctx.player.pos);
          }
        }
      },
    },
  },

  // ============ THE SHOWMAN (Freddy Fazbear) ============
  {
    id: 'showman',
    name: 'The Showman',
    scale: 1.15,
    props: ['tophat', 'roundEars', 'snoutBear', 'mic'],
    anim: { swingAmp: 0.5 },
    stats: {
      speedStalk: 2.2, speedChase: 4.6, damage: 2, attackRange: 1.9,
      sightRange: 44, stalkRange: 30, stalkTime: 6, loseSightTime: 10,
      stunTime: 1.6, firstNight: 3,
    },
    paintSkin(p) {
      p.fillPart('head', '#6b4a2e');
      p.ditherPart('head', '#5e4128', 0.3);
      p.sprite('headFront', [
        '........',
        '.KK..KK.',
        '.KW..WK.',
        '........',
        '........',
        '........',
        '..KKKK..',
        '........',
      ], { K: '#14100c', W: '#e8e8e8' });
      p.fillPart('torso', '#6b4a2e');
      p.ditherPart('torso', '#5e4128', 0.3);
      p.rect('torsoFront', 2, 2, 4, 6, '#a8845a'); // belly
      p.rect('torsoFront', 3, 0, 2, 1, '#141414'); // bowtie
      p.px('torsoFront', 2, 0, '#141414');
      p.px('torsoFront', 5, 0, '#141414');
      p.fillPart('arm', '#6b4a2e');
      p.ditherPart('arm', '#5e4128', 0.3);
      p.fillPart('leg', '#6b4a2e');
      p.ditherPart('leg', '#5e4128', 0.3);
    },
    behavior: {
      // Won't take a single step while watched. Being near him drains your
      // stamina like a dying flashlight, and every advance comes with a laugh.
      think(k, ctx) {
        if (k.state !== STATES.STALK && k.state !== STATES.CHASE) return;
        if (k.observed) {
          k.moveSpeed = 0;
          k.data.adv = 0;
        } else {
          k.data.adv = (k.data.adv ?? 0) + 1 / CONFIG.THINK_HZ;
          if (k.data.adv > 3) {
            k.data.adv = 0;
            if (ctx.sfx) ctx.sfx('deepLaugh', null, k.pos);
          }
        }
      },
      effects(k, ctx, dt) {
        if (k.despawned || ctx.player.dead) return;
        // must out-pace stamina regen (16/s) up close or the aura means nothing
        if (k.distToPlayer < 10) {
          ctx.player.stamina = Math.max(0, ctx.player.stamina - dt * 30 * (1 - k.distToPlayer / 10));
        }
      },
    },
  },

  // ============ THE RABBIT (Bonnie) ============
  {
    id: 'rabbit',
    name: 'The Rabbit',
    scale: 1.12,
    props: ['tallEars', 'snoutBunny', 'guitar'],
    anim: { swingAmp: 0.55 },
    stats: {
      speedStalk: 2.4, speedChase: 5.2, damage: 1.5, attackRange: 1.8,
      sightRange: 42, stalkRange: 28, stalkTime: 7, loseSightTime: 8,
      stunTime: 2.0, firstNight: 2,
    },
    paintSkin(p) {
      p.fillPart('head', '#7a4a9c');
      p.ditherPart('head', '#6a3e8c', 0.3);
      p.sprite('headFront', [
        '........',
        '.KK..KK.',
        '.KW..WK.',
        '........',
        '........',
        '........',
        '..KKKK..',
        '........',
      ], { K: '#180c20', W: '#e0d0e8' });
      p.fillPart('torso', '#7a4a9c');
      p.ditherPart('torso', '#6a3e8c', 0.3);
      p.rect('torsoFront', 2, 2, 4, 6, '#b88ccc'); // belly
      p.rect('torsoFront', 3, 0, 2, 1, '#c02020'); // red bowtie
      p.px('torsoFront', 2, 0, '#c02020');
      p.px('torsoFront', 5, 0, '#c02020');
      p.fillPart('arm', '#7a4a9c');
      p.ditherPart('arm', '#6a3e8c', 0.3);
      p.fillPart('leg', '#7a4a9c');
      p.ditherPart('leg', '#6a3e8c', 0.3);
    },
    behavior: {
      // The peripheral lurker: appears at the very edge of your vision and
      // stands dead still, guitar in hand. The moment your eyes find him — rage.
      think(k, ctx) {
        if (k.state !== STATES.STALK && k.state !== STATES.CHASE) return;
        const d = k.data;
        d.rage = Math.max(0, (d.rage ?? 0) - 1 / CONFIG.THINK_HZ);
        d.tpCd = (d.tpCd ?? 4) - 1 / CONFIG.THINK_HZ;
        if (d.rage > 0) {
          k.moveSpeed = k.stats.speedChase * 1.55;
          k.unseenTime = 0;
          return;
        }
        if (!d.lurking && d.tpCd <= 0 && k.distToPlayer > 9 && !k.observed) {
          const yaw = ctx.playerYaw();
          const side = Math.random() < 0.5 ? 1 : -1;
          const a = yaw + Math.PI + side * (1.0 + Math.random() * 0.25); // edge of the view cone
          const dist = 11 + Math.random() * 4;
          const p = ctx.player.pos;
          const spot = surfaceSpot(k.world, p.x + Math.sin(a) * dist, p.z + Math.cos(a) * dist, k);
          if (spot) {
            if (ctx.particles) ctx.particles.burst({ x: k.pos.x, y: k.pos.y + 1, z: k.pos.z, colors: SMOKE_COLORS, count: 8, speed: 1.5, up: 2, ttl: 0.6 });
            k.teleportTo(spot);
            d.lurking = true;
            d.tpCd = 12;
          }
        }
        if (d.lurking) {
          k.moveSpeed = 0;
          if (k.observed || k.distToPlayer < 5) {
            d.lurking = false;
            d.rage = 4;
            k.setState(STATES.CHASE, ctx);
            if (ctx.sfx) ctx.sfx('rage', null, k.pos);
          }
        }
      },
    },
  },

  // ============ THE CHICKEN (Chica) ============
  {
    id: 'chicken',
    name: 'The Chicken',
    scale: 1.12,
    props: ['beak', 'cupcake'],
    anim: { swingAmp: 0.6 },
    stats: {
      speedStalk: 2.4, speedChase: 5.0, damage: 1.5, attackRange: 1.8,
      sightRange: 42, stalkRange: 28, stalkTime: 6, loseSightTime: 8,
      stunTime: 2.0, firstNight: 1,
    },
    paintSkin(p) {
      p.fillPart('head', '#e8c020');
      p.ditherPart('head', '#d8b018', 0.3);
      p.sprite('headFront', [
        '........',
        '.KK..KK.',
        '.KV..VK.',
        '........',
        '........',
        '........',
        '........',
        '........',
      ], { K: '#181008', V: '#c060c0' });
      p.fillPart('torso', '#e8c020');
      p.ditherPart('torso', '#d8b018', 0.3);
      // bib: LET'S EAT — well, EAT is all that fits at this resolution
      p.rect('torsoFront', 1, 1, 6, 6, '#f0ece0');
      p.rect('torsoFront', 1, 2, 2, 1, '#181818'); // E
      p.px('torsoFront', 1, 3, '#181818');
      p.rect('torsoFront', 1, 4, 2, 1, '#181818');
      p.px('torsoFront', 1, 5, '#181818');
      p.rect('torsoFront', 1, 6, 2, 1, '#181818');
      p.px('torsoFront', 4, 2, '#181818'); // A
      p.px('torsoFront', 3, 3, '#181818'); p.px('torsoFront', 5, 3, '#181818');
      p.rect('torsoFront', 3, 4, 3, 1, '#181818');
      p.px('torsoFront', 3, 5, '#181818'); p.px('torsoFront', 5, 5, '#181818');
      p.px('torsoFront', 3, 6, '#181818'); p.px('torsoFront', 5, 6, '#181818');
      p.rect('torsoFront', 6, 2, 1, 1, '#181818'); // T (squeezed)
      p.rect('torsoFront', 6, 3, 1, 4, '#181818');
      p.fillPart('arm', '#e8c020');
      p.ditherPart('arm', '#d8b018', 0.3);
      p.fillPart('leg', '#d87818'); // orange legs
      p.ditherPart('leg', '#c86810', 0.3);
    },
    behavior: {
      // You always hear her — pots and pans clattering somewhere out there.
      // But she never comes from where the noise was: she circles BEHIND you.
      think(k, ctx) {
        if ((k.state === STATES.STALK || k.state === STATES.CHASE) && k.distToPlayer > 6) {
          const yaw = ctx.playerYaw();
          const p = ctx.player.pos;
          k.target.set(p.x + Math.sin(yaw) * 4, 0, p.z + Math.cos(yaw) * 4); // behind the player
        }
        k.data.clangCd = (k.data.clangCd ?? 3) - 1 / CONFIG.THINK_HZ;
        if (k.data.clangCd <= 0 && k.distToPlayer < 32) {
          k.data.clangCd = 5 + Math.random() * 5;
          if (ctx.sfx) ctx.sfx('clang', null, k.pos);
        }
      },
    },
  },

  // ============ THE PIRATE FOX (Foxy) ============
  {
    id: 'piratefox',
    name: 'The Pirate Fox',
    scale: 1.1,
    turnRate: 3.2,
    props: ['snoutFox', 'hook'],
    anim: { swingAmp: 0.7 },
    stats: {
      speedStalk: 2.6, speedChase: 9.5, damage: 2, attackRange: 1.9,
      sightRange: 55, stalkRange: 40, stalkTime: 999, loseSightTime: 12,
      stunTime: 1.8, attackCooldown: 2, firstNight: 4,
    },
    paintSkin(p) {
      p.fillPart('head', '#a83a28');
      p.ditherPart('head', '#963222', 0.3);
      p.sprite('headFront', [
        '........',
        'KKK..KK.',
        'KKK..WY.',
        '.K......',
        '........',
        '........',
        '..KKKK..',
        '........',
      ], { K: '#160c08', W: '#f0e8d8', Y: '#e8a020' });
      p.fillPart('torso', '#a83a28');
      p.ditherPart('torso', '#5a2418', 0.35); // torn, ragged
      p.rect('torsoFront', 2, 2, 4, 6, '#d8b088');
      p.dither('torsoFront', '#3a1810', 0.15);
      p.fillPart('arm', '#a83a28');
      p.ditherPart('arm', '#5a2418', 0.3);
      p.fillPart('leg', '#8a4a30');
      p.ditherPart('leg', '#6a3624', 0.3);
    },
    behavior: {
      // Pirate Cove rules: he keeps his distance, patience building while you
      // aren't watching. Then the sprint — a dead-straight 9.5 blocks/second.
      // Catch him winding up and he slinks back to start over. Once he's
      // running, nothing calls him off.
      think(k, ctx) {
        const d = k.data;
        d.phase = d.phase ?? 'lurk';
        if (k.state === STATES.ROAM) k.setState(STATES.STALK, ctx);
        if (k.state !== STATES.STALK && k.state !== STATES.CHASE) return;

        if (d.phase === 'lurk') {
          if (k.state === STATES.CHASE) { d.phase = 'sprint'; return; } // cornered into it
          k.moveSpeed = k.stats.speedStalk;
          const p = ctx.player.pos;
          const dx = k.pos.x - p.x, dz = k.pos.z - p.z;
          const dist = Math.hypot(dx, dz) || 1;
          k.target.set(p.x + (dx / dist) * 24, 0, p.z + (dz / dist) * 24);
          if (!k.observed) d.build = (d.build ?? 0) + 1 / CONFIG.THINK_HZ;
          else d.build = Math.max(0, (d.build ?? 0) - 2 / CONFIG.THINK_HZ);
          if (d.build > 5) {
            d.phase = 'windup';
            d.t = 0;
            if (ctx.sfx) ctx.sfx('foxCharge', null, k.pos);
          }
        } else if (d.phase === 'windup') {
          k.moveSpeed = 0;
          k.crouching = true; // the lean
          d.t = (d.t ?? 0) + 1 / CONFIG.THINK_HZ;
          if (k.observed && d.t < 1.5) {
            d.phase = 'lurk';
            d.build = 0;
          } else if (d.t >= 1.5) {
            d.phase = 'sprint';
            k.setState(STATES.CHASE, ctx);
          }
        } else if (d.phase === 'sprint') {
          if (k.state === STATES.STALK) k.setState(STATES.CHASE, ctx);
          k.moveSpeed = k.stats.speedChase;
          k.unseenTime = 0; // nothing calls him off
          if (k.attackCooldown > 0.5) { // just landed a hit — back to the cove
            d.phase = 'lurk';
            d.build = 0;
          }
        }
      },
    },
  },

  // ============ THE INK DEMON (Bendy) ============
  {
    id: 'inkdemon',
    name: 'The Ink Demon',
    scale: 1.1,
    props: ['horns'],
    anim: { swingAmp: 0.6 },
    stats: {
      speedStalk: 2.4, speedChase: 4.6, damage: 1.5, attackRange: 1.8,
      sightRange: 44, stalkRange: 28, stalkTime: 6, loseSightTime: 12,
      stunTime: 2.0, firstNight: 3,
    },
    paintSkin(p) {
      p.fillPart('head', '#16141a');
      p.ditherPart('head', '#221e28', 0.25);
      p.sprite('headFront', [
        'KKKKKKKK',
        'WWWWWWWW',
        'WKKWWKKW',
        'WKKWWKKW',
        'WWWWWWWW',
        'KWKWWKWK',
        'KKKKKKKK',
        'WWWWWWWW',
      ], { K: '#0c0a10', W: '#ece8e0' });
      p.fillPart('torso', '#16141a');
      p.ditherPart('torso', '#221e28', 0.3);
      p.rect('torsoFront', 3, 0, 2, 1, '#ece8e0'); // white bowtie
      p.fillPart('arm', '#16141a');
      p.ditherPart('arm', '#221e28', 0.25);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 9, 4, 3, '#ece8e0'); // gloves
      p.fillPart('leg', '#0e0c12');
      p.ditherPart('leg', '#1a1620', 0.3);
    },
    behavior: {
      // Dissolves into a puddle of ink that slides across the ground —
      // fast, low, and immune to your weapon — then rises right next to you.
      onStun(k) {
        if (k.data.mode === 'puddle') {
          k.data.mode = 'formed';
          k.data.noStun = false;
          k.rig.pivots.body.scale.set(1, 1, 1);
        }
      },
      think(k, ctx) {
        const d = k.data;
        const endPuddle = () => {
          d.mode = 'formed';
          d.noStun = false;
          k.rig.pivots.body.scale.set(1, 1, 1);
          if (ctx.particles) ctx.particles.burst({ x: k.pos.x, y: k.pos.y + 0.6, z: k.pos.z, colors: INK_COLORS, count: 14, speed: 2.5, up: 4, ttl: 0.7 });
          if (ctx.sfx) ctx.sfx('inkDive', null, k.pos);
        };
        if (k.state !== STATES.CHASE && k.state !== STATES.STALK) {
          if (d.mode === 'puddle') endPuddle();
          return;
        }
        d.cd = (d.cd ?? 6) - 1 / CONFIG.THINK_HZ;
        if (d.mode === 'puddle') {
          k.moveSpeed = 8.5;
          k.unseenTime = 0;
          d.t = (d.t ?? 0) + 1 / CONFIG.THINK_HZ;
          if (d.t > 5 || k.distToPlayer < 5) {
            endPuddle();
            d.cd = 10;
          }
        } else if (d.cd <= 0 && k.distToPlayer > 9) {
          d.mode = 'puddle';
          d.noStun = true;
          d.t = 0;
          k.rig.pivots.body.scale.set(1.35, 0.12, 1.35);
          if (ctx.particles) ctx.particles.burst({ x: k.pos.x, y: k.pos.y + 0.3, z: k.pos.z, colors: INK_COLORS, count: 12, speed: 2, up: 2, ttl: 0.6 });
          if (ctx.sfx) ctx.sfx('inkDive', null, k.pos);
        }
      },
      effects(k, ctx, dt) {
        if (k.despawned) return;
        if (k.distToPlayer < 10) {
          ctx.effects.ink = Math.max(ctx.effects.ink, 1 - k.distToPlayer / 10);
        }
      },
    },
  },

  // ============ THE NEIGHBOR (Hello Neighbor) ============
  {
    id: 'neighbor',
    name: 'The Neighbor',
    scale: 1.08,
    props: ['bignose'],
    anim: { swingAmp: 0.75 },
    stats: {
      speedStalk: 2.6, speedChase: 5.8, damage: 1, attackRange: 1.7,
      sightRange: 46, stalkRange: 30, stalkTime: 5, loseSightTime: 9,
      stunTime: 2.0, attackCooldown: 1.0, firstNight: 1,
    },
    paintSkin(p) {
      p.fillPart('head', '#d8a878');
      p.rect('headTop', 0, 0, 8, 8, '#4a3220'); // hair
      for (const f of ['headLeft', 'headRight', 'headBack']) p.rect(f, 0, 0, 8, 3, '#4a3220');
      p.sprite('headFront', [
        'HHHHHHHH',
        '.KK..KK.',
        '.WB..BW.',
        '........',
        '.MMMMMM.',
        '.MMMMMM.',
        '........',
        '........',
      ], { H: '#4a3220', K: '#3a2a18', W: '#ffffff', B: '#1a3a6a', M: '#5a3a20' });
      p.fillPart('torso', '#2e6e5e');
      p.ditherPart('torso', '#276052', 0.3);
      p.rect('torsoFront', 2, 0, 4, 1, '#f0ece0'); // shirt collar
      p.fillPart('arm', '#2e6e5e');
      p.ditherPart('arm', '#276052', 0.3);
      for (const f of ['armFront', 'armBack', 'armLeft', 'armRight']) p.rect(f, 0, 8, 4, 4, '#d8a878'); // rolled sleeves
      p.fillPart('leg', '#5a5248');
      p.ditherPart('leg', '#4c453c', 0.3);
    },
    behavior: {
      // The only killer that BUILDS. Run from him and he hammers a fence up in
      // your path, cutting off your escape route.
      think(k, ctx) {
        if (k.state !== STATES.CHASE) return;
        const d = k.data;
        d.wallCd = (d.wallCd ?? 4) - 1 / CONFIG.THINK_HZ;
        if (d.wallCd > 0 || (d.walls ?? 0) >= 12) return;
        const p = ctx.player;
        const speed = Math.hypot(p.vel.x, p.vel.z);
        if (speed < 2.5) return; // only cuts off a RUNNING player
        const nx = p.vel.x / speed, nz = p.vel.z / speed;
        const tx = p.pos.x + nx * 5, tz = p.pos.z + nz * 5;
        const by = k.world.surfaceHeight(Math.floor(tx), Math.floor(tz)) + 1;
        if (Math.abs(by - p.pos.y) > 3) return;
        let placed = 0;
        for (const off of [-0.5, 0.5]) { // 2-wide, perpendicular to the run
          const wx = Math.floor(tx - nz * off), wz = Math.floor(tz + nx * off);
          for (const dy of [0, 1]) {
            const y = by + dy;
            if (y < 1 || y >= CONFIG.WORLD_HEIGHT) continue;
            if (k.world.getBlock(wx, y, wz) !== AIR) continue;
            if (Math.hypot(wx + 0.5 - p.pos.x, wz + 0.5 - p.pos.z) < 1.3) continue; // never inside the player
            k.world.setBlock(wx, y, wz, PLANKS);
            placed++;
          }
        }
        if (placed > 0) {
          d.walls = (d.walls ?? 0) + placed;
          d.wallCd = 7;
          if (ctx.sfx) ctx.sfx('hammer', null, { x: tx, y: by, z: tz });
          if (ctx.particles) ctx.particles.burst({ x: tx, y: by + 1, z: tz, colors: ['#9c7748', '#6b4a2e'], count: 8, speed: 2, up: 2.5, ttl: 0.5 });
        }
      },
    },
  },
];

export const ROSTER_BY_ID = Object.fromEntries(ROSTER.map((d) => [d.id, d]));

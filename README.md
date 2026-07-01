# NIGHTFALL

A Minecraft-style voxel horror survival game for the browser.

By day, a quiet blocky island: punch trees, mine stone, wall yourself in.
By night, the most famous killers in horror come out to hunt you — a ghost-faced
stalker, an unstoppable masked camper, a burned man in a striped sweater, a
dancing clown with balloons, a tall faceless thing in a suit, and more.

**Survive until 6:00 AM. Survive seven nights. Win.**

## Play

No build step, no dependencies — it's a plain static site:

```bash
# from the repo root, any static server works:
python3 -m http.server 8000
# or: npx serve
```

Then open http://localhost:8000 and click PLAY.

Want to meet the cast in daylight first? Open http://localhost:8000/?gallery

### Debug / cheat console

Normal play has no cheats. Add `?debug` to the URL and a `__game` console object
appears in devtools — `__game.debug.setTime(0.65)` skips to night,
`__game.debug.spawn('ghostface')` spawns a specific killer (ids: `ghostface`,
`camper`, `dreamdemon`, `shape`, `goodguy`, `clown`, `tallone`, `nun`,
`drowned`, `butcher`), `__game.debug.give(7, 64)` grants blocks,
`__game.debug.night(7)` jumps the night counter. The automated tests drive the
game through this same surface.

## Controls

| Input | Action |
|---|---|
| WASD | move |
| Mouse | look |
| Shift | sprint (drains stamina) |
| Space | jump |
| Left click | mine block / swing axe |
| Right click | place block |
| 1–6 / wheel | hotbar |
| Esc | pause |

## How it works

- **The clock is everything.** The HUD clock (top right) turns red at 9 PM. Killers
  spawn at nightfall and vanish at 6 AM. Each night spawns more of them, faster.
- **Your axe stuns, it does not kill.** A clean hit knocks a killer back and
  freezes it for a couple of seconds. Nothing you do kills them. Only the dawn.
- **Build, but build smart.** Blocks you place can be chopped through by The
  Camper — and The Butcher saws through *anything* in his path.
- **Watch or don't watch.** Some of them freeze while you look at them. One of
  them hurts you *because* you look at him.
- Health regenerates slowly, and only in daylight. Death is a jumpscare and a
  score. Best run is saved locally.

## The cast

| Name | Behavior |
|---|---|
| The Ghost Face | Crouch-stalks while watched, lunges in bursts up close |
| The Camper | Slow, hits like a truck, chops through your walls |
| The Dream Demon | Frozen while observed; blinks closer when you look away |
| The Shape | Circles and stares; once he commits, he never stops walking |
| The Good Guy | Knee-high, giggling, fastest chase in the game |
| The Dancing Clown | Leaves balloons around; loses sight of you, appears at one |
| The Tall One | Faceless. Never moves in view. Don't stare — the static hurts |
| The Nun | Glides, dims the world around her, teleports behind you |
| The Drowned Girl | Moves in horrible quantized snaps; drains color from the world |
| The Butcher | Chainsaw sprints in straight lines through *any* terrain |

## Tech

- Pure ES modules + [Three.js](https://threejs.org/) (vendored, pinned r160). No bundler, no npm install.
- Zero binary assets: block textures, character skins, hearts and icons are all
  pixel art painted onto canvases at runtime; every sound is synthesized with
  WebAudio (procedural heartbeat, chase stingers, chainsaw drone, jumpscare screech).
- Chunked voxel engine: culled-face meshing into merged buffer geometries, DDA
  voxel raycasts for block targeting and AI line-of-sight, swept AABB physics
  shared by the player and all killers.
- One shared killer chassis (FSM: roam → stalk → chase → attack, steering with
  auto-hop and unstuck logic) with per-character behavior hooks layered on top.

## Test

```bash
node test/smoke.mjs   # needs playwright + chromium available
```

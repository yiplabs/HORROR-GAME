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

### Debug / cheat menu

Normal play has no cheats: you start with nothing and craft everything. Add
`?debug` to the URL and two things appear:

- **The cheat menu** — press `` ` `` (backtick) or `F9` in-game, or click the
  `` ` CHEATS`` badge in the bottom-right of the HUD (if you don't see the
  badge, `?debug` isn't active). Give everything (64 of every block, the
  Spiked Club, a maxed Rucksack), full heal, god mode, jump to dawn/dusk,
  set the night counter, summon any killer by name, or banish them all.
  The world keeps running while it's open.
- **The `__game` console object** in devtools — `__game.debug.setTime(0.65)`
  skips to night, `__game.debug.spawn('ghostface')` spawns a specific killer
  (ids: `ghostface`, `camper`, `dreamdemon`, `shape`, `goodguy`, `clown`,
  `tallone`, `nun`, `drowned`, `butcher`, …), `__game.debug.give(7, 64)`
  grants blocks, `__game.debug.night(7)` jumps the night counter. The
  automated tests drive the game through this same surface.

## Controls

| Input | Action |
|---|---|
| WASD | move |
| Mouse | look |
| Shift | sprint (drains stamina) |
| Space | jump |
| Left click | mine block / swing axe |
| Right click | place block |
| 1–9, 0 / wheel | hotbar |
| C (or E) | crafting — the world does NOT pause |
| ` (backtick) or F9 | cheat menu (`?debug` builds only) |
| Esc | pause |

## How it works

- **You start with nothing.** Just the axe in your hand — no free blocks. Every
  plank, torch, barricade, trap, weapon upgrade and pack is gathered and crafted.
- **Your backpack is finite.** Pockets hold 64 items total. Craft a Backpack
  (192) and then a Rucksack (576) to carry more; when you're full, blocks
  won't break until you make room.
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
| The Teacher | Doesn't see — *hears*. Every block you break makes him faster |
| The Showman | Frozen while watched; drains your stamina up close; laughs as he advances |
| The Rabbit | Appears at the edge of your vision and stands still — until you look |
| The Chicken | You'll hear the kitchen clatter, but she always flanks from behind |
| The Pirate Fox | Builds up out of sight, then a 9.5-block/s sprint. Watch the windup to cancel it |
| The Ink Demon | Melts into an invincible ink puddle, slides to you, and rises |
| The Neighbor | The only killer that *builds* — hammers fences up across your escape route |

## Crafting (press C)

You begin every run empty-handed, so this panel is how you get *everything*.
It does **not** pause the game. Recipes:

| Recipe | Cost | Effect |
|---|---|---|
| Planks ×4 | 1 log | building material |
| Torches ×4 | 2 planks | real placeable light with flame flicker |
| Barricades ×2 | 3 planks + 2 stone | killers take 3× longer to break them |
| Spike Trap | 2 stone + 1 plank | stuns the first killer that touches it (single use) |
| Backpack | 6 planks + 2 logs | carry 192 items instead of the 64 your pockets hold |
| Rucksack | 12 planks + 4 stone | carry 576 items (requires the Backpack) |
| Spiked Club | 4 planks + 3 stone | one-time weapon upgrade: longer stuns, bigger knockback |

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

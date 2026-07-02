import { BLOCKS, PLANKS, LOG, STONE, TORCH, REINFORCED, SPIKES } from '../world/blocks.js';
import { CONFIG } from '../config.js';
import { paintBagIcon } from './hud.js';

// Crafting: press C in-game. The world DOES NOT pause while you craft —
// keep one eye over your shoulder. You start a run with NOTHING: every
// plank, torch, trap and pack on this list has to be made by hand.

export const RECIPES = [
  { name: 'Planks ×4', out: { block: PLANKS, n: 4 }, cost: { [LOG]: 1 },
    desc: 'Saw a log into building planks.' },
  { name: 'Torches ×4', out: { block: TORCH, n: 4 }, cost: { [PLANKS]: 2 },
    desc: 'Light for the long nights. They still come — but you\'ll see them.' },
  { name: 'Barricades ×2', out: { block: REINFORCED, n: 2 }, cost: { [PLANKS]: 3, [STONE]: 2 },
    desc: 'Reinforced planks. Killers take 3× longer to chew through them.' },
  { name: 'Spike Trap', out: { block: SPIKES, n: 1 }, cost: { [STONE]: 2, [PLANKS]: 1 },
    desc: 'Stuns the first killer that steps on it. Single use.' },
  { name: 'Backpack', out: { backpack: 2 }, cost: { [PLANKS]: 6, [LOG]: 2 }, once: true,
    desc: `Plank frame, bark straps. Carry ${CONFIG.BACKPACK_TIERS[1]} items instead of ${CONFIG.BACKPACK_TIERS[0]}.` },
  { name: 'Rucksack', out: { backpack: 3 }, cost: { [PLANKS]: 12, [STONE]: 4 }, once: true,
    desc: `A pack for a siege. Carry ${CONFIG.BACKPACK_TIERS[2]} items. Needs the Backpack first.` },
  { name: 'Spiked Club', out: { upgrade: true }, cost: { [PLANKS]: 4, [STONE]: 3 }, once: true,
    desc: 'Weapon upgrade: much longer stuns, bigger knockback. One time.' },
];

function paintClubIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a3220';
  for (let i = 0; i < 9; i++) ctx.fillRect(3 + i, 12 - i, 2, 2);
  ctx.fillStyle = '#6e6e72';
  ctx.fillRect(9, 1, 5, 5);
  ctx.fillStyle = '#9a9aa2';
  ctx.fillRect(10, 2, 3, 3);
  ctx.fillStyle = '#c8ccd4';
  ctx.fillRect(8, 3, 1, 1); ctx.fillRect(14, 3, 1, 1); ctx.fillRect(11, 0, 1, 1);
  return c;
}
export { paintClubIcon };

export class CraftingUI {
  constructor(interaction, hud, atlas, onSfx) {
    this.interaction = interaction;
    this.hud = hud;
    this.onSfx = onSfx;
    this.openFlag = false;
    this.crafted = new Set(); // indexes of once-only recipes already made

    this.root = document.getElementById('crafting-screen');
    this.capEl = this.root.querySelector('#craft-backpack');
    this.rows = [];
    const list = this.root.querySelector('#recipe-list');
    RECIPES.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'recipe';
      const icon = r.out.block !== undefined ? atlas.tileToCanvas(BLOCKS[r.out.block].tiles.side)
        : r.out.backpack !== undefined ? paintBagIcon() : paintClubIcon();
      icon.className = 'recipe-icon';
      const info = document.createElement('div');
      info.className = 'recipe-info';
      const title = document.createElement('div');
      title.className = 'recipe-name';
      title.textContent = r.name;
      const cost = document.createElement('div');
      cost.className = 'recipe-cost';
      cost.textContent = Object.entries(r.cost)
        .map(([id, n]) => `${n} ${BLOCKS[id].name}`).join('  +  ');
      const desc = document.createElement('div');
      desc.className = 'recipe-desc';
      desc.textContent = r.desc;
      info.append(title, cost, desc);
      const btn = document.createElement('button');
      btn.className = 'craft-btn';
      btn.textContent = 'CRAFT';
      btn.addEventListener('click', () => this.craft(i));
      row.append(icon, info, btn);
      list.appendChild(row);
      this.rows.push({ row, btn });
    });
  }

  canCraft(i) {
    const r = RECIPES[i];
    if (r.once && this.crafted.has(i)) return false;
    // packs upgrade in order: pockets -> Backpack -> Rucksack
    if (r.out.backpack !== undefined && this.interaction.backpackTier !== r.out.backpack - 1) return false;
    if (!Object.entries(r.cost).every(([id, n]) => (this.interaction.inventory[id] ?? 0) >= n)) return false;
    // crafted blocks must fit in the backpack once the ingredients are spent
    if (r.out.block !== undefined) {
      const spent = Object.values(r.cost).reduce((a, b) => a + b, 0);
      if (this.interaction.totalCarried() - spent + r.out.n > this.interaction.capacity) return false;
    }
    return true;
  }

  craft(i) {
    if (!this.canCraft(i)) return false;
    const r = RECIPES[i];
    for (const [id, n] of Object.entries(r.cost)) this.interaction.inventory[id] -= n;
    if (r.out.block !== undefined) {
      this.interaction.inventory[r.out.block] = (this.interaction.inventory[r.out.block] ?? 0) + r.out.n;
    } else if (r.out.backpack !== undefined) {
      this.interaction.setBackpackTier(r.out.backpack);
      this.crafted.add(i);
    } else {
      this.interaction.upgradeWeapon();
      this.crafted.add(i);
    }
    this.interaction.syncHud();
    this.refresh();
    if (this.onSfx) this.onSfx('craft');
    return true;
  }

  // cheat-menu hook: own every once-only craft (club + both packs) instantly
  grantOnce() {
    RECIPES.forEach((r, i) => {
      if (!r.once) return;
      if (r.out.upgrade) this.interaction.upgradeWeapon();
      if (r.out.backpack !== undefined) this.interaction.setBackpackTier(r.out.backpack);
      this.crafted.add(i);
    });
    this.refresh();
  }

  refresh() {
    this.capEl.textContent = `Backpack: ${this.interaction.totalCarried()} / ${this.interaction.capacity}`;
    RECIPES.forEach((r, i) => {
      const done = r.once && this.crafted.has(i);
      this.rows[i].btn.disabled = !this.canCraft(i);
      this.rows[i].btn.textContent = done ? 'OWNED' : 'CRAFT';
      this.rows[i].row.classList.toggle('crafted', done);
    });
  }

  get isOpen() { return this.openFlag; }

  open() {
    this.openFlag = true;
    this.refresh();
    this.root.classList.remove('hidden');
  }

  close() {
    this.openFlag = false;
    this.root.classList.add('hidden');
  }

  reset() {
    this.crafted.clear();
    this.close();
  }
}

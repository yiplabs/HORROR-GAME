import { CONFIG } from '../config.js';
import { PLANKS, DIRT, STONE, SAND, LOG, LEAVES, TORCH, REINFORCED, SPIKES } from '../world/blocks.js';
import { ROSTER } from '../characters/roster.js';

// The cheat menu (?debug builds only, backtick to toggle). A normal run gives
// you NOTHING — every block, pack and weapon has to be crafted. This panel is
// the deliberate exception: it hands you all of it, plus control over the
// clock and the cast. Like the crafting screen, the world does not pause.

// one hotbar stack of each carriable block; 9 × 64 fills the Rucksack exactly
const GIVE_IDS = [PLANKS, DIRT, STONE, SAND, LOG, LEAVES, TORCH, REINFORCED, SPIKES];

export class CheatMenu {
  constructor({ interaction, crafting, hud, player, director, daynight, ctx, onToggle }) {
    this.interaction = interaction;
    this.crafting = crafting;
    this.hud = hud;
    this.player = player;
    this.director = director;
    this.daynight = daynight;
    this.ctx = ctx;
    this.openFlag = false;

    // a small badge on the HUD so a ?debug run makes the menu discoverable:
    // seeing it also confirms debug mode is actually on
    this.hint = document.createElement('div');
    this.hint.id = 'cheat-hint';
    this.hint.textContent = '` CHEATS';
    this.hint.title = 'press ` (backtick) or F9 — or click';
    this.hint.addEventListener('click', () => { if (onToggle) onToggle(); });
    document.getElementById('hud').appendChild(this.hint);

    // built only in ?debug sessions, so a normal game has no cheat DOM at all
    this.root = document.createElement('div');
    this.root.id = 'cheat-screen';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <h3>CHEATS <span class="cheat-hint">— ?debug build. \` to close.</span></h3>
      <div class="cheat-row"><button id="cheat-give" class="cheat-btn">GIVE EVERYTHING</button></div>
      <div class="cheat-row">
        <button id="cheat-heal" class="cheat-btn">FULL HEAL</button>
        <button id="cheat-god" class="cheat-btn">GOD MODE: OFF</button>
      </div>
      <div class="cheat-row">
        <button id="cheat-day" class="cheat-btn">JUMP TO DAWN</button>
        <button id="cheat-dusk" class="cheat-btn">JUMP TO DUSK</button>
      </div>
      <div class="cheat-row">
        <button id="cheat-night-minus" class="cheat-btn slim">−</button>
        <div id="cheat-night-label">Night 1</div>
        <button id="cheat-night-plus" class="cheat-btn slim">+</button>
      </div>
      <div class="cheat-row">
        <select id="cheat-killer"></select>
        <button id="cheat-spawn" class="cheat-btn slim-wide">SUMMON</button>
      </div>
      <div class="cheat-row"><button id="cheat-clear" class="cheat-btn">BANISH ALL KILLERS</button></div>
      <div class="cheat-note">A normal run starts with empty hands — everything here is
        otherwise gathered and crafted. The world keeps moving while this is open.</div>
    `;
    document.getElementById('app').appendChild(this.root);

    const killerSel = this.root.querySelector('#cheat-killer');
    for (const def of ROSTER) {
      const o = document.createElement('option');
      o.value = def.id;
      o.textContent = def.name;
      killerSel.appendChild(o);
    }
    this.killerSel = killerSel;
    this.godBtn = this.root.querySelector('#cheat-god');
    this.nightLabel = this.root.querySelector('#cheat-night-label');

    const on = (id, fn) => this.root.querySelector(id).addEventListener('click', fn);
    on('#cheat-give', () => this.giveEverything());
    on('#cheat-heal', () => this.heal());
    on('#cheat-god', () => this.toggleGod());
    on('#cheat-day', () => { this.daynight.setTime(0.02); this.refresh(); });
    on('#cheat-dusk', () => { this.daynight.setTime(0.62); this.refresh(); });
    on('#cheat-night-minus', () => this.shiftNight(-1));
    on('#cheat-night-plus', () => this.shiftNight(1));
    on('#cheat-spawn', () => this.summon());
    on('#cheat-clear', () => this.banish());
  }

  giveEverything() {
    this.crafting.grantOnce(); // Rucksack + Spiked Club, marked OWNED
    for (const id of GIVE_IDS) this.interaction.inventory[id] = 64;
    this.interaction.syncHud();
    this.crafting.refresh();
    this.hud.showMessage('Pack maxed, pockets stuffed, club in hand.');
  }

  heal() {
    if (this.player.dead) return;
    this.player.health = CONFIG.MAX_HEALTH;
    this.player.stamina = 100;
    this.hud.showMessage('Wounds close. Legs steady.');
  }

  toggleGod() {
    this.player.godMode = !this.player.godMode;
    this.refresh();
    this.hud.showMessage(this.player.godMode ? 'They cannot touch you.' : 'You are mortal again.');
  }

  shiftNight(d) {
    this.daynight.day = Math.max(1, this.daynight.day + d);
    this.refresh();
  }

  summon() {
    const killer = this.director.forceSpawn(this.killerSel.value, this.ctx);
    if (killer) this.hud.showMessage(`${killer.def.name} answers the call.`, true);
  }

  banish() {
    for (const k of this.director.killers) k.despawn();
    this.director.killers = [];
    this.hud.showMessage('The island falls silent.');
  }

  refresh() {
    this.godBtn.textContent = `GOD MODE: ${this.player.godMode ? 'ON' : 'OFF'}`;
    this.godBtn.classList.toggle('on', this.player.godMode);
    this.nightLabel.textContent = `Night ${this.daynight.day}`;
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
}

import { BLOCKS } from '../world/blocks.js';

const HEART = [
  '.RR.RR.',
  'RRRRRRR',
  'RRRRRRR',
  '.RRRRR.',
  '..RRR..',
  '...R...',
];

function paintHeart(canvas, mode) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 7, 6);
  for (let y = 0; y < HEART.length; y++) {
    for (let x = 0; x < HEART[y].length; x++) {
      if (HEART[y][x] !== 'R') continue;
      let color = '#3a3a3a';
      if (mode === 'full' || (mode === 'half' && x < 3.5)) color = '#d81f1f';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
      if (color === '#d81f1f' && y === 1 && (x === 1 || x === 5)) {
        ctx.fillStyle = '#ff6a6a'; // glint
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function paintAxeIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a5636';
  for (let i = 0; i < 9; i++) ctx.fillRect(3 + i, 12 - i, 2, 2); // diagonal handle
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(9, 1, 5, 4);
  ctx.fillRect(8, 2, 7, 3);
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(9, 2, 5, 1);
  return c;
}

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

export function paintBagIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a2818';                             // straps
  ctx.fillRect(5, 1, 2, 4); ctx.fillRect(9, 1, 2, 4);
  ctx.fillStyle = '#6b4a2a';                             // bag body
  ctx.fillRect(3, 4, 10, 10);
  ctx.fillStyle = '#7d5a36';
  ctx.fillRect(4, 8, 8, 5);                              // lighter face
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(3, 4, 10, 3);                             // flap
  ctx.fillStyle = '#c8b060';
  ctx.fillRect(7, 6, 2, 2);                              // buckle
  return c;
}

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.clockEl = document.getElementById('clock');
    this.dayEl = document.getElementById('day-label');
    this.heartsEl = document.getElementById('hearts');
    this.staminaFill = document.getElementById('stamina-fill');
    this.hotbarEl = document.getElementById('hotbar');
    this.messageEl = document.getElementById('message');
    this.damageFlash = document.getElementById('damage-flash');
    this.staticCanvas = document.getElementById('static-overlay');
    this.staticCanvas.width = 160;
    this.staticCanvas.height = 90;
    this.staticCtx = this.staticCanvas.getContext('2d');
    this.desatEl = document.getElementById('desat-overlay');
    this.mineEl = document.getElementById('mine-progress');
    this.mineFill = document.getElementById('mine-progress-fill');
    this.backpackEl = document.getElementById('backpack');
    this.backpackCountEl = document.getElementById('backpack-count');
    this.backpackEl.prepend(paintBagIcon());

    this.heartCanvases = [];
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('canvas');
      c.width = 7; c.height = 6;
      this.heartsEl.appendChild(c);
      this.heartCanvases.push(c);
    }
    this.lastHealth = -1;
    this.messageTimeout = null;
    this.slotEls = [];
    this.countEls = [];
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  buildHotbar(hotbar, atlas) {
    this.hotbarEl.innerHTML = '';
    this.slotEls = [];
    this.countEls = [];
    hotbar.forEach((slot, i) => {
      const div = document.createElement('div');
      div.className = 'hotbar-slot';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String((i + 1) % 10); // slots 1..9 then 0
      div.appendChild(key);
      const icon = slot.kind === 'weapon' ? paintAxeIcon() : atlas.tileToCanvas(BLOCKS[slot.id].tiles.side);
      if (slot.kind === 'weapon') this.weaponIconEl = icon;
      div.appendChild(icon);
      let count = null;
      if (slot.kind === 'block') {
        count = document.createElement('span');
        count.className = 'count';
        div.appendChild(count);
      }
      this.hotbarEl.appendChild(div);
      this.slotEls.push(div);
      this.countEls.push(count);
    });
    this.hotbarDef = hotbar;
  }

  updateHotbar(inventory, selected) {
    this.hotbarDef.forEach((slot, i) => {
      this.slotEls[i].classList.toggle('selected', i === selected);
      if (this.countEls[i]) this.countEls[i].textContent = String(inventory[slot.id] ?? 0);
    });
  }

  setBackpack(used, cap) {
    const s = `${used}/${cap}`;
    if (this.backpackCountEl.textContent !== s) this.backpackCountEl.textContent = s;
    this.backpackEl.classList.toggle('full', used >= cap);
  }

  setHealth(hp) {
    const snapped = Math.ceil(hp * 2) / 2;
    if (snapped === this.lastHealth) return;
    this.lastHealth = snapped;
    for (let i = 0; i < 5; i++) {
      const left = snapped - i * 2;
      paintHeart(this.heartCanvases[i], left >= 2 ? 'full' : left >= 1 ? 'half' : 'empty');
    }
    this.damageFlash.classList.toggle('low-health', hp > 0 && hp <= 3);
  }

  setStamina(v) {
    this.staminaFill.style.width = `${v}%`;
    this.staminaFill.classList.toggle('low', v < 25);
  }

  setClock(str, isNight) {
    if (this.clockEl.textContent !== str) this.clockEl.textContent = str;
    this.clockEl.classList.toggle('night', isNight);
  }

  setDayLabel(str, isNight) {
    if (this.dayEl.textContent !== str) this.dayEl.textContent = str;
    this.dayEl.classList.toggle('night', isNight);
  }

  setMineProgress(p) {
    this.mineEl.style.display = p > 0 ? 'block' : 'none';
    if (p > 0) this.mineFill.style.width = `${Math.min(100, p * 100)}%`;
  }

  flashDamage() {
    this.damageFlash.classList.add('hit');
    setTimeout(() => this.damageFlash.classList.remove('hit'), 70);
  }

  showMessage(text, ominous = false, duration = 4) {
    this.messageEl.textContent = text;
    this.messageEl.classList.toggle('ominous', ominous);
    this.messageEl.classList.add('show');
    clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => this.messageEl.classList.remove('show'), duration * 1000);
  }

  // TV-static overlay; repainted only while active, at 1/4-ish resolution.
  setStatic(level) {
    if (level <= 0.02) {
      if (this.staticCanvas.style.opacity !== '0') this.staticCanvas.style.opacity = '0';
      return;
    }
    const ctx = this.staticCtx;
    const img = ctx.createImageData(160, 90);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.staticCanvas.style.opacity = String(Math.min(0.92, level));
  }

  setDesat(level) {
    const l = Math.min(1, level);
    this.desatEl.style.opacity = l > 0.02 ? '1' : '0';
    this.desatEl.style.backdropFilter = l > 0.02 ? `grayscale(${l.toFixed(2)}) brightness(${(1 - l * 0.25).toFixed(2)})` : '';
  }

  // The Ink Demon's darkness creeping in from the edges of the screen.
  setInk(level) {
    if (!this.inkEl) this.inkEl = document.getElementById('ink-overlay');
    this.inkEl.style.opacity = String(Math.min(1, level));
  }

  // swap the weapon slot icon when the club is crafted
  setWeaponIcon(kind) {
    if (!this.weaponIconEl) return;
    const painted = kind === 'club' ? paintClubIcon() : paintAxeIcon();
    this.weaponIconEl.getContext('2d').clearRect(0, 0, 16, 16);
    this.weaponIconEl.getContext('2d').drawImage(painted, 0, 0);
  }
}

// Pointer lock, keyboard/mouse state, look angles. No game logic lives here.
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 0.0023;
    this.locked = false;
    this.enabled = false;              // gameplay input allowed (PLAYING state)
    this.mouseDown = [false, false, false];
    this.justPressed = [false, false, false];
    this.hotbarKey = null;             // 0-based slot from Digit1..6, consumed per frame
    this.wheelDelta = 0;
    this.onLockLost = null;

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      const m = /^Digit([1-6])$/.exec(e.code);
      if (m) this.hotbarKey = Number(m[1]) - 1;
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      // browsers can report one huge bogus delta right after acquiring the lock
      if (this.swallowNextMove) { this.swallowNextMove = false; return; }
      const mx = Math.max(-300, Math.min(300, e.movementX));
      const my = Math.max(-300, Math.min(300, e.movementY));
      this.yaw -= mx * this.sensitivity;
      this.pitch -= my * this.sensitivity;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button <= 2) { this.mouseDown[e.button] = true; this.justPressed[e.button] = true; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button <= 2) this.mouseDown[e.button] = false;
    });
    document.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.wheelDelta += Math.sign(e.deltaY);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked && !wasLocked) this.swallowNextMove = true;
      if (wasLocked && !this.locked && this.onLockLost) this.onLockLost();
    });
  }

  // Pointer lock can be rejected (headless browsers, rapid Esc). The game keeps
  // running either way so automated tests can drive it without a lock.
  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* unsupported */ }
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  // Call once per frame after all systems consumed input edges.
  endFrame() {
    this.justPressed[0] = this.justPressed[1] = this.justPressed[2] = false;
    this.hotbarKey = null;
    this.wheelDelta = 0;
  }
}

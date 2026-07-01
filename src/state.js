export const State = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  DEAD: 'DEAD',
  WON: 'WON',
};

export class StateMachine {
  constructor() {
    this.current = null;
    this.handlers = {};
  }

  on(state, { enter, exit } = {}) {
    this.handlers[state] = { enter, exit };
  }

  set(next) {
    if (next === this.current) return;
    const prev = this.current;
    if (prev && this.handlers[prev]?.exit) this.handlers[prev].exit(next);
    this.current = next;
    if (this.handlers[next]?.enter) this.handlers[next].enter(prev);
  }
}

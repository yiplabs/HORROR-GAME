export class Menus {
  constructor(handlers) {
    this.screens = {
      title: document.getElementById('title-screen'),
      pause: document.getElementById('pause-screen'),
      death: document.getElementById('death-screen'),
      win: document.getElementById('win-screen'),
    };
    this.bestEl = document.getElementById('best-score');
    this.deathCause = document.getElementById('death-cause');
    this.deathStats = document.getElementById('death-stats');
    this.winStats = document.getElementById('win-stats');

    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-play', handlers.onPlay);
    on('btn-resume', handlers.onResume);
    on('btn-restart', handlers.onRestart);
    on('btn-quit', handlers.onQuit);
    on('btn-retry', handlers.onRestart);
    on('btn-death-quit', handlers.onQuit);
    on('btn-win-again', handlers.onRestart);
    on('btn-win-quit', handlers.onQuit);
  }

  hideAll() {
    for (const el of Object.values(this.screens)) el.classList.add('hidden');
  }

  showTitle(bestNights) {
    this.hideAll();
    this.bestEl.textContent = bestNights > 0 ? `best run: ${bestNights} night${bestNights === 1 ? '' : 's'} survived` : '';
    this.screens.title.classList.remove('hidden');
  }

  showPause() {
    this.hideAll();
    this.screens.pause.classList.remove('hidden');
  }

  showDeath(killerName, nights, best) {
    this.hideAll();
    this.deathCause.textContent = killerName ? `${killerName} got you.` : 'The island got you.';
    this.deathStats.textContent = `nights survived: ${nights}   ·   best: ${best}`;
    this.screens.death.classList.remove('hidden');
  }

  showWin(best) {
    this.hideAll();
    this.winStats.textContent = `best: ${best} nights`;
    this.screens.win.classList.remove('hidden');
  }
}

/**
 * FocusTimer — Pomodoro timer engine
 * Sessions: [{work, break}, ...] — last session has no break phase
 */
class FocusTimer {
  /**
   * @param {Array<{work: number, break: number}>} sessions
   * @param {{onTick, onPhaseEnd, onSessionEnd, onAllDone}} callbacks
   */
  constructor(sessions, callbacks) {
    this.sessions = sessions;
    this.cb = callbacks;

    this._intervalId = null;
    this._sessionIndex = 0;
    this._phase = 'work'; // 'work' | 'break'
    this._elapsed = 0;
    this._running = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._tick(); // immediate first tick
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  pause() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  resume() {
    if (this._running) return;
    this.start();
  }

  skip() {
    this._advancePhase();
  }

  reset() {
    this.destroy();
    this._sessionIndex = 0;
    this._phase = 'work';
    this._elapsed = 0;
    this._running = false;
  }

  destroy() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._running = false;
  }

  get isRunning() { return this._running; }
  get sessionIndex() { return this._sessionIndex; }
  get phase() { return this._phase; }

  // ── Internal ───────────────────────────────────────────────────────────────

  _currentTotal() {
    const s = this.sessions[this._sessionIndex];
    return this._phase === 'work' ? s.work * 60 : s.break * 60;
  }

  _tick() {
    const total = this._currentTotal();
    const remaining = total - this._elapsed;

    if (this.cb.onTick) {
      this.cb.onTick(remaining, total, this._phase, this._sessionIndex);
    }

    this._elapsed++;

    if (this._elapsed > total) {
      this._elapsed = 0;
      clearInterval(this._intervalId);
      this._intervalId = null;
      this._running = false;
      this._advancePhase();
    }
  }

  _advancePhase() {
    const prevPhase = this._phase;
    const prevSession = this._sessionIndex;

    if (this.cb.onPhaseEnd) {
      this.cb.onPhaseEnd(prevPhase, prevSession);
    }

    const isLastSession = this._sessionIndex === this.sessions.length - 1;

    if (prevPhase === 'work') {
      if (isLastSession) {
        // All done
        if (this.cb.onSessionEnd) this.cb.onSessionEnd(prevSession);
        if (this.cb.onAllDone) this.cb.onAllDone();
        return;
      }
      // Move to break (if break duration > 0) or skip break
      const breakMins = this.sessions[this._sessionIndex].break;
      if (breakMins > 0) {
        this._phase = 'break';
        this._elapsed = 0;
        this._running = true;
        this._tick();
        this._intervalId = setInterval(() => this._tick(), 1000);
      } else {
        // Skip break, go to next work session
        if (this.cb.onSessionEnd) this.cb.onSessionEnd(prevSession);
        this._sessionIndex++;
        this._phase = 'work';
        this._elapsed = 0;
        this._running = true;
        this._tick();
        this._intervalId = setInterval(() => this._tick(), 1000);
      }
    } else {
      // Break ended → next work session
      if (this.cb.onSessionEnd) this.cb.onSessionEnd(prevSession);
      this._sessionIndex++;
      this._phase = 'work';
      this._elapsed = 0;
      this._running = true;
      this._tick();
      this._intervalId = setInterval(() => this._tick(), 1000);
    }
  }
}

/**
 * AudioEngine — Media player for Focus Bomb
 */
class AudioEngine {
  constructor() {
    this._ctx = null;
    this._ambientGain = null;
    this._masterGain = null;
    this._volume = 0.4;
    this._paused = false;
    this._customAudio = null;
    this.onTimeUpdate = null;
    this.onEnded = null;
    this._mode = 'off';
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volume;
      this._masterGain.connect(this._ctx.destination);
      this._ambientGain = this._ctx.createGain();
      this._ambientGain.gain.value = 1;
      this._ambientGain.connect(this._masterGain);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // ── Alarm ──────────────────────────────────────────────────────────────────

  playAlarm() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.25;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.16);
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  play(src) {
    this._stopSources();
    if (!src) return;
    this._mode = 'custom';
    this._paused = false;
    this._startFile(src);
  }

  _stopSources() {
    if (this._customAudio) {
      this._customAudio.pause();
      this._customAudio.src = '';
      this._customAudio = null;
    }
  }

  stopAmbient() {
    this._stopSources();
    this._mode = 'off';
    this._paused = false;
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain && this._ctx)
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.05);
    if (this._customAudio) this._customAudio.volume = this._volume;
  }

  get isAmbientPlaying() { return !this._paused && this._mode !== 'off'; }

  pauseAmbient() {
    if (this._paused) return;
    this._paused = true;
    if (this._ambientGain && this._ctx)
      this._ambientGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05);
    if (this._customAudio) this._customAudio.pause();
  }

  resumeAmbient() {
    if (!this._paused) return;
    this._paused = false;
    if (this._ambientGain && this._ctx)
      this._ambientGain.gain.setTargetAtTime(1, this._ctx.currentTime, 0.05);
    if (this._customAudio) this._customAudio.play().catch(() => {});
  }

  toggleAmbient() {
    if (this._paused) this.resumeAmbient(); else this.pauseAmbient();
    return this.isAmbientPlaying;
  }

  // ── Sources ────────────────────────────────────────────────────────────────

  _startFile(src) {
    const el = new Audio(src);
    el.loop = false;
    el.volume = this._volume;
    el.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) this.onTimeUpdate(el.currentTime, el.duration);
    });
    el.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
    });
    el.play().catch(() => {});
    this._customAudio = el;
  }

  seekTo(time) {
    if (this._customAudio) {
      this._customAudio.currentTime = time;
    }
  }
}


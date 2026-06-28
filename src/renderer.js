/* renderer.js — Focus Bomb UI logic */

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────────────────────
  const audio = new AudioEngine();
  let timer = null;
  let timerRunning = false;
  let sessionConfigs = []; // [{work, break}]
  let currentDbIds = [];   // DB row id per session (saved on work-phase start)
  let historyCache = null;

  // ── DOM Refs ────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const cfgPanel    = $('cfg-panel');
  const timerView   = $('timer-view');
  const sessionCountInput = $('session-count');
  const sessionRowsEl     = $('session-rows');
  const applyAllBtn  = $('apply-all-btn');
  const startBtn     = $('start-btn');

  const sessionLabel = $('session-label');
  const phaseLabel   = $('phase-label');
  const timerDisplay = $('timer-display');
  const ringProgress = $('ring-progress');
  const sessionDots  = $('session-dots');

  const btnStartPause = $('btn-start-pause');
  const btnSkip       = $('btn-skip');
  const btnReset      = $('btn-reset');

  const CIRCUMFERENCE = 2 * Math.PI * 120; // 753.98

  // ── Nav / View switching ────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = 'view-' + btn.dataset.view;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(viewId).classList.add('active');
      if (btn.dataset.view === 'history') loadHistory(false);
    });
  });

  // ── Window controls ─────────────────────────────────────────────────────────
  $('btn-minimize').addEventListener('click', () => window.focusBomb.minimizeWindow());
  $('btn-close').addEventListener('click',    () => window.focusBomb.closeWindow());

  // ── Drawer Toggle ─────────────────────────────────────────────────────────
  const sidebar = $('sidebar');
  const overlay = $('drawer-overlay');
  
  function toggleDrawer() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
  
  $('btn-drawer-toggle').addEventListener('click', toggleDrawer);
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  // ── Mini Player Controls ──────────────────────────────────────────────────
  function setPlayerUI(trackName, playing, isFile = false) {
    const nameEl   = $('player-track-name');
    const playBtn  = $('ambient-play-btn');
    const playIco  = $('amb-play-ico');
    const pauseIco = $('amb-pause-ico');
    const timeRow  = $('player-time-row');

    if (nameEl && trackName != null) nameEl.textContent = trackName;
    if (playBtn)  playBtn.disabled = (audio._mode === 'off');
    if (playIco)  playIco.style.display  = playing ? 'none' : '';
    if (pauseIco) pauseIco.style.display = playing ? ''     : 'none';
    if (timeRow)  timeRow.style.display  = isFile ? 'flex' : 'none';
  }

  function formatAudioTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  let isDraggingSlider = false;
  audio.onTimeUpdate = (curr, total) => {
    if (!isDraggingSlider && total) {
      $('time-current').textContent = formatAudioTime(curr);
      $('time-total').textContent = formatAudioTime(total);
      $('time-slider').value = (curr / total) * 100;
    }
  };

  $('time-slider').addEventListener('input', () => { isDraggingSlider = true; });
  $('time-slider').addEventListener('change', e => {
    isDraggingSlider = false;
    if (audio._customAudio && audio._customAudio.duration) {
      audio.seekTo((e.target.value / 100) * audio._customAudio.duration);
    }
  });

  // Playlist logic
  let draggedTrackPath = null;

  async function loadPlaylist() {
    const container = $('playlist-container');
    if (!container) return;
    try {
      const folders = await window.focusBomb.getPlaylist();
      if (!folders || folders.length === 0) {
        container.innerHTML = `<div style="padding: 10px; text-align: center; color: var(--muted); font-size: 9px;">Drop MP3s in folder</div>`;
        return;
      }
      container.innerHTML = '';
      
      folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'playlist-folder';
        
        const header = document.createElement('div');
        header.className = 'playlist-folder-header';
        header.innerHTML = `<i data-lucide="${folder.isRoot ? 'home' : 'folder'}"></i> ${folder.name}`;
        
        const content = document.createElement('div');
        content.className = 'playlist-folder-content expanded';
        
        header.addEventListener('click', () => content.classList.toggle('expanded'));
        
        // Drag and drop target
        header.addEventListener('dragover', e => { e.preventDefault(); header.classList.add('drag-over'); });
        header.addEventListener('dragleave', () => header.classList.remove('drag-over'));
        header.addEventListener('drop', async e => {
          e.preventDefault();
          header.classList.remove('drag-over');
          if (draggedTrackPath) {
            await window.focusBomb.moveTrack(draggedTrackPath, folder.path);
            loadPlaylist();
          }
        });
        
        // Render files
        folder.files.forEach(f => {
          const item = document.createElement('div');
          item.className = 'playlist-item';
          item.draggable = true;
          item.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis;">${f.name}</span>
            <div class="eq-bars">
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
              <div class="eq-bar"></div>
            </div>
          `;
          
          item.addEventListener('dragstart', () => { draggedTrackPath = f.rawPath; });
          item.addEventListener('click', () => {
            document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            audio.play(f.path);
            setPlayerUI(f.name, true, true);
          });
          content.appendChild(item);
        });
        
        if (folder.files.length === 0) {
          content.innerHTML = `<div style="padding: 4px 10px 4px 24px; font-size: 9px; color: var(--border);">Empty</div>`;
        }
        
        folderDiv.appendChild(header);
        folderDiv.appendChild(content);
        container.appendChild(folderDiv);
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
      container.innerHTML = `<div style="padding: 10px; text-align: center; color: var(--muted); font-size: 9px;">Error loading playlist</div>`;
    }
  }

  $('new-playlist-btn').addEventListener('click', async () => {
    const name = prompt("Enter new playlist name:");
    if (name && name.trim()) {
      await window.focusBomb.createPlaylistFolder(name.trim());
      loadPlaylist();
    }
  });

  $('open-playlist-btn').addEventListener('click', () => {
    window.focusBomb.openPlaylistFolder();
  });

  window.addEventListener('focus', loadPlaylist);
  loadPlaylist();

  // Play / pause toggle
  $('ambient-play-btn').addEventListener('click', () => {
    if (audio._mode === 'off') return;
    const playing = audio.toggleAmbient();
    setPlayerUI(null, playing, !!audio._customAudio);
  });

  // Volume
  $('vol-slider').addEventListener('input', e => {
    audio.setVolume(e.target.value / 100);
  });

  // ── Configurator ────────────────────────────────────────────────────────────
  function buildSessionRows(count) {
    sessionRowsEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const workVal  = sessionConfigs[i]?.work  ?? 25;
      const breakVal = sessionConfigs[i]?.break ?? 5;

      const row = document.createElement('div');
      row.className = 'session-row';
      row.dataset.index = i;
      row.innerHTML = `
        <span class="snum">Session ${i + 1}</span>
        <div class="sin-wrap">
          <input type="number" class="row-input work-in" min="1" max="90" value="${workVal}" data-idx="${i}" />
          <span>min</span>
        </div>
        <div class="sin-wrap">
          ${isLast
            ? `<span class="dash">—</span>`
            : `<input type="number" class="row-input break-in" min="0" max="30" value="${breakVal}" data-idx="${i}" /><span>min</span>`}
        </div>
        <span></span>
      `;
      sessionRowsEl.appendChild(row);
    }
  }

  function readSessionConfigs() {
    const rows = sessionRowsEl.querySelectorAll('.session-row');
    const configs = [];
    let valid = true;
    rows.forEach((row, i) => {
      const workIn  = row.querySelector('.work-in');
      const breakIn = row.querySelector('.break-in');
      const work  = parseInt(workIn?.value, 10);
      const brk   = breakIn ? parseInt(breakIn.value, 10) : 0;

      let rowOk = true;
      if (!workIn || isNaN(work) || work < 1 || work > 90) {
        if (workIn) workIn.classList.add('error');
        rowOk = false;
      } else {
        workIn?.classList.remove('error');
      }
      if (breakIn && (isNaN(brk) || brk < 0 || brk > 30)) {
        breakIn.classList.add('error');
        rowOk = false;
      } else {
        breakIn?.classList.remove('error');
      }
      if (!rowOk) valid = false;
      configs.push({ work: isNaN(work) ? 25 : work, break: isNaN(brk) ? 0 : brk });
    });
    return valid ? configs : null;
  }

  sessionCountInput.addEventListener('change', () => {
    let n = parseInt(sessionCountInput.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 10) n = 10;
    sessionCountInput.value = n;
    // Preserve existing configs
    buildSessionRows(n);
  });

  applyAllBtn.addEventListener('click', () => {
    const rows = sessionRowsEl.querySelectorAll('.session-row');
    const firstWork  = rows[0]?.querySelector('.work-in')?.value  ?? '25';
    const firstBreak = rows[0]?.querySelector('.break-in')?.value ?? '5';
    rows.forEach((row, i) => {
      if (i === 0) return;
      const w = row.querySelector('.work-in');
      const b = row.querySelector('.break-in');
      if (w) w.value = firstWork;
      if (b) b.value = firstBreak;
    });
  });

  startBtn.addEventListener('click', () => {
    const configs = readSessionConfigs();
    if (!configs) return;
    sessionConfigs = configs;
    currentDbIds = new Array(configs.length).fill(null);
    startTimerSession();
  });

  // ── Timer Session ────────────────────────────────────────────────────────────
  function startTimerSession() {
    // Switch UI
    cfgPanel.style.display = 'none';
    timerView.style.display = 'flex';

    // Build dots
    renderDots(0, 'work', []);

    // Create timer
    timer = new FocusTimer(sessionConfigs, {
      onTick: handleTick,
      onPhaseEnd: handlePhaseEnd,
      onSessionEnd: handleSessionEnd,
      onAllDone: handleAllDone
    });

    timerRunning = false;
    updateStartPauseBtn(false, 'work');
    updateTimerLabel(0, 'work');
    setRingProgress(1);

    // Save first session row immediately (completed=0)
    saveSessionStart(0);
  }

  async function saveSessionStart(idx) {
    const cfg = sessionConfigs[idx];
    const today = new Date().toISOString().slice(0, 10);
    const result = await window.focusBomb.saveSession({
      date: today,
      session_number: idx + 1,
      work_minutes: cfg.work,
      break_minutes: cfg.break,
      completed: 0
    });
    currentDbIds[idx] = result.id;
  }

  // ── Timer Callbacks ──────────────────────────────────────────────────────────
  function handleTick(remaining, total, phase, sessionIdx) {
    timerDisplay.textContent = formatTime(remaining);
    setRingProgress(remaining / total);
    updateTimerLabel(sessionIdx, phase);
  }

  async function handlePhaseEnd(phase, sessionIdx) {
    audio.playAlarm();
    const isLastSession = sessionIdx === sessionConfigs.length - 1;
    if (phase === 'work') {
      const hasBreak = !isLastSession && sessionConfigs[sessionIdx].break > 0;
      const title = '✅ Work phase complete!';
      const body = hasBreak
        ? `Session ${sessionIdx + 1} done. Locking screen for your break.`
        : `Session ${sessionIdx + 1} done. Almost there!`;
      await window.focusBomb.sendNotification(title, body);
      // Lock screen so you're forced onto break
      if (hasBreak) window.focusBomb.lockScreen();
    } else {
      await window.focusBomb.sendNotification('⏰ Break over!', 'Time to focus!');
    }
  }

  async function handleSessionEnd(sessionIdx) {
    // Mark completed in DB
    const id = currentDbIds[sessionIdx];
    if (id) await window.focusBomb.updateSessionComplete(id);
    // Save next session start row
    const nextIdx = sessionIdx + 1;
    if (nextIdx < sessionConfigs.length) {
      await saveSessionStart(nextIdx);
    }
    renderDots(nextIdx < sessionConfigs.length ? nextIdx : sessionIdx, timer.phase, currentDbIds);
  }

  async function handleAllDone() {
    timerRunning = false;
    btnStartPause.textContent = 'Done';
    btnStartPause.disabled = true;
    phaseLabel.textContent = 'Complete!';
    phaseLabel.className = '';
    timerDisplay.textContent = '00:00';

    await window.focusBomb.sendNotification(
      '🎉 All sessions complete!',
      'Amazing work! Locking screen now.'
    );

    // All dots → completed
    sessionDots.querySelectorAll('.sdot').forEach(d => {
      d.className = 'sdot completed';
    });

    // Lock screen
    window.focusBomb.lockScreen();

    // After 4s reset back to configurator so user can start fresh
    setTimeout(() => resetToConfigurator(), 4000);
  }

  function resetToConfigurator() {
    if (timer) { timer.destroy(); timer = null; }
    timerRunning = false;
    btnStartPause.disabled = false;
    btnStartPause.textContent = 'Start';
    // Rebuild session rows with the last-used settings preserved
    buildSessionRows(sessionConfigs.length);
    timerView.style.display = 'none';
    cfgPanel.style.display = 'flex';
    cfgPanel.style.flexDirection = 'column';
  }

  // ── Control Buttons ──────────────────────────────────────────────────────────
  btnStartPause.addEventListener('click', () => {
    if (!timer) return;
    if (timerRunning) {
      timer.pause();
      timerRunning = false;
      updateStartPauseBtn(false, timer.phase);
    } else {
      timer.resume();
      timerRunning = true;
      updateStartPauseBtn(true, timer.phase);
    }
  });

  btnSkip.addEventListener('click', () => {
    if (!timer) return;
    timer.skip();
    timerRunning = true;
    updateStartPauseBtn(true, timer.phase);
  });

  btnReset.addEventListener('click', () => {
    if (timer) { timer.destroy(); timer = null; }
    timerRunning = false;
    timerView.style.display = 'none';
    cfgPanel.style.display = 'flex';
    cfgPanel.style.flexDirection = 'column';
    btnStartPause.disabled = false;
  });

  // ── UI Helpers ───────────────────────────────────────────────────────────────
  function updateStartPauseBtn(running, phase) {
    btnStartPause.textContent = running ? 'Pause' : 'Resume';
    if (!timerRunning && !timer?.isRunning) btnStartPause.textContent = 'Start';
    btnStartPause.className = phase === 'break' ? 'break-mode' : '';
  }

  function updateTimerLabel(sessionIdx, phase) {
    sessionLabel.textContent = `Session ${sessionIdx + 1} of ${sessionConfigs.length}`;
    phaseLabel.textContent = phase === 'work' ? 'Work' : 'Break';
    phaseLabel.className = phase === 'break' ? 'break' : '';

    const accent = phase === 'work' ? '#e05a2b' : '#2b8ce0';
    ringProgress.style.stroke = accent;
  }

  function setRingProgress(fraction) {
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    ringProgress.setAttribute('stroke-dashoffset', offset.toFixed(2));
  }

  function renderDots(currentIdx, phase, completedIdsArr) {
    sessionDots.innerHTML = '';
    const completedSet = new Set();
    currentDbIds.forEach((id, i) => {
      // A session is "completed" if next session has started (i < currentIdx)
      if (i < currentIdx) completedSet.add(i);
    });

    sessionConfigs.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'sdot';
      if (completedSet.has(i)) {
        dot.classList.add('completed');
      } else if (i === currentIdx) {
        dot.classList.add('current');
        if (phase === 'break') dot.classList.add('break');
      }
      sessionDots.appendChild(dot);
    });
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── History ──────────────────────────────────────────────────────────────────
  async function loadHistory(useCache) {
    if (useCache && historyCache) { renderHistory(historyCache); return; }
    const days = parseInt($('hist-range').value, 10);
    const rows = await window.focusBomb.getHistory(days);
    historyCache = rows;
    renderHistory(rows);
  }

  function renderHistory(rows) {
    const histRows = $('hist-rows');
    const histEmpty = $('hist-empty');

    // Summary stats
    const totalSessions = rows.reduce((s, r) => s + (r.sessions_completed || 0), 0);
    const totalMinutes  = rows.reduce((s, r) => s + (r.total_focus_minutes || 0), 0);
    const streak = calcStreak(rows);
    const bestDay = rows.reduce((best, r) =>
      (r.sessions_completed > (best?.sessions_completed || 0)) ? r : best, null);

    $('stat-sessions').textContent = totalSessions;
    $('stat-focus').textContent    = totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      : `${totalMinutes} min`;
    $('stat-streak').textContent   = `${streak} day${streak !== 1 ? 's' : ''}`;
    $('stat-best').textContent     = bestDay ? fmtDate(bestDay.date) : '—';

    // Table
    histRows.innerHTML = '';
    if (rows.length === 0) {
      histEmpty.style.display = 'block';
      $('hist-table').style.display = 'none';
      return;
    }
    histEmpty.style.display = 'none';
    $('hist-table').style.display = 'block';

    rows.forEach(row => {
      const el = document.createElement('div');
      el.className = 'hist-row';
      const avgMin = row.avg_work_minutes ? Math.round(row.avg_work_minutes) : 0;
      const totalMin = row.total_focus_minutes || 0;
      el.innerHTML = `
        <div class="hist-row-main" data-date="${row.date}">
          <span class="date-cell">${fmtDate(row.date)}</span>
          <span class="data-cell">${row.sessions_completed}</span>
          <span class="data-cell">${totalMin} min</span>
          <span class="data-cell">${avgMin} min avg</span>
        </div>
        <div class="hist-row-detail" id="detail-${row.date}"></div>
      `;
      el.querySelector('.hist-row-main').addEventListener('click', () => toggleDetail(row.date));
      histRows.appendChild(el);
    });
  }

  async function toggleDetail(date) {
    const detailEl = document.getElementById(`detail-${date}`);
    if (detailEl.classList.contains('open')) {
      detailEl.classList.remove('open');
      return;
    }
    // Load if empty
    if (!detailEl.innerHTML.trim()) {
      const sessions = await window.focusBomb.getSessionsForDate(date);
      detailEl.innerHTML = sessions.map(s => `
        <div class="detail-session">
          <span class="ds-num">Session ${s.session_number}</span>
          <span>${s.work_minutes} min work</span>
          <span>${s.break_minutes > 0 ? s.break_minutes + ' min break' : 'no break'}</span>
          <span class="ds-badge ${s.completed ? 'done' : 'abandoned'}">${s.completed ? 'Completed' : 'Abandoned'}</span>
        </div>
      `).join('') || '<p style="color:var(--muted);padding:8px 0;font-size:12px">No sessions for this date.</p>';
    }
    detailEl.classList.add('open');
  }

  function calcStreak(rows) {
    // rows sorted DESC by date
    if (!rows.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    let cursor = new Date(today);
    const dateSet = new Set(rows.map(r => r.date));
    while (true) {
      const ds = cursor.toISOString().slice(0, 10);
      if (dateSet.has(ds)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function fmtDate(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  $('hist-range').addEventListener('change', () => { historyCache = null; loadHistory(false); });
  $('hist-refresh').addEventListener('click', () => { historyCache = null; loadHistory(false); });

  // ── Init ───────────────────────────────────────────────────────────────
  buildSessionRows(5);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setPlayerUI('No track loaded', false);

})();

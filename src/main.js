const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const db = require('./db');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d0d0d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('save-session', (_event, data) => {
  return db.saveSession(data);
});

ipcMain.handle('update-session-complete', (_event, id) => {
  db.updateSessionComplete(id);
});

ipcMain.handle('get-history', (_event, days) => {
  return db.getHistory(days);
});

ipcMain.handle('get-sessions-for-date', (_event, date) => {
  return db.getSessionsForDate(date);
});

ipcMain.handle('lock-screen', () => {
  return new Promise((resolve) => {
    exec('loginctl lock-session', (err) => {
      if (!err) return resolve(true);
      exec('gnome-screensaver-command --lock', (err2) => {
        if (!err2) return resolve(true);
        exec('xdg-screensaver lock', (err3) => {
          resolve(!err3);
        });
      });
    });
  });
});

ipcMain.handle('send-notification', (_event, title, body) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title,
      body,
      icon: path.join(__dirname, '..', 'assets', 'icon.png')
    });
    n.show();
  }
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// ── Playlist Logic ───────────────────────────────────────────────────────────
function getPlaylistDir() {
  const dir = path.join(app.getPath('userData'), 'playlist');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('get-playlist', () => {
  try {
    const rootDir = getPlaylistDir();
    const files = fs.readdirSync(rootDir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.mp3'))
      .map(f => ({
        name: f.name,
        path: `file://${path.join(rootDir, f.name)}`,
        rawPath: path.join(rootDir, f.name)
      }));
    return files;
  } catch (err) {
    return [];
  }
});

ipcMain.handle('open-playlist-folder', () => {
  shell.openPath(getPlaylistDir());
});

ipcMain.handle('delete-track', (_event, trackPath) => {
  try {
    if (fs.existsSync(trackPath)) fs.unlinkSync(trackPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('copy-files-to-playlist', (_event, filePaths) => {
  try {
    const rootDir = getPlaylistDir();
    const copied = [];
    for (const src of filePaths) {
      if (!src.toLowerCase().endsWith('.mp3')) continue;
      const fileName = path.basename(src);
      const dest = path.join(rootDir, fileName);
      fs.copyFileSync(src, dest);
      copied.push(fileName);
    }
    return { ok: true, copied };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

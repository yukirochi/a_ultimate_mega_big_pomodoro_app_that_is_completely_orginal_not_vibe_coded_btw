const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusBomb', {
  saveSession: (data) => ipcRenderer.invoke('save-session', data),
  updateSessionComplete: (id) => ipcRenderer.invoke('update-session-complete', id),
  getHistory: (days) => ipcRenderer.invoke('get-history', days),
  getSessionsForDate: (date) => ipcRenderer.invoke('get-sessions-for-date', date),
  lockScreen: () => ipcRenderer.invoke('lock-screen'),
  sendNotification: (title, body) => ipcRenderer.invoke('send-notification', title, body),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getPlaylist: () => ipcRenderer.invoke('get-playlist'),
  openPlaylistFolder: () => ipcRenderer.invoke('open-playlist-folder'),
  createPlaylistFolder: (name) => ipcRenderer.invoke('create-playlist-folder', name),
  moveTrack: (sourceRawPath, targetFolderPath) => ipcRenderer.invoke('move-track', sourceRawPath, targetFolderPath)
});

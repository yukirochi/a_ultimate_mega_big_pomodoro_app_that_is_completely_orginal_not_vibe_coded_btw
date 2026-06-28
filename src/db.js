const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'sessions.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT NOT NULL,
        session_number  INTEGER NOT NULL,
        work_minutes    INTEGER NOT NULL,
        break_minutes   INTEGER NOT NULL,
        completed       INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
  }
  return db;
}

function saveSession(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sessions (date, session_number, work_minutes, break_minutes, completed)
    VALUES (@date, @session_number, @work_minutes, @break_minutes, @completed)
  `);
  const result = stmt.run(data);
  return { id: result.lastInsertRowid };
}

function updateSessionComplete(id) {
  const db = getDb();
  db.prepare('UPDATE sessions SET completed = 1 WHERE id = ?').run(id);
}

function getHistory(days) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      date,
      COUNT(*) FILTER (WHERE completed = 1) AS sessions_completed,
      SUM(work_minutes) FILTER (WHERE completed = 1) AS total_focus_minutes,
      AVG(work_minutes) FILTER (WHERE completed = 1) AS avg_work_minutes
    FROM sessions
    WHERE date >= date('now', 'localtime', ? || ' days')
      AND completed = 1
    GROUP BY date
    ORDER BY date DESC
  `).all(`-${days}`);
  return rows;
}

function getSessionsForDate(date) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM sessions
    WHERE date = ?
    ORDER BY session_number ASC
  `).all(date);
}

module.exports = { saveSession, updateSessionComplete, getHistory, getSessionsForDate };

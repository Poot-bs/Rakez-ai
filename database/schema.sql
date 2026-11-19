PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  target_minutes INTEGER DEFAULT 25,
  mode TEXT NOT NULL DEFAULT 'normal',
  success INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attention_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  ts INTEGER NOT NULL,
  focus_score REAL NOT NULL,
  blink_detected INTEGER NOT NULL DEFAULT 0,
  yawn_detected INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS distraction_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  ts INTEGER NOT NULL,
  source TEXT NOT NULL,
  app TEXT,
  site TEXT,
  reason TEXT,
  penalty_coins INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fatigue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  ts INTEGER NOT NULL,
  severity TEXT NOT NULL,
  blink_rate INTEGER NOT NULL DEFAULT 0,
  yawn_count INTEGER NOT NULL DEFAULT 0,
  suggestion TEXT,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS duel_matches (
  id TEXT PRIMARY KEY,
  opponent_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  result TEXT,
  my_distractions INTEGER NOT NULL DEFAULT 0,
  opponent_distractions INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_attention_samples_ts ON attention_samples(ts);
CREATE INDEX IF NOT EXISTS idx_distraction_events_ts ON distraction_events(ts);
CREATE INDEX IF NOT EXISTS idx_fatigue_events_ts ON fatigue_events(ts);
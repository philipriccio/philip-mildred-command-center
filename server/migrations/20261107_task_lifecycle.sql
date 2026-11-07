-- Companion metadata for existing tasks, never a second task queue.
CREATE TABLE IF NOT EXISTS task_lifecycle (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
 goal_id TEXT, goal_title TEXT, project_id TEXT, project_title TEXT,
 occurrence_id TEXT UNIQUE, why_text TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued', run_id TEXT UNIQUE,
 producer TEXT, last_seq INTEGER NOT NULL DEFAULT -1,
 observed_at INTEGER, received_at INTEGER, progress TEXT NOT NULL,
 next_action TEXT NOT NULL, obstacle_json TEXT, evidence_json TEXT,
 reviewer TEXT, delivered_at INTEGER
);
CREATE TABLE IF NOT EXISTS task_lifecycle_events (
 revision INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 producer TEXT NOT NULL, event_id TEXT NOT NULL,
 observed_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
 kind TEXT NOT NULL, summary TEXT NOT NULL,
 UNIQUE(producer,event_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS task_single_delivery ON task_lifecycle_events(task_id) WHERE kind='delivered';

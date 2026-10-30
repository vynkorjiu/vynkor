CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  student TEXT NOT NULL,
  graduation TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  instructor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','revoked')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS certificate_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id TEXT NOT NULL REFERENCES certificates(id),
  version INTEGER NOT NULL,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  UNIQUE(certificate_id, version)
);
CREATE INDEX IF NOT EXISTS certificate_created ON certificates(created_at DESC, id);
CREATE TRIGGER IF NOT EXISTS certificate_insert AFTER INSERT ON certificates BEGIN
  INSERT INTO certificate_events(certificate_id,version,actor,occurred_at,snapshot)
  VALUES(NEW.id,NEW.version,NEW.updated_by,NEW.updated_at,
    json_object('student',NEW.student,'graduation',NEW.graduation,'awarded_on',NEW.awarded_on,'instructor',NEW.instructor,'status',NEW.status));
END;
CREATE TRIGGER IF NOT EXISTS certificate_update AFTER UPDATE ON certificates BEGIN
  INSERT INTO certificate_events(certificate_id,version,actor,occurred_at,snapshot)
  VALUES(NEW.id,NEW.version,NEW.updated_by,NEW.updated_at,
    json_object('student',NEW.student,'graduation',NEW.graduation,'awarded_on',NEW.awarded_on,'instructor',NEW.instructor,'status',NEW.status));
END;

import os from "node:os";
import path from "node:path";
import { getEffectiveConfig } from "../config.js";

export const MAX_CHUNK_BYTES = 4096;
export const SNIPPET_MAX_BYTES = 800;
export const RRF_K = 60;
export const STATE_BUDGET = 2048;
export const MAX_SNAPSHOT_BYTES = 256 * 1024;
export const MAX_SNAPSHOTS_PER_SESSION = 64;
export const MAX_OUTLINE_CACHE_DB_ENTRIES = 512;
export const MAX_OUTLINE_JSON_BYTES = 128 * 1024;
export const DEFAULT_FILE_READ_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CUTOFF_BYTES = 46080; // 45 KiB — aligns with Antigravity read_file host return cap

export const FILE_CATEGORIES = {
  images: {
    id: "images",
    name: "Images",
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".psd"]
  },
  documents: {
    id: "documents",
    name: "Documents",
    extensions: [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".rtf"]
  },
  code: {
    id: "code",
    name: "Source Code",
    extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".cs", ".html", ".css", ".yaml", ".yml", ".sh", ".ps1"]
  },
  models3d: {
    id: "models3d",
    name: "3D Models",
    extensions: [".blend", ".fbx", ".obj", ".gltf", ".glb", ".stl", ".dae", ".3ds", ".step", ".iges"]
  },
  music: {
    id: "music",
    name: "Music",
    extensions: [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma", ".midi"]
  },
  video: {
    id: "video",
    name: "Video",
    extensions: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"]
  },
  archives: {
    id: "archives",
    name: "Archives",
    extensions: [".zip", ".tar", ".gz", ".7z", ".rar", ".wasm"]
  }
};

export const DEFAULT_ACTIVE_CATEGORIES = ["images", "documents", "models3d", "music", "video", "archives"];

export const DEFAULT_EXEMPT_EXTENSIONS = Array.from(
  new Set(
    DEFAULT_ACTIVE_CATEGORIES.flatMap((catId) => FILE_CATEGORIES[catId]?.extensions || [])
  )
);

/** Truncate string strictly by UTF-8 byte length without splitting multi-byte chars */
export function truncateUtf8Bytes(text, maxBytes) {
  if (!text) return "";
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const sliced = Buffer.from(text, "utf8").subarray(0, Math.max(0, maxBytes)).toString("utf8");
  return sliced.replace(/\uFFFD+$/, "");
}


/** Default path to context database (~/.agy-dart/context.db) */
export function getDefaultDbPath() {
  const cfgDb = getEffectiveConfig().dbPath;
  if (cfgDb) return cfgDb;
  const dir = path.join(os.homedir(), ".agy-dart");
  return path.join(dir, "context.db");
}

/** Sanitize an input query string for safe FTS5 queries */
export function sanitizeFtsQuery(query) {
  if (!query || typeof query !== "string") return "";
  const cleaned = query.trim().replace(/[\x00-\x1f]/g, " ");
  const tokens = cleaned.match(/[a-zA-Z0-9_\u0080-\uffff]+/g);
  if (!tokens || tokens.length === 0) return "";
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

/** Sanitize query specifically for trigram index (must have at least 3 characters) */
export function sanitizeTrigramQuery(query) {
  if (!query || typeof query !== "string") return "";
  const tokens = query.match(/[a-zA-Z0-9_\u0080-\uffff]{3,}/g);
  if (!tokens || tokens.length === 0) return "";
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

export class SchemaMethods {
  /** Initialize tables, FTS5 virtual tables, and indexes */
  initSchema() {
    if (!this.db) return;
    const busyMs = Number.isFinite(this.busyTimeoutMs) && this.busyTimeoutMs >= 0 ? Math.floor(this.busyTimeoutMs) : 5000;
    const initStart = Date.now();
    try {
      this.db.exec(`PRAGMA busy_timeout = ${busyMs};`);
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA synchronous = NORMAL;");
    } catch (err) {
      const msg = String(err?.message || err || "");
      const isBusy = err?.code === "ERR_SQLITE_ERROR" && /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(msg);
      if (this.hookMode && isBusy && this.maxRetryDeadlineMs > 0 && Date.now() - initStart >= this.maxRetryDeadlineMs) {
        throw err;
      }
      // Fallback if PRAGMA configuration is restricted
    }

    // Standard tables
    this._withBusyRetry(() => {
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        worktree TEXT NOT NULL,
        agent TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        bytes_total INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        created_ts INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        accessed_ts INTEGER NOT NULL,
        content_hash TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sources_session ON sources(session_id);
      CREATE INDEX IF NOT EXISTS idx_sources_worktree ON sources(worktree);

      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        worktree TEXT NOT NULL,
        agent TEXT NOT NULL,
        kind TEXT NOT NULL,
        tool TEXT,
        key TEXT,
        path TEXT,
        ok INTEGER NOT NULL DEFAULT 1,
        exit_code INTEGER,
        bytes INTEGER NOT NULL DEFAULT 0,
        body TEXT,
        turn INTEGER NOT NULL DEFAULT 0,
        sandbox_bytes INTEGER NOT NULL DEFAULT 0,
        returned_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        accessed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_turn ON events(session_id, turn);

      CREATE TABLE IF NOT EXISTS file_reads (
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        mtime_ms REAL NOT NULL,
        file_size INTEGER NOT NULL,
        ctime_ms REAL,
        ino TEXT,
        byte_est INTEGER NOT NULL DEFAULT 0,
        read_ts INTEGER NOT NULL,
        bypass_armed INTEGER NOT NULL DEFAULT 0,
        read_step INTEGER,
        PRIMARY KEY (session_id, file_path, start_line, end_line)
      );

      CREATE INDEX IF NOT EXISTS idx_file_reads_session_path ON file_reads(session_id, file_path);

      CREATE TABLE IF NOT EXISTS file_snapshots (
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        mtime_ms REAL NOT NULL,
        file_size INTEGER NOT NULL,
        ino TEXT,
        raw_bytes INTEGER NOT NULL DEFAULT 0,
        content_gz BLOB NOT NULL,
        updated_ts INTEGER NOT NULL,
        bypass_armed INTEGER NOT NULL DEFAULT 0,
        full_read_ts INTEGER NOT NULL DEFAULT 0,
        full_read_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (session_id, file_path, start_line, end_line)
      );

      CREATE INDEX IF NOT EXISTS idx_file_snapshots_session_path ON file_snapshots(session_id, file_path);

      CREATE TABLE IF NOT EXISTS repo_cache (
        workspace_dir TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_ts INTEGER NOT NULL,
        PRIMARY KEY (workspace_dir, head_sha, kind)
      );

      CREATE TABLE IF NOT EXISTS ghost_interceptions (
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        cutoff_bytes INTEGER NOT NULL DEFAULT 46080,
        blocked_ts INTEGER NOT NULL,
        recall_reads INTEGER NOT NULL DEFAULT 0,
        recall_bytes INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (session_id, file_path)
      );

      CREATE INDEX IF NOT EXISTS idx_ghost_session ON ghost_interceptions(session_id);

      CREATE TABLE IF NOT EXISTS session_checkpoints (
        session_id TEXT PRIMARY KEY,
        worktree TEXT NOT NULL DEFAULT '',
        modified_files_json TEXT NOT NULL DEFAULT '[]',
        last_test_json TEXT,
        last_build_json TEXT,
        updated_ts INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_updated ON session_checkpoints(updated_ts);

      CREATE TABLE IF NOT EXISTS outline_cache (
        file_path TEXT PRIMARY KEY,
        mtime_ms REAL NOT NULL,
        file_size INTEGER NOT NULL,
        line_count INTEGER NOT NULL,
        symbols_json TEXT NOT NULL,
        updated_ts INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outline_cache_updated ON outline_cache(updated_ts);
    `);

      // Idempotent schema upgrade: ensure sources.content_hash exists on legacy v2/v3 databases
      const sourceCols = this.db.prepare("PRAGMA table_info(sources)").all();
      if (!sourceCols.some((c) => c.name === "content_hash")) {
        try {
          this.db.exec("ALTER TABLE sources ADD COLUMN content_hash TEXT;");
        } catch (err) {
          if (!/duplicate column name/i.test(String(err?.message || ""))) throw err;
        }
      }
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_sources_session_hash ON sources(session_id, content_hash);");

      // Idempotent schema upgrade: ensure file_reads tracks ctime_ms & ino to catch atomic replace / preserved-mtime edits
      const readCols = this.db.prepare("PRAGMA table_info(file_reads)").all();
      for (const colDef of [
        { name: "ctime_ms", sql: "ALTER TABLE file_reads ADD COLUMN ctime_ms REAL;" },
        { name: "ino", sql: "ALTER TABLE file_reads ADD COLUMN ino TEXT;" },
        { name: "read_step", sql: "ALTER TABLE file_reads ADD COLUMN read_step INTEGER;" }
      ]) {
        if (!readCols.some((c) => c.name === colDef.name)) {
          try {
            this.db.exec(colDef.sql);
          } catch (err) {
            if (!/duplicate column name/i.test(String(err?.message || ""))) throw err;
          }
        }
      }

      // Idempotent schema upgrade: ensure file_snapshots tracks full_read_ts, full_read_seq & ino
      const snapCols = this.db.prepare("PRAGMA table_info(file_snapshots)").all();
      for (const colDef of [
        { name: "full_read_ts", sql: "ALTER TABLE file_snapshots ADD COLUMN full_read_ts INTEGER NOT NULL DEFAULT 0;" },
        { name: "full_read_seq", sql: "ALTER TABLE file_snapshots ADD COLUMN full_read_seq INTEGER NOT NULL DEFAULT 0;" },
        { name: "ino", sql: "ALTER TABLE file_snapshots ADD COLUMN ino TEXT;" }
      ]) {
        if (!snapCols.some((c) => c.name === colDef.name)) {
          try {
            this.db.exec(colDef.sql);
          } catch (err) {
            if (!/duplicate column name/i.test(String(err?.message || ""))) throw err;
          }
        }
      }
    });

    // Virtual FTS5 tables & schema_version (wrapped in busy-retry for concurrent cold starts)
    this._withBusyRetry(() => {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
          source_id UNINDEXED,
          session_id UNINDEXED,
          worktree UNINDEXED,
          agent UNINDEXED,
          ord UNINDEXED,
          body,
          title,
          tokenize = 'porter unicode61 remove_diacritics 2'
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_tri USING fts5(
          source_id UNINDEXED,
          session_id UNINDEXED,
          ord UNINDEXED,
          body,
          tokenize = 'trigram'
        );
      `);

      const versionRow = this.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
      if (!versionRow) {
        this.db
          .prepare("INSERT INTO meta(key, value) VALUES ('schema_version', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .run();
      } else if (versionRow.value !== "3") {
        this.db.prepare("UPDATE meta SET value = '3' WHERE key = 'schema_version'").run();
      }
    });
  }
}

import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import {
  Artifact,
  IngestJob,
  NormalizedBundle,
  ProjectRecord,
  RawEventRef,
  RunReplay,
  SessionRecord,
  TimelineEvent,
  TurnRecord
} from "../core/types";
import { buildProjectTimeline } from "../core/timeline";
import { buildReplayNodes } from "../core/replay";
import { resolveDatabasePath } from "./paths";

const SCHEMA_VERSION = 1;

export class SuperViewDatabase {
  private db: Database.Database;

  constructor(databasePath = resolveDatabasePath()) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        version INTEGER PRIMARY KEY,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cwd TEXT NOT NULL,
        repo_root TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        cwd TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        cli_version TEXT,
        model_provider TEXT,
        source TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        cwd TEXT,
        model TEXT,
        approval_policy TEXT,
        sandbox_policy TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS raw_event_refs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        line_no INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        redacted_payload_json TEXT NOT NULL,
        source_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        turn_id TEXT,
        timestamp TEXT NOT NULL,
        kind TEXT NOT NULL,
        lane TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        tool_name TEXT,
        call_id TEXT,
        status TEXT NOT NULL,
        files_json TEXT NOT NULL,
        raw_event_ref_id TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT,
        excerpt TEXT NOT NULL,
        sha256 TEXT,
        FOREIGN KEY(event_id) REFERENCES events(id)
      );

      CREATE TABLE IF NOT EXISTS ingest_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        total_files INTEGER NOT NULL,
        processed_files INTEGER NOT NULL,
        total_events INTEGER NOT NULL,
        errors_json TEXT NOT NULL
      );
    `);

    this.db.prepare("INSERT OR REPLACE INTO schema_meta(version, updated_at) VALUES (?, ?)").run(SCHEMA_VERSION, new Date().toISOString());
  }

  upsertBundle(bundle: NormalizedBundle) {
    const tx = this.db.transaction(() => {
      this.upsertProject(bundle.project);
      this.upsertSession(bundle.session);
      for (const turn of bundle.turns) this.upsertTurn(turn);
      for (const raw of bundle.rawEventRefs) this.upsertRawEvent(raw);
      for (const event of bundle.events) this.upsertEvent(event);
      for (const artifact of bundle.artifacts) this.upsertArtifact(artifact);
    });
    tx();
  }

  upsertProject(project: ProjectRecord) {
    this.db
      .prepare(
        `INSERT INTO projects(id, name, cwd, repo_root, created_at, updated_at)
         VALUES (@id, @name, @cwd, @repoRoot, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           cwd=excluded.cwd,
           repo_root=excluded.repo_root,
           updated_at=excluded.updated_at`
      )
      .run(project);
  }

  upsertSession(session: SessionRecord) {
    this.db
      .prepare(
        `INSERT INTO sessions(id, project_id, path, cwd, started_at, ended_at, cli_version, model_provider, source)
         VALUES (@id, @projectId, @path, @cwd, @startedAt, @endedAt, @cliVersion, @modelProvider, @source)
         ON CONFLICT(id) DO UPDATE SET
           project_id=excluded.project_id,
           path=excluded.path,
           cwd=excluded.cwd,
           ended_at=excluded.ended_at,
           cli_version=excluded.cli_version,
           model_provider=excluded.model_provider,
           source=excluded.source`
      )
      .run(session);
  }

  upsertTurn(turn: TurnRecord) {
    this.db
      .prepare(
        `INSERT INTO turns(id, session_id, started_at, ended_at, cwd, model, approval_policy, sandbox_policy)
         VALUES (@id, @sessionId, @startedAt, @endedAt, @cwd, @model, @approvalPolicy, @sandboxPolicy)
         ON CONFLICT(id) DO UPDATE SET
           ended_at=excluded.ended_at,
           cwd=excluded.cwd,
           model=excluded.model,
           approval_policy=excluded.approval_policy,
           sandbox_policy=excluded.sandbox_policy`
      )
      .run(turn);
  }

  upsertRawEvent(raw: RawEventRef) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO raw_event_refs(id, session_id, line_no, timestamp, type, redacted_payload_json, source_path, sha256)
         VALUES (@id, @sessionId, @lineNo, @timestamp, @type, @redactedPayloadJson, @sourcePath, @sha256)`
      )
      .run(raw);
  }

  upsertEvent(event: TimelineEvent) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO events(id, project_id, session_id, turn_id, timestamp, kind, lane, title, detail, tool_name, call_id, status, files_json, raw_event_ref_id)
         VALUES (@id, @projectId, @sessionId, @turnId, @timestamp, @kind, @lane, @title, @detail, @toolName, @callId, @status, @filesJson, @rawEventRefId)`
      )
      .run({ ...event, filesJson: JSON.stringify(event.files) });
  }

  upsertArtifact(artifact: Artifact) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO artifacts(id, event_id, type, path, excerpt, sha256)
         VALUES (@id, @eventId, @type, @path, @excerpt, @sha256)`
      )
      .run(artifact);
  }

  upsertJob(job: IngestJob) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO ingest_jobs(id, status, started_at, finished_at, total_files, processed_files, total_events, errors_json)
         VALUES (@id, @status, @startedAt, @finishedAt, @totalFiles, @processedFiles, @totalEvents, @errorsJson)`
      )
      .run({ ...job, errorsJson: JSON.stringify(job.errors) });
  }

  listProjects(): ProjectRecord[] {
    return this.db
      .prepare("SELECT id, name, cwd, repo_root as repoRoot, created_at as createdAt, updated_at as updatedAt FROM projects ORDER BY updated_at DESC")
      .all() as ProjectRecord[];
  }

  getProject(projectId: string): ProjectRecord | null {
    return (
      (this.db
        .prepare("SELECT id, name, cwd, repo_root as repoRoot, created_at as createdAt, updated_at as updatedAt FROM projects WHERE id = ?")
        .get(projectId) as ProjectRecord | undefined) ?? null
    );
  }

  listEvents(projectId: string): TimelineEvent[] {
    const rows = this.db
      .prepare(
        `SELECT id, project_id as projectId, session_id as sessionId, turn_id as turnId, timestamp, kind, lane, title, detail,
                tool_name as toolName, call_id as callId, status, files_json as filesJson, raw_event_ref_id as rawEventRefId
         FROM events WHERE project_id = ? ORDER BY timestamp ASC`
      )
      .all(projectId) as Array<Omit<TimelineEvent, "files"> & { filesJson: string }>;
    return rows.map((row) => ({ ...row, files: JSON.parse(row.filesJson) as string[] }));
  }

  getTimeline(projectId: string) {
    const project = this.getProject(projectId);
    if (!project) return null;
    return buildProjectTimeline(project, this.listEvents(projectId));
  }

  listSessions(projectId?: string): SessionRecord[] {
    const sql = `SELECT id, project_id as projectId, path, cwd, started_at as startedAt, ended_at as endedAt,
                        cli_version as cliVersion, model_provider as modelProvider, source
                 FROM sessions ${projectId ? "WHERE project_id = ?" : ""} ORDER BY started_at DESC`;
    return (projectId ? this.db.prepare(sql).all(projectId) : this.db.prepare(sql).all()) as SessionRecord[];
  }

  getSession(sessionId: string): SessionRecord | null {
    return (
      (this.db
        .prepare(
          `SELECT id, project_id as projectId, path, cwd, started_at as startedAt, ended_at as endedAt,
                  cli_version as cliVersion, model_provider as modelProvider, source
           FROM sessions WHERE id = ?`
        )
        .get(sessionId) as SessionRecord | undefined) ?? null
    );
  }

  getRunReplay(sessionId: string): RunReplay | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const events = this.listEvents(session.projectId).filter((event) => event.sessionId === sessionId);
    const artifacts = this.listArtifactsForEvents(events.map((event) => event.id));
    return {
      session,
      events,
      nodes: buildReplayNodes(events),
      artifacts
    };
  }

  listArtifactsForEvents(eventIds: string[]): Artifact[] {
    if (eventIds.length === 0) return [];
    const placeholders = eventIds.map(() => "?").join(",");
    return this.db
      .prepare(`SELECT id, event_id as eventId, type, path, excerpt, sha256 FROM artifacts WHERE event_id IN (${placeholders})`)
      .all(...eventIds) as Artifact[];
  }

  getJob(jobId: string): IngestJob | null {
    const row = this.db
      .prepare(
        `SELECT id, status, started_at as startedAt, finished_at as finishedAt, total_files as totalFiles,
                processed_files as processedFiles, total_events as totalEvents, errors_json as errorsJson
         FROM ingest_jobs WHERE id = ?`
      )
      .get(jobId) as (Omit<IngestJob, "errors"> & { errorsJson: string }) | undefined;
    return row ? { ...row, errors: JSON.parse(row.errorsJson) as string[] } : null;
  }
}

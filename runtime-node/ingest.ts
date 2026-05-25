import { randomUUID } from "node:crypto";
import { parseCodexJsonlFile } from "../core/parser";
import { normalizeCodexLines } from "../core/normalizer";
import { IngestJob } from "../core/types";
import { SuperViewDatabase } from "../storage/database";
import { scanRolloutFiles } from "./scanner";
import { getRepoRoot } from "./git-provider";

export class IngestService {
  private running = new Set<string>();

  constructor(private db: SuperViewDatabase) {}

  start(codexHome?: string) {
    const now = new Date().toISOString();
    const job: IngestJob = {
      id: randomUUID(),
      status: "queued",
      startedAt: now,
      finishedAt: null,
      totalFiles: 0,
      processedFiles: 0,
      totalEvents: 0,
      errors: []
    };
    this.db.upsertJob(job);
    void this.run(job.id, codexHome);
    return job;
  }

  getJob(jobId: string) {
    return this.db.getJob(jobId);
  }

  private async run(jobId: string, codexHome?: string) {
    if (this.running.has(jobId)) return;
    this.running.add(jobId);
    const job = this.db.getJob(jobId);
    if (!job) return;

    try {
      job.status = "running";
      const files = await scanRolloutFiles(codexHome);
      job.totalFiles = files.length;
      this.db.upsertJob(job);

      let projectCount = 0;
      let sessionCount = 0;

      for (const file of files) {
        try {
          const lines = await parseCodexJsonlFile(file);
          const meta = lines.find((line) => line.type === "session_meta");
          const cwd = extractCwd(meta?.payload);
          const repoRoot = cwd ? await getRepoRoot(cwd) : null;
          const bundle = normalizeCodexLines(lines, { repoRoot });
          if (bundle) {
            this.db.upsertBundle(bundle);
            projectCount += 1;
            sessionCount += 1;
            job.totalEvents += bundle.events.length;
          }
        } catch (error) {
          job.errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
        job.processedFiles += 1;
        this.db.upsertJob(job);
      }

      job.status = "completed";
      job.finishedAt = new Date().toISOString();
      this.db.upsertJob(job);
      return { projects: projectCount, sessions: sessionCount, events: job.totalEvents };
    } catch (error) {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.errors.push(error instanceof Error ? error.message : String(error));
      this.db.upsertJob(job);
      return null;
    } finally {
      this.running.delete(jobId);
    }
  }
}

function extractCwd(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "cwd" in payload && typeof payload.cwd === "string") {
    return payload.cwd;
  }
  return null;
}

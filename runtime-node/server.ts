import express from "express";
import { SuperViewDatabase } from "../storage/database";
import { IngestService } from "./ingest";

export function createServer() {
  const db = new SuperViewDatabase();
  const ingest = new IngestService(db);
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/ingest", (req, res) => {
    const job = ingest.start(typeof req.body?.codexHome === "string" ? req.body.codexHome : undefined);
    res.status(202).json({ jobId: job.id });
  });

  app.get("/api/ingest/jobs/:id", (req, res) => {
    const job = ingest.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json(job);
  });

  app.get("/api/projects", (_req, res) => {
    const projects = db.listProjects().map((project) => ({
      ...project,
      sessions: db.listSessions(project.id)
    }));
    res.json({ projects });
  });

  app.get("/api/projects/:id/timeline", (req, res) => {
    const timeline = db.getTimeline(req.params.id);
    if (!timeline) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json(timeline);
  });

  app.get("/api/runs/:id", (req, res) => {
    const replay = db.getRunReplay(req.params.id);
    if (!replay) {
      res.status(404).json({ error: "run not found" });
      return;
    }
    res.json(replay);
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.SUPERVIEW_API_PORT ?? 5174);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`SuperView API listening on http://127.0.0.1:${port}`);
  });
}

import fg from "fast-glob";
import path from "node:path";
import { resolveCodexHome } from "../storage/paths";

export async function scanRolloutFiles(codexHome = resolveCodexHome()): Promise<string[]> {
  const sessionsDir = path.join(codexHome, "sessions");
  return fg("**/rollout-*.jsonl", {
    cwd: sessionsDir,
    absolute: true,
    onlyFiles: true,
    suppressErrors: true
  });
}

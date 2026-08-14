import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("runtime sources contain no filesystem persistence fallback", async () => {
  const [serverSource, databaseSource, errorLogSource] = await Promise.all([
    fs.readFile(path.join(REPO_ROOT, "server.ts"), "utf8"),
    fs.readFile(path.join(REPO_ROOT, "server", "db.ts"), "utf8"),
    fs.readFile(path.join(REPO_ROOT, "server", "errorLog.ts"), "utf8"),
  ]);

  for (const forbidden of [
    "saveBufferToLocalDisk",
    "express.static(uploadsRootDir)",
    "VERTEX_DB_FILE",
    "readFromLocalDisk",
    "saveToLocalDisk",
    "VERTEX_ERROR_LOG_FILE",
    "error-log.jsonl",
  ]) {
    assert(!`${serverSource}\n${databaseSource}\n${errorLogSource}`.includes(forbidden), `forbidden local persistence path found: ${forbidden}`);
  }

  assert(!/fs\.(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rename|renameSync|rm|rmSync)\b/.test(serverSource));
  assert(!/(?:node:fs|from ['"]fs['"])/.test(databaseSource));
  assert(!/(?:node:fs|from ['"]fs['"])/.test(errorLogSource));
});

test("normal runtime refuses to start without Upstash", { timeout: 15_000 }, async () => {
  const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxCli, "server.ts"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERTEX_API_ONLY: "1",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET_NAME: "",
    },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
  const [exitCode] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
  clearTimeout(timeout);

  assert.equal(exitCode, 1);
  assert.match(output, /Upstash Redis is required/);
});

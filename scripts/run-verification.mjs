#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const FINAL_GATES = Object.freeze([
  Object.freeze({ id: "harness", command: "pnpm", args: ["validate:harness"] }),
  Object.freeze({ id: "unit-component", command: "pnpm", args: ["test:unit:run"] }),
  Object.freeze({ id: "typecheck", command: "pnpm", args: ["typecheck"] }),
  Object.freeze({ id: "lint", command: "pnpm", args: ["lint"] }),
  Object.freeze({ id: "build", command: "pnpm", args: ["build"] }),
]);

export const DEFAULT_RESULT_PATH = ".cache/harness/verification-result.json";
export const RESULT_KIND = "HARNESS_VERIFY_RESULT_V1";
const MAX_CAPTURED_OUTPUT = 12_000;

function commandText(gate) {
  return [gate.command, ...gate.args].join(" ");
}

export function requireArgumentFreeInvocation(argv = process.argv.slice(2)) {
  if (argv.length > 0) throw new Error("Usage: pnpm verify");
}

export function buildSpawnInvocation(gate, { platform = process.platform, env = process.env } = {}) {
  if (platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", commandText(gate)],
    };
  }
  return { command: gate.command, args: gate.args };
}

function summarizeOutput(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-4).join(" | ");
}

export async function executeGateProcess(gate, { cwd, stdout, stderr }) {
  return new Promise((resolve, reject) => {
    const invocation = buildSpawnInvocation(gate);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let captured = "";
    const record = (chunk, destination) => {
      const text = chunk.toString();
      destination.write(text);
      captured = `${captured}${text}`.slice(-MAX_CAPTURED_OUTPUT);
    };
    child.stdout.on("data", (chunk) => record(chunk, stdout));
    child.stderr.on("data", (chunk) => record(chunk, stderr));
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      resolve({
        exitCode: Number.isInteger(exitCode) ? exitCode : 1,
        signal: signal ?? null,
        summary: summarizeOutput(captured),
      });
    });
  });
}

export async function runVerification({
  cwd = process.cwd(),
  gates = FINAL_GATES,
  executeGate = executeGateProcess,
  now = () => performance.now(),
  clock = () => new Date().toISOString(),
  stdout = process.stdout,
  stderr = process.stderr,
  resultPath = DEFAULT_RESULT_PATH,
} = {}) {
  const startedAt = clock();
  const aggregateStart = now();
  const results = [];
  let failed = false;

  for (const gate of gates) {
    if (failed) {
      results.push({
        id: gate.id,
        command: commandText(gate),
        status: "skipped",
        exitCode: null,
        durationMs: 0,
        summary: "Skipped after an earlier gate failed.",
      });
      continue;
    }

    stdout.write(`\n[verify] ${commandText(gate)}\n`);
    const gateStart = now();
    let outcome;
    try {
      outcome = await executeGate(gate, { cwd, stdout, stderr });
    } catch (error) {
      outcome = {
        exitCode: 1,
        signal: null,
        summary: `Runner error: ${error.message}`,
      };
    }
    const durationMs = Math.max(0, Math.round(now() - gateStart));
    const status = outcome.exitCode === 0 ? "passed" : "failed";
    results.push({
      id: gate.id,
      command: commandText(gate),
      status,
      exitCode: outcome.exitCode,
      durationMs,
      summary: outcome.summary || `${commandText(gate)} ${status}.`,
      ...(outcome.signal ? { signal: outcome.signal } : {}),
    });
    failed = outcome.exitCode !== 0;
  }

  const result = {
    schemaVersion: 1,
    kind: RESULT_KIND,
    status: failed ? "FAIL" : "PASS",
    startedAt,
    finishedAt: clock(),
    durationMs: Math.max(0, Math.round(now() - aggregateStart)),
    gates: results,
  };
  const absoluteResultPath = path.resolve(cwd, resultPath);
  await mkdir(path.dirname(absoluteResultPath), { recursive: true });
  await writeFile(absoluteResultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  stdout.write(`\n${RESULT_KIND}=${JSON.stringify(result)}\n`);
  return result;
}

async function main() {
  requireArgumentFreeInvocation();
  const result = await runVerification();
  if (result.status !== "PASS") process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`Verification runner failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

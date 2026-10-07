import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FINAL_GATES,
  RESULT_KIND,
  buildSpawnInvocation,
  requireArgumentFreeInvocation,
  runVerification,
} from "./run-verification.mjs";

const quietStream = { write() {} };

function deterministicNow() {
  let value = 0;
  return () => {
    value += 10;
    return value;
  };
}

test("runs every final gate exactly once in order and emits structured PASS evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "verification-runner-"));
  const calls = [];
  try {
    const result = await runVerification({
      cwd: root,
      now: deterministicNow(),
      clock: () => "2026-08-12T00:00:00.000Z",
      stdout: quietStream,
      stderr: quietStream,
      executeGate: async (gate) => {
        calls.push(gate.id);
        return { exitCode: 0, signal: null, summary: `${gate.id} passed` };
      },
    });
    assert.deepEqual(calls, ["harness", "unit-component", "typecheck", "lint", "build"]);
    assert.equal(new Set(calls).size, FINAL_GATES.length);
    assert.equal(result.kind, RESULT_KIND);
    assert.equal(result.status, "PASS");
    assert.ok(result.durationMs > 0);
    assert.ok(result.gates.every((gate) => gate.status === "passed" && gate.exitCode === 0));
    const persisted = JSON.parse(
      await readFile(path.join(root, ".cache", "harness", "verification-result.json"), "utf8"),
    );
    assert.deepEqual(persisted, result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails fast and marks later final gates skipped", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "verification-runner-"));
  const calls = [];
  try {
    const result = await runVerification({
      cwd: root,
      now: deterministicNow(),
      stdout: quietStream,
      stderr: quietStream,
      executeGate: async (gate) => {
        calls.push(gate.id);
        return {
          exitCode: gate.id === "unit-component" ? 2 : 0,
          signal: null,
          summary: `${gate.id} result`,
        };
      },
    });
    assert.deepEqual(calls, ["harness", "unit-component"]);
    assert.equal(result.status, "FAIL");
    assert.equal(result.gates[1].status, "failed");
    assert.ok(result.gates.slice(2).every((gate) => gate.status === "skipped" && gate.exitCode === null));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepts no CLI arguments and rejects workspace-style runner arguments", () => {
  assert.doesNotThrow(() => requireArgumentFreeInvocation([]));
  assert.throws(() => requireArgumentFreeInvocation(["--workspace", "web"]), /Usage: pnpm verify/);
  assert.throws(() => requireArgumentFreeInvocation(["--base", "HEAD"]), /Usage: pnpm verify/);
});

test("uses cmd.exe for pnpm scripts on Windows without enabling shell mode", () => {
  assert.deepEqual(
    buildSpawnInvocation(FINAL_GATES[0], {
      platform: "win32",
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "pnpm validate:harness"],
    },
  );
  assert.deepEqual(buildSpawnInvocation(FINAL_GATES[0], { platform: "linux", env: {} }), {
    command: "pnpm",
    args: ["validate:harness"],
  });
});

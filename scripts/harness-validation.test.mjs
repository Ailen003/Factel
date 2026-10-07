import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  validatePrismaStaticReference,
  validateExternalReferenceIsolation,
  validateRepository,
  validateRetiredLifecycleArtifacts,
  validateRetiredOpenSpecLayout,
  validateRuntimeAdapters,
  validateSkillRegistry,
  validateSingleAppLayout,
  validateVerificationScripts,
} from "./harness-validation.mjs";

const execFileAsync = promisify(execFile);
const VALIDATE_HARNESS_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-harness.mjs");

async function write(root, relativePath, content) {
  const absolute = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

async function withTemporaryRoot(prefix, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function validManifest() {
  return {
    scripts: {
      dev: "next dev",
      build: "next build",
      lint: "eslint .",
      "lint:fast": "eslint . --cache",
      "validate:harness": "node --test scripts/harness-validation.test.mjs scripts/run-verification.test.mjs && node scripts/validate-harness.mjs",
      "test:unit": "vitest",
      "test:unit:run": "vitest run",
      "typecheck:app": "tsc --noEmit --incremental false",
      "typecheck:reference": "tsc --project tsconfig.reference.json --noEmit --incremental false",
      typecheck: "pnpm typecheck:app && pnpm typecheck:reference",
      "typecheck:fast": "tsc --noEmit --incremental",
      "verify:fast": "pnpm test:unit:run && pnpm typecheck:fast && pnpm lint:fast",
      verify: "node scripts/run-verification.mjs",
    },
    dependencies: {},
    devDependencies: { vitest: "^4.1.10" },
  };
}

function validRunnerSource() {
  return `
export const FINAL_GATES = [
  { id: "harness", command: "pnpm", args: ["validate:harness"] },
  { id: "unit-component", command: "pnpm", args: ["test:unit:run"] },
  { id: "typecheck", command: "pnpm", args: ["typecheck"] },
  { id: "lint", command: "pnpm", args: ["lint"] },
  { id: "build", command: "pnpm", args: ["build"] },
];
const RESULT_KIND = "HARNESS_VERIFY_RESULT_V1";
const resultPath = ".cache/harness/verification-result.json";
const result = { durationMs: 1, exitCode: 0, status: "PASS", resultPath };
`;
}

const runtimeAgentDefinitions = [
  ["agent-architect", "medium"],
  ["agent-data", "high"],
  ["agent-requirements-curator", "medium"],
  ["agent-ui", "high"],
  ["agent-verifier", "high"],
];

async function createRuntimeFixture(root) {
  await write(
    root,
    "AGENTS.md",
    [
      "HARNESS_EXECUTOR_V1",
      ".agent/contracts/phase-handoff.md",
      ".agent/skills/spec-driven-development/SKILL.md",
      ".agent/skill-registry.md",
      ".agent/agents/orchestrator.md",
      "docs/requirements/<requirement-kebab>/progress.md",
      "append-only",
      "Do not backfill untouched historical requirements.",
    ].join("\n"),
  );
  await write(
    root,
    ".agent/contracts/phase-handoff.md",
    "HARNESS_EXECUTOR_V1\n`verdict`: `PASS`, `FAIL`, or `not-run`; completed verification is status: success.\n",
  );
  await write(
    root,
    ".agent/skill-registry.md",
    "# Skill Registry\n`.agent/skills/spec-driven-development/SKILL.md`\n`.agent/skills/requirements-curation/SKILL.md`\n",
  );
  await write(
    root,
    ".agent/agents/orchestrator.md",
    "# Orchestrator\ndocs/requirements/<requirement-kebab>/progress.md\nappend-only\nDo not backfill untouched historical requirements.\n",
  );
  await write(
    root,
    ".agent/skills/spec-driven-development/SKILL.md",
    "---\nname: spec-driven-development\ndescription: Root guide.\n---\ndocs/requirements/<requirement-kebab>/progress.md\nappend-only\nDo not backfill untouched historical requirements.\n",
  );
  await write(
    root,
    ".agent/skills/requirements-curation/SKILL.md",
    "---\nname: requirements-curation\ndescription: Curate requirements.\n---\nRead only injected documentation and skill paths.\ndocs/requirements/<requirement-kebab>/progress.md\nappend-only\nDo not backfill untouched historical requirements.\n",
  );
  await write(
    root,
    "docs/requirements/_templates/progress.template.md",
    "Do not backfill untouched historical requirements. Keep history append-only.\n## Current State\n## Iterations\n",
  );
  await write(
    root,
    ".codex/config.toml",
    'project_root_markers = [".git"]\n\n[agents]\nenabled = true\nmax_concurrent_threads_per_session = 4\n',
  );
  for (const [name, reasoning] of runtimeAgentDefinitions) {
    const rolePath = `.agent/agents/${name}.md`;
    await write(root, rolePath, `HARNESS_EXECUTOR_V1\nRead .agent/contracts/phase-handoff.md.\n`);
    await write(
      root,
      `.codex/agents/${name}.toml`,
      `name = "${name}"
description = "Bounded ${name}."
model_reasoning_effort = "${reasoning}"
sandbox_mode = "workspace-write"
developer_instructions = """
HARNESS_EXECUTOR_V1
Read .agent/contracts/phase-handoff.md and ${rolePath}.
${name === "agent-verifier" ? "Return executor status and verification verdict.\n" : ""}
"""
`,
    );
  }
}

async function createPrismaReferenceFixture(root) {
  const files = {
    ".agent/profiles/README.md": "# Stack capability profiles\nassurance profiles\ncomposition\n",
    ".agent/profiles/nextjs-prisma-postgresql.md": "Capability ID: `prisma-postgresql`\ncurrent official Prisma\nservice architecture\ndoes not add dependencies\n",
    ".agent/skills/prisma-orm/SKILL.md": "current official Prisma documentation\nproject-owned persistence boundary\nMiddleware\nEdge runtime\ncanonical service\n",
    ".agent/skills/prisma-orm/references/adoption.md": "current official Prisma documentation\ndoes not provide\nproject-owned persistence boundary\n",
    ".agent/skills/prisma-orm/references/service-patterns.md": "@/lib/persistence/prisma\ncurrent-actor\nauthorization policy\n$transaction\n",
    ".agent/reference/widget/README.md": "Prisma\nboundary\nservice-patterns.md\n",
    ".agent/reference/widget/lib/services/widget.prisma.services.ts.example": 'import "server-only";\nimport prisma from "@/lib/persistence/prisma";\nimport { requireCurrentActor } from "@/lib/auth/current-actor";\nservice-patterns.md\nupdatedById: actor.id\nprisma.$transaction(async (tx) => {});\nprisma.$transaction(async (tx) => {});\n',
  };
  for (const [relativePath, content] of Object.entries(files)) await write(root, relativePath, content);
}

async function createValidRepositoryFixture(root) {
  await write(root, "package.json", `${JSON.stringify(validManifest(), null, 2)}\n`);
  await write(root, "scripts/run-verification.mjs", validRunnerSource());
  await write(root, "vitest.config.mts", 'exclude: ["reference-projects/**"]\n');
  await write(root, "tsconfig.json", '{ "exclude": ["reference-projects/**"] }\n');
  await write(root, "eslint.config.mjs", "ignores: ['reference-projects/**']\n");
  await write(root, "openspec/changes/archive/2026-01-01-legacy/notes.md", "Historical record.\n");
  await createRuntimeFixture(root);
  await createPrismaReferenceFixture(root);
}

test("allows archive-only OpenSpec history", async () => {
  await withTemporaryRoot("harness-openspec-archive-", async (root) => {
    await write(root, "openspec/changes/archive/2026-01-01-legacy/notes.md", "Historical record.\n");
    assert.deepEqual(await validateRetiredOpenSpecLayout(root), []);
  });
});

test("rejects active OpenSpec config, specs, and non-archive change directories", async () => {
  await withTemporaryRoot("harness-openspec-active-", async (root) => {
    await write(root, "openspec/config.yaml", "schema: legacy\n");
    await write(root, "openspec/specs/example/spec.md", "# active\n");
    await write(root, "openspec/changes/example-change/tasks.md", "# active\n");
    await write(root, "openspec/changes/archive/2026-01-01-legacy/notes.md", "Historical record.\n");
    const errors = await validateRetiredOpenSpecLayout(root);
    assert.ok(errors.some((error) => error.includes("openspec/config.yaml")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("openspec/specs")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("example-change is stale")), errors.join("\n"));
    assert.ok(!errors.some((error) => error.includes("2026-01-01-legacy")), errors.join("\n"));
  });
});

test("rejects retired lifecycle artifacts and monorepo layout files", async () => {
  await withTemporaryRoot("harness-layout-", async (root) => {
    await write(root, ".agent/skills/implementation-progress/SKILL.md", "legacy\n");
    await write(root, ".codex/skills/openspec-apply-change/SKILL.md", "legacy\n");
    await write(root, ".agent/workspaces.yaml", "schemaVersion: 1\n");
    await write(root, "pnpm-workspace.yaml", "packages: []\n");
    const lifecycleErrors = await validateRetiredLifecycleArtifacts(root);
    const layoutErrors = await validateSingleAppLayout(root);
    assert.ok(lifecycleErrors.some((error) => error.includes("implementation-progress")), lifecycleErrors.join("\n"));
    assert.ok(lifecycleErrors.some((error) => error.includes("openspec-apply-change")), lifecycleErrors.join("\n"));
    assert.ok(layoutErrors.some((error) => error.includes(".agent/workspaces.yaml")), layoutErrors.join("\n"));
    assert.ok(layoutErrors.some((error) => error.includes("pnpm-workspace.yaml")), layoutErrors.join("\n"));
  });
});

test("requires root quality tools to exclude ignored reference projects", async () => {
  await withTemporaryRoot("harness-external-reference-isolation-", async (root) => {
    await write(root, "vitest.config.mts", 'exclude: ["reference-projects/**"]\n');
    await write(root, "tsconfig.json", '{ "exclude": [] }\n');
    await write(root, "eslint.config.mjs", "ignores: []\n");
    const errors = await validateExternalReferenceIsolation(root);
    assert.equal(errors.length, 2, errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("tsconfig.json")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("eslint.config.mjs")), errors.join("\n"));
  });
});

test("allows empty directories left behind after retired artifact files are removed", async () => {
  await withTemporaryRoot("harness-empty-retired-directories-", async (root) => {
    await mkdir(path.join(root, "openspec", "specs", "legacy-capability"), { recursive: true });
    await mkdir(path.join(root, ".agent", "skills", "implementation-progress"), { recursive: true });
    await mkdir(path.join(root, ".codex", "skills", "openspec-apply-change"), { recursive: true });
    assert.deepEqual(await validateRetiredOpenSpecLayout(root), []);
    assert.deepEqual(await validateRetiredLifecycleArtifacts(root), []);
  });
});

test("accepts the single-app verification command contract", () => {
  assert.deepEqual(validateVerificationScripts(validManifest(), validRunnerSource()), []);
});

test("allows optional browser-test dependencies in an adopted project", () => {
  const manifest = validManifest();
  manifest.devDependencies["@playwright/test"] = "latest";
  manifest.devDependencies.cypress = "latest";
  manifest.scripts["test:e2e"] = "playwright test";
  const runner = validRunnerSource().replace(
    '  { id: "build", command: "pnpm", args: ["build"] },',
    '  { id: "e2e", command: "pnpm", args: ["test:e2e"] },\n  { id: "build", command: "pnpm", args: ["build"] },',
  );
  assert.deepEqual(validateVerificationScripts(manifest, runner), []);
});

test("rejects retired and monorepo verification interfaces", () => {
  const manifest = validManifest();
  manifest.scripts["validate:specs"] = "openspec validate --all";
  manifest.scripts["verify:app"] = "pnpm build";
  manifest.scripts.lint = "eslint . --cache";
  manifest.workspaces = ["apps/*"];
  manifest.devDependencies["@fission-ai/openspec"] = "latest";
  const source = validRunnerSource().replace("validate:harness", "validate:specs");
  const errors = validateVerificationScripts(manifest, source);
  assert.ok(errors.some((error) => error.includes("validate:specs is retired")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("verify:app")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("final lint must not use cache")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("workspaces are not part")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("OpenSpec is retired and must not be a dependency")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("required final gates must each appear exactly once")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("must not invoke retired validate:specs")), errors.join("\n"));
});

test("accepts coherent root, executor, and Codex adapter definitions", async () => {
  await withTemporaryRoot("harness-runtime-", async (root) => {
    await createRuntimeFixture(root);
    assert.deepEqual(await validateRuntimeAdapters(root), []);
  });
});

test("rejects a misordered root bootstrap and missing adapter registration", async () => {
  await withTemporaryRoot("harness-runtime-invalid-", async (root) => {
    await createRuntimeFixture(root);
    await write(
      root,
      "AGENTS.md",
      "HARNESS_EXECUTOR_V1\n.agent/contracts/phase-handoff.md\n.agent/agents/orchestrator.md\n.agent/skill-registry.md\n.agent/skills/spec-driven-development/SKILL.md\n",
    );
    await write(root, ".agent/contracts/phase-handoff.md", "HARNESS_EXECUTOR_V1\n");
    await write(root, ".codex/config.toml", "[agents]\nenabled = true\nmax_concurrent_threads_per_session = 4\n");
    await rm(path.join(root, ".codex", "agents", "agent-ui.toml"));
    const errors = await validateRuntimeAdapters(root);
    assert.ok(errors.some((error) => error.includes("root bootstrap must load")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("progress ownership")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("status/verdict contract")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("project_root_markers")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("agent-ui.toml") && error.includes("file is missing")), errors.join("\n"));
  });
});

test("rejects a requirement progress template without lazy append-only history", async () => {
  await withTemporaryRoot("harness-progress-invalid-", async (root) => {
    await createRuntimeFixture(root);
    await write(root, "docs/requirements/_templates/progress.template.md", "# Progress\n");
    const errors = await validateRuntimeAdapters(root);
    for (const token of ["Current State", "Iterations", "append-only", "backfill"]) {
      assert.ok(errors.some((error) => error.includes("progress-history token") && error.includes(token)), errors.join("\n"));
    }
  });
});

test("rejects missing registered skills and executor-side skill re-resolution", async () => {
  await withTemporaryRoot("harness-skills-invalid-", async (root) => {
    await write(
      root,
      ".agent/skill-registry.md",
      "`.agent/skills/requirements-curation/SKILL.md`\n`.agent/skills/missing/SKILL.md`\n",
    );
    await write(
      root,
      ".agent/skills/requirements-curation/SKILL.md",
      "Read .agent/skill-registry.md and .agent/skills/*/SKILL.md.\n",
    );
    const errors = await validateSkillRegistry(root);
    assert.ok(errors.some((error) => error.includes("executor skills must not re-resolve")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("missing/SKILL.md") && error.includes("file is missing")), errors.join("\n"));
  });
});

test("accepts the full harness after optional Prisma capability adoption", async () => {
  await withTemporaryRoot("harness-prisma-", async (root) => {
    await createValidRepositoryFixture(root);
    const manifest = validManifest();
    manifest.dependencies.prisma = "^7.0.0";
    manifest.dependencies["@prisma/client"] = "^7.0.0";
    manifest.scripts["db:migrate"] = "prisma migrate dev";
    await write(root, "package.json", `${JSON.stringify(manifest, null, 2)}\n`);
    assert.deepEqual(await validateRepository(root), []);
  });
});

test("rejects Prisma setup mirrors, generated paths, and erased auth placeholders", async () => {
  await withTemporaryRoot("harness-prisma-invalid-", async (root) => {
    await createPrismaReferenceFixture(root);
    await write(root, ".agent/reference/prisma-postgresql/schema.prisma.example", "generator client {}\n");
    await write(
      root,
      ".agent/reference/widget/lib/services/widget.prisma.services.ts.example",
      'import "@/lib/generated/prisma/client";\ndeclare function resolveCurrentActorId(): Promise<string>;\n',
    );
    const errors = await validatePrismaStaticReference(root);
    assert.ok(errors.some((error) => error.includes("local Prisma setup mirror must be absent")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("generated-client output paths are prohibited")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("erased resolveCurrentActorId declaration")), errors.join("\n"));
  });
});

test("validates an archive-only single-app repository end to end", async () => {
  await withTemporaryRoot("harness-repository-", async (root) => {
    await createValidRepositoryFixture(root);
    assert.deepEqual(await validateRepository(root), []);
  });
});

test("validate-harness rejects retired lifecycle arguments", async () => {
  await withTemporaryRoot("harness-cli-", async (root) => {
    await assert.rejects(
      () => execFileAsync(process.execPath, [VALIDATE_HARNESS_SCRIPT, "--snapshot", "legacy-change"], { cwd: root }),
      /Usage: pnpm validate:harness/,
    );
  });
});

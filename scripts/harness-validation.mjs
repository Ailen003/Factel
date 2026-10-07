import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const FINAL_GATE_COMMANDS = Object.freeze([
  "pnpm validate:harness",
  "pnpm test:unit:run",
  "pnpm typecheck",
  "pnpm lint",
  "pnpm build",
]);

export const FINAL_GATE_IDS = Object.freeze(["harness", "unit-component", "typecheck", "lint", "build"]);

const VERIFY_HARNESS_SCRIPT =
  "node --test scripts/harness-validation.test.mjs scripts/run-verification.test.mjs && node scripts/validate-harness.mjs";
const RETIRED_OPENSPEC_CONFIGS = [
  "openspec/config.yaml",
  "openspec/config.yml",
  "openspec/config.json",
  "openspec/config.toml",
];
const RETIRED_LIFECYCLE_ARTIFACTS = [
  ".agent/skills/implementation-progress",
  ".agent/runtime-adapters/portable-contract.md",
  ".codex/skills/openspec-propose",
  ".codex/skills/openspec-apply-change",
  ".codex/skills/openspec-update-change",
  ".codex/skills/openspec-explore",
  ".codex/skills/openspec-sync-specs",
  ".codex/skills/openspec-archive-change",
];
const SINGLE_APP_FORBIDDEN_ARTIFACTS = [".agent/workspaces.yaml", "pnpm-workspace.yaml"];
const EXTERNAL_REFERENCE_EXCLUSIONS = [
  "vitest.config.mts",
  "tsconfig.json",
  "eslint.config.mjs",
];
const EXECUTOR_MARKER = "HARNESS_EXECUTOR_V1";
const REQUIREMENT_PROGRESS_PATH = "docs/requirements/<requirement-kebab>/progress.md";
const REQUIREMENT_PROGRESS_TEMPLATE = "docs/requirements/_templates/progress.template.md";
const REQUIREMENT_PROGRESS_POLICY_TOKENS = ["append-only", "backfill"];
const CODEX_AGENT_DEFINITIONS = [
  {
    path: ".codex/agents/agent-architect.toml",
    name: "agent-architect",
    rolePath: ".agent/agents/agent-architect.md",
    reasoning: "medium",
  },
  {
    path: ".codex/agents/agent-data.toml",
    name: "agent-data",
    rolePath: ".agent/agents/agent-data.md",
    reasoning: "high",
  },
  {
    path: ".codex/agents/agent-requirements-curator.toml",
    name: "agent-requirements-curator",
    rolePath: ".agent/agents/agent-requirements-curator.md",
    reasoning: "medium",
  },
  {
    path: ".codex/agents/agent-ui.toml",
    name: "agent-ui",
    rolePath: ".agent/agents/agent-ui.md",
    reasoning: "high",
  },
  {
    path: ".codex/agents/agent-verifier.toml",
    name: "agent-verifier",
    rolePath: ".agent/agents/agent-verifier.md",
    reasoning: "high",
  },
];
const PRISMA_SERVICE_REFERENCE_FILES = [
  ".agent/profiles/README.md",
  ".agent/profiles/nextjs-prisma-postgresql.md",
  ".agent/skills/prisma-orm/SKILL.md",
  ".agent/skills/prisma-orm/references/adoption.md",
  ".agent/skills/prisma-orm/references/service-patterns.md",
  ".agent/reference/widget/README.md",
  ".agent/reference/widget/lib/services/widget.prisma.services.ts.example",
];

function normalizeRelativePath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function absolutePath(root, relativePath) {
  return path.join(root, ...normalizeRelativePath(relativePath).split("/"));
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function pathHasContent(filePath) {
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isDirectory()) return true;
    for (const entry of await readdir(filePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || (await pathHasContent(path.join(filePath, entry.name)))) return true;
    }
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRequired(root, relativePath, errors) {
  try {
    return await readFile(absolutePath(root, relativePath), "utf8");
  } catch (error) {
    errors.push(`${relativePath}: ${error?.code === "ENOENT" ? "file is missing" : error.message}.`);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasTomlString(content, field, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${field}\\s*=\\s*["']${escapedValue}["']\\s*$`, "m").test(content);
}

export async function validateRetiredOpenSpecLayout(root) {
  const errors = [];
  for (const relativePath of RETIRED_OPENSPEC_CONFIGS) {
    if (await pathExists(absolutePath(root, relativePath))) {
      errors.push(`OpenSpec is retired; remove ${relativePath}.`);
    }
  }

  if (await pathHasContent(absolutePath(root, "openspec/specs"))) {
    errors.push("OpenSpec is retired; remove openspec/specs.");
  }

  const changesRoot = absolutePath(root, "openspec/changes");
  if (!(await pathExists(changesRoot))) return errors;

  const changesStats = await stat(changesRoot);
  if (!changesStats.isDirectory()) {
    errors.push("openspec/changes must be absent or contain archive-only history.");
    return errors;
  }

  for (const entry of await readdir(changesRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "archive") {
      errors.push(`openspec/changes/${entry.name} is stale; the harness no longer tracks active OpenSpec changes.`);
    }
    if (entry.name === "archive" && !entry.isDirectory()) {
      errors.push("openspec/changes/archive must be a directory when present.");
    }
  }
  return errors;
}

export async function validateSingleAppLayout(root) {
  const errors = [];
  for (const relativePath of SINGLE_APP_FORBIDDEN_ARTIFACTS) {
    if (await pathExists(absolutePath(root, relativePath))) {
      errors.push(`This single-app harness must not define ${relativePath}.`);
    }
  }
  return errors;
}

export async function validateExternalReferenceIsolation(root) {
  const errors = [];
  for (const relativePath of EXTERNAL_REFERENCE_EXCLUSIONS) {
    const content = await readRequired(root, relativePath, errors);
    if (content !== null && !content.includes("reference-projects/**")) {
      errors.push(`${relativePath}: must exclude reference-projects/** from root quality tooling.`);
    }
  }
  return errors;
}

export async function validateRetiredLifecycleArtifacts(root) {
  const errors = [];
  for (const relativePath of RETIRED_LIFECYCLE_ARTIFACTS) {
    if (await pathHasContent(absolutePath(root, relativePath))) {
      errors.push(`Retired lifecycle artifact remains active: ${relativePath}.`);
    }
  }
  return errors;
}

export function validateVerificationScripts(manifest, runnerSource = "") {
  const errors = [];
  const scripts = manifest?.scripts;
  if (!isObject(scripts)) {
    return ["package.json: scripts must be an object."];
  }

  if (scripts["validate:harness"] !== VERIFY_HARNESS_SCRIPT) {
    errors.push("package.json: validate:harness must run both Node harness tests and node scripts/validate-harness.mjs.");
  }
  if (Object.hasOwn(scripts, "validate:specs")) {
    errors.push("package.json: validate:specs is retired; use validate:harness.");
  }
  if (Object.hasOwn(scripts, "verify:app")) {
    errors.push("package.json: verify:app is a monorepo overlay command and is not supported here.");
  }
  if (scripts.verify !== "node scripts/run-verification.mjs") {
    errors.push("package.json: verify must invoke only node scripts/run-verification.mjs.");
  }

  for (const scriptName of [
    "test:unit",
    "test:unit:run",
    "typecheck:fast",
    "typecheck:app",
    "typecheck:reference",
    "typecheck",
    "lint:fast",
    "lint",
    "build",
    "verify:fast",
  ]) {
    if (typeof scripts[scriptName] !== "string") errors.push(`package.json: missing required script ${scriptName}.`);
  }

  const fast = scripts["verify:fast"];
  if (typeof fast === "string") {
    for (const fragment of ["test:unit:run", "typecheck:fast", "lint:fast"]) {
      if (!fast.includes(fragment)) errors.push(`package.json: verify:fast must include ${fragment}.`);
    }
  }
  if (typeof scripts.typecheck === "string") {
    for (const fragment of ["typecheck:app", "typecheck:reference"]) {
      if (!scripts.typecheck.includes(fragment)) errors.push(`package.json: typecheck must include ${fragment}.`);
    }
  }
  for (const scriptName of ["typecheck:app", "typecheck:reference"]) {
    if (typeof scripts[scriptName] === "string" && !/--incremental\s+false/.test(scripts[scriptName])) {
      errors.push(`package.json: final ${scriptName} must be non-incremental.`);
    }
  }
  if (typeof scripts.lint === "string" && /(?:^|\s)--cache(?:=|\s|$)/.test(scripts.lint)) {
    errors.push("package.json: final lint must not use cache.");
  }

  for (const [scriptName, value] of Object.entries(scripts)) {
    if (typeof value !== "string") {
      errors.push(`package.json: script ${scriptName} must be a string.`);
      continue;
    }
    if (/\bopenspec\b/i.test(value)) {
      errors.push(`package.json: script ${scriptName} must not invoke retired OpenSpec tooling.`);
    }
    if (/(?:^|\s)--(?:workspace|workspaces|base)(?:=|\s|$)/.test(value)) {
      errors.push(`package.json: script ${scriptName} must not use monorepo verification arguments.`);
    }
  }

  if (Object.hasOwn(manifest, "workspaces")) {
    errors.push("package.json: workspaces are not part of this single-app harness.");
  }
  const dependencies = { ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) };
  for (const dependencyName of Object.keys(dependencies)) {
    if (dependencyName.toLowerCase().includes("openspec")) {
      errors.push("package.json: OpenSpec is retired and must not be a dependency.");
    }
  }

  if (typeof runnerSource !== "string" || runnerSource.length === 0) {
    errors.push("scripts/run-verification.mjs: file is missing or empty.");
    return errors;
  }
  const gates = [...runnerSource.matchAll(/id:\s*"([^"]+)"[\s\S]*?command:\s*"pnpm"[\s\S]*?args:\s*\["([^"]+)"\]/g)].map(
    (match) => ({ id: match[1], command: `pnpm ${match[2]}` }),
  );
  const requiredGates = FINAL_GATE_IDS.map((id, index) => ({ id, command: FINAL_GATE_COMMANDS[index] }));
  const requiredPositions = requiredGates.map((requiredGate) =>
    gates.findIndex((gate) => gate.id === requiredGate.id && gate.command === requiredGate.command),
  );
  const hasExactRequiredGates = requiredGates.every(
    (requiredGate) =>
      gates.filter((gate) => gate.id === requiredGate.id && gate.command === requiredGate.command).length === 1,
  );
  const hasRequiredOrder = requiredPositions.every(
    (position, index) => position >= 0 && (index === 0 || requiredPositions[index - 1] < position),
  );
  if (!hasExactRequiredGates || !hasRequiredOrder) {
    errors.push("scripts/run-verification.mjs: required final gates must each appear exactly once in order.");
  }
  for (const token of ["HARNESS_VERIFY_RESULT_V1", "durationMs", "exitCode", "status", ".cache/harness/verification-result.json"]) {
    if (!runnerSource.includes(token)) {
      errors.push(`scripts/run-verification.mjs: missing structured result token ${token}.`);
    }
  }
  if (runnerSource.includes("validate:specs")) {
    errors.push("scripts/run-verification.mjs: must not invoke retired validate:specs.");
  }
  if (/args:\s*\["verify"\]/.test(runnerSource)) {
    errors.push("scripts/run-verification.mjs: runner must not recurse through pnpm verify.");
  }
  for (const legacyArgument of ["--workspace", "--workspaces", "--base", "--label"]) {
    if (runnerSource.includes(legacyArgument)) {
      errors.push(`scripts/run-verification.mjs: ${legacyArgument} is not part of the single-app runner interface.`);
    }
  }
  return errors;
}

export async function validateRuntimeAdapters(root) {
  const errors = [];
  const rootInstructions = await readRequired(root, "AGENTS.md", errors);
  if (rootInstructions !== null) {
    const rootTokens = [
      ".agent/skills/spec-driven-development/SKILL.md",
      ".agent/skill-registry.md",
      ".agent/agents/orchestrator.md",
    ];
    for (const token of [EXECUTOR_MARKER, ".agent/contracts/phase-handoff.md", ...rootTokens]) {
      if (!rootInstructions.includes(token)) errors.push(`AGENTS.md: root/executor bootstrap is missing ${token}.`);
    }
    if (!rootInstructions.includes(REQUIREMENT_PROGRESS_PATH)) {
      errors.push(`AGENTS.md: missing product-requirement progress ownership for ${REQUIREMENT_PROGRESS_PATH}.`);
    }
    for (const token of REQUIREMENT_PROGRESS_POLICY_TOKENS) {
      if (!rootInstructions.toLowerCase().includes(token)) {
        errors.push(`AGENTS.md: missing product-requirement progress policy token ${token}.`);
      }
    }
    const indexes = rootTokens.map((token) => rootInstructions.indexOf(token));
    if (indexes.every((index) => index >= 0) && !(indexes[0] < indexes[1] && indexes[1] < indexes[2])) {
      errors.push("AGENTS.md: root bootstrap must load SDD, registry, and orchestrator in that order.");
    }
  }

  const contract = await readRequired(root, ".agent/contracts/phase-handoff.md", errors);
  if (contract !== null) {
    if (!contract.includes(EXECUTOR_MARKER)) {
      errors.push(".agent/contracts/phase-handoff.md: executor handoffs must use HARNESS_EXECUTOR_V1.");
    }
    for (const token of ["`verdict`", "`PASS`", "`FAIL`", "`not-run`", "status: success"]) {
      if (!contract.includes(token)) {
        errors.push(`.agent/contracts/phase-handoff.md: missing status/verdict contract token ${token}.`);
      }
    }
  }
  await readRequired(root, ".agent/skill-registry.md", errors);
  const orchestrator = await readRequired(root, ".agent/agents/orchestrator.md", errors);
  const sdd = await readRequired(root, ".agent/skills/spec-driven-development/SKILL.md", errors);
  const requirementsCuration = await readRequired(root, ".agent/skills/requirements-curation/SKILL.md", errors);
  for (const [relativePath, content] of [
    [".agent/agents/orchestrator.md", orchestrator],
    [".agent/skills/spec-driven-development/SKILL.md", sdd],
    [".agent/skills/requirements-curation/SKILL.md", requirementsCuration],
  ]) {
    if (content !== null && !content.includes(REQUIREMENT_PROGRESS_PATH)) {
      errors.push(`${relativePath}: missing product-requirement progress ownership for ${REQUIREMENT_PROGRESS_PATH}.`);
    }
    for (const token of REQUIREMENT_PROGRESS_POLICY_TOKENS) {
      if (content !== null && !content.toLowerCase().includes(token)) {
        errors.push(`${relativePath}: missing product-requirement progress policy token ${token}.`);
      }
    }
  }
  const progressTemplate = await readRequired(root, REQUIREMENT_PROGRESS_TEMPLATE, errors);
  for (const token of ["## Current State", "## Iterations", ...REQUIREMENT_PROGRESS_POLICY_TOKENS]) {
    if (progressTemplate !== null && !progressTemplate.toLowerCase().includes(token.toLowerCase())) {
      errors.push(`${REQUIREMENT_PROGRESS_TEMPLATE}: missing progress-history token ${token}.`);
    }
  }
  for (const definition of CODEX_AGENT_DEFINITIONS) {
    const roleContent = await readRequired(root, definition.rolePath, errors);
    if (roleContent !== null) {
      for (const token of [EXECUTOR_MARKER, ".agent/contracts/phase-handoff.md"]) {
        if (!roleContent.includes(token)) errors.push(`${definition.rolePath}: executor bootstrap is missing ${token}.`);
      }
    }
  }

  const config = await readRequired(root, ".codex/config.toml", errors);
  if (config !== null) {
    const rootMarkers = config.match(/^\s*project_root_markers\s*=\s*\[([^\]]*)\]\s*$/m)?.[1];
    if (rootMarkers === undefined || !/["']\.git["']/.test(rootMarkers)) {
      errors.push('.codex/config.toml: project_root_markers must include ".git".');
    }
    if (!/^\s*\[agents\]\s*$/m.test(config)) errors.push(".codex/config.toml: missing [agents] table.");
    if (!/^\s*enabled\s*=\s*true\s*$/m.test(config)) errors.push(".codex/config.toml: agents.enabled must be true.");
    if (!/^\s*max_concurrent_threads_per_session\s*=\s*4\s*$/m.test(config)) {
      errors.push(".codex/config.toml: max_concurrent_threads_per_session must be 4.");
    }
  }
  for (const definition of CODEX_AGENT_DEFINITIONS) {
    const content = await readRequired(root, definition.path, errors);
    if (content === null) continue;
    if (!hasTomlString(content, "name", definition.name)) errors.push(`${definition.path}: name must be ${definition.name}.`);
    for (const field of ["description", "developer_instructions"]) {
      if (!new RegExp(`^\\s*${field}\\s*=`, "m").test(content)) errors.push(`${definition.path}: missing required ${field}.`);
    }
    if (!content.includes(EXECUTOR_MARKER)) {
      errors.push(`${definition.path}: developer instructions must include ${EXECUTOR_MARKER}.`);
    }
    if (!content.includes(definition.rolePath)) {
      errors.push(`${definition.path}: must reference portable role ${definition.rolePath}.`);
    }
    if (!hasTomlString(content, "model_reasoning_effort", definition.reasoning)) {
      errors.push(`${definition.path}: model_reasoning_effort must be ${definition.reasoning}.`);
    }
    if (!hasTomlString(content, "sandbox_mode", "workspace-write")) {
      errors.push(`${definition.path}: sandbox_mode must be workspace-write.`);
    }
    if (definition.name === "agent-verifier" && !content.includes("verification verdict")) {
      errors.push(`${definition.path}: verifier instructions must distinguish executor status from verification verdict.`);
    }
  }
  return errors;
}

export async function validateSkillRegistry(root) {
  const errors = [];
  const registryPath = ".agent/skill-registry.md";
  const registry = await readRequired(root, registryPath, errors);
  if (registry === null) return errors;

  const skillPaths = [...registry.matchAll(/`(\.agent\/skills\/[a-z0-9-]+\/SKILL\.md)`/g)].map((match) => match[1]);
  if (skillPaths.length === 0) {
    errors.push(`${registryPath}: must register at least one exact project skill path.`);
    return errors;
  }

  for (const skillPath of new Set(skillPaths)) {
    const skill = await readRequired(root, skillPath, errors);
    if (skill === null || skillPath === ".agent/skills/spec-driven-development/SKILL.md") continue;
    for (const forbiddenToken of [
      ".agent/skill-registry.md",
      ".agent/skills/spec-driven-development/SKILL.md",
      ".agent/skills/*/SKILL.md",
    ]) {
      if (skill.includes(forbiddenToken)) {
        errors.push(`${skillPath}: executor skills must not re-resolve root guidance through ${forbiddenToken}.`);
      }
    }
  }
  return errors;
}

function requireReferenceTokens(errors, relativePath, content, tokens) {
  if (content === null) return;
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${relativePath}: missing required Prisma static-reference token ${token}.`);
  }
}

export async function validatePrismaStaticReference(root) {
  const errors = [];
  const contents = {};
  for (const relativePath of PRISMA_SERVICE_REFERENCE_FILES) {
    contents[relativePath] = await readRequired(root, relativePath, errors);
  }

  if (await pathExists(absolutePath(root, ".agent/reference/prisma-postgresql"))) {
    errors.push(".agent/reference/prisma-postgresql: local Prisma setup mirror must be absent.");
  }
  requireReferenceTokens(errors, ".agent/profiles/README.md", contents[".agent/profiles/README.md"], [
    "Stack capability profiles",
    "assurance profiles",
    "composition",
  ]);
  requireReferenceTokens(errors, ".agent/profiles/nextjs-prisma-postgresql.md", contents[".agent/profiles/nextjs-prisma-postgresql.md"], [
    "Capability ID: `prisma-postgresql`",
    "current official Prisma",
    "service architecture",
    "does not add dependencies",
  ]);
  requireReferenceTokens(errors, ".agent/skills/prisma-orm/SKILL.md", contents[".agent/skills/prisma-orm/SKILL.md"], [
    "current official Prisma documentation",
    "project-owned persistence boundary",
    "Middleware",
    "Edge runtime",
    "canonical service",
  ]);
  requireReferenceTokens(
    errors,
    ".agent/skills/prisma-orm/references/adoption.md",
    contents[".agent/skills/prisma-orm/references/adoption.md"],
    ["current official Prisma documentation", "does not provide", "project-owned persistence boundary"],
  );
  requireReferenceTokens(
    errors,
    ".agent/skills/prisma-orm/references/service-patterns.md",
    contents[".agent/skills/prisma-orm/references/service-patterns.md"],
    ["@/lib/persistence/prisma", "current-actor", "authorization policy", "$transaction"],
  );
  requireReferenceTokens(errors, ".agent/reference/widget/README.md", contents[".agent/reference/widget/README.md"], [
    "Prisma",
    "boundary",
    "service-patterns.md",
  ]);

  const servicePath = ".agent/reference/widget/lib/services/widget.prisma.services.ts.example";
  const service = contents[servicePath];
  requireReferenceTokens(errors, servicePath, service, [
    'import "server-only"',
    'from "@/lib/persistence/prisma"',
    'import { requireCurrentActor } from "@/lib/auth/current-actor"',
    "service-patterns.md",
    "updatedById: actor.id",
  ]);
  if (service !== null) {
    if (service.includes("generated/prisma")) {
      errors.push(`${servicePath}: generated-client output paths are prohibited in the service architecture reference.`);
    }
    if (/\bdeclare\s+function\s+resolveCurrentActorId\b/.test(service)) {
      errors.push(`${servicePath}: erased resolveCurrentActorId declaration is prohibited.`);
    }
    const transactionCallbacks = service.match(/\$transaction\(async\s*\(\s*tx\s*\)\s*=>/g)?.length ?? 0;
    if (transactionCallbacks < 2) {
      errors.push(`${servicePath}: coupled bulk mutations must use transaction callbacks.`);
    }
  }

  return errors;
}

export async function validateRepository(root) {
  const errors = [];
  const manifestContent = await readRequired(root, "package.json", errors);
  const runnerSource = await readRequired(root, "scripts/run-verification.mjs", errors);
  if (manifestContent !== null) {
    try {
      errors.push(...validateVerificationScripts(JSON.parse(manifestContent), runnerSource ?? ""));
    } catch (error) {
      errors.push(`package.json: invalid JSON: ${error.message}.`);
    }
  }
  errors.push(...(await validateRetiredOpenSpecLayout(root)));
  errors.push(...(await validateSingleAppLayout(root)));
  errors.push(...(await validateExternalReferenceIsolation(root)));
  errors.push(...(await validateRetiredLifecycleArtifacts(root)));
  errors.push(...(await validateRuntimeAdapters(root)));
  errors.push(...(await validateSkillRegistry(root)));
  errors.push(...(await validatePrismaStaticReference(root)));
  return [...new Set(errors)];
}

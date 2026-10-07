# Codex Harness Entry Point

This harness is a guide for scoped collaboration. It does not create a
required lifecycle, durable work state, or tool-specific workflow. Native
checklists and planning tools are optional at the assistant's discretion and
are never required, awaited, or stored by this harness.

Choose the applicable bootstrap before acting.

All harness paths are relative to the Git project root. When the current
working directory is nested, resolve that root before loading `.agent/` files.

## Executor

Use this path when the thread is non-root or the assignment begins
`HARNESS_EXECUTOR_V1`.

1. Read `.agent/contracts/phase-handoff.md`.
2. Read the exact `.agent/agents/<role>.md` named in the handoff.
3. Read only its exact `SKILL.md` paths.
4. Complete the bounded work within its allowed roots and exclusive artifacts.
5. Return the structured conversational result. Do not redelegate.

If a safety boundary, writer ownership, or necessary scope is missing, return
`blocked` with the specific gap. Do not reconstruct a broader workflow.

## Root Orchestrator

Only in the root thread without the executor marker, read in this order:

1. `.agent/skills/spec-driven-development/SKILL.md`
2. `.agent/skill-registry.md`
3. `.agent/agents/orchestrator.md`

Those files guide scope, risk, skill routing, execution, and proportional
checks. Resolve only the skills that apply.

For every material iteration that creates, implements, reopens, or changes the
scope of a product requirement, assign one writer to
`docs/requirements/<requirement-kebab>/progress.md`. Create it from the template
if it does not exist, update its current state at the start and after
verification, and append the iteration outcome to its append-only history. Do
not backfill untouched historical requirements or create progress for passive
reading, research without a requirement change, typo-only edits, or unrelated
internal refactors.

For specialized work, send the bounded handoff with the role, scope, allowed
roots, exclusive artifacts, exact skills, constraints, and expected checks.
Use `inline` or a native subagent when useful; neither is a required work plan.
Only one active writer may own an exclusive artifact.

For a high-risk irreversible action, obtain direct user confirmation immediately
before that action. Agents never run `git commit`. A PASS reports the checks
that were observed and leaves any manual commit decision to the user.

---
name: spec-driven-development
description: Guide scoped application work with the smallest useful collaboration and verification steps.
---

# Scoped Development Guide

## Sources of context

- The user's request defines the requested outcome and authority.
- `docs/documentation-inventory.md` routes agents to the applicable maintained
  product and architecture sources under `docs/`, plus lightweight requirement
  history when it applies.
- The codebase provides the current implementation reality.
- `.agent/` provides roles, skills, handoffs, and reference patterns.

Native planning or checklist tools may help an assistant reason, but are
optional. This harness never requires, waits for, or stores them.

Executors use the `HARNESS_EXECUTOR_V1` path and do not load this root skill
unless explicitly assigned.

## Route by scope and risk

| Request | Suggested route |
|---|---|
| Broad product intent | Ask the requirements curator for focused documentation context when useful. |
| Bounded product or technical work | Inspect the affected code and documentation, then implement within the user-approved scope. |
| Internal refactor or documentation work | Use the smallest applicable role and checks. |
| Irreversible or high-risk work | Identify the exact irreversible action and ask for direct user confirmation immediately before it. |

Routine work needs no ceremony beyond clear scope. Standard work benefits from
explicit affected roots, ownership, and focused checks. High-risk work includes
destructive data operations, security or permission changes, irreversible
migrations, external side effects, and multi-boundary changes. When risk is
unclear, explain the uncertainty and choose a safe, reversible path first.

## Collaboration

- Use the phase-handoff contract and only exact registry skills.
- Give each exclusive artifact one active writer. Executors never redelegate.
- Work inline for small or tightly coupled changes; use a subagent for a
  bounded independent investigation, implementation, or check when it adds
  value.
- Before replacing a writer, confirm the prior writer has stopped.
- Architecture advice is optional. An authored note needs exact inputs, a
  desired format, a stopping condition, and exclusive ownership.
- For every material iteration that creates, implements, reopens, or changes a
  product requirement, assign one writer to
  `docs/requirements/<requirement-kebab>/progress.md`. Create it lazily when
  missing, update current state at the start and after verification, and append
  the outcome to its append-only iteration history. Do not backfill untouched
  historical requirements or create progress for passive reading, research
  without a requirement change, typo-only edits, or unrelated internal
  refactors.

## Checks and handoff

Choose checks from affected roots and risk: documentation coherence for
documentation-only work; focused tests for changed behavior; typecheck or lint
for relevant source edits; and a build for route, build, dependency, or
configuration risk. Use a broader project check when it adds confidence, not
because the harness requires a closing ritual.

Return a structured conversational result with changed files, commands and
outcomes, remaining risks, and a useful next step. A PASS means the observed
checks passed and the work is ready for the user's review and possible manual
commit. Agents never run `git commit`.

Reference implementations are lazy inputs under `.agent/reference/widget/`;
feature-writing examples are under `.agent/reference/spec-example/`.

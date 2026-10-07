---
name: verification-harness
description: Select and report risk-proportional checks for bounded work.
---

# Verification Guide

## Select checks by changed scope

Start from the files and behavior actually changed. Use the smallest meaningful
set of checks:

- documentation coherence for documentation-only work;
- focused unit or component tests for deterministic behavior;
- typecheck or lint for relevant source edits;
- a build for route, build, dependency, or configuration risk;
- a broader project check when its added confidence justifies its cost.

For high-risk work, seek independent checking when practical and add checks
that exercise the affected boundary. Do not invent a workflow gate for routine
work.

## Run and report

Run commands after the relevant edits are stable enough for useful feedback.
`pnpm verify`, `pnpm test:unit:run`, `pnpm typecheck`, `pnpm lint`, and `pnpm
build` are available options; choose only those that fit the request and risk.
A verifier reports failures without repairing another writer's implementation.

Return the structured conversational result with each command, exit code,
summary, relevant warnings, and remaining risks. For verification assignments,
executor `status` records whether the bounded task completed and `verdict`
records `PASS`, `FAIL`, or `not-run`; a completed verification can therefore
have `status: success` with `verdict: FAIL`. A PASS means the reported checks
passed for the observed files. It does not create durable evidence or authorize
a commit; the user decides whether and when to commit.

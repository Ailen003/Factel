# Developer Harness Guide

The harness is a small set of guides for doing careful work without turning
every request into a formal process. It preserves useful context, encourages
clear ownership, and keeps verification visible.

## Everyday work loop

1. Read the request and the relevant project context, code, and patterns.
2. Choose a native planning format only if it helps: a tool plan, short notes,
   or direct implementation are all valid.
3. Implement the scoped change. Delegate independently scoped work when that
   improves clarity or speed.
4. Use the existing repository patterns and update durable documentation when
   the product scope changes.
5. Run the smallest relevant checks during development, then the appropriate
   final checks for the risk and scope.
6. Report changed files, checks, outcome, and remaining risks. Do not create a
   git commit.

Planning is a choice of the coding tool or agent. It never blocks work because
a particular planning artifact is absent.

## Delegation and patterns

Delegate a bounded, independently writable area when it is useful. Name the
owner, files or responsibility, expected result, and checks. Avoid concurrent
writes to the same artifact. A delegated agent may use the patterns and skills
it needs, but it should not make a git commit or silently enlarge its scope.

Use the shared references under `.agent/` when they fit the task. They are
guidance, not a substitute for reading the relevant implementation or tests.

## Requirements and documentation

For a new product capability, first consult `docs/documentation-inventory.md`,
then its applicable core material and `docs/requirements/index.md`. For
Conversation Processing Demo, the authoritative sources are
`docs/product-source-of-truth.md` for product intent and
`docs/solution-architecture.md` for technical boundaries. Create or update a
focused brief only when it adds durable product context.

For every material iteration that creates, implements, reopens, or changes a
product requirement, copy `docs/requirements/_templates/progress.template.md`
into that requirement as `progress.md` if it is missing. The root assigns one
writer to the artifact; that owner updates current state at the start and after
verification and appends the outcome to its append-only iteration history. Do
not backfill untouched historical requirements. Passive reading, research
without a requirement change, typo-only edits, and unrelated internal
refactors do not start an iteration.

## Verification

Use the fastest check that can reveal the change while working:

```bash
pnpm verify:fast
```

Run focused unit tests, type checks, lint, or a build when the changed surface
calls for them. For a full final repository check, run:

```bash
pnpm verify
```

`pnpm verify` begins with `pnpm validate:harness`. Do not describe a result as
PASS unless the reported checks passed. PASS means the work is ready for manual
user review and commit; it does not authorize an agent to commit.

## Practical report shape

Keep the handoff short and factual:

- what changed and why;
- checks run and their results;
- any documentation updated;
- known limitations, follow-up work, or checks not run.

This makes work reviewable without requiring a prescribed plan, centralized
record, or closing ritual.

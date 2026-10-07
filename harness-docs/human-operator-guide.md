# Human Operator Guide

The harness is intentionally lightweight. Tell the agent the outcome you want,
the boundaries that matter, and any constraints or risks you already know. The
agent chooses a planning approach appropriate to the task; no fixed planning
format or ceremony is required.

## What to expect

For a scoped change, an agent should make the work easy to review by stating:

- the intended outcome and important constraints;
- any useful delegation or repository pattern it will use;
- the checks it ran and their result;
- files changed, documentation impact, and remaining risks.

For every material iteration that creates, implements, reopens, or changes a
product requirement, the root assigns one writer to a concise `progress.md`.
That owner updates current state at the start and after verification and
appends the result to its append-only history. Existing requirements are not
backfilled until material work touches them. Passive reading, research without
a requirement change, typo-only edits, and unrelated internal refactors do not
start an iteration.

## Planning and delegation

Planning belongs to the coding tool or agent doing the work. It can be a native
tool plan, short notes, or direct implementation, and it never becomes a
blocker merely because a particular artifact does not exist.

Agents can delegate clearly independent work and use the repository's patterns.
They should avoid overlapping file ownership and report the result of any
delegated work. They do not make git commits.

## Checks and readiness

During implementation, quick feedback is available through:

```bash
pnpm verify:fast
```

For a full final repository check, use:

```bash
pnpm verify
```

The final runner begins with `pnpm validate:harness`. The right checks remain
proportionate to the task: a narrowly scoped documentation edit may need less
than a risky behavior or security change.

When the agent reports PASS, it means the reported verification succeeded and
the work is ready for you to review and commit manually. It does not mean a
commit was created, and agents must never run `git commit`.

In a verifier handoff, `status` says whether the verification task completed;
`verdict` says whether the observed checks passed. A completed verifier can
therefore report `status: success` together with `verdict: FAIL`.

## Useful prompts

```text
Implement this within the named files. Use any native planning that helps, run
the relevant checks, and report the result without making a git commit.
```

```text
This is a new product requirement. Review the documentation inventory, update
the brief, create its progress record, and append this iteration's outcome.
```

```text
Please verify the completed work and summarize the checks, remaining risks,
and whether it is ready for my manual commit.
```

# .agent Harness

`.agent` is a portable guide layer for a single application:

`request -> scoped work -> proportional checks -> conversational handoff`

It is deliberately not a work-state system. It never requires a plan, waits
for a plan, or stores a plan. An assistant may use native notes or planning
tools when helpful, but they remain optional and tool-local.

Core sources:

- `AGENTS.md`: root versus `HARNESS_EXECUTOR_V1` bootstrap.
- `skills/spec-driven-development/`: scope, risk, collaboration, and check guidance.
- `skill-registry.md`: lazy exact skill routing.
- `contracts/phase-handoff.md`: portable bounded input and conversational output.
- `agents/`: role boundaries and layer ownership.
- `profiles/`: lazy stack capability compositions; inactive unless selected or evidenced.
- `runtime-adapters/`: native collaboration mappings.
- `reference/`: lazy implementation and requirement-writing examples.

Use routine, standard, or high-risk handling according to the requested work.
Stack capability profiles under `profiles/` remain separate; they compose
optional technologies such as Prisma/PostgreSQL and do not install packages or
activate runtime behavior. Requirement status is lightweight and belongs in
project documentation when documentation work is in scope.

Exclusive writers prevent collisions. Results are returned in conversation with
their scope, changed files, checks, and remaining risks. A successful check
result means the work is ready for the user's review and possible manual
commit; agents never commit on the user's behalf. Requirement progress is
created lazily for material requirement iterations, keeps current state plus an
append-only history, and is never backfilled into untouched historical work.

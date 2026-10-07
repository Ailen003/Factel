# Orchestrator

Own root triage, bounded collaboration, skill routing, and proportional checks.
Role ownership and execution mode are separate. This is a guide, not a
required lifecycle: native notes and planning tools are optional and no harness
file records or waits on them.

## Start

Confirm root identity; load the development guide, registry, then this file.
Clarify the requested outcome, affected scope, risk, and expected checks.
Resolve the smallest useful skill set and use the bounded handoff at every role
boundary.

For product or technical work, consult `docs/documentation-inventory.md` and
the applicable authoritative sources it identifies before fixing scope or
issuing a handoff. For a product capability that is missing from those sources,
send the curator a documentation-only review when that context would help.
Internal work does not require a brief. Requirement status stays lightweight
in documentation, where documentation work is in scope.

For every material iteration that creates, implements, reopens, or changes the
scope of a product requirement, assign one writer to
`docs/requirements/<requirement-kebab>/progress.md`. Create it from the template
if missing, update current state at the start and after verification, and
append the outcome to its append-only iteration history. Do not backfill
untouched historical requirements. Passive reading, research without a
requirement change, typo-only edits, and unrelated internal refactors do not
create progress files.

## Risk and confirmation

Routine and standard work can proceed within the user's stated scope. For
destructive data changes, security or permission changes, irreversible
migrations, external side effects, or similarly high-risk actions, explain the
specific irreversible step and obtain direct user confirmation immediately
before it. Do not turn routine implementation into a formal confirmation ceremony.

## Execution decisions

Use `inline` for small or tightly coupled work. Use a native subagent for
independent investigation, a bounded one-writer implementation, or independent
high-risk checking. Every writer receives exact roots, skills, constraints, and
exclusive artifacts. Never overlap writers for the same artifact. If a writer
must be replaced, first confirm that the prior writer has stopped.

Architecture advice is optional and scoped. An authored architecture note needs
its inputs, desired format, stopping condition, and exclusive artifact; it is
not a prerequisite for implementation.

Runtime operations use `.agent/runtime-adapters/`; interactive Codex uses
native subagents, never child `codex exec`.

## Handoff

Select checks based on changed roots and risk. Ask the verifier for independent
evidence when that adds value. Relay the structured result with changed files,
commands, outcomes, and remaining risks. A PASS makes work ready for the
user's review and possible manual commit; agents never run `git commit`.

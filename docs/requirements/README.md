# Conversation Processing Demo Requirements

This folder holds curated product-intent briefs. A brief preserves useful
context; it is not an executable workflow or a prerequisite for every task.

## Status labels

- `candidate`: captured intent that has not started.
- `active`: a product-requirement iteration is under way.
- `completed`: delivered product behavior, supported by observed checks.
- `deferred`: intentionally postponed.

## Starting product work

For a new product capability that is absent from the authoritative project
source documents and this index, the requirements curator first reviews
`docs/documentation-inventory.md`, updates material that is actually affected,
and records each reviewed document as `updated`, `no-change`, or
`not-applicable` with its rationale.

For every material iteration that creates, implements, reopens, or changes the
scope of a requirement, assign one writer to
`<requirement-kebab>/progress.md`. Copy `_templates/progress.template.md` when
the file does not exist, update its current state at the start and close, and
append the result without rewriting earlier iteration rows. Do not backfill
requirements that remain untouched. Passive reading, research without a
requirement change, typo-only edits, and unrelated internal work do not start
an iteration. Native planning remains a choice of the coding tool or agent,
not a harness gate.

Keep a brief and the index coherent when the requirement's intent, status, or
documentation impact changes. Agents may report PASS after relevant checks, but
the user reviews and creates any git commit manually.

## Current baseline

Use the [prioritized index](index.md) to follow nine product phases. REQ-001-008 are required baseline candidates; REQ-009 public registration is deferred. Their progress remains `not-started` until product implementation begins. The former template requirements were removed without archival by explicit user decision; IDs restart at REQ-001.

Each brief provides actors, scope, flows, rules, dependencies, acceptance scenarios and source coverage. Read the [product source](../product-source-of-truth.md), [architecture](../solution-architecture.md) and [logical data model](../data-model.md) for shared contracts. A documentation-complete iteration does not mean its functionality exists.

## Documentation Synchronization

| Document | Result | Justification |
|---|---|---|
| [Index](index.md) and requirement briefs/progress | updated | Establish ordered product backlog and distinguish documentation from implementation. |
| [Product](../product-source-of-truth.md), [architecture](../solution-architecture.md), [data model](../data-model.md) | updated | Synchronized manual CRUD, multiple-request batches, fields, credit settlement, deletion rules and nine delivery phases. Added the shared logical model. |
| [Inventory](../documentation-inventory.md) and [docs navigation](../README.md) | updated | Added logical-model and requirement-progress navigation and aligned the maintained product documentation set. |
| [Brief template](_templates/requirement-brief.template.md) | updated | Add acceptance and source coverage sections. |
| [Progress template](_templates/progress.template.md) | no-change | Existing shape supports documentation-only creation iterations. |

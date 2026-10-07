---
name: requirements-curation
description: Synchronize bounded project documentation and extract lightweight candidate requirements.
---

# Requirements Curation

## When to use

Use this skill when product knowledge needs to become a clean, lightweight
backlog under `docs/requirements/`. When a new capability is absent from the
authoritative project source documents and the requirements index, synchronize
the applicable project documentation first.

Requirement documentation provides context and traceability; it is not a
workflow gate or a persistent implementation plan.

## Inputs

Read the applicable sources first:

- `docs/documentation-inventory.md` — maintained documentation and review
  scope; read it first to route the review.
- `docs/product-source-of-truth.md` — authoritative product behavior, scope,
  users, permissions, and outcomes.
- `docs/solution-architecture.md` — authoritative technology, service
  boundaries, hosting, communication, operational controls, and deployment
  topology.
- `docs/requirements/index.md` — existing curated requirements and IDs.
- `docs/requirements/_templates/requirement-brief.template.md` — brief shape.
- `docs/requirements/_templates/progress.template.md` — current-state and
  append-only iteration-history shape.

The root handoff supplies every applicable skill as an exact path. Do not read
the root registry, load root guidance, or discover additional skills from this
executor skill.

## Outputs

For each curated requirement, create or update:

- `docs/requirements/<requirement-kebab>/brief.md`
- a row in `docs/requirements/index.md`

For a newly created requirement, also create
`docs/requirements/<requirement-kebab>/progress.md` from the progress template
and record the creation iteration; its current state may remain `not-started`
when product implementation has not begun. For an existing requirement, create
the file lazily when the next material iteration changes it. The assigned owner
updates current state and appends the iteration result to the append-only
history; do not backfill untouched historical requirements.

Each brief should capture:

- stable `REQ-<NNN>` ID, status, and priority;
- source references back to the applicable authoritative project document;
- intent, actors, scope, and out of scope;
- candidate flows, business rules, RNFs, and constraints;
- dependencies and open questions;
- a `Documentation Synchronization` ledger with each reviewed document marked
  `updated`, `no-change`, or `not-applicable`, plus rationale.

## Rules

- Keep requirements concise and candidate-level.
- For a new capability absent from source material, review the inventory before
  creating the brief. Update only documentation affected by the documented
  impact; record `no-change` or `not-applicable` for reviewed material that
  remains accurate or outside scope. Use a bounded curator handoff with
  documentation-only roots.
- Do not copy the authoritative project documents into every brief; cite the
  applicable source sections.
- Split unrelated capabilities into separate requirement briefs.
- Merge duplicate or overlapping requirements and record the decision in the brief.
- Preserve unresolved decisions under `Open Questions`; never guess silently.
- Reconcile documentation with completed product work only when the request
  names that documentation scope.
- Treat a material requirement creation or scope change as an iteration worth
  recording. Passive reading, research without a requirement change, and
  typo-only edits do not start an iteration.

## Checklist

- [ ] Applicable source documentation was read.
- [ ] The documentation inventory was reviewed for a new product capability.
- [ ] Existing requirement IDs were checked.
- [ ] Each new requirement has one stable `REQ-<NNN>` ID.
- [ ] `docs/requirements/index.md` was updated when a brief changed.
- [ ] New or materially changed requirements have an owned `progress.md` with
      current state and append-only iteration history.
- [ ] The brief records documentation synchronization and rationale.
- [ ] Open questions were preserved instead of invented away.

## Common errors

- Treating a requirement brief as a mandatory implementation gate.
- Bulk-converting the authoritative project documents into requirements.
- Creating one huge requirement that should be several focused changes.
- Forgetting source references back to the applicable authoritative project
  document.
- Losing ambiguity instead of recording it as an open question.

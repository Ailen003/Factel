# Documentation Inventory

This inventory routes agents to the maintained project documentation they must
consider for product and technical work, especially when a new capability is
introduced or its scope changes. Review is deliberate and proportional: update
only documentation that the documented impact actually affects.

## Core review material

| Material | Purpose | Curator action |
|---|---|---|
| `docs/product-source-of-truth.md` | Authoritative product behavior, scope, actors, permissions, rules, and outcomes for Conversation Processing Demo. | Review before creating, changing, or implementing a product requirement; update only when durable product intent changes. |
| `docs/solution-architecture.md` | Authoritative technology choices, system boundaries, data flows, security controls, and deployment topology for Conversation Processing Demo. | Review for technical constraints and before architecture or implementation work; update only when an architecture decision or durable technical boundary changes. |
| `docs/data-model.md` | Logical fields, entities, relationships, invariants, provenance, and deletion behavior. | Review for changes to records, extraction, persistence, identity, credits, or cleanup; keep aligned with product and architecture. |
| `docs/requirements/<requirement-kebab>/brief.md` | Curated intent and scope for one capability. | Create or update when the requirement is new or changes; record the review ledger. |
| `docs/requirements/index.md` | Navigation and current requirement status. | Update only when the row, status, scope, or brief reference changes. |

The authority and conflict rules between the project source documents are
defined in `docs/product-source-of-truth.md#1-authority-and-document-boundaries`.
Agents should cite the applicable sections rather than duplicate either source
document in a requirement brief.

## Conditional review material

| Material | Review when |
|---|---|
| `README.md` | The capability changes public use, setup, commands, or repository orientation. |
| `docs/README.md` and `docs/requirements/README.md` | Documentation navigation, requirement guidance, or templates change. |
| `docs/guides/**/*.md` and `docs/operations/**/*.md` | They exist and the capability changes the instructions they document. |
| `harness-docs/*.md` | The capability changes how developers or operators use the lightweight harness. |
| `docs/requirements/_templates/*.md` | The shape of future requirement or progress records changes. |

If a reviewed material does not exist or does not apply, record it as
`not-applicable` in the brief with a short reason. Do not create documentation
just to satisfy a checklist.

## Exclusions

- Historical change records kept outside the active documentation set.
- Application source, tests, generated output, and dependency material.
- Documents unrelated to the capability's durable product or operating impact.

## Recording the review

Each affected brief has a **Documentation Synchronization** ledger with the
document, result (`updated`, `no-change`, or `not-applicable`), and rationale.
For an implementation that materially changes documented scope, refresh the
affected entries before reporting the work complete. This is lightweight
contextkeeping, not a formal planning or release gate.

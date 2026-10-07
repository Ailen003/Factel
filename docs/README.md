# Project Documentation

`docs/` is the project-knowledge layer.

- `product-source-of-truth.md`: authoritative product behavior, scope, actors,
  permissions, rules, and outcomes for Conversation Processing Demo.
- `solution-architecture.md`: authoritative system design, technology,
  security, operational controls, and deployment topology.
- `data-model.md`: logical entities, fields, relationships, validation,
  provenance, and deletion rules implementing the product and architecture.
- `documentation-inventory.md`: the documentation to consider when product
  scope changes.
- `requirements/`: nine ordered Conversation Processing Demo phase briefs,
  their progress records, index, coverage map, and reusable templates. Eight
  phases define the baseline; public registration is deferred and excluded from
  the current controlled-access delivery.
- [Controlled-access roadmap](roadmaps/public-trial-readiness.md): landing
  contact, human approval, administrator-created trials, temporary credentials,
  operational limits and the zero-USD constraint. The legacy filename is kept
  for link compatibility; it no longer proposes public self-registration.
- `../harness-docs/`: lightweight developer, operator, and audit guidance.

Requirement briefs help preserve product intent; they are not an executable
workflow or a prerequisite for every task. For a new requirement or the next
material iteration that changes an existing one, create its small `progress.md`
from the requirements template if missing, update current state, and append the
iteration outcome. Do not backfill untouched historical requirements or create
progress merely for passive reading, research without a requirement change,
typo-only edits, or an unrelated internal refactor.

The coding tool or agent chooses any planning format that helps the work. The
guides support sound collaboration and verification without imposing a central
planning system or gate.

Documentation describes intended behavior, not a declaration that every
capability is implemented. Use requirement progress and observed verification
to distinguish delivered behavior from remaining work. The controlled-access
roadmap records the latest delivery focus without claiming baseline completion.

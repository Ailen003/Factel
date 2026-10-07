# Agent UI

Enter only through `HARNESS_EXECUTOR_V1`. Read
`.agent/contracts/phase-handoff.md`, this role, and only exact assigned skills.
Do not load root guidance, broaden scope, redelegate, or repair work outside
the assigned UI layer.

Implement bounded SSR entries, lists, modals, forms, filters, details, and
assigned messages. Require roots, exact skills, relevant checks, and exclusive
artifacts when writing. Missing safety or ownership bounds means `blocked`.

Typical roots are `modules/<module>/` outside `lib/`, assigned app routes, and
both locale files. Do not edit data-layer or global utility code without
explicit scope or another writer's artifact.

Reuse shared components, preserve server/client boundaries, and update both
locales for visible text. Add the smallest useful Testing Library or Vitest
coverage and run focused checks appropriate to the scope. Before an
irreversible high-risk action, stop for direct user confirmation. Never run
`git commit`; return the structured conversational result.

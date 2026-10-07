# Skill Registry

The root selects only the exact skills that help the requested work and places
their paths in a `HARNESS_EXECUTOR_V1` handoff. Executors do not reread this
registry to expand their scope.

| Trigger | Skill path | Usual owner |
|---|---|---|
| Root collaboration guide | `.agent/skills/spec-driven-development/SKILL.md` | orchestrator |
| Requirements or documentation synchronization | `.agent/skills/requirements-curation/SKILL.md` | agent-requirements-curator |
| Module architecture | `.agent/skills/module-architecture/SKILL.md` | agent-architect |
| Services/actions/types/hooks/mocks | `.agent/skills/data-layer/SKILL.md` | agent-data |
| Prisma service usage, or a request to configure Prisma that needs current official guidance | `.agent/skills/prisma-orm/SKILL.md` | agent-data |
| SSR/container/Suspense | `.agent/skills/ssr-data-fetching/SKILL.md` | agent-ui |
| Lists/modals/actions | `.agent/skills/client-views-modals/SKILL.md` | agent-ui |
| RHF/Zod forms | `.agent/skills/forms-rhf-zod/SKILL.md` | agent-ui |
| URL filters | `.agent/skills/filters-url-state/SKILL.md` | agent-ui |
| Visible text/messages | `.agent/skills/i18n-conventions/SKILL.md` | data/UI/architect |
| Deterministic behavior | `.agent/skills/behavior-testing/SKILL.md` | data/UI/verifier |
| Proportional checks and handoff evidence | `.agent/skills/verification-harness/SKILL.md` | verifier |

The handoff marks skill resolution as `paths-injected` or `none`. Ownership is
explicit, and a writer has one exclusive artifact at a time. Execution may be
inline or delegated when that improves the work; neither mode creates durable
work state.

Typical minimal bundles:

- data: data-layer; add behavior or i18n only when triggered.
- prisma: data-layer + prisma-orm; use only for the optional Prisma profile.
- UI: only affected UI skills; add behavior or i18n when triggered.
- verifier: verification; add behavior when relevant.
- curator/architect: their single domain skill unless visible text applies.

Lazy module examples live under `.agent/reference/widget/`; requirement-writing
examples live under `.agent/reference/spec-example/`. Stack capability profiles
compose optional technical addons under `.agent/profiles/`; none of these files
forces a tool workflow or a persisted checklist.

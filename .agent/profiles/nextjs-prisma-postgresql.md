# Next.js + Prisma + PostgreSQL stack capability

Capability ID: `prisma-postgresql`.

Use this capability only when a Next.js project explicitly adopts Prisma, or
when it already exposes a Prisma persistence boundary. It combines the normal
core conventions with:

- `.agent/skills/data-layer/SKILL.md`
- `.agent/skills/prisma-orm/SKILL.md`

The capability is inactive by default. A request to add Prisma may activate it
before packages exist; ordinary mock- or API-backed modules may not. It does not add dependencies, a `DATABASE_URL`, or a database service to the base template.

## Configuration handoff

Prisma installation, initialization, schema, generator, adapter, environment,
migration, seed, deployment, and version choices belong to each adopting
project. Before making any of those choices, read the current official Prisma
documentation. This harness provides no configuration recipe, scripts,
generated-client path, or fallback setup.

Once setup is complete, the project exposes a persistence boundary that its
module services can import. The harness verifies service architecture only; it
does not validate Prisma configuration or access external systems.

## Module rule

Each module has one chosen service source for a concrete deployment: mock,
external API, or Prisma. Its service exposes the existing typed module
contract and imports the project's persistence boundary; it does not create or
configure Prisma itself.

If an authentication capability is also selected, its composition overlay owns
the current-actor adapter and identity-table boundary. The service still
requires an explicit actor and authorization policy before persistence is
enabled.

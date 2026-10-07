# Prisma adoption handoff

This harness does not provide Prisma installation, initialization, schema,
generator, adapter, environment, migration, seed, deployment, version, or
test commands. When a project needs any of those decisions, read the current official Prisma documentation first and adapt it to that project's runtime,
database, deployment, and security constraints.

Do not use a remembered package list or an old local template as a fallback.
If current official documentation cannot be consulted, surface that limitation
to the operator before changing project setup.

Return to this addon after the project has exposed a working, project-owned persistence boundary for module services. Then use `service-patterns.md` and
the widget reference to preserve this template's service conventions.

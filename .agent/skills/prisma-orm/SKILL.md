---
name: prisma-orm
description: Guide Prisma use inside this template's server services. For installation or configuration, first read current official Prisma documentation for the adopting project; this skill provides no setup recipe. Use only when Prisma is requested or already evidenced.
---

# Prisma service architecture (optional addon)

Use Prisma only after the module's data source has been intentionally chosen.
This skill is an addon to `data-layer`; it does not replace its service/action
boundaries. It is a stack capability, not a lifecycle assurance profile.

## Workflow

1. Confirm that Prisma is requested or already present. Otherwise, keep the
   existing mock or external-API pattern.
2. If Prisma must be installed, initialized, reconfigured, migrated, seeded,
   or upgraded, read the current official Prisma documentation first and make
   those project-specific decisions there. This harness has no package list,
   schema, generator, adapter, environment, script, version, or deployment
   recipe. If the official documentation is unavailable, report that block;
   do not invent a local setup fallback.
3. After the project exposes a project-owned persistence boundary for Prisma, keep calls in a Node-runtime, `server-only` module service. Actions validate then delegate; hooks call actions. Never import Prisma client code in Middleware or Edge runtime code.
4. Resolve the actor from a project-owned server boundary and apply an explicit
   authorization scope to every query. Select only needed fields, map database
   values to module DTOs, use transactions for coupled operations, and
   translate stable Prisma errors into `ServiceResponse` codes.
5. When a module needs a concrete pattern, read
   `.agent/reference/widget/lib/services/widget.prisma.services.ts.example`
   and `references/service-patterns.md`. Replace the real module's canonical service implementation with one chosen source; never leave mock, API, and Prisma implementations active together.

## References

- Read `references/adoption.md` for the official-documentation handoff before
  project-specific setup.
- Read `references/service-patterns.md` for service boundaries, authorization,
  transactions, and error handling.

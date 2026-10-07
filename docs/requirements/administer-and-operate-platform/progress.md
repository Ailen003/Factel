# Requirement Progress: REQ-007 - Administer and operate platform

| Field | Value |
|---|---|
| Status | in-progress |
| Last updated | 2026-09-11 |
| Current iteration | H2C-2b controlled administrator MFA recovery and protected ownership transfer - verification-complete-awaiting-migration-and-real-flow |
| Progress owner | root |

## Current State

H2C-2a is implemented and migrated: every active owner/operator must complete verified Better Auth TOTP MFA before exercising any administrative capability. Server authorization reloads current role, profile, status and both MFA persistence states; pending enrollment fails closed. Password-only provisional sessions, trusted devices, email/SMS OTP, administrator MFA disablement and direct plugin bypasses remain unavailable. Its authorized real PostgreSQL journey remains pending. H2C-2b is implemented in code for controlled operator-factor recovery, owner break-glass and protected ownership transfer; its additive migration and real operations remain unapplied/unexecuted pending direct confirmation.

H2C-1 remains active: administrative authorization is a centralized typed server-only capability policy over a product-owned nullable `adminProfile`. Trial users require null; platform administrators require `owner` or `operator`. Every protected service/action reloads current role, profile and status, rejects inconsistent state and records sensitive denials safely. Generic Better Auth browser admin permissions remain empty.

The owner can perform all operator work, manage operator promotion/demotion, change contact email, resume admission and owns future global-limit/global-reopen capabilities. Operators can manage trial users, read required Settings state and pause admission, but cannot act on administrators, change profiles/contact email or resume. Promotion/demotion is confirmed, version/idempotency-fenced, target-locked, serializable, session-revoking and audit-fail-closed; an invalid downgrade stops without a partial transition, and the sole owner remains protected. Settings contact update, pause and resume are distinct version-fenced transactional operations with attributable audit.

The explicit owner bootstrap is dry-run by default, requires an email and confirmation for mutation, protects production, serializes the unique owner invariant, handles the same owner idempotently, rejects a different owner, assigns remaining legacy admins operator, revokes sessions and audits without secrets. Read-only status reports all ten migrations applied and current, exactly one active MFA-ready owner and no aggregate role/profile/state/credential/workspace/MFA inconsistency without exposing identity. Broader REQ-007 limits, credits/extensions, expiry/cleanup and support inspection remain pending; REQ-007 stays in progress.

Current policy iteration: documented zero-USD managed trials, bounded administrative powers, global free-tier controls and expiry/cleanup policy. Scoped whitespace and local-link checks passed. Operational implementation and safe capacity validation remain pending; this does not complete REQ-007.

The user administration list uses the shared debounced URL-filter updater, resets to page one for every filter update or reset, and reflects browser URL navigation without overwriting in-progress input. Its service also clamps stale pages after the filtered result set shrinks. Focused tests, TypeScript validation, lint and whitespace checks passed. The broader operational capabilities in REQ-007 remain outside this bounded list-correction iteration.

## Iterations

| Date | Iteration | Status | Evidence and deferred work |
|---|---|---|---|
| 2026-09-06 | Shared Prisma persistence foundation | started | Owner: agent-data. Establish only the shared PostgreSQL/Prisma schema and server persistence boundary; no phase behavior, migration, or database target is delivered. |
| 2026-09-06 | Initial documentation curation | started | Owner: requirements curator. Create the scoped brief, dependencies, acceptance scenarios and source ledger; preserve implementation status as not-started. |
| 2026-09-06 | Initial documentation curation | documentation-complete | Harness validation passed; scoped checks confirmed nine unique IDs, brief sections, not-started progress and all local links/anchors; scoped git diff --check passed. Product implementation remains deferred to its delivery phase. |
| 2026-09-06 | Documentation review corrections | started | Correct damaged punctuation and make synchronization ledgers describe the complete material iteration. |
| 2026-09-06 | Documentation review corrections | documentation-complete | Corrected punctuation and iteration-wide synchronization results. Scoped metadata/link/anchor/corruption/ledger checks, harness validation and diff whitespace check passed; product status remains not-started. |
| 2026-09-06 | Shared Prisma persistence foundation | ready-for-manual-commit | Prisma schema validation and client generation passed; lint and diff checks passed. No migration or PostgreSQL command was run. |
| 2026-09-07 | User-list URL filter synchronization | started | Owner: root (inline). Align the user-filter hook with the shared URL updater, preserve validated URL parsing, reset pagination on every filter change, and review adjacent list behavior. |
| 2026-09-07 | User-list URL filter synchronization | ready-for-manual-commit | Replaced direct router navigation with the shared URL updater; added navigation and reset coverage; clamped stale list pages in the service transaction. 14 focused tests, app typecheck, scoped lint and diff whitespace check passed. |
| 2026-09-09 | Controlled zero-cost trial policy | started | Owner: agent-requirements-curator. Synchronize only affected product documentation and requirements for manual admission, zero-USD constraints and continued exclusion of public registration; no implementation. |
| 2026-09-09 | Controlled zero-cost trial policy | documentation-complete | Owner: agent-requirements-curator. Scoped whitespace and local Markdown file-target checks passed for ten documents. Manual admission replaces the public roadmap; REQ-009 remains deferred/not-started. Accepted trial/permission policy and zero-USD constraints documented; capacity, contact/delivery and deployment/provider viability remain open. No application, schema, database, deployment or commit changes. |
| 2026-09-09 | Access-contact administration | started | Owner: root. Add a platform-admin-only configuration form for the public contact email and admission switch, with server validation and attributable audit. |
| 2026-09-09 | Access-contact administration | verification-complete-with-environment-caveat | Owner: root. Delivered the protected settings route, typed persisted configuration, transactional audit, public fail-closed read and sidebar navigation. Focused tests passed 22/22; serial full suite passed 460/460 runnable tests; Prisma validation, types, lint, build, locale parity and whitespace passed. Canonical parallel verification timed out four unrelated tests that pass isolated. Migration application and runtime configuration remain pending. |
| 2026-09-10 | H2C-1 owner/operator policy and Settings authorization | started | Owner: root; documentation writer: agent-requirements-curator. Separate owner/operator powers with a centralized server-authoritative policy, protected profile transitions, explicit owner bootstrap and independently authorized Settings operations. Preserve broader REQ-007 scope and keep MFA/ownership transfer in H2C-2. |
| 2026-09-10 | H2C-1 owner/operator policy and Settings authorization | verification-complete-awaiting-migration-and-bootstrap | Owner: root; documentation writer: agent-requirements-curator. Implemented the product profile/capability boundary, owner-only promotion/demotion, stale-session revocation, Settings read/contact/pause/resume split and safe explicit bootstrap. H2C focused tests passed 51/51, UI audit 29/29, security/H2B 25/25 and later focused functional coverage 170 tests; isolated schema compatibility passed 1/1 in 0.888 s. Final integrated verification passed 115 files and 613 tests with 3 files/tests skipped. Typechecks, Prisma validate/generate, harness, lint with two pre-existing warnings, build, ES/EN parity 1270/1270 and whitespace passed. The migration remains unapplied and bootstrap unexecuted. REQ-007 remains in progress. |
| 2026-09-10 | H2C-2a mandatory administrator TOTP MFA | started | Owner and documentation writer: root. Add Better Auth 1.7.3 TOTP enrollment, definitive-session login challenge, single-use/regenerated backup codes, five-attempt/15-minute lockout, centralized MFA enforcement, direct-endpoint defense and secret-free audit. Prepare but do not apply the additive migration; keep controlled recovery and ownership transfer in H2C-2b. |
| 2026-09-10 | H2C-2a mandatory administrator TOTP MFA | verification-complete-awaiting-migration-and-real-flow | Owner and sole progress writer: root. All owner/operator capabilities now fail closed until current Prisma and Better Auth factor state agree; trial users remain unchanged. The application-owned setup/challenge/regeneration services protect raw plugin endpoints, revalidate role/profile/status/suspension after factor verification and revoke stale sessions. Both the serial suite and canonical `pnpm verify` passed 652 runnable tests in 125 files, focused MFA/security coverage passed 60/60, and typecheck, build, Prisma validate/generate, harness, locale parity and whitespace passed; lint retains two pre-existing warnings. An independent read-only verifier returned PASS with no blocking or high-severity finding. Only the additive MFA migration is pending and no database mutation occurred. H2C-2b and broader REQ-007 work remain open. |
| 2026-09-11 | H2C-2b controlled administrator MFA recovery and protected ownership transfer | started | Owner: root. Read-only evidence supersedes the earlier runtime state: all ten migrations are applied, exactly one active owner is MFA-ready and no aggregate identity/MFA invariant is invalid. Implement owner-only operator recovery, dry-run-first owner break-glass and two-participant ownership transfer with official Better Auth step-up, serializable ledgers, deterministic locking, session revocation and safe audit. The eleventh migration and real account operations require direct immediate confirmation; H3 and broader REQ-007 work remain out of scope. |
| 2026-09-11 | H2C-2b controlled administrator MFA recovery and protected ownership transfer | verification-complete-awaiting-migration-and-real-flow | Owner: root. Verified the bounded REQ-007 security slice: owner-only operator-factor recovery, operational owner break-glass and recipient-specific two-participant ownership transfer use recent definitive sessions, Better Auth password/TOTP step-up, authoritative reloads, version/idempotency fences, serializable locks, session revocation and safe mandatory audit. Focused coverage passed 90/90; the isolated serial global run passed 714/714 runnable tests across 136 files with 3 tests/files skipped and no timeouts. Types, build, Prisma, harness 20/20, EN/ES parity 1487/1487, lint with two pre-existing warnings and whitespace passed; independent review returned PASS. The eleventh migration and real journey remain pending direct confirmation, so H2 and broader REQ-007 remain in progress. |

## Documentation Synchronization

### 2026-09-11 H2C-2b controlled administrator MFA recovery and protected ownership transfer

| Document | Result | Justification |
|---|---|---|
| [REQ-001](../secure-application-foundation/brief.md), this brief/progress and [index](../index.md) | updated | Record verified shared administrator-security behavior without expanding the broader REQ-007 operational scope. |
| [Product](../../product-source-of-truth.md), [architecture](../../solution-architecture.md) and [data model](../../data-model.md) | updated | Define the recovery/transfer authority, step-up, locking, singleton ownership, ledgers, audit and session boundaries. |
| [Roadmap](../../roadmaps/public-trial-readiness.md), Prisma setup and [runbook](../../operations/owner-mfa-recovery.md) | updated | Mark code complete, identify the one pending additive migration and document safe operational activation. |
| Documentation inventory, templates, guides and harness | no-change | No new requirement ID or broader limits/credits/cleanup/support behavior was introduced. |

### 2026-09-10 H2C-2a mandatory administrator TOTP MFA

| Document | Result | Justification |
|---|---|---|
| [REQ-001](../secure-application-foundation/brief.md), this brief/progress and [index](../index.md) | updated | Record identity ownership under REQ-001 and shared enforcement across every current/future REQ-007 capability. |
| [Product](../../product-source-of-truth.md), [architecture](../../solution-architecture.md), and [data model](../../data-model.md) | updated | Define MFA state, session/challenge boundaries, endpoint policy, audit semantics and partial-failure behavior. |
| [Roadmap](../../roadmaps/public-trial-readiness.md) | updated | Reconcile active H2C-1 and distinguish current H2C-2a from pending H2C-2b. |
| Documentation inventory, templates, guides, operations and harness | no-change | Existing routing and procedures remain accurate; no migration, bootstrap, deployment or real-account MFA mutation is performed. |

### 2026-09-10 H2C-1 owner/operator policy and Settings authorization

| Document | Result | Justification |
|---|---|---|
| [Brief](brief.md), this progress and [index](../index.md) | updated | Record the verified material REQ-007 slice while preserving candidate/in-progress status and broader deferred operations. |
| [Product](../../product-source-of-truth.md), [architecture](../../solution-architecture.md), and [data model](../../data-model.md) | updated | Record implemented owner/operator powers, server-only enforcement, profile/bootstrap invariants and Settings concurrency. |
| [Roadmap](../../roadmaps/public-trial-readiness.md) | updated | Distinguish verified H2C-1 code from its unapplied migration/unexecuted bootstrap and pending H2C-2. |
| Documentation inventory, templates, README, guides, operations and harness | no-change | Existing routing and procedures remain accurate; no runtime migration/bootstrap action was performed. |

### Earlier synchronization

| Document | Result | Justification |
|---|---|---|
| [Brief](brief.md), this progress and [index](../index.md) | updated | Assign zero-cost controls, bounded team permissions and trial expiry/cleanup to REQ-007; expose its actual in-progress state. |
| [Product](../../product-source-of-truth.md), [architecture](../../solution-architecture.md), and [data model](../../data-model.md) | updated | Record the accepted operating constraint and future lifecycle obligations without claiming implementation. |
| [Roadmap](../../roadmaps/public-trial-readiness.md) and [docs navigation](../../README.md) | updated | Replace the public-signup proposal with managed operations and link the current roadmap. |
| Project README, guides, operations and harness | no-change | No implemented runtime behavior or operator procedure changed in this documentation iteration. |

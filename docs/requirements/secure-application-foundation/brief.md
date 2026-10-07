# Requirement Brief: Secure application foundation

> **ID:** REQ-001
> **Status:** candidate
> **Priority:** high
> **Phase:** 1
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#12-roles-and-authorization-policy); [solution-architecture.md](../../solution-architecture.md#15-identity-and-authorization-architecture); [solution-architecture.md](../../solution-architecture.md#5-deployment-topology)

## Intent

Provide authenticated access and an isolated personal workspace for every trial user.

## Controlled-access policy (2026-09-09)

- Deliver a bilingual landing request-access form that prepares email to an administrator-configured business address without persisting visitor data, plus human approval and administrator-created individual trial accounts. Public signup remains disabled; no shared account or automatic credit/account grant.
- Complete mandatory temporary-password replacement before workspace APIs, controlled administrative reissuance/reset, owner/operator permission boundaries and administrator MFA. H2C-1 implements the profile/capability boundary; H2C-2a adds mandatory TOTP enrollment, login challenge and backup codes, while H2C-2b retains controlled factor recovery and protected ownership transfer. Reissuance/reset is application-owned, restricted server-side to a current authorized owner/operator and trial-user targets, and never reactivates a suspended account.
- The server generates the initial temporary password with a cryptographically secure random source and shows it once to the provisioning administrator. The 14-day clock starts when first-login temporary-password replacement completes. An unused temporary credential expires 72 hours after successful provisioning; existing accounts are not retroactively gated. A later recovery-purpose credential must preserve the original trial dates. The contact destination is runtime platform configuration with an independent admission switch; private credential delivery remains open. The contact form uses the visitor's mail application and does not add automated email or a request database.
- Acceptance adds: a contact request creates no account; unauthorized provisioning fails; temporary credentials cannot bypass replacement; privileged operations use current authoritative role/profile/status and, after H2C-2a, require a Better Auth-owned verified TOTP factor as well as a definitive post-challenge session.
- This section defines durable scope; [progress](progress.md) is authoritative for implementation evidence. H2C-1 and H2C-2a are implemented and migrated, a valid active MFA-ready owner exists, the authorized H2C-2a real flow remains pending, and H2C-2b is complete in code with its additive migration and authorized real journey still pending. See [accepted policy](../../product-source-of-truth.md#25-controlled-trial-policy-accepted-2026-09-09). These open decisions supersede the older "None" statement below.

## Actors

Platform administrator; trial user; application operator.

## Scope

- Adapt the existing template shell/navigation to Conversation Processing Demo; remove sample business modules from navigation and retain reusable UI infrastructure.
- Integrate Better Auth, Neon PostgreSQL and Prisma-owned schema/migrations in the Next.js application, with server-only credentials and isolated preview/production resources.
- Establish the initial owner explicitly, owner/operator administration, administrator-only trial provisioning, one personal workspace per user, forced temporary-password replacement, activation/suspension, password reset and session revocation.
- Introduce shared server-owned workspace authorization, privileged-access separation, safe basic audit and bilingual accessible account flows.

## Out of Scope

Business CRUD, audio, AI, public registration and full operational dashboards.

## Candidate Flows

1. Administrator creates a trial user with temporary credentials; the user signs in and replaces the password before reaching workspace content.
2. Administrator suspends the user, resets credentials or revokes sessions; existing sessions cannot bypass the resulting state.

## Rules and Constraints

- Resolve workspace from authenticated server context. Verify resource ownership on every operation; browser input never grants tenant scope.
- Any privileged content inspection exposed now requires a declared reason and durable audit. No unaudited support shortcut.
- Account cleanup covers identity/workspace data now and expands with each phase. Record intended initial allocation (default ten) if provisioning before the ledger exists; actual processing stays unavailable until REQ-004. Initial credit accounting arrives in REQ-004; complete administration in REQ-007.
- Public registration stays disabled. Passwords, sessions and secrets never enter ordinary logs or browser bundles.
- Administrator input cannot choose a temporary password. Plaintext exists only in the server provisioning or reissuance call and its one-time authorized response; persistence and verification remain owned by Better Auth.
- Reissuance requires explicit confirmation, an operation UUID, an expected credential version and a structured reason. It revokes all target sessions, replaces any earlier issuance, and records only secret-free lifecycle and general delivery-category metadata. Activation-purpose replacement starts the original trial once; recovery preserves trial dates, workspace, credits and suspended state.
- Keep `trial_user` and `platform_admin` as the general roles. A nullable product-owned administrative profile is null for trial users and `owner` or `operator` for administrators. A centralized typed server-only matrix authorizes each operation from current database role, profile and status; inconsistent or missing profiles fail closed, and generic Better Auth browser administration permissions remain empty.
- Only the owner may promote an eligible user to operator or demote an operator. These confirmed, version-fenced operations serialize per target, revoke sessions and require attributable audit; the sole owner cannot be demoted, suspended or deleted. H2C-2b adds ownership transfer only through its two-participant, expiring and transactionally protected protocol.
- Every active owner/operator must complete password-confirmed TOTP enrollment and first-code verification before administrative access. Authoritative checks require both the user MFA flag and the verified Better Auth factor row. Trial users remain outside MFA scope; email/SMS OTP, trusted devices, administrator MFA disablement and direct plugin bypasses are prohibited.
- H2C-2b operator MFA recovery is owner-only and requires a recent definitive session plus current password/TOTP, confirmation, structured reason, optional safe reference, operation ID and expected version. It atomically clears only factor/flag, revokes sessions, preserves suspension/profile/password/workspace and forces reenrollment. Owner loss uses only the dry-run-first break-glass command after external identity verification; there is no operator web takeover path.
- Ownership transfer is a 30-minute two-participant protocol to an active MFA-ready operator. Start/cancel/decline/accept are monotonic, idempotent and authoritatively revalidated; acceptance atomically swaps owner/operator, increments both versions, preserves MFA, records both transitions and revokes both session sets while retaining exactly one owner.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

None; first product delivery phase.

## Acceptance Scenarios

1. Create two trial users and verify exactly one isolated workspace each; deny forged cross-workspace requests.
2. Verify temporary-password gating, sign-in/out, reset, suspension and revocation, including already-open sessions.
3. Deny trial-user admin actions; verify preview configuration cannot reach production data.
4. Exercise both locales, keyboard access, safe errors and attributable lifecycle audit.
5. Recover an eligible operator without changing password/profile/workspace or suspension; verify factor/flag removal, full session revocation and mandatory reenrollment. Exercise break-glass dry-run/refusals without identity output.
6. Start, decline/cancel, expire and accept ownership transfers; reject stale/concurrent state and verify an atomic single-owner swap with both participants logged out.

## Source Coverage

CPD-FR-001–006 foundation; CPD-FR-009 privileged-access policy; CPD-FR-070–072, 075 as applicable. Acceptance: identity, temporary credentials and isolation; ten-credit provisioning completes with REQ-004. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

Choose the operational private-channel procedure used by the human team. The application records only the nonsensitive category `in_person`, `phone`, `secure_message` or `other`, never addresses, numbers, conversations or credentials. The monitored company contact address is configured at runtime, unused credentials expire after 72 hours, and the 14-day clock starts at completed first-login activation replacement. Controlled recovery/reset and H2C-1 owner/operator separation are implemented; the H2B and H2C-1 migrations are applied and aggregate read-only evidence confirms one valid active owner. H2C-2a implements privileged TOTP MFA, backup codes and second-factor login challenge. H2C-2b implements controlled administrator MFA recovery, total-factor-loss handling and protected ownership transfer in code; activation still requires its migration and an authorized real journey. Record implementation evidence and gaps in [progress](progress.md).

## Documentation Synchronization

### H2C-2a mandatory administrator TOTP MFA, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Define Better Auth-owned TOTP enrollment/challenge/backup codes, authoritative dual-state enforcement, session transitions, safe audit and non-atomic failure boundaries. |
| This brief and progress | updated | Record H2C-2a while preserving H2/REQ-001 in progress and keeping controlled recovery and ownership transfer in H2C-2b. |
| REQ-007 brief/progress and requirements index | updated | Record the shared operational MFA boundary without claiming broader REQ-007 completion. |
| Roadmap | updated | Reconcile the applied H2C-1 migration and split H2C-2a delivery from H2C-2b recovery/ownership work. |
| Documentation inventory, templates, guides and operations | no-change | Existing document routing is sufficient; no migration, bootstrap, deployment or real-data MFA exercise is performed by this iteration. |

### H2C-1 owner/operator separation, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record the implemented application-owned admin profile, centralized server-only capability policy, authoritative refresh, protected transitions, Settings split and explicit bootstrap invariants. |
| This brief and progress | updated | Close the verified H2C-1 implementation iteration while keeping REQ-001/H2 in progress for H2C-2. |
| Requirements index | updated | Clarify H2C-1 delivery ownership and preserve candidate/in-progress status. |
| Roadmap | updated | Mark H2C-1 implemented and verified, its additive migration/bootstrap unexecuted, and H2C-2 as the next increment. |
| Documentation inventory, templates, README, guides, operations and harness | no-change | Existing routing and reusable shapes remain accurate; no migration or bootstrap operating procedure was executed or approved. |

### H2B controlled administrative credential reissuance, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record controlled reissuance, activation/recovery invariants, secret-free delivery ledger, concurrency fences and fail-closed ordering. |
| This brief and progress | updated | Close H2B in code, preserve the pending additive migration, and leave MFA plus owner/operator separation in H2C. |
| Requirements index and documentation inventory | no-change | REQ-001 identity, status, priority, ownership and maintained-document routing remain accurate. |
| Roadmap | updated | Mark H2B verified in code but unavailable at runtime until its additive migration is authorized and applied. |
| Templates, project README, guides, operations and harness | no-change | No reusable shape, public setup, deployment procedure or harness contract changed. |

### H2A review corrections, 2026-09-10

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Add server-generated one-time credentials, explicit activation/recovery purpose and paired trial timestamps without claiming H2B issuance. |
| This brief and progress | updated | Record the H2A review correction while preserving recovery/reset and MFA as later increments. |
| Requirements index | no-change | REQ-001 status, priority and ownership remain accurate. |
| Roadmap | updated | Mark secure random provisioning and recovery-compatible state while keeping the migration and H2B application pending. |
| Prisma setup guide | updated | Describe the purpose discriminator and preserve the direct-confirmation requirement before application. |
| Project README, guides, operations and harness | no-change | No public setup, deployed procedure or harness contract changed. |

### Configurable access contact implementation, 2026-09-09

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record the selected administrator-configured email mechanism, admission switch and deliberate absence of persisted visitor requests or server-side email. |
| This brief and progress | updated | Resolve the contact-mechanism decision while preserving the runtime mailbox value, credential delivery and credential-expiry work. |
| Requirements index | no-change | REQ-001 status, priority and ownership remain accurate. |
| Roadmap | updated | Expose implemented code, pending migration/application configuration and the remaining H2 work. |
| Project README, guides, operations and harness | no-change | Existing setup and harness commands remain valid; no deployed operating procedure was added. |

### Review for controlled-access policy, 2026-09-09

| Document | Result | Justification |
|---|---|---|
| Product, architecture and data model | updated | Record accepted manual admission, zero-USD constraint, intended administrative powers and expiry/cleanup obligations without claiming implementation or migration. |
| This brief, progress and requirements index | updated | Synchronize affected ownership and preserve REQ-009 deferral; progress owner is agent-requirements-curator. |
| Documentation inventory | no-change | Existing maintained-document routing remains sufficient. |
| Requirement brief/progress templates | no-change | Existing shapes support this policy iteration. |
| Roadmap and docs navigation | updated | Root-owned synchronization for controlled trials; this executor does not edit those artifacts. |
| Guides, operations and harness | not-applicable | No runtime procedure or harness changes are delivered. |

### Earlier iteration ledger

| Document | Result | Justification |
|---|---|---|
| [Product](../../product-source-of-truth.md) and [architecture](../../solution-architecture.md) | updated | Synchronized manual CRUD, multiple-request batches, fields, credit settlement, deletion rules and nine delivery phases. |
| [Data model](../../data-model.md) | updated | Created logical fields, cardinalities, origins, credit settlement and deletion contracts, including initial allocation and exactly-once grants. |
| [Inventory](../../documentation-inventory.md) | updated | Added logical-model and requirement-progress navigation and aligned the maintained product documentation set. |
| [Index](../index.md), [guidance](../README.md) and this brief | updated | Replace inherited backlog with ordered product phases and acceptance criteria. |
| [Progress](progress.md) | updated | Records documentation curation without claiming implementation. |
| [Project README](../../../README.md) and [docs navigation](../../README.md) | updated | Reoriented navigation toward Conversation Processing Demo, its shared model and prioritized product backlog. |
| Reusable brief template | updated | Adds explicit acceptance scenarios and source coverage for future briefs. |
| Reusable progress template | no-change | Existing current-state/append-only history shape is sufficient. |
| Guides and operations documents | not-applicable | No implemented runtime procedure changes in this documentation iteration. |
| Harness documentation | not-applicable | No harness behavior change. |

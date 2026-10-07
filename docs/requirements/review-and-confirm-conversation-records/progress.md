# Requirement Progress: REQ-005 - Review and confirm conversation records

| Field | Value |
|---|---|
| Status | active |
| Last updated | 2026-09-08 |
| Current iteration | Provider JSON rejection recovery - verified |

## Current State

Owner: root implementer (exclusive writer). User reported Groq HTTP 400
`json_validate_failed` on reprocessing. Implemented bounded retries only for this
explicit provider rejection using the existing durable run/reservation, plus
contextual failure guidance for the preserved review. Strict JSON schema and
application evidence validation remain unchanged. Prior staged changes are retained.
Observed checks: 38 targeted adapter/workflow/processing UI tests passed, including
second-attempt recovery, exhaustion, other-400 rejection and unchanged strict
provider options. A real Spanish synthetic Groq extraction passed (two grounded
requests and contact/evidence checks); the intermittent provider rejection was
simulated deterministically in tests, not reproduced in that live call. Scoped
ESLint, application typecheck and final whitespace checks passed. No private conversation, application records or application credits
were used, and failed historical runs were not changed.

### Previous reprocessing delivery

Owner: root implementer (exclusive progress writer). Implemented roadmap increment 10 only: a separately published extraction candidate with its own credit, preserved current human corrections, explicit field/item adoption or retention, and invalidation of readiness/plans at start. Nine grouped production-service PostgreSQL checks passed in an isolated temporary database that was removed: concurrent starts/confirmation, stale adoption, terminal failure and late publication, evidence provenance, credit rollback and cleanup. Independent backend review reported no actionable findings. Initial full suite: 423 passed, 3 skipped and one pre-existing authentication timeout; the authentication test passed in isolation. Application typecheck, production build, lint (two pre-existing/generated warnings), harness validation and 20 harness tests passed. Final focused UI suite: 47 tests passed across review/details/processing, including bilingual comparison, selected field evidence, explicit request mapping, keep confirmation, lost-response retries, history preserving selections and external-tab changes preserving unsaved edits. Browser visual QA remains unavailable because the existing .codex/config.toml agents boolean is rejected by the runtime. No schema/dependency changes, application-database writes, provider calls, actual application credit consumption or commits. Increment 11 remains out of scope.

### Previous creation iteration

Active iteration owner: root implementer (exclusive progress writer). Implemented roadmap increments 8 and 9: same-workspace contact duplicates, exact persisted batch preview, explicit confirmation, atomic one-client/N-request creation and durable replay. Explicit readiness remains; reprocessing (increment 10) is deferred. Shared record helpers preserve manual module behavior. Final checks: 409 unit/component tests passed and 3 opt-in tests skipped; 14 production-service PostgreSQL checks passed in an isolated temporary database that was removed; application typecheck, production build, lint (two pre-existing/generated warnings), harness validation and 20 harness tests passed. Independent backend review found no actionable defects. Focused ES/EN UI coverage verifies client choice, exact preview, response recovery, completed read-only review and inline record consultation. Browser visual QA cannot initialize because the pre-existing `.codex/config.toml` agents syntax is rejected by the browser runtime. No schema/dependency changes, application-database writes, AI calls, processing-credit consumption or commits.

### Previous field-recovery iteration

Active iteration owner: root implementer (exclusive writer). Implemented recovery for every identifiable client/request field, preserving only verified evidence and valid sibling data. Discarded fields carry persistent blocking findings; authored correction/decision and mandatory-field validation control readiness. Duplicate/unknown item identities, forged provenance, malformed envelopes and provider failures remain terminal. Prompt v4/policy v3. Focused suite: 118 passed. Full suite: 372 passed, 3 skipped with maxWorkers=1. TypeScript, scoped ESLint, diff whitespace and harness validation passed. Three paced real Groq extractions of the same synthetic call passed, each with two requests, verified retained evidence and zero discarded fields; forced field-recovery behavior is covered by automated regressions. No database repair, migrations, application credit usage or permission changes.

### Previous contact-recovery iteration

Current iteration owner: root implementer (exclusive writer). Implemented bounded deterministic EN/ES spoken-phone normalization and recovery of unsupported phone/email values into empty, evidenced fields with blocking human-review findings. Bilingual messages explain the required decision. Schema/source-evidence validation, atomic credit publication and immutable revisions remain intact. The general suite reported 343 passed, 3 skipped and one unrelated authentication timeout; that test passed in isolation. Application typecheck, scoped lint and harness validation passed. Real Groq synthetic spoken-contact extraction passed with the expected international phone, literal confirmed email and two prioritized requests. Earlier live attempts returned one HTTP 400 json_validate_failed and two request-title quote mismatches; the prompt now clarifies literal request quotes as well as phone normalization. No database repair, migrations, permission changes, private-audio upload or application credit consumption.

### Previous implementation baseline

Owner: root implementer. Implemented closed Groq extraction, atomic proposal/credit publication and versioned human review inside the existing detail modal. Existing transcribed conversations continue explicitly using their current reservation; new runs continue automatically. Drafts, revisions, evidence links, conflict handling, readiness, bounded extraction leases and proposal cleanup are covered by automated checks. The full suite passed 307 tests before the additional provider-access regression; application typecheck and production build passed, lint reported no errors. Ten real PostgreSQL checks passed in a temporary database, which was removed. The additive migration was then applied successfully to the configured local development database. Duplicate resolution, creation plans/batches and reprocessing of published proposals remain deferred. The network issue is resolved. Real synthetic Spanish and English extractions passed: two requests each, literal evidence references, explicit email retained and absent contacts left empty. Prompt v2 clarifies exact observed client field substrings without relaxing validation. A 429 and an English HTTP 400 were observed; the subsequent English smoke passed. No private audio, application records or application credits were used.

## Iterations

| Date | Iteration | Status | Evidence and deferred work |
|---|---|---|---|
| 2026-09-06 | Shared Prisma persistence foundation | started | Owner: agent-data. Establish only the shared PostgreSQL/Prisma schema and server persistence boundary; no phase behavior, migration, or database target is delivered. |
| 2026-09-06 | Initial documentation curation | started | Owner: requirements curator. Create the scoped brief, dependencies, acceptance scenarios and source ledger; preserve implementation status as not-started. |
| 2026-09-06 | Initial documentation curation | documentation-complete | Harness validation passed; scoped checks confirmed nine unique IDs, brief sections, not-started progress and all local links/anchors; scoped git diff --check passed. Product implementation remains deferred to its delivery phase. |
| 2026-09-06 | Documentation review corrections | started | Correct damaged punctuation and make synchronization ledgers describe the complete material iteration. |
| 2026-09-06 | Documentation review corrections | documentation-complete | Corrected punctuation and iteration-wide synchronization results. Scoped metadata/link/anchor/corruption/ledger checks, harness validation and diff whitespace check passed; product status remains not-started. |
| 2026-09-06 | Shared Prisma persistence foundation | ready-for-manual-commit | Prisma schema validation and client generation passed; lint and diff checks passed. No migration or PostgreSQL command was run. |
| 2026-09-08 | Extraction and versioned review | started | Owner: root implementer for this progress file. Approved roadmap increments 6 and 7; preserve SSR/module patterns and immutable evidence, deliver explicit saving/readiness and no-request incomplete drafts. |
| 2026-09-08 | Extraction and versioned review | automated-verification-passed; provider-access-blocked | Implemented and tested extraction/workflow leases, atomic proposal/credit settlement, immutable authored revisions, explicit readiness, modal evidence and unsaved/conflict handling, bilingual UI and cleanup. Full suite 307 passed/1 skipped with maxWorkers=2 after a default-concurrency auth-test timeout; typecheck, build and lint passed (warnings only). Ten isolated PostgreSQL migration/constraint/concurrency/cleanup checks passed; temporary database removed. Applied additive migration to local development. Real synthetic Groq smoke failed HTTP 403 even outside restricted execution; models lookup reports network access denied. No real private audio or application records were processed. |

| 2026-09-08 | Real bilingual Groq verification | started | Owner: root implementer. User resolved network access and authorized resuming real synthetic smoke tests. Groq now responds; strict validation rejected the name quote/value alignment. Refine the versioned prompt without weakening evidence validation and rerun ES/EN checks. |
| 2026-09-08 | Real bilingual Groq verification | verification-passed | Real Spanish extraction passed request/evidence/contact assertions; after an English HTTP 400, the isolated English repeat passed. Prompt v2 clarifies exact client field quotes; strict validator regression added. Safe diagnostics expose allowlisted codes/field keys only. Rate-limit 429 also observed; smoke calls are paced. No private audio, database writes or application credit settlement. |

| 2026-09-08 | Spoken contacts and recoverable contact review | started | Owner: root implementer. User supplied a synthetic spoken-phone/email transcript and requested natural interpretation plus partial recovery for human review. Bound changes to extraction validation/prompt, bilingual review messages and regression coverage. |
| 2026-09-08 | Spoken contacts and recoverable contact review | verification-passed | Closed EN/ES token normalization, empty observed-only contact recovery, evidence preservation, blocking/readiness and authored correction tests passed. General suite 343 passed/3 skipped with one auth timeout subsequently passing alone; typecheck/lint/harness passed. Synthetic real Groq case passed after earlier 400 and quote failures. Prompt v3/policy v2; strict fabricated-evidence rejection retained. Existing terminal runs were not modified. |

| 2026-09-08 | General field-level extraction recovery | started | Owner: root implementer. User requested recovery beyond contacts after a nonliteral serviceType quote failed the same audio. Bound changes to field validation, adapter representability, persistent review decisions, bilingual messages and tests; no provider retry-policy or authorization changes. |
| 2026-09-08 | General field-level extraction recovery | verification-passed | 118 focused tests; full suite 372 passed/3 skipped; application typecheck, scoped lint, diff check and harness passed. Tests cover every field, fabricated/missing references and quotes, catalog/length limits, sibling preservation, 50-request idempotence, atomic publication, authored resolution and readiness. Three live Groq calls (GROQ_SMOKE_REPETITIONS=3) on identical synthetic evidence passed with zero discarded fields; simulated bad outputs verify recovery. No database writes or private-audio submissions. |

| 2026-09-08 | Duplicate resolution and atomic conversation creation | started | Owner: root implementer for progress. User approved increments 8/9, explicit readiness, duplicate candidates only and one client choice for the complete request batch. Reprocessing remains deferred. |

| 2026-09-08 | Duplicate resolution and atomic conversation creation | verification-passed; browser-qa-unavailable | 409 unit/component tests passed, 3 skipped; 14 isolated PostgreSQL service checks passed; final typecheck/build/lint/harness passed. Verified full batches, reuse without updates, rollback, concurrent confirmations, replay after expiry/source and record deletion, workspace isolation, unchanged credits and bilingual UI recovery. No schema/dependency changes, application-database writes or commit. Browser runtime blocked by pre-existing local Codex config. Reprocessing deferred. |

| 2026-09-08 | Safe pre-completion reprocessing | started | Root owns progress/backend integration. User authorized roadmap 10 only: preserved revisions, a separate candidate, explicit comparison/adoption, readiness/plan invalidation and failure recovery. UI and isolated PostgreSQL checks use exclusive writers. |

| 2026-09-08 | Safe pre-completion reprocessing | automated-verification-passed; browser-qa-unavailable | Separate candidates, explicit adoption/retention, credit settlement and failure recovery implemented. 9 production-service PostgreSQL groups passed; 48 focused backend tests and 47 final UI tests passed. General suite 423 passed/3 skipped/1 auth timeout; isolated auth rerun passed. Typecheck, production build, lint (2 prior/generated warnings), harness and whitespace checks passed. Independent backend review found no actionable defect. Browser runtime blocked by existing Codex config. Roadmap 11 deferred; no application data writes, real provider calls, schema changes or commit. |

| 2026-09-08 | Provider JSON rejection recovery | started | Root owns this iteration. User reported explicit Groq 400 json_validate_failed during reprocessing; scope is bounded recovery within the current run and corrected preserved-review guidance. |
| 2026-09-08 | Provider JSON rejection recovery | verification-passed | 38 focused tests passed, including retry success/exhaustion, strict output options, non-retryable unrelated 400s and preserved-review UI. Real Spanish synthetic Groq extraction passed; intermittent rejection tested deterministically. Scoped ESLint, application typecheck and whitespace passed. No application data/credit changes, private evidence submission or commit; historical failed runs remain terminal. |

## Documentation Synchronization

Provider JSON rejection recovery: README, architecture and brief document the
bounded error classification and contextual failure recovery. Product/data model
remain unchanged (same credit/revision guarantees). Existing provider profile,
schema, dependencies and SDK retry settings remain unchanged.

Final selector review: existing request option values use a distinct prefix so
request IDs cannot collide with the add/ignore choices. All 8 bilingual comparison
tests passed after this correction, including an existing request with ID `add`;
focused ESLint and final whitespace checks passed.

Roadmap 10: product, architecture, logical model, brief and README synchronized
for candidate comparison/adoption, explicit retention, original-evidence reuse,
credits, failure recovery and cleanup. No schema/dependency or provider setup
changes. Integrated core closure (roadmap 11) remains outside this iteration.

Current iteration: product, architecture, data model, brief, index and README
synchronized for one client choice, persisted exact previews, atomic creation
and durable receipt recovery. Shared-helper changes and regressions are also
recorded under REQ-002. Reprocessing remains explicitly deferred.

General-recovery iteration: product, architecture, logical model and brief updated
for field-local discard rather than whole-run failure, unchanged schema/credit
boundaries and persistent human decisions. No new database enum or migration.
Index, README and navigation reviewed with no product-stage or setup change.

Previous contact-recovery iteration: product, architecture, logical data model and
brief synchronized for bounded spoken-phone normalization and observed-only
contact review. Existing schema, credit and revision contracts remain unchanged.
Final focused checks: 90 tests passed, application typecheck and scoped lint
passed. Terminal-failure copy now distinguishes no automatic retry from starting
a new eligible run; it no longer claims the conversation cannot be processed.

| Document | Result | Justification |
|---|---|---|
| [Brief](brief.md) | updated | Captures the approved capability; no implementation claim. |
| [Index](../index.md) | updated | Records priority, status and dependency order. |
| [Product](../../product-source-of-truth.md) and [architecture](../../solution-architecture.md) | updated | Synchronized manual CRUD, multiple-request batches, fields, credit settlement, deletion rules and nine delivery phases. |
| [Data model](../../data-model.md) | updated | Created logical fields, cardinalities, origins, credit settlement and deletion contracts, including initial allocation and exactly-once grants. |

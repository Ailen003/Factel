# Requirement Progress: REQ-004 - Process conversations and preserve evidence

| Field | Value |
|---|---|
| Status | active |
| Last updated | 2026-09-08 |
| Current iteration | Extraction continuation and atomic credit settlement - automated verification passed |

## Current State

Roadmap increments 6/7 now extend this boundary through extraction and atomic
review-proposal/credit publication in REQ-005. New runs continue automatically;
legacy transcribed runs continue explicitly with their existing reservation.
Failed extraction retries reuse the immutable transcript with a new reservation.
Polling spans the transient TRANSCRIBED boundary; expired worker leases cannot
publish. Root owns this integration progress update. Automated verification passed;
real Groq access is restored, and synthetic Spanish/English extraction checks passed.
These provider checks do not replace a full audio-to-record creation demonstration.

The established AssemblyAI implementation preserves immutable original evidence,
diarization fallback, private playback and recoverable deletion. Speech is now
locally enabled; no new real audio processing was performed in this iteration.
The player remains mounted across Information, Transcript and Review tabs.
Successful transcript persistence alone still does not consume credit; only
the atomic REQ-005 proposal publication closes the reservation as consumed.

## Iterations

| Date | Iteration | Status | Evidence and deferred work |
|---|---|---|---|
| 2026-09-06 | Shared Prisma persistence foundation | started | Owner: agent-data. Establish only the shared PostgreSQL/Prisma schema and server persistence boundary; no phase behavior, migration, or database target is delivered. |
| 2026-09-06 | Initial documentation curation | started | Owner: requirements curator. Create the scoped brief, dependencies, acceptance scenarios and source ledger; preserve implementation status as not-started. |
| 2026-09-06 | Initial documentation curation | documentation-complete | Harness validation passed; scoped checks confirmed nine unique IDs, brief sections, not-started progress and all local links/anchors; scoped git diff --check passed. Product implementation remains deferred to its delivery phase. |
| 2026-09-06 | Documentation review corrections | started | Correct damaged punctuation and make synchronization ledgers describe the complete material iteration. |
| 2026-09-06 | Documentation review corrections | documentation-complete | Corrected punctuation and iteration-wide synchronization results. Scoped metadata/link/anchor/corruption/ledger checks, harness validation and diff whitespace check passed; product status remains not-started. |
| 2026-09-06 | Shared Prisma persistence foundation | ready-for-manual-commit | Prisma schema validation and client generation passed; lint and diff checks passed. No migration or PostgreSQL command was run. |
| 2026-09-07 | Durable transcription and evidence | started | Owner: requirements curator for documentation synchronization. Record the approved `TRANSCRIBED` boundary, durable workflow/outbox and AssemblyAI integration, reserved-but-unconsumed credits, evidence/diarization behavior, deletion cleanup and private configuration; implementation claims remain pending observed verification. |
| 2026-09-07 | Durable transcription and evidence | implementation-complete; verification-pending | Observed schema/migration, credit initialization and start services, workflow/outbox/cron, AssemblyAI adapter and normalization, persistence/deletion paths, bilingual UI/messages and private configuration. Focused source tests, `prisma validate`, harness validation and scoped documentation checks passed. Dependency installation/lockfile synchronization, Prisma client generation, database migration exercise, full automated verification/build, and real English/Spanish provider smoke tests remain deferred until the user installs dependencies and returns. |
| 2026-09-07 | Durable transcription and evidence | scoped-verification-passed; install-dependent-checks-pending | Independent read-only verification passed `git diff --check`, Prisma schema validation and 21 tests across nine executable focused suites. The replay, orphan-cleanup, idempotent provider deletion and paired-null time-constraint repairs were confirmed by inspection. The workflow/provider suites, generated client, isolated migration, typecheck, lint, full suite, build and bilingual provider smoke remain deferred because the user will install `workflow` and `assemblyai` after handoff. No install, database mutation or provider call was performed. |
| 2026-09-07 | Durable transcription and evidence | post-install-verification-started | The user reported dependency installation complete. Verification resumed without running `pnpm install`; planned evidence includes dependency/lockfile integrity, Prisma client generation, deferred workflow/provider suites, typecheck, lint, full tests, build and a safe isolated migration check where local infrastructure permits. |
| 2026-09-07 | Durable transcription and evidence | automated-verification-passed; provider-smoke-pending | Confirmed pinned dependencies and lockfile, generated Prisma Client 7.10.0, passed the deferred workflow/provider suites and added explicit idempotent AssemblyAI 404 cleanup coverage (10 focused tests), full suite (236 passed, 1 skipped), application/reference typecheck, lint with one pre-existing warning, production build, harness validation (20 tests) and `git diff --check`. Applied all four migrations twice to newly created local PostgreSQL databases, verified `TRANSCRIBED` and `original_transcripts_immutable`, then dropped both isolated databases. Fixed test isolation by restoring the transaction mock between workflow cases. Real AssemblyAI smoke remains pending: the key is configured, but `CONVERSATION_SPEECH_ENABLED=false` and no non-sensitive ES/EN audio samples are available. |
| 2026-09-08 | Persistent detail audio player | started | Move private audio playback from the Information tab to the stable conversation-detail shell above the tabs so playback remains available and mounted while switching between Information and Transcript. Add a component regression test for visibility and player identity across tab changes. |
| 2026-09-08 | Persistent detail audio player | implementation-complete; verification-passed | Moved the existing authorized player and retry/error UI above the tab root without changing its private playback route. A Radix tab regression test proves Transcript becomes active while the exact same audio DOM node remains mounted. Detail-module tests passed (4 tests), focused lint passed, and application typecheck passed. |

| 2026-09-08 | Extraction continuation integration | started | Owner: root implementer. Extend the established transcription boundary into REQ-005 without retranscribing legacy evidence or duplicating reservations. |
| 2026-09-08 | Extraction continuation integration | automated-verification-passed | Automatic new-run extraction, explicit legacy continuation, transcript reuse on failed-run retry, fenced worker leases, atomic publication/consumption and deletion cleanup verified through focused tests, full suite, production build and isolated PostgreSQL checks. Real Groq smoke blocked by HTTP 403; no real private audio was submitted. |

## Documentation Synchronization

Iteration 2026-09-08: REQ-005 implements the previously deferred downstream
publication contract. Its progress file records the shared observed checks.

| Document | Result | Justification |
|---|---|---|
| [Brief](brief.md) | updated | Refines the accepted phase-4 scope, flows, constraints, acceptance scenarios and synchronization ledger. |
| [Index](../index.md) | updated | Marks REQ-004 active with verification pending while preserving its priority and dependency order. |
| [Product](../../product-source-of-truth.md) | updated | Adds the explicit `TRANSCRIBED` lifecycle and credit boundary, durable dispatch behavior, safe provider retry and provider cleanup intent. |
| [Architecture](../../solution-architecture.md) | updated | Records the transactional outbox, run-only workflow input, AssemblyAI profile/polling, evidence normalization/fallback and remote cleanup boundaries. |
| [Data model](../../data-model.md) | updated | Synchronizes physical field names, intermediate status, initialization marker, active-run/ledger/evidence constraints and immutable-transcript enforcement. |
| [Project README](../../../README.md) | updated | Documents the delivered surfaces, private speech variables, cron reconciliation, credit initializer, transcript UI and deferred extraction/verification. |

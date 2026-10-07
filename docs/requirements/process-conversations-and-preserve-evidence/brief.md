# Requirement Brief: Process conversations and preserve evidence

> **ID:** REQ-004
> **Status:** active
> **Priority:** high
> **Phase:** 4
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#103-processing-transcription-and-diarization); [product-source-of-truth.md](../../product-source-of-truth.md#24-baseline-business-contract); [solution-architecture.md](../../solution-architecture.md#10-conversation-processing-architecture); [solution-architecture.md](../../solution-architecture.md#11-speech-transcript-and-diarization-architecture); [data-model.md](../../data-model.md#4-execution-and-governance)

## Intent

Produce immutable transcript evidence through durable processing with recoverable failures and explainable credit accounting.

## Actors

Trial user; durable workflow; speech adapter; credit service.

## Scope

- Integrate Vercel Workflow (Queues only where lower-level delivery is needed) with persisted runs, attempts, checkpoints, correlation, visible state and bounded retries.
- Start workflows from a transactional outbox using only a processing-run identifier; the interactive request attempts immediate delivery and an authenticated reconciler retries pending or interrupted dispatch without duplicating the run.
- Integrate AssemblyAI through an application-owned speech contract using declared `en`/`es` language, speaker labels and pinned speech models; store original transcript separately from versioned timestamped generic/unknown speaker segments and warnings.
- Persist literal transcript text, its SHA-256 fingerprint and stable text-aligned evidence. Use utterance evidence when it aligns safely, deterministic word grouping otherwise, and one global fallback span with a warning rather than publishing unreliable offsets.
- Keep authorized audio playback in the stable conversation-detail shell above the Information and Transcript tabs so the same player remains available and mounted while the user reviews either view.
- Initialize grants exactly once for existing trial workspaces using their intended allocation and integrate the same idempotent grant into new account creation. Implement ledger allocation (configurable initial default ten), atomic reservation, release and consumption; final consumption requires a valid proposal available for review, integrated in REQ-005.
- Record bounded invocation profile/provider, remote job reference, duration, latency, usage, status and safe failure metadata; add speech switches and evidence cleanup, including idempotent remote-transcript deletion.

## Out of Scope

Extraction/review implementation (REQ-005), full credit operations UI (REQ-007), real-time transcription.

## Candidate Flows

1. User starts processing verified audio; one transaction validates state/version/policy/balance, initializes credits if needed, reserves one credit, creates the run/checkpoint/outbox event and returns promptly. Duplicate intent or a double click resolves to the active run.
2. Outbox delivery starts a workflow with only the processing-run identifier. Each durable step reloads authorization, deletion state and persisted authority before obtaining a temporary private audio URL or contacting the provider.
3. Speech finalizes immutable original evidence and optional derived speaker segments. The conversation reaches `TRANSCRIBED`, keeps the run and reservation open at the extraction boundary, and exposes persisted progress and evidence.
4. Missing or unreliable diarization retains literal transcript access with an explicit warning and no invented speaker. Transient polling/persistence failures retry only at safe idempotent boundaries.
5. Terminal failure or deletion revokes write authority, restores an open reservation once and schedules local/private-audio and provider cleanup. A late delivery cannot recreate evidence; a later user retry creates a new run.

## Rules and Constraints

- Transcript success alone never consumes credit. This phase establishes/tests the completion contract; REQ-005 supplies the valid review-proposal signal. Transcript-only intermediate success retains its reservation pending that signal.
- `TRANSCRIBED` is a persisted nonterminal conversation boundary between diarization and extraction. The processing run is not `SUCCEEDED`, has no `finishedAt`, and has no `CONSUME` entry at that boundary.
- One logical execution has one reservation and at most one consumption. Technical retries reuse it; a new execution needs a new reservation. A run after terminal failure is a new run.
- Every step reloads authorization/deletion/current state. Duplicate delivery cannot duplicate charges, artifacts or terminal effects; no available credit means no provider execution.
- Original transcript is immutable; derived attribution uses generic/unknown labels and never overwrites evidence. Provider SDK payloads are not domain contracts.
- Provider job creation is not retried blindly when its outcome is uncertain. Polling and idempotent persistence use bounded retry and reconcile persisted provider references.
- Deletion/cancellation races cannot resurrect artifacts. Content deletion after successful review delivery never refunds consumed credits.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-003](../capture-and-manage-conversations/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Initialize existing and newly provisioned accounts, including an explicit zero allocation; rerun initialization and prove one initialization outcome each. Duplicate concurrent start reserves once; exhausted balance, invalid audio and disabled speech start no provider work.
2. Normalize English and Spanish speech success, literal text/fingerprints, aligned offsets, stable evidence IDs, generic speaker labels, optional confidence and missing/unreliable diarization without fabricating attribution. While reviewing the result, switch between Information and Transcript without hiding, remounting or resetting the authorized audio player.
3. Retry/redeliver outbox dispatch and checkpoints without duplicate runs, reservations or artifacts; reconcile transient polling and reject unsafe retry of uncertain provider creation.
4. Persist speech idempotently, expose `TRANSCRIBED`, keep the run/reservation open and prove available/reserved/consumed balances reflect no transcript charge.
5. Using a downstream-result fixture, test successful/duplicate completion callback and failure/cancellation release; explicitly prove transcript-only success never consumes.
6. Suspend/delete during processing and verify local evidence, private media and remote transcript cleanup, no result resurrection, safe bilingual recovery and retained minimal ledger/tombstone proof.

## Source Coverage

CPD-FR-030–039, 089; initial CPD-FR-007 allocation; CPD-FR-070–072, 074–075. Acceptance: credit reservation/release, transcript, diarization fallback and retries; final integration completes in REQ-005. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

None for the approved capability scope. Record implementation evidence and observed gaps in [progress](progress.md); shared policies are governed by the product sources and data model.

## Documentation Synchronization

| Document | Result | Justification |
|---|---|---|
| [Product](../../product-source-of-truth.md) | updated | Adds the explicit `TRANSCRIBED` boundary and reserved-but-unconsumed speech outcome while preserving phase 5 as the chargeable review boundary. |
| [Architecture](../../solution-architecture.md) | updated | Defines run-only workflow input, transactional outbox dispatch, durable polling, normalized evidence/fallback and provider cleanup boundaries. |
| [Data model](../../data-model.md) | updated | Aligns the logical lifecycle, credit initialization marker, workflow/provider/outbox references, evidence constraints and deletion cleanup with this increment. |
| [Inventory](../../documentation-inventory.md) | no-change | Its maintained-document routing remains accurate for this bounded update. |
| [Index](../index.md) and this brief | updated | Marks REQ-004 active and refines the phase boundary and acceptance coverage. |
| [Progress](progress.md) | updated | Preserves the iteration start and records implementation completion with the still-unobserved verification work. |
| [Project README](../../../README.md) | updated | Documents the operational capability, private speech configuration and current phase boundary. |
| Requirements guidance and reusable templates | no-change | The existing brief and append-only progress shapes cover this iteration. |
| Guides and operations documents | not-applicable | No assigned guide or runbook artifact is needed beyond the project setup documentation. |
| Harness documentation | not-applicable | No harness behavior change. |

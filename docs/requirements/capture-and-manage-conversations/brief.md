# Requirement Brief: Capture and manage conversations

> **ID:** REQ-003
> **Status:** candidate
> **Priority:** high
> **Phase:** 3
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#102-conversation-capture-and-audio); [solution-architecture.md](../../solution-architecture.md#82-direct-audio-transfer); [solution-architecture.md](../../solution-architecture.md#164-retention-and-deletion)

## Intent

Capture consented audio privately and manage conversations before processing.

## Actors

Trial user; audited administrator; private storage adapter.

## Scope

- Provide microphone recording with consent notice, permission handling, persistent recording indicator, duration, activity feedback, stop and discard.
- Accept prepared WebM, MP3, M4A/MP4, WAV and OGG audio with upload progress and recoverable failures; enforce 10-minute/25-MB baseline limits server-side.
- Issue short-lived operation/workspace-bound grants for direct upload to private S3-compatible object storage; use Supabase Storage initially and verify actual media, ownership and completed storage before processing eligibility.
- Provide paginated conversation list/detail, source/locale/status, authorized playback, confirmed deletion and durable cleanup/reconciliation.

## Out of Scope

Live transcription, VoIP/telephony, external CRM, automatic retention and AI processing.

## Candidate Flows

1. User acknowledges consent responsibility, grants microphone permission, records, stops and reviews/uploads or discards.
2. User selects a prepared recording; trusted validation verifies the completed upload before making processing available.
3. User plays or deletes a conversation; deletion revokes access immediately while asynchronous object cleanup retries independently.

## Rules and Constraints

- Browser-reported media type, duration and completion are untrusted. Reject unsupported, oversized, over-duration, incomplete and foreign media before processing.
- Never expose permanent storage/provider credentials or public audio URLs. Playback checks current authorization; possession of a grant is not workspace authorization.
- Discard consumes no credit. Content has no automatic expiry; extend account cleanup to conversation/media data.
- Future source deletion preserves business records with a minimal source-deleted marker; later artifacts join the same cleanup contract.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-002](../manage-clients-and-service-requests/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Exercise allowed/denied microphone permission, stop/discard and accessible activity/status in both locales.
2. Accept supported valid formats; reject invalid type, excessive duration/size and incomplete storage server-side.
3. Replay/alter upload grants and cross-workspace playback identifiers; deny unauthorized access.
4. Inject object-storage deletion failure; content remains inaccessible and retry completes cleanup idempotently.

## Source Coverage

CPD-FR-020–028, 070–072, 075. Acceptance: microphone/file input, media rejection, private playback and source deletion. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

None for the approved capability scope. Record implementation evidence and observed gaps in [progress](progress.md); shared policies are governed by the product sources and data model.

## Documentation Synchronization

| Document | Result | Justification |
|---|---|---|
| [Product](../../product-source-of-truth.md) and [architecture](../../solution-architecture.md) | updated | Replaces the Vercel Blob-specific decision with a provider-portable private S3 boundary, names Supabase Storage as the initial provider, and preserves the existing authorization and cleanup contracts. |
| [Data model](../../data-model.md) | updated | Created logical fields, cardinalities, origins, credit settlement and deletion contracts, including initial allocation and exactly-once grants. |
| [Inventory](../../documentation-inventory.md) | updated | Added logical-model and requirement-progress navigation and aligned the maintained product documentation set. |
| [Index](../index.md), [guidance](../README.md) and this brief | updated | Replace inherited backlog with ordered product phases and acceptance criteria. |
| [Progress](progress.md) | updated | Records documentation curation without claiming implementation. |
| [Project README](../../../README.md) and [docs navigation](../../README.md) | updated | Reoriented navigation toward Conversation Processing Demo, its shared model and prioritized product backlog. |
| Reusable brief template | updated | Adds explicit acceptance scenarios and source coverage for future briefs. |
| Reusable progress template | no-change | Existing current-state/append-only history shape is sufficient. |
| Guides and operations documents | not-applicable | No implemented runtime procedure changes in this documentation iteration. |
| Harness documentation | not-applicable | No harness behavior change. |

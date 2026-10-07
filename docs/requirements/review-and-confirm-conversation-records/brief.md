# Requirement Brief: Review and confirm conversation records

> **ID:** REQ-005
> **Status:** active
> **Priority:** high
> **Phase:** 5
> **Source:** [product-source-of-truth.md](../../product-source-of-truth.md#104-extraction-and-human-review); [product-source-of-truth.md](../../product-source-of-truth.md#105-clients-requests-and-confirmed-writes); [product-source-of-truth.md](../../product-source-of-truth.md#24-baseline-business-contract); [solution-architecture.md](../../solution-architecture.md#12-structured-extraction-architecture); [solution-architecture.md](../../solution-architecture.md#14-record-planning-and-transactional-writes); [data-model.md](../../data-model.md#3-conversation-and-review)

## Intent

Turn transcript evidence into one reviewed client and several service requests, then commit the exact approved batch.

## Actors

Trial user; closed extraction task; validator; shared record-plan service.

## Scope

- Integrate AI SDK/Groq behind stable registered task/profile aliases, versioned prompts/schemas, minimized transcript inputs and no extraction tools.
- Propose one client and one or more requests with stable item IDs, observed/normalized values, evidence references, confidence when supplied and missing/ambiguous/conflicting indicators.
- Provide combined audio/original/derived/field review, author/time correction revisions, request add/remove controls, deterministic validation and explicit user readiness.
- Provide separate reprocessing candidates, comparison and explicit adoption; duplicate resolution, exact batch preview and confirmed atomic client reuse/creation plus N requests through REQ-002 services.
- Connect valid review-proposal delivery to REQ-004 credit settlement; add extraction limits/switches, correlation and complete proposal/evidence cleanup.

## Out of Scope

Current implementation increment (roadmap 10): safe pre-completion reprocessing
inside the existing detail modal, using the completed duplicate/creation flow.
Dashboard/demo closure and integrated real-provider verification (roadmap 11)
remain outside this iteration.

Assistant interactions, multiple distinct clients per conversation, post-completion reprocessing/second batches and other business domains.

## Candidate Flows

1. User reviews the proposed client and request set against evidence, fills required gaps and corrects each request without changing original transcript.
2. User marks the valid current revision ready, resolves duplicates, previews exact records and confirms one atomic batch.
3. Before completion, user requests a new execution; compare its separate candidate and explicitly adopt changes without silently replacing prior corrections.

## Rules and Constraints

- Valid for review means schema/evidence checks pass; human-completable business omissions can remain flagged and still count as delivered review output. Ready additionally requires valid mandatory fields/resolved blocking conflicts and an authorized human action.
- If no request is identified, the application supplies one explicitly empty request draft with default provenance and no invented evidence. It is chargeable review output but cannot become ready without human completion.
- Existing `TRANSCRIBED` runs continue by explicit user action using the same reservation. New runs continue automatically. Draft saving is explicit, version-checked and attributed; stale conflicts retain the local draft.
- Apply REQ-002 fields/catalogs. Local phone prefixes require explicit correction. Confidence never authorizes readiness; manual corrections record author/time without invented audio evidence.
- At least one request must remain to confirm. Reuse never silently updates a client. Approval binds workspace, current revision, duplicate decision and exact request set; changes invalidate it.
- Without contact matches, preview one new client with all requests automatically assigned to it. With matches, choose one existing candidate or explicitly acknowledge creating a distinct client. One decision applies to the entire batch; no general client catalog or per-request client selection is included.
- Prepared plans last 15 minutes and are recoverable when reopening the modal. Abandoning returns to ready; saving corrections invalidates all pending plans and requires readiness again. Completion shows a durable receipt and read-only revision history, including after later business-record deletion.
- A conversation permits one successful batch only. Reprocessing is pre-completion only, uses a new execution credit, preserves revision history/corrections and invalidates readiness/plans when starting, and requires explicit adoption into another human revision. A failed reprocessing run preserves the earlier revision for explicit readiness again.
- An unresolved candidate blocks editing/readiness and another extraction. Compare selected client fields; explicitly map candidate request fields to existing requests, add complete candidate requests or remove existing requests. No automatic request matching. Keep-previous retires the candidate with a durable authored decision and preserves the current revision. Successful publication consumes its credit even when the candidate is declined.
- Explicit provider HTTP 400 `json_validate_failed` rejections may retry within the existing bounded run/reservation budget. Generic 400s, uncertain submissions and local validation failures do not gain retries. Exhaustion preserves the previous review and releases the reserve; failed historical runs remain terminal.
- Reject malformed envelopes/ambiguous identities. Discard fabricated evidence and unsupported values at the identifiable field boundary, retaining valid sibling fields and requests with blocking human-review findings. Excluded sensitive values are redacted/blocked from proposals, records and assistant results; original source remains private until deletion.
- Normalize explicit EN/ES phone digit tokens and leading plus words deterministically, without inferred prefixes. Unsupported phone/email transformations with valid literal evidence become empty observed-only fields with blocking ambiguity, not whole-extraction failures. Human review resolves them while preserving other extracted data.
- Replay returns the committed result; uncertain outcomes reconcile before retry. Failure leaves no partial business records. Source deletion removes copied evidence from plans/proposals while preserving independent records.
- Every introduced capability includes server authorization, English/Spanish parity, accessible critical actions, safe audit/telemetry and deletion coverage for its artifacts. All CPD-NFR-001–007 apply proportionally; see the index matrix.

## Dependencies

[REQ-004](../process-conversations-and-preserve-evidence/brief.md) must be delivered first; earlier phases are transitive dependencies.

## Acceptance Scenarios

1. Extract multiple requests for one client; verify item identity, field evidence/catalogs and reject invented evidence/malformed schema.
2. Block readiness for missing contacts, local-only phone or unresolved conflicts; corrections create attributable revisions and confidence alone cannot approve.
3. Add/remove requests with at least one retained; reprocess/compare/adopt without losing correction history, invalidating earlier readiness/plans.
4. Confirm new/reused-client batches; test rollback, replay, stale/expired approval and completed-conversation second-batch rejection.
5. Deliver a valid review proposal with human-completable gaps and consume once; extraction failure/cancellation before delivery releases reservation.
6. Verify sensitive omissions, deletion of evidence copies and retained records/source-deleted provenance in both locales.
7. Accept a spoken international phone such as "plus one, 4-1-5..." with an unchanged observed quote; omit a guessed prefix or unsupported email transformation and preserve both requests. Publish that reviewable proposal with normal settlement, require an explicit ambiguity decision, and continue rejecting fabricated evidence.
8. Recover nonliteral serviceType/title quotes, nonexistent references, missing field evidence, invalid catalog labels and field-length violations without failing other fields/items. Verify discarded quotes/values never become evidence, revalidation is idempotent for 50 requests, and a human decision plus mandatory-field validation controls readiness. Repeated model responses may differ; recovery policy remains deterministic.

## Source Coverage

CPD-FR-040–059 conversation completion, 037–039 integration, 084–089; CPD-FR-070–072, 074–075. Acceptance: extraction/evidence, corrections/readiness, duplicates, exact batch, replay safety and credit completion. See the [coverage matrix](../index.md#functional-requirement-coverage) for shared ownership and non-functional coverage.

## Open Questions

None for the approved capability scope. Record implementation evidence and observed gaps in [progress](progress.md); shared policies are governed by the product sources and data model.

## Documentation Synchronization

Current increment review: product, architecture, logical model and README updated
for separate candidates, explicit selection/retention, credit settlement and
failure recovery. Index/progress track roadmap 10. No new schema, dependency,
provider setup or dashboard work is introduced.
Inventory, navigation and reusable templates reviewed with no changes required.
No separate operations guide or harness change applies. Full account cleanup
remains a later capability; managed-account deletion with domain data stays blocked.

| Document | Result | Justification |
|---|---|---|
| [Product](../../product-source-of-truth.md) and [architecture](../../solution-architecture.md) | updated | Separate extraction candidates, explicit selection/retention, preserved current revision and readiness/plan invalidation. |
| [Data model](../../data-model.md) | updated | Candidate lifecycle, branched revision numbering, provenance remapping and durable decision replay using existing schema. |
| [Inventory](../../documentation-inventory.md) | no-change | Existing document routing covers this increment. |
| [Index](../index.md) and this brief | updated | Track increment 10; integrated closure remains outside this iteration. |
| [Requirements guidance](../README.md) and [docs navigation](../../README.md) | no-change | No documentation navigation or format change. |
| [Progress](progress.md) | updated | Records implementation and observed verification evidence for the current increment. |
| [Project README](../../../README.md) | updated | Documents comparison, credits, failure recovery and isolated reprocessing verification. |
| Reusable brief template | no-change | Existing brief shape is sufficient. |
| Reusable progress template | no-change | Existing current-state/append-only history shape is sufficient. |
| Guides and operations documents | not-applicable | No implemented runtime procedure changes in this documentation iteration. |
| Harness documentation | not-applicable | No harness behavior change. |

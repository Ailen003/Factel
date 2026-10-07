# Conversation Processing Demo Requirements

The approved documentation baseline replaces eight inherited template requirements without archival and restarts numbering at REQ-001. A documented requirement is not an implemented feature.

## Priority and delivery order

The accepted 2026-09-09 [controlled-access policy](../product-source-of-truth.md#25-controlled-trial-policy-accepted-2026-09-09)
excludes public signup from the current roadmap. REQ-001 owns landing
contact/manual provisioning, credential security, the H2C-1 privileged identity
boundary and H2C-2a administrator MFA; REQ-007 owns zero-USD controls, H2C-1
operational capability application/Settings behavior, the shared MFA
prerequisite on those capabilities and trial expiry/cleanup. H2C-2b retains
identity/factor invariants and break-glass under REQ-001, while REQ-007 shares
the owner/operator capabilities, administrative UI, attributable operation and
two-participant transfer controls. The recipient response is contextual and
does not grant general owner administration.
REQ-009 stays deferred and not-started; reopening requires a separate explicit
future scope decision, not automatic activation after baseline completion.
The [roadmap](../roadmaps/public-trial-readiness.md) coordinates remaining work
without asserting that the new policy is implemented.

All eight baseline phases are required. Priority expresses delivery order, not optional scope. Dependencies form REQ-001 → REQ-002 → REQ-003 → REQ-004 → REQ-005 → REQ-006 → REQ-007 → REQ-008. REQ-009 remains deferred; reopening requires baseline completion and a separate explicit future scope decision.

| ID | Phase / requirement | Priority | Status | Depends on | Progress |
|---|---|---|---|---|---|
| REQ-001 | 1. [Secure application foundation](secure-application-foundation/brief.md) | high | candidate | — | [in-progress](secure-application-foundation/progress.md) |
| REQ-002 | 2. [Manage clients and service requests](manage-clients-and-service-requests/brief.md) | high | candidate | REQ-001 | [in-progress](manage-clients-and-service-requests/progress.md) |
| REQ-003 | 3. [Capture and manage conversations](capture-and-manage-conversations/brief.md) | high | candidate | REQ-002 | [not-started](capture-and-manage-conversations/progress.md) |
| REQ-004 | 4. [Process conversations and preserve evidence](process-conversations-and-preserve-evidence/brief.md) | high | active | REQ-003 | [verification-pending](process-conversations-and-preserve-evidence/progress.md) |
| REQ-005 | 5. [Review and confirm conversation records](review-and-confirm-conversation-records/brief.md) | high | active | REQ-004 | [safe reprocessing verified; browser QA unavailable](review-and-confirm-conversation-records/progress.md) |
| REQ-006 | 6. [Workspace AI assistant](workspace-ai-assistant/brief.md) | medium | candidate | REQ-005 | [not-started](workspace-ai-assistant/progress.md) |
| REQ-007 | 7. [Administer and operate platform](administer-and-operate-platform/brief.md) | medium | candidate | REQ-006 | [in-progress](administer-and-operate-platform/progress.md) |
| REQ-008 | 8. [Validate baseline demonstration](validate-baseline-demonstration/brief.md) | medium | candidate | REQ-007 | [not-started](validate-baseline-demonstration/progress.md) |
| REQ-009 | 9. [Capped public registration](capped-public-registration/brief.md) | low | deferred | REQ-008 | [not-started](capped-public-registration/progress.md) |

Credits are initialized and reserved in REQ-004 and consumed only after REQ-005 delivers a schema/evidence-valid proposal for review; persisted `TRANSCRIBED` evidence keeps its run and reservation open and is not chargeable completion. Manual creation services begin in REQ-002 and serve conversation batches and assistant approval later. Security, localization, audit, limits and cleanup accompany each capability.

## Functional requirement coverage

The product source owns CPD-FR definitions. Shared rows identify initial delivery and completion; REQ-008 verifies every baseline row end to end.

| Product IDs | Delivery ownership |
|---|---|
| CPD-FR-001–005 | REQ-001 identity and isolation. |
| CPD-FR-006 | REQ-001 lifecycle; REQ-002–006 incremental domain cleanup; REQ-007 full account deletion. |
| CPD-FR-007 | REQ-004 initial allocation/ledger; REQ-007 allocation/replenishment administration. |
| CPD-FR-008–009 | REQ-001 privileged identity/profile, mandatory administrator TOTP and server-authoritative capability policy; REQ-007 operational capability application and inspection/searchable audit; any earlier exposed content inspection enforces current verified MFA plus reason/audit immediately. |
| CPD-FR-010 | REQ-009 only, deferred. |
| CPD-FR-020–027 | REQ-003 capture, validation, private playback and discard. |
| CPD-FR-028 | REQ-003 deletion foundation; REQ-004–006 own artifact cleanup; REQ-007 full reconciliation. |
| CPD-FR-030–036 | REQ-004 durable processing, speech evidence and invocation metadata. |
| CPD-FR-037–039 | REQ-004 accounting/status contract; REQ-005 valid review-proposal completion integration. |
| CPD-FR-040–049 | REQ-005 extraction, evidence, corrections and readiness. |
| CPD-FR-050–053 | REQ-002 records/duplicates; REQ-005 conversation duplicate decisions. |
| CPD-FR-054–059 | REQ-002 manual shared prepare/confirm/commit; REQ-005 revision-bound atomic batches; REQ-006 reuses services. |
| CPD-FR-060–069 | REQ-006 bounded assistant reads and approved writes. |
| CPD-FR-070–072, 075 | REQ-001–007 enforce localization, audit and safe logs per capability; REQ-008 verifies parity and correlation. |
| CPD-FR-073–074 | REQ-004 processing controls, REQ-005 extraction controls, REQ-006 assistant controls; REQ-007 full operations/alerts. |
| CPD-FR-080–083 | REQ-002 client/request CRUD, required contacts and service field/catalog rules. |
| CPD-FR-084–085 | REQ-005 editable multi-request proposals and one atomic confirmed batch per conversation. |
| CPD-FR-086 | REQ-002 shared manual service/origins; REQ-005 conversational origin and reuse without silent updates. |
| CPD-FR-087 | REQ-002 client deletion restrictions; REQ-003 deletion contract; REQ-005 business-record preservation/source-deleted provenance. |
| CPD-FR-088 | REQ-005 separate pre-completion reprocessing candidates, explicit adoption and stale-plan invalidation. |
| CPD-FR-089 | REQ-004 run/credit contract; REQ-005 successful review availability, failure/cancellation settlement. |

## Non-functional and acceptance coverage

| Product IDs | Delivery and verification |
|---|---|
| CPD-NFR-001 Security | REQ-001 foundation; REQ-002–007 enforcement at every boundary; REQ-008 attack/isolation scenarios. |
| CPD-NFR-002 Privacy and data minimization | REQ-001 disclosure, REQ-003 consent/private media, REQ-004–006 bounded provider/context data, REQ-007 complete cleanup; REQ-008 verifies. |
| CPD-NFR-003 Reliability | REQ-002 atomic/idempotent creation; REQ-003 cleanup; REQ-004 durable retries; REQ-005/006 confirmed outcomes; REQ-007 reconciliation; REQ-008 failures. |
| CPD-NFR-004 Performance and limits | REQ-002/003 bounded lists/media; REQ-004 asynchronous/concurrency controls; REQ-005 extraction; REQ-006 agent bounds; REQ-007 operator controls; REQ-008 verifies. |
| CPD-NFR-005 Auditability and observability | REQ-001 audit foundation, REQ-002–006 correlation, REQ-007 search/alerts, REQ-008 trace verification. |
| CPD-NFR-006 Maintainability and portability | Application contracts/versions and locale parity throughout REQ-001–007; REQ-008 contract/integration checks. |
| CPD-NFR-007 Accessibility and usability | Keyboard, clear state/errors and bilingual parity per phase; REQ-008 complete journeys including missing diarization. |

REQ-008 exercises every [product §16 acceptance criterion](../product-source-of-truth.md#16-product-acceptance-criteria). Delivery ownership is identity/temporary credentials (REQ-001), manual records/shared transactions (REQ-002), capture/media/deletion (REQ-003), credits/transcript/diarization (REQ-004), extraction/corrections/readiness/duplicates/batches (REQ-005), assistant (REQ-006), and audited support/account cleanup (REQ-007). The [business contract](../product-source-of-truth.md#24-baseline-business-contract) and [data model](../data-model.md) govern the additional CRUD, multiple-request, state, provenance and charge-boundary acceptance scenarios in the briefs.

### Product acceptance scenario ownership

REQ-008 verifies all 34 scenarios together; these phases deliver their behavior.

| Product section 16 scenario numbers | Delivery ownership |
|---|---|
| 1-2 | REQ-001 accounts/passwords; REQ-004 ten-credit allocation. |
| 3-4 | REQ-003 bilingual capture and server media rejection. |
| 5-8 | REQ-004 reservation, original evidence and diarization fallback. |
| 9-15 | REQ-005 extraction, corrections, human readiness, duplicates and atomic replay-safe batch; REQ-002 shared service foundation. |
| 16-18 | REQ-006 scoped assistant/approval and equivalence with direct creation. |
| 19 | REQ-001 foundation; all subsequent phase boundaries enforce isolation. |
| 20 | REQ-007 searchable administrative audit; earlier inspections obey the policy. |
| 21 | REQ-004 retry/credit invariants; REQ-005 completion integration. |
| 22-23 | REQ-003 deletion foundation, REQ-004-006 artifact coverage, REQ-007 complete cleanup. |
| 24 | Every phase implements locale parity; REQ-008 verifies complete journeys. |
| 25-28 | REQ-002 manual CRUD, contacts, service contract and concurrent restricted deletion. |
| 29-31 | REQ-005 multi-request batch, safe reuse/source provenance and pre-completion reprocessing. |
| 32 | REQ-004 settlement contract and REQ-005 completion/cancellation race integration. |
| 33 | REQ-002 manual submission policy; REQ-005 proposal policy; REQ-006 assistant filtering. |
| 34 | REQ-003 source cleanup contract, REQ-005 plan/proposal cleanup and REQ-006 referenced-thread cleanup. |

## Documentation Synchronization

| Document | Result | Justification |
|---|---|---|
| [Product](../product-source-of-truth.md), [architecture](../solution-architecture.md), [data model](../data-model.md) | updated | Synchronized manual CRUD, multiple-request batches, fields, credit settlement, deletion rules and nine delivery phases. Added the shared logical model. |
| [Inventory](../documentation-inventory.md) | updated | Added logical-model source and aligned maintained product documentation routing. |
| [Requirements guidance](README.md), nine briefs/progress records and index | updated | Replace inherited backlog with traceable product requirements. |
| [Project README](../../README.md) and [docs navigation](../README.md) | updated | Reoriented navigation toward Conversation Processing Demo, its shared model and prioritized product backlog. |

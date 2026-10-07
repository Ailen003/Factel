# Asterisk call observability utility

## Intent

Provide a small, independently runnable utility that connects to Asterisk AMI
and incrementally observes custom CSV CDR output as a foundation for a future
telephony billing system.

## Current scope

- AMI login with a server-side secret supplied through environment variables.
- Automatic reconnection after a dropped socket.
- Human-readable logging of call lifecycle events.
- A bidirectional AMI smoke action using `CoreShowChannels`.
- Follow-up incremental reading of a custom CSV CDR file.

## Explicit exclusions

No database, pricing, invoices, billing logic, web panel, or automatic writes to
the existing conversation-processing product are included in this increment.
The utility is intended to run as a long-lived CLI/container process, not as a
Vercel serverless request.

## Documentation synchronization

| Document | Result | Rationale |
|---|---|---|
| Product source of truth | no-change | The existing product explicitly excludes VoIP integrations; this is a separate operational utility. |
| Solution architecture | no-change | The existing architecture remains unchanged; the utility is a future external adapter/process. |
| Data model | not-applicable | No persistence or data-model change is in scope. |

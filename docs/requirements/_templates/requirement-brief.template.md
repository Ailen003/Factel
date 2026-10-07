# Requirement Brief: <Title>

> **ID:** REQ-<NNN>
> **Status:** candidate | active | completed | deferred
> **Priority:** low | medium | high
> **Source:** `docs/<authoritative-source>.md#<section>`

## Intent

What user or business problem this requirement addresses.

## Actors

- <actor / role>

## Scope

- <included behavior>

## Out of Scope

- <excluded behavior>

## Candidate Flows

### Flow 1 - <name>

1. ...

## Rules and Constraints

- <business rule, RNF, technical constraint, or dependency>

## Dependencies

- <other requirement, system, API, data model, or feature>

## Acceptance Scenarios

- <observable success, failure, authorization, or recovery scenario>

## Source Coverage

- <applicable product FR/NFR IDs and acceptance criteria; identify shared phase ownership>

## Open Questions

- <question>

## Documentation Synchronization

| Document | Result | Justification |
|---|---|---|
| `<path>` | updated \| no-change \| not-applicable | <why it changed or does not apply> |

Record the initial documentation review here. Refresh affected entries when an
implementation materially changes documented scope.

Create `progress.md` from `_templates/progress.template.md` with every new
requirement. For an existing requirement without one, create it lazily when a
future material iteration implements, reopens, or changes its scope. Keep its
iteration history append-only and do not backfill untouched historical
requirements. The brief captures product intent; progress records outcomes,
not a tool's planning process.

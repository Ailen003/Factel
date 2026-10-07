# Feature: Widget Management

> **Status:** Active &nbsp;·&nbsp; **Owner:** reference &nbsp;·&nbsp; **Requirements covered:** REF-1–REF-7
>
> ⚠️ Reference spec — paired 1:1 with the code at [`.agent/reference/widget/`](../widget/README.md). Not a real project spec; do not implement from this file directly, copy the pattern instead.

## Context

Admins need to manage a catalog of generic **widgets** (name, description, type, active state) with the standard CRUD surfaces: browse/filter, create, edit, view details, delete, and toggle active state. This is the canonical example of a "full shape" module in this project — every other full-CRUD feature spec should follow the same structure.

## Functional requirements

Use RFC 2119 (MUST / SHOULD / MAY) and stable IDs `RF-WID-NN`.

- **RF-WID-01:** The system MUST display a paginated list of widgets, sortable and filterable by `search` (matches `name`) and `isActive`.
- **RF-WID-02:** An authorized user MUST be able to create a widget by providing `name` (required), `description` (optional), and `type` (`type_a` | `type_b`, defaults to `type_a`).
- **RF-WID-03:** An authorized user MUST be able to edit any of a widget's fields (`name`, `description`, `isActive`, `type`) via a partial-update form.
- **RF-WID-04:** Any user with view access MUST be able to open a read-only details view showing all widget fields, including `createdBy`/`createdAt` and `updatedBy`/`updatedAt` audit metadata.
- **RF-WID-05:** An authorized user MUST be able to delete a widget, with a confirmation step.
- **RF-WID-06:** An authorized user MUST be able to toggle `isActive` directly from the list or details view, without opening the full edit form.
- **RF-WID-07:** List, filter, sort, and pagination state MUST be reflected in the URL query string.

## Non-functional requirements

Reference system-wide RNFs from the applicable authoritative project document
listed in `docs/documentation-inventory.md`, or from the selected requirement
brief. List only feature-specific deltas here.

- Applies: `RNF-GLOBAL-01` (auth), `RNF-GLOBAL-02` (i18n — all labels via the `widgets` i18n namespace), `RNF-GLOBAL-04` (server-side validation on create/edit).

## Main flows

### Flow 1 — Create a widget (happy path)
1. User clicks the create trigger on the widget list header.
2. Fills `name` (required) and optionally `description`/`type`; client-side Zod validation runs on submit.
3. `createWidgetAction` (server action) re-validates via `convertCreateWidgetDto`, persists, and the list refreshes with a success toast.

### Flow 2 — Filter and sort
1. User types a `search` term and/or picks an `isActive` filter.
2. `WidgetFiltersDto` is derived via `convertWidgetFiltersDto` and pushed to the URL.
3. `WidgetListContainer` re-fetches server-side with the new `WidgetFiltersDto`; results and pagination update.

### Flow 3 — Toggle active state
1. User toggles `isActive` from the list row or details view.
2. System asks for confirmation, then calls the toggle action; the widget remains in the list under the opposite filter state.

### Flow 4 — Edit a widget
1. User opens edit on an existing widget; form is pre-filled from `WidgetDetails`.
2. Submits a partial change; `convertEditWidgetDto` builds the DTO with only the changed fields.
3. `editWidgetAction` persists; details/list reflect the update and `updatedBy`/`updatedAt` change.

## Business rules

- **Soft delete rule:** deletion in the real project should preserve history when the selected requirement or project context requires it; this reference module uses a hard delete only because it is a compact training example.
- **URL state rule:** list filters/sort/pagination are URL-synced (see `WidgetFiltersDto`).

## Acceptance criteria (Gherkin)

```gherkin
Scenario: Create a widget with defaults
  Given a user opens the "Create widget" form
  When they submit only a name
  Then a widget is created with type "type_a" and isActive true
  And it appears in the list

Scenario: Search filters the list and updates the URL
  Given a user is on the widget list
  When they type a search term matching an existing widget's name
  Then only matching widgets are shown
  And the URL query string includes the search term

Scenario: Toggle active state
  Given a user views an active widget
  When they toggle it to inactive
  Then the widget's isActive field becomes false
  And it is reflected immediately in the list without a full page reload

Scenario: Edit updates only provided fields
  Given a user edits a widget and changes only its description
  Then the widget's name and type remain unchanged
  And updatedBy/updatedAt reflect the edit
```

- [ ] AC-WID-01 — create defaults `type` to `type_a` and `isActive` to `true` when omitted.
- [ ] AC-WID-02 — search/filter/sort/pagination are URL-synced and shareable.
- [ ] AC-WID-03 — edit performs a partial update; unspecified fields are untouched.
- [ ] AC-WID-04 — delete requires confirmation.
- [ ] AC-WID-05 — toggle active state works from both list and details.

## Dependencies

- **Requires:** none (self-contained reference).
- **Affects:** none.

## Open questions

- None — this is a fully resolved reference example, intentionally left without open questions.

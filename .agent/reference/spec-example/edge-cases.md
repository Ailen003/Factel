# Edge Cases: Widget Management

> ⚠️ Reference edge cases — paired with [`spec.md`](./spec.md) and the code at [`.agent/reference/widget/`](../widget/README.md).

| ID | Scenario | Expected behavior | Source |
|---|---|---|---|
| EC-WID-01 | Create submitted with an empty/whitespace-only `name` | Rejected client- and server-side; `name` is required | RF-WID-02 |
| EC-WID-02 | Edit submitted with no changed fields | `convertEditWidgetDto` produces an all-`undefined` DTO; server action MAY short-circuit and skip the write | RF-WID-03 |
| EC-WID-03 | `type` value outside `"type_a" \| "type_b"` reaches the server action | Server-side validation rejects it; `getWidgetTypeInfo` also falls back to a neutral label/style for any unknown value defensively | RF-WID-02, RF-WID-03 |
| EC-WID-04 | User filters by `isActive=false` and then creates a new widget (which defaults to active) | New widget does not appear in the current filtered view; UI should make this discoverable (e.g. via toast or filter hint) | RF-WID-01, RF-WID-02 |
| EC-WID-05 | Delete is triggered on a widget already deleted by another session | Server action returns a not-found error; UI shows a clear message and refreshes the list | RF-WID-05 |
| EC-WID-06 | Search term contains special characters used in the underlying query | Input is sanitized/escaped before being used in the search filter | RF-WID-01 |

## Notes

- This reference module uses a hard delete (`RF-WID-05`) purely to keep the
  training example small. A real requirement should state explicitly whether it
  uses soft or hard delete.

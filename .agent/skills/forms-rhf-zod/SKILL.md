---
name: forms-rhf-zod
description: Load for create/edit forms, React Hook Form containers, shared Zod schemas, triggers, and edit prefill.
---

# Forms: React Hook Form and Zod

Use `modules/<module>/form/` with a shared `<entity>-form.tsx`, separate
create/edit containers, separate schemas, a create trigger, and an edit loader.
Full patterns live under `.agent/reference/widget/form/`.

## Schemas and server validation

Create/edit schemas are explicit; edit may be partial only when the contract
allows it. Use `superRefine` for cross-field rules. Export inferred types.
Visible validation messages enter schema factories from i18n. Reuse the same
schema at the server action boundary before calling the service.

## Containers and shared form

Client containers begin `"use client"` and use `FormProvider`, typed `useForm`,
`zodResolver`, and controlled-safe defaults (`""`, not `undefined`, for text).
On success, show translated feedback, close the modal, then refresh the SSR
view using the established delayed refresh pattern when needed.

The edit loader fetches the entity through the module hook and
`DetailsContainerWrapper`; the edit form prefills defaults from that entity and
submits its ID separately.

The shared form uses `useFormContext`, existing RHF field components, a global
destructive alert, scrollable modal body, and `FormActionFooter`. It does not
receive the form instance as a prop. `isEditMode` may select translated button
copy.

The create trigger owns open state and uses the shared `Modal`; mount the
create container only while open.

Checklist:

- [ ] Separate typed create/edit schemas with i18n messages.
- [ ] Shared schema also validates the server boundary.
- [ ] Provider + typed form + resolver + safe defaults.
- [ ] Shared form uses context and existing RHF primitives.
- [ ] Edit loader handles loading/error and form prefill.
- [ ] Modal content unmounts on close.
- [ ] Focused tests cover schema edges and submit success/failure.

Exact examples:

- `.agent/reference/widget/form/create/`
- `.agent/reference/widget/form/edit/`
- `.agent/reference/widget/form/widget-form.tsx`

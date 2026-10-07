---
name: client-views-modals
description: Load for client list presentation, responsive table/card views, list actions, modals, and confirmation dialogs.
---

# Client Views and Modals

The list presentational begins `"use client"`, receives already-fetched data,
owns selected IDs/open state, and composes responsive views:

- table in `hidden md:block`;
- cards in `block md:hidden`.

It never fetches the server list. Re-export generic list action hooks through
`list/hooks/index.ts` with entity-specific aliases. Keep entity-specific bulk
hooks local because they call entity actions.

Always use `@/components/modal/modal.tsx`. Mount modal/container content only
when its selected ID/open flag exists so close unmounts stale state. Delete and
toggle confirmations use existing AlertDialog-based containers. Keep modal
state in the list presentational or the trigger, not the server container.

Tables use the existing TanStack/shared table primitives, stable row IDs,
selection only when bulk behavior exists, and an action menu. Cards show
essential fields and equivalent actions. Both views must expose behavior
required by the spec and accessible labels for icon-only controls.

Checklist:

- [ ] Client presentational receives data by props.
- [ ] Table and cards preserve equivalent actions.
- [ ] Entity aliases reuse generic hooks.
- [ ] Modal contents mount conditionally.
- [ ] Bulk work uses a focused module hook.
- [ ] Local tests cover modal selection/close and important list regressions.

Exact examples: `.agent/reference/widget/list/`.

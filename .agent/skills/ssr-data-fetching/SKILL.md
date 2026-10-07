---
name: ssr-data-fetching
description: Load for SSR module entry points, server containers, Suspense boundaries, skeletons, or server/client container-presentational separation.
---

# SSR Data Fetching

Use the module `*-content.tsx` as an async Server Component. Receive parsed
filter DTOs from `page.tsx`, call `getTranslations`, render `ModuleHeader` and
client filters, then place each server fetch container in its own Suspense
boundary. Derive the list boundary key from `JSON.stringify(filters)` so URL
filter changes remount it and reveal the skeleton.

Do not wrap client filter controls in a server Suspense just to load their
catalogs. Each remote select uses its own client hook with independent options,
loading, and error state.

A server container is async, has no `"use client"`, state, handlers, or UI
decisions. It awaits the action, passes results to a presentational, and adds
shared pagination when required. Skeletons approximate the final layout.

`page.tsx` awaits `searchParams`, safely parses page/limit/booleans/sort fields
into the module filter DTO, and passes it to content.

Client containers are allowed for item-on-demand workflows such as edit/detail:
the hook loads data and `DetailsContainerWrapper` owns loading/error/empty
states before rendering the presentational/form.

Checklist:

- [ ] Async content uses server translations.
- [ ] Each server fetch has a focused Suspense/skeleton.
- [ ] Filter-derived key resuspends lists.
- [ ] Server containers contain only fetch/composition.
- [ ] Client catalog loading remains per-select.
- [ ] Page parsing produces a valid filter DTO.

Exact examples:

- `.agent/reference/widget/widget-content.tsx`
- `.agent/reference/widget/list/widget-list-container.tsx`
- `.agent/reference/widget/list/widget-list-loading-skeleton.tsx`

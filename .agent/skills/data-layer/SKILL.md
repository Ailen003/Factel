---
name: data-layer
description: Load for module services, actions, types/DTOs, client data hooks, mock stores, or external API route catalogs.
---

# Data Layer

Use inside `modules/<module>/lib/`. Load full examples lazily from
`.agent/reference/widget/lib/`.

## Boundaries

`service (server-only) -> ServiceResponse<T>` contains business/data logic.
Server components may call services/actions as designed. A `"use server"`
action validates/normalizes input and delegates. A `"use client"` hook invokes
the action and owns loading/error/result state.

Choose one concrete data source for a module service: local mock, external API,
or Prisma. Do not select the source at runtime or keep fallback persistence
paths. Load `prisma-orm` only when Prisma is requested or already evidenced.
Project-specific Prisma setup is decided from current official documentation;
the module consumes only the project's established persistence boundary. When
adopting its reference, replace the canonical module service implementation
rather than leaving a second active Prisma variant beside it.

## Services and actions

- `import "server-only"` is the first service line.
- Validate DTOs at the server boundary with the same shared Zod schema used by
  the form; never trust client validation.
- Return `ServiceResponse<T>` for fallible operations. Catch failures and map
  stable error codes; missing single records return `NOT_FOUND`, never success
  with `null`.
- Keep queries and mutations readable and typed.
- `"use server"` is the first action line. Actions stay thin: parse/normalize,
  return `VALIDATION_ERROR` when invalid, then call one service operation.

External APIs use one shared server-only catalog per upstream:
`lib/api/routes/<upstream>-api.routes.ts`. Export a specific `as const` object
of relative paths beginning `/`; dynamic segments use typed functions and
`encodeURIComponent`. Catalogs contain no host or `process.env`.

The service reads a private non-`NEXT_PUBLIC_` base URL, validates `http/https`,
removes trailing slashes, composes it with the catalog path, owns fetch
options, and translates errors to `ServiceResponse`. Never store absolute URLs
or `":id"` string replacement in catalogs.

## Types, hooks, and mocks

Keep domain/enums, entity/detail interfaces, responses, filter UI state,
filter DTOs/converters, then create/edit DTOs/converters in the type module.
Edit DTO fields are optional unless the contract says otherwise. Convert UI
empty values to clean DTO `undefined` values.

Client hooks begin `"use client"` and expose operation, `isLoading`, translated
`error`, result, and `reset`. Wrap prop-facing callbacks in `useCallback`; clear
loading in `finally`. Translate `errors.<code>` with `t.has`, falling back to
the server message.

For a remote select backed by a paginated endpoint, keep the upstream contract
at the service/action boundary. Query names, pagination shape, and search
capability come from the API contract (`page`/`limit`/`search` is only the
widget example; cursor, offset, localized names, or no server search are valid
when the API says so). Normalize that contract into typed response data the
client hook can consume without knowing upstream field names. The hook owns
debounced search when supported, accumulated unique options, `hasNextPage`,
`isFetchingNextPage` and a guarded `loadNextPage`; it invalidates stale
searches. Do not replace this flow with an eager loop that downloads every page.

Mock stores use stable IDs/ISO dates and enough representative records for
meaningful filters and tests. Tests reset mutable stores via a module helper.

## Checklist

- [ ] Correct server/action/client directive first.
- [ ] Shared Zod validation at the server boundary.
- [ ] Stable `ServiceResponse`, `NOT_FOUND`, and i18n error codes.
- [ ] Thin typed actions; clean create/edit/filter DTO converters.
- [ ] External route catalog is relative, encoded, server-only, and pure.
- [ ] Private base URL is validated inside the service.
- [ ] Hook exposes loading/error/result/reset and clears loading in `finally`.
- [ ] Remote select pagination/search is adapted from the real API contract.
- [ ] Focused tests cover success plus meaningful validation/failure branches.

Exact examples:

- `.agent/reference/widget/lib/services/widget.services.ts`
- `.agent/reference/widget/lib/actions/widget.actions.ts`
- `.agent/reference/widget/lib/types/widget.types.ts`
- `.agent/reference/widget/lib/hooks/`
- `.agent/reference/widget/lib/mock/`

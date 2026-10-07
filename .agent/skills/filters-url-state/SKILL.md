---
name: filters-url-state
description: Load for URL-synchronized module filters, filter hooks, responsive controls, and active-filter chips.
---

# Filters and URL State

Use a client hook, container, presentational, and active-filter component under
`modules/<module>/filters/`. Exact patterns live in
`.agent/reference/widget/filters/`.

Initialize local state from `useSearchParams` so refresh/share preserves
filters. Keep UI sentinel values explicit (for example `boolean | ""`) and
convert them to clean DTO `undefined` values. Every filter change and full
reset sets pagination to page 1 in both URL and local pagination state.

Memoize the active count using only non-default filters. Active-filter chips
remove one filter at a time and offer translated clear-all.

The presentational receives state/change callbacks and uses existing
SearchInput/SelectInput/Button primitives. Convert boolean select values at the
edge and give icon-only sort controls accessible translated labels. Preserve
the established responsive grid.

Remote select catalogs use independent client hooks in the module data layer;
each select owns options/loading/error. Do not aggregate them in a blocking
server fetch or couple unrelated select loading states.

When the endpoint is paginated, pass the hook's controlled search and
incremental state directly to the select (`filterValue`, `onFilterChange`,
`hasNextPage`, `isFetchingNextPage`, `onLoadNextPage`). The hook adapts the real
API contract; do not assume the widget example's `page`/`limit`/`search` names
or `totalPages` metadata exist. The dropdown search is ephemeral UI state and
does not enter the route URL; only the selected filter values do.

Flow: control change -> URL update -> server page receives `searchParams` ->
parses filter DTO -> content Suspense key changes -> list refetches.

Checklist:

- [ ] State initializes from URL and conversions are typed.
- [ ] All changes/reset force page 1.
- [ ] Active count/chips reflect non-default filters.
- [ ] Remote catalogs load independently.
- [ ] Paginated remote selects adapt the endpoint contract before reaching UI.
- [ ] Accessible translated controls and focused URL-state tests exist.

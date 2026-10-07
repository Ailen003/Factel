# Prisma service pattern

The project owns the Prisma client/type boundary that services import (for
example, a project-defined `@/lib/persistence/prisma` module). This harness
does not define how that boundary is configured or generated. Import it only
from a Node-runtime, `server-only` module service; do not construct a client
per request, expose it to client components, or import it from Middleware or
Edge runtime code.

Before enabling the service, implement a project-owned current-actor boundary
and authorization policy. Actor IDs are audit data, not authorization: every
read and mutation needs the policy's project-specific owner, role, or tenant
scope. Do not retain an erased `declare` placeholder or an authentication
fallback.

Define reusable `select` objects with `satisfies Prisma.<Model>Select`, derive
payload types from them, and map dates, enums, and relations to the module DTO.
Build `where` and ordering from an allow-list, not raw client strings. Use
`$transaction` for a list/count pair and for coupled mutations. Map known
errors such as unique conflicts and missing records to stable service errors;
log unexpected failures without leaking database details.

The widget Prisma service template demonstrates these rules while preserving
the same exports as the mock reference service. Copy it into the module's
canonical service path; do not leave a second active source variant.

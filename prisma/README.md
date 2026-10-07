# Prisma and PostgreSQL

TalkFlow uses PostgreSQL through Prisma 7. The generated client is intentionally
kept outside version control at `lib/persistence/generated/`; server code imports
the shared singleton from `@/lib/persistence/prisma`. Do not create a client per
request and do not import it from client components, middleware, or Edge runtime.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to the intended isolated
   PostgreSQL database. URL-encode credentials when needed.
2. Run `pnpm install` after dependency changes.
3. Run `pnpm db:generate` whenever `schema.prisma` changes.

Reviewed migrations are included for the initial domain schema and subsequent
additive identity, controlled-trial, owner/operator and TOTP MFA increments.
Read-only status at the start of H2C-2b reports the first ten migrations applied
and current. The new recovery/ownership migration is prepared but must not be
applied until it is reviewed and explicitly approved. After selecting an
isolated development target, inspect migration status and apply reviewed work
with `pnpm db:migrate:dev`.
Use `pnpm db:migrate:deploy` only for a reviewed, committed migration in staging
or production. Never use `db push` or `migrate reset` against a shared target.
`db:migrate:reset` and `db:push` exist only for disposable local development;
the former destroys the target schema's data and the latter bypasses migration
history. Use `pnpm db:migrate:status`, `db:migrate:diff`, and
`db:migrate:resolve` to inspect or recover migration state deliberately.

## Integrity boundary

The Prisma schema provides enum domains, cardinality, idempotency keys, and
workspace-scoped composite foreign keys for core business relationships.
The initial reviewed migration must additionally add PostgreSQL checks or
transactional service enforcement for rules that Prisma cannot model directly:

- nonblank client/request text, client contact presence and valid normalized
  contact pairing; nonnegative media sizes/durations/credits and confidence
  ranges;
- valid status transitions, processing eligibility, append-only evidence and
  revisions, plan/approval freshness, and no conversation reprocessing after a
  completed batch;
- exactly one active processing reservation per run and exactly one terminal
  reservation settlement (consume or restore), with nonnegative ledger balances;
- proposal target/evidence consistency, readiness only with a client draft and
  one-or-more request items free of blocking findings;
- operation-kind payload requirements, one successful conversational batch per
  conversation, and cleanup ordering that nulls live source pointers before
  deleting source content.

These checks do not replace server-side authorization. Services must derive the
workspace from the authenticated server actor, use transactions for coupled
writes, and revalidate deletion/approval/run eligibility at commit time.

`PlatformSettings` is an application-owned singleton addressed only by the
constant `public-access`. Its service is the authority for updates, requires a
platform administrator, and couples every change to an audit event. Public
reads expose only whether access requests are currently available; the contact
email is released only after a valid request is prepared while admission is
enabled.

## Administrator TOTP migration

`20260910223000_admin_totp_mfa` is an additive Better Auth 1.7.3 migration. It
adds `users.two_factor_enabled` with a false default and the plugin-owned
`two_factor` table. The table holds only Better Auth encrypted TOTP secrets and
encrypted backup-code payloads; application code must not duplicate or reveal
that storage. `user_id` is unique to serialize enrollment to one row per user,
and deletion of an identity cascades to its factor record.

This migration is now applied. Before any later schema repair, take a database
backup and inspect `pnpm db:migrate:status`. A destructive rollback requires
first disabling the MFA-enforcement release, then restoring from backup or
applying a separately reviewed forward recovery migration; dropping these
columns while enforcement is live can lock out administrators. Existing users
remain disabled until they complete verified enrollment.

Better Auth mutates its user flag and factor row across separate adapter calls,
so application authorization always requires both `two_factor_enabled = true`
and `two_factor.verified = true`. Audit writes are also a separate durability
boundary: an already verified factor is never rolled back because an audit
write failed. Administrative access stays closed, and an operator must
reconcile the missing safe audit event from server diagnostics without handling
secrets.

## Administrator recovery and ownership migration

`20260911120000_admin_mfa_recovery_ownership` is the additive H2C-2b migration.
It adds a secret-free administrative-security operation ledger, a monotonic
ownership-transfer record, one-global-pending-transfer uniqueness, participant
and lifecycle checks, indexes and two transfer-specific profile-transition
kinds. It rewrites no user, factor, session or earlier migration.

Do not apply it without direct immediate confirmation. Before application,
verify the ten-migration baseline, exactly one active MFA-ready owner, no
role/profile/status/MFA divergence and no drift. After application, validate
the schema and keep recovery/transfer disabled until code and migration are
deployed together. Rollback after use is forward-only: disable the application
paths, preserve/export ledgers, confirm no pending transfer, and use a separately
reviewed migration. Never reconstruct a deleted factor or revoked session.

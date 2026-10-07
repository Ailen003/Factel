# Owner MFA break-glass

Use this procedure only when the sole platform owner still knows the current
password but has lost the authenticator and every backup code. It does not
recover a password, transfer ownership, create an owner, generate a factor or
create a session. Human identity verification is an external operational
control and must finish before mutation.

## Preconditions

- H2C-2b code and its additive migration are deployed together.
- A trusted operator has completed the approved external identity check.
- Exactly one owner is expected and the account is active, credential-backed,
  workspace-ready and currently has a verified Better Auth TOTP factor.
- Prepare a new UUID operation ID, one structured reason and, optionally, a
  short non-sensitive operational reference. Never use a ticket description,
  email content, credential, factor, token, cookie or identity-check detail as
  the reference.

Allowed reasons are `lost_all_factors`, `lost_device`,
`suspected_compromise`, `operational_recovery` and `other`. `other` requires a
safe reference.

## Dry-run

Dry-run is the default and performs aggregate checks only:

```sh
pnpm --silent auth:recover-owner-mfa --email <explicit-owner-address> --operation-id <uuid> --reason lost_all_factors --reference <safe-reference>
```

The output contains only status flags and counts. It must not contain the
address, a user ID, secrets, codes, tokens or cookies. A refusal is a stop
condition; investigate the invariant without editing identity rows manually.

## Confirmed execution

Immediately before execution, reconfirm the selected owner and the external
identity-check outcome. Then run:

```sh
pnpm --silent auth:recover-owner-mfa --email <explicit-owner-address> --operation-id <same-uuid> --reason lost_all_factors --reference <safe-reference> --confirm
```

The `--silent` option is mandatory because ordinary pnpm script output echoes
command arguments, including the explicit selector. Production additionally
requires the separate `--confirm-production` flag.
Do not add that flag to reusable shell aliases or automation.

The transaction acquires the global ownership lock and the owner lock, reloads
all identity invariants, deletes only the Better Auth factor, sets
`twoFactorEnabled=false`, increments the administrative security version,
revokes every owner session, and writes the secret-free ledger and audit. The
password, role, owner profile, workspace and business data remain unchanged.
An equivalent retry with the same operation ID is idempotent; using that ID
with different parameters is rejected.

## Postconditions

1. Confirm aggregate read-only evidence still reports exactly one owner.
2. Confirm that owner has no active session and that MFA flag/factor state agree.
3. Confirm the ledger and audit contain the operation, structured reason,
   timestamp, safe reference and revoked-session count only.
4. Have the owner sign in with the existing password and complete a new TOTP
   enrollment. No prior secret or backup code can be recovered.
5. Verify privileged capabilities only after the new definitive MFA login.

If the command reports uncertainty or any postcondition fails, close access:
revoke owner sessions again through a reviewed database operation, keep the
application's MFA gate enabled, and perform a forward repair. Do not roll back
by restoring factor rows, flags or sessions. Never delete the ledger/audit to
repeat the procedure.

Loss of both the administrative password and MFA is outside this procedure and
outside H2C-2b.

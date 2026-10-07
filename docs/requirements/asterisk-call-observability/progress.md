# Requirement Progress: Asterisk call observability utility

| Field | Value |
|---|---|
| Status | active |
| Last updated | 2026-10-07 |
| Current iteration | AMI local smoke test |

## Current State

The local AMI listener is implemented as a dependency-free Node CLI. The user
provided Asterisk 17.4.0, host `192.168.2.194`, port `5038`, and an AMI account.
The secret is intentionally not stored in source control. Protocol tests pass.
The current environment could not reach TCP `192.168.2.194:5038`, so the real
login and call-event smoke test must run from the user's local machine or a
network location allowed by the PBX firewall. CDR path, column mapping, and
the Asterisk-side network permission are still pending.

## Iterations

| Date | Iteration | Status | Evidence and deferred work |
|---|---|---|---|
| 2026-10-07 | AMI local smoke test | started | Added a standalone AMI listener, protocol tests, local setup guide, and package command. CDR tailing remains deferred until its path and mapping are supplied. |
| 2026-10-07 | AMI local smoke test | active | `node --test scripts/asterisk/ami-protocol.test.mjs` passed 3/3. TCP probe to `192.168.2.194:5038` was unreachable from this environment; no AMI login was attempted. ESLint was unavailable because local dependencies are not installed/exposed. |

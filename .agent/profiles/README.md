# Stack capability profiles

Stack capability profiles compose core `.agent` conventions with optional
technology addons. They do not install packages, require services, or activate
runtime behavior. Select one only when the user requests its stack or durable
repository evidence establishes it.

They are distinct from lifecycle **assurance profiles** (`no-change`,
`standard-change`, and `high-risk`), which describe the rigor of a change.
Capability selection describes technology; it never downgrades the assurance
profile required by a migration, dependency, permission, or other risk.

`nextjs-prisma-postgresql.md` is the initial stack capability profile. Future
addons such as Better Auth or payments add their own capability composition.
When two capabilities have an integration concern, add a small composition
overlay that owns only the boundary between them; do not copy either core
skill or make it globally active.

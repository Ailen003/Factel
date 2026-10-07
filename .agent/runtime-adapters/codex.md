# Codex Native Adapter

Project registration lives in `.codex/config.toml` and thin
`.codex/agents/*.toml` files. Each custom agent points to the portable handoff
and role instead of copying policy. Models inherit; role files set reasoning
effort and workspace-write, while exclusive ownership remains a harness rule.

| Portable operation | Native mapping |
|---|---|
| Spawn | Start the named native subagent with the complete `HARNESS_EXECUTOR_V1` handoff. |
| Activity | Inspect native thread or background-agent status when useful. |
| Steer | Follow up in the same thread; do not create a competing writer. |
| Wait | Observe without treating an empty wait as failure. |
| Interrupt | Stop a writer only for a clear terminal condition or before a safe replacement. |
| Complete | Consume and relay the structured conversational result. |

Interactive Codex must use native subagents, never child `codex exec`.
Subagents inherit the live parent permission mode. If project agents are not
discovered after repository changes, reload/open a new session or use a native
default subagent with the same bounded contract.

Native planning and status features are optional conveniences. They do not
replace the handoff's scope, skills, confirmation boundary, or exclusive writer
rule, and the harness does not store their output. Before replacing a writer,
confirm that the prior writer stopped. Agents never run `git commit`.

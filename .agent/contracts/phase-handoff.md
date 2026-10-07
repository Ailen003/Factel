# Bounded Handoff Contract

Every non-root assignment starts `HARNESS_EXECUTOR_V1`. Use this lightweight
contract for subagents and deliberately inline role boundaries.

## Input

Provide:

- role and concise bounded request;
- allowed editable roots and exclusive artifacts for any writer;
- exact `SKILL.md` paths and `skillResolution` (`paths-injected` or `none`);
- relevant constraints, non-goals, and expected checks;
- a direct user-confirmation condition when the assigned work contains an
  irreversible high-risk action.

The sender may also include a native execution mode, research limit, or time
bound when they are useful. These are conversational coordination details, not
required work plans or persistent state. Architecture assignments may name
their inputs, desired format, and stopping condition.

If a needed safety boundary, writer owner, or editable root is absent, return
`blocked`. Otherwise make bounded, reversible assumptions instead of creating
a broader workflow.

## Output

Return exactly one fenced JSON object for the parent to relay in conversation:

- `role`, `status` (`success`, `partial`, `blocked`), and `summary`;
- `verdict` (`PASS`, `FAIL`, or `not-run`) for verification assignments;
- `executionMode` when relevant (`inline` or `subagent`);
- `rootsUsed`, `skills`, `skillResolution`, `filesChanged`, and
  `exclusiveArtifacts`;
- `checks`: records with `command`, `exitCode`, and `summary`;
- `risks`, `deviations`, and `nextStep`.

The JSON is a structured conversational result only. Do not write it to a
state file or treat it as a prerequisite for later work.

`status` describes whether the assigned executor completed its bounded task;
`verdict` describes the observed verification result. A verifier that completes
all requested checks and observes a failing check returns `status: success`
with `verdict: FAIL`. Use `not-run` only when no verdict could be observed, and
explain why in `risks`, `deviations`, or `nextStep` as applicable.

## Invariants

- Executors do not redelegate, broaden their scope, or load root guidance.
- Stay inside allowed roots and respect another writer's exclusive artifact.
- One active writer owns an exclusive artifact at a time.
- Before taking an irreversible high-risk action, require the direct user
  confirmation specified in the handoff.
- An empty wait or absent optional artifact is not itself a blocker.
- A blocked result names the exact missing decision, path, artifact, or
  external condition.
- Agents never run `git commit`; a PASS only makes work ready for the user's
  manual commit decision.

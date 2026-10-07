# Harness Audit Summary

> Updated 2026-08-12 to distinguish durable lessons from the retired formal
> workflow.

## Conclusion

The earlier harness work established useful habits: keep product intent easy to
find, give collaborators clear boundaries, reuse proven implementation
patterns, and make verification visible. Those habits remain valuable. The
former heavyweight process added central state, mandatory planning artifacts,
and closing records that were disproportionate for this template's day-to-day
work.

The current harness is therefore guide-only. It supports sound judgment rather
than prescribing a lifecycle.

## Lasting lessons

- Keep durable product context in `docs/` and update it only when scope
  actually changes.
- Give a delegated agent an independent responsibility and avoid overlapping
  writers.
- Prefer focused feedback while implementing and use the full repository runner
  when final confidence is needed.
- Treat repository patterns as useful starting points, then verify the code in
  front of you.
- Make results reviewable by reporting files, checks, and unresolved risks.
- Keep builds and dependencies reproducible where the project can control them.

## Current operating model

1. Understand the requested outcome and relevant context.
2. Let the coding tool or agent choose a native plan if one is useful.
3. Implement directly or delegate independent work with clear ownership.
4. Update a requirement brief or other documentation only when durable context
   changes.
5. Run proportionate checks and report the result.
6. If the result is PASS, leave the final review and git commit to the user.

No required planning format, central state record, or closing procedure remains
in the active harness.

## Residual limits

Guidance and checks cannot prove that an agent understood unstated intent,
picked the best design, made a high-quality delegation, or reported a manual
observation perfectly. They also cannot replace human review for security,
destructive operations, or product decisions. Clear scope, focused tests, and
careful user review remain the practical safeguards.

## Historical note

The detailed 2026 audit and completed requirement briefs remain as condensed
historical context. They do not prescribe the current workflow; the developer
and operator guides above are the active source of harness guidance.

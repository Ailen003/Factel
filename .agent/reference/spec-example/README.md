# Requirement Reference — Widget

> **This is not a real project requirement.** It is a training reference paired
> 1:1 with the code reference module at
> [`.agent/reference/widget/`](../widget/README.md).

## Why this exists

`.agent/reference/widget/` shows agents what the **code** for a fully featured
module looks like. This folder shows requirement-writing examples for the same
entity (`Widget`), fields, and features: list, filters, create/edit form,
details, delete, and activation.

Read `spec.md` here with the matching file in `.agent/reference/widget/` to
see how clear requirements map to implementation decisions.

## Files

| File | Purpose |
|---|---|
| `spec.md` | Fully resolved Widget Management feature reference, with no placeholders. |
| `edge-cases.md` | Fully resolved edge cases for the same feature. |

## How to use it

1. Read `.agent/skills/spec-driven-development/SKILL.md` for the scoped work guide.
2. Read `spec.md` and `edge-cases.md` to see requirement-quality rules applied
   to a generic example.
3. Cross-check `.agent/reference/widget/lib/types/widget.types.ts` to see how
   `RF-WID-NN` requirements became concrete fields and DTOs.
4. Use the pattern to clarify the current request; do not treat this reference
   as a required workflow artifact.

New source material starts in the authoritative project documents listed in
`docs/documentation-inventory.md` and is curated under `docs/requirements/`.

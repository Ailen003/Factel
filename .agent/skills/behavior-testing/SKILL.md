---
name: behavior-testing
description: Add focused Vitest unit or component coverage when deterministic behavior changes affect data, services, schemas, URL state, client state, localization, or local component behavior. Use during implementation and verification to select the smallest test layer that proves the changed contract.
---

# Behavior Testing

## Select the Smallest Valuable Layer

- Test pure functions, schemas, services, actions, filters, pagination, and
  state transitions with Vitest.
- Test local React behavior and regressions with Testing Library in jsdom.

Prefer a few contract-shaped cases over broad permutations. Include the
regression that motivated the change and important branch boundaries; do not
add arbitrary coverage targets or snapshots.

## Executor workflow

1. Map each changed behavior to the cheapest layer that can catch its regression.
2. Create the test with the production change, inside the executor's allowed roots.
3. Reset mutable in-memory stores in `beforeEach` through a module helper. Do
   not add HTTP endpoints used only by tests.
4. Run the smallest relevant Vitest target while editing.
5. Report the focused command and outcome with the work handoff.

## Commands

- `pnpm test:unit` is the watch-mode authoring loop.
- `pnpm test:unit:run` is the deterministic unit/component command.
- `pnpm verify:fast` and `pnpm verify` are optional broader feedback commands
  when their coverage is useful for the request.

Include changed test and configuration files in the conversational result.
Exclude caches and generated runtime artifacts.

## Optional manual exploration

An operator may inspect completed work in a browser for diagnosis or
exploratory confidence. A discovered deterministic regression should receive
focused automated coverage when it is addressed.

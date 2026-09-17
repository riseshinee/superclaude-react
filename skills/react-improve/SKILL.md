---
name: react-improve
description: Refactors and improves React code without changing behavior (React edition of SuperClaude /sc:improve) — splitting large components, extracting custom hooks, removing unnecessary useEffect, strengthening types, reorganizing state. Use for "refactor", "clean this up", "improve this code", "extract a hook".
argument-hint: "<path|component> [--type quality|hooks|types|state|structure] [--preview] [--safe]"
---

# react-improve

Target: `$ARGUMENTS`

## Flags
| Flag | Meaning |
|---|---|
| `--type` | Limit the kind of improvement (default: decide from the target) |
| `--preview` | Don't edit; present a before/after plan only |
| `--safe` | If there are no tests, add characterization tests first, then refactor |

## Behavioral Flow

1. **Detect** — Confirm the stack with `react-stack`.
2. **Baseline** — Find and run tests related to the target; record the current pass state. If there are no tests and the change is large, recommend `--safe` or tell the user.
3. **Diagnose** — Pick the applicable recipes below and present a short change plan.
4. **Refactor** — Make small steps, each of which can be verified to preserve behavior.
5. **Verify** — Re-run typecheck / lint / related tests and compare with the baseline.
6. **Report** — What changed and why; explicitly state whether the public API (props, exports) changed.

## Refactoring Recipes

**R1. Remove unnecessary useEffect** (most common, highest impact)
- Values computable from props/state synced via effect+setState → compute during render (`useMemo` if expensive)
- Work that should happen because of an event, done in an effect → move into the event handler
- Resetting state when a prop changes → change `key` from the parent

**R2. Extract custom hooks**
- A bundle of state + effects + handlers unrelated to markup → extract to `useXxx`
- Hooks return values and actions, never JSX
- Follow the project's hook naming and location (`hooks/`, inside feature folders)

**R3. Split large components**
- Extract children by visual section; push state down to where it's used (state colocation)
- Large conditional branches → one component per branch

**R4. Reorganize state**
- Multiple states that change together → one object or `useReducer`
- Contradictory boolean combos (`isLoading`, `isError`, `isSuccess`) → a `status` union
- Server data copied into a global store → move to the server-state tool

**R5. Strengthen types**
- `any` → real types; validate API responses with a schema (if zod etc. is detected)
- Mode-dependent props → discriminated unions
- Explicit event types: `React.ChangeEvent<HTMLInputElement>`, etc.

**R6. Props design**
- Prop drilling 3+ levels → composition (children/slots) first, then Context
- Boolean flag explosion → compound components or a variant prop

## Personas
- For large structural changes, have the `react-architect` agent review the plan.

## Boundaries
**Will**: behavior-preserving refactors, step-by-step verification, explicit notice of public API changes
**Will Not**: mix in features or bug fixes (report them separately), finish with failing tests, mass-edit files outside the target

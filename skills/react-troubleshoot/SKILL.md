---
name: react-troubleshoot
description: Resolves React bugs, errors, and unexpected behavior via reproduce → root cause → fix → verify (React edition of SuperClaude /sc:troubleshoot). Covers infinite re-renders, hydration mismatches, stale closures, state not updating, build/type errors, failing tests. Use for "fix this error", "why doesn't this work", "bug", "blank screen".
argument-hint: "<symptom or error message> [--fix] [--trace]"
---

# react-troubleshoot

Symptom: `$ARGUMENTS`

## Flags
| Flag | Meaning |
|---|---|
| `--fix` | Apply the fix once the cause is confirmed (otherwise present cause + fix and ask) |
| `--trace` | Record evidence (logs, code locations) for each hypothesis as you go |

## Behavioral Flow

1. **Detect** — Confirm the stack with `react-stack` (React version and framework matter for diagnosis).
2. **Reproduce** — Get the full error, stack trace, and repro path. Where possible:
   - Build/type/test errors → run the command yourself
   - Runtime/UI bugs → use **Playwright MCP** to inspect console logs and network
3. **Hypothesize** — Pick up to 3 candidate causes from the symptom table below, ordered by likelihood.
4. **Confirm the cause** — Read code, add logs, or build a minimal repro until the cause is **confirmed**. Don't fix before that.
5. **Fix** — Fix the cause, not the symptom. Add a regression test when feasible.
6. **Verify** — Re-run the repro, run related tests, remove temporary logs.

## Symptom Table

| Symptom | Common cause | Check |
|---|---|---|
| `Too many re-renders` | setState during render, `onClick={fn()}` | Handler passed as reference, not called |
| Effect infinite loop | Object/array/function dependency recreated every render | Referential stability of dependencies |
| Stale values (stale closure) | Effect/interval/callback captured old state | Missing deps, functional update `setX(p => …)` |
| State set but UI unchanged | Mutated object/array and set the same reference | Immutable updates |
| Input loses focus / state resets while typing | Component defined **inside** another component, unstable `key` | Where the component is defined, key |
| List item state gets mixed up | `key={index}` with sort/delete | Stable unique id keys |
| Hydration mismatch | `Date.now()`/`Math.random()`/`window` during render, invalid HTML nesting (`<p><div>`), browser extensions | SSR vs CSR output, nesting rules |
| Effect runs twice in dev | Intended StrictMode behavior | Whether cleanup is correct (not a bug) |
| `Cannot update a component while rendering a different component` | setState/store update of another component during render | Move the update to an effect or handler |
| `Invalid hook call` | Hook inside condition/loop, duplicate React copies | `npm ls react`, hook call sites |
| `Objects are not valid as a React child` | Rendering an object, Promise, or Date directly | Type of the rendered value |
| Next: `useState only works in Client Components` | Hook used in a Server Component | `'use client'` boundary |
| Next: function props serialization error | Passing a function from Server to Client | Server Action or move the boundary |
| Query data doesn't refresh | Query key mismatch, missing invalidation, staleTime | Key structure, mutation onSuccess |
| Fails only in build/CI | Missing env var, import path casing (Linux CI), server-only module imported on client | Local vs CI differences |

## Personas
- If the cause is performance (slowness, jank), measure first (React DevTools Profiler, production build) before changing code.
- If the root cause is structural, suggest a `react-architect` agent review after the fix.

## Boundaries
**Will**: evidence-based root cause, fix the underlying cause, add regression tests, confirm the fix
**Will Not**: list speculative fixes before the cause is known, mask symptoms with `eslint-disable`/`@ts-ignore`/`suppressHydrationWarning`, swallow errors with try/catch

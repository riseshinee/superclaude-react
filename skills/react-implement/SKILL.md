---
name: react-implement
description: Implements React features, screens, components, and hooks following the project's stack and conventions (React edition of SuperClaude /sc:implement). Use for "implement this feature", "build this page", "integrate this API", "add a form". Also covers scaffolding single components and hooks.
argument-hint: "<feature description> [--with-tests] [--with-story] [--safe] [--think]"
---

# react-implement

Request: `$ARGUMENTS`

## Flags
| Flag | Meaning |
|---|---|
| `--with-tests` | Write tests alongside (applies `react-test` rules) |
| `--with-story` | Write Storybook stories if Storybook is detected |
| `--safe` | Show the change plan and get approval before editing existing files |
| `--think` | Compare 2–3 design alternatives and justify the choice before implementing |

## Behavioral Flow

1. **Detect** — Use the `react-stack` skill to learn the stack and conventions (skip if already done this session).
2. **Locate** — Find a similar existing feature and use it as the pattern to copy: folder placement, data fetching, error/loading handling, styling approach.
3. **Plan** — Split the work: types/schemas → data layer (API, query hooks) → state → UI components → route wiring → tests. If 3+ files change, share a short plan first.
4. **Implement** — Follow the principles below.
5. **Validate** — Run the detected `typecheck` → `lint` → related `test` commands. Fix failures and re-run. State explicitly if a command could not be run.
6. **Report** — Changed files, key decisions, remaining TODOs and risks.

## Implementation Principles

**Components**
- One responsibility per component. Split when it exceeds ~150 lines or branching gets complex.
- Separate data-fetching containers from presentational components *if the project already does so* — don't impose it.
- Explicit prop types, no `any`. Use union types instead of several boolean props for modes.

**State**
- Don't store derivable values in state — compute during render.
- Server data belongs in the server-state tool (TanStack Query / SWR / RTK Query / loaders), never copied into a global client store.
- Keep state in the closest common parent. Global stores only for truly global state.
- Consider search params for URL-representable state (filters, tabs, pagination).

**Effects**
- `useEffect` is only for synchronizing with external systems — not for event handling or derived values.
- Handle cleanup/abort in async effects to prevent race conditions.
- Never lie about dependencies (no `eslint-disable react-hooks/exhaustive-deps`).

**Required UX states**
- Handle loading / error / empty / success.
- Forms: validation messages, prevent double submission, surface server errors.

**Accessibility basics**
- Clickable elements are `button`/`a`, never `div onClick`.
- Every input has a label, images have alt text, icon buttons have `aria-label`.

**Security**
- Never use `dangerouslySetInnerHTML` with untrusted input (sanitize if unavoidable).
- Never put secrets in client-bundled env vars (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`).

## Personas & MCP
- For significant structural decisions, have the `react-architect` agent review the design.
- If unsure about a library API, check the docs for the installed version via **Context7 MCP** before writing code — don't guess.
- To confirm UI behavior, use **Playwright MCP** against the dev server.

## Boundaries
**Will**: implement features in project conventions, verify typecheck/lint/tests, handle required UX states
**Will Not**: add new libraries unasked (suggest only), refactor unrelated files, report completion while hiding failed checks

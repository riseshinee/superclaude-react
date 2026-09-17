---
name: react-stack
description: Detects a React project's stack (framework, React version, state management, styling, testing tools, folder structure) and summarizes its conventions. The shared foundation that every other react-* skill runs first. Also use for "what stack is this", "understand the project structure", "which libraries does this use".
argument-hint: "[projectDir]"
---

# react-stack — Stack Detection & Project Conventions

**Step 0** for every `react-*` skill. The goal is to follow the tools and conventions the project actually uses instead of writing code from assumptions.

## 1. Run the detection script

Run `scripts/detect-stack.mjs` from this skill's folder. The path depends on where the skills were installed, so check which one exists:

- Project install: `.claude/skills/react-stack/scripts/detect-stack.mjs`
- Global install: `~/.claude/skills/react-stack/scripts/detect-stack.mjs`

```bash
node .claude/skills/react-stack/scripts/detect-stack.mjs $ARGUMENTS
# add --json for machine-readable output
```

If Node cannot be run, read `package.json`, the lockfile, and config files (`vite.config.*`, `next.config.*`, `tsconfig.json`, `components.json`) directly and fill in the same fields.

## 2. Confirm conventions from real code (what the script can't see)

Dependencies tell you *what* is used, not *how*. Read 2–3 representative files and confirm:

| Item | What to check |
|---|---|
| Component declaration | `function Foo()` vs `const Foo = () =>`, default vs named export |
| Props typing | `interface FooProps` vs `type`, whether `React.FC` is used |
| File naming | `PascalCase.tsx` / `kebab-case.tsx` / `index.tsx` barrels |
| Colocated files | `Foo.test.tsx`, `Foo.stories.tsx`, `Foo.module.css`, `__tests__/` |
| Import paths | path aliases such as `@/`, depth of relative imports |
| Data fetching | custom hooks (`useXxxQuery`), server components, loaders |
| Next.js | where `'use client'` boundaries sit, whether Server Actions are used |

If `CLAUDE.md`, `CONTRIBUTING.md`, or lint rules exist, **they override the general guidance in these skills**.

## 3. Summary format

Summarize briefly in this format and use it as the reference for the rest of the task:

```
[Stack] Next.js 15 (app router) · React 19 · TS · pnpm
[State] zustand (client) · tanstack-query (server)
[Style] tailwind + shadcn-ui
[Test]  vitest + testing-library + msw · playwright (e2e)
[Conv]  named exports · function declarations · kebab-case files · @/ alias · colocated tests
[Cmds]  dev=`pnpm dev` test=`pnpm test` lint=`pnpm lint` typecheck=`pnpm typecheck`
```

## 4. Key framework branches

Branching rules the task skills rely on. Details in `references/frameworks.md`.

- **Next.js App Router**: Server Components by default. Add `'use client'` only where interactivity, browser APIs, or hooks are needed — as close to the leaves as possible. Fetch data on the server.
- **Next.js Pages Router**: Keep `getServerSideProps`/`getStaticProps` conventions. Don't mix in App Router patterns.
- **Vite / CRA SPA**: Everything is client-side. Code splitting via `React.lazy` + the router.
- **Remix / React Router framework mode**: `loader`/`action` first; prefer `<Form>` for mutations.
- **React Native / Expo**: No DOM elements or CSS files — use `View`/`Text`/`StyleSheet`. Accessibility via `accessibilityLabel` and friends.
- **React 19+**: `use`, `useActionState`, `useOptimistic`, and ref-as-prop are available. Avoid introducing new `forwardRef`.
- **React ≤17**: Newer hooks (`useId`, `useTransition`, …) are unavailable — check the version before suggesting them.
- **React Compiler enabled**: Don't recommend manual `useMemo`/`useCallback`/`memo` by default.

---
name: react-analyze
description: Analyzes a React codebase for quality, architecture, performance, security, and accessibility, producing a prioritized report (React edition of SuperClaude /sc:analyze). Use for "analyze the code", "review this codebase", "find problems", "diagnose the structure". Does not modify code.
argument-hint: "[path] [--focus quality|architecture|performance|security|a11y] [--depth quick|deep]"
---

# react-analyze

Target: `$ARGUMENTS` (defaults to all of `src/`)

## Flags
| Flag | Meaning |
|---|---|
| `--focus <area>` | Analyze one area only. Without it, cover all areas shallowly |
| `--depth quick` | Heuristic grep-based scan of representative files (default) |
| `--depth deep` | File-by-file reading + parallel sub-agent analysis |

## Behavioral Flow

1. **Detect** — Confirm the stack with `react-stack`. Then get a fresh `react-map` and use it to locate code, following its token budget rules.
2. **Map** — Folder structure, route list, largest component files (top 10 by line count), dependency direction. The map's `## Routes` and `## Hotspots` sections cover most of this.
3. **Scan** — Use Grep with the checklist below to find candidates, then read those files to **confirm each issue is real**. Never report raw grep hits.
4. **Deep (optional)** — With `--depth deep`, delegate areas in parallel: architecture/performance→`react-architect`, security→`react-security`, test gaps→`react-qa`.
5. **Report** — Output in the format below.

## Checklist (detection signals by area)

**quality**
- Components over 300 lines, 10+ props, ternaries nested 3+ deep
- `any`, `as unknown as`, `@ts-ignore`, `eslint-disable`
- Duplicated fetch/formatting logic, dead code, unused exports

**architecture**
- Reverse-direction imports (shared → features, components → pages)
- Circular dependencies; barrel (`index.ts`) overuse causing huge imports
- Server data copied into global stores; prop drilling 4+ levels
- Next.js: `'use client'` placed unnecessarily high

**performance**
- New objects/functions passed to memoized children each render; Context value recreated each render
- Index keys, unvirtualized large lists, no route-level code splitting
- Derived state synced via setState inside `useEffect`

**security**
- `dangerouslySetInnerHTML`, `eval`, `new Function`, `javascript:` URLs
- Secrets in client-bundled env vars; tokens stored in `localStorage`
- Unvalidated redirects (`window.location = param`)

**a11y**
- `onClick` on `div`/`span`, missing `img` alt, unlabeled inputs, `tabIndex` > 0
- Modals without focus trap, `outline: none` without replacement

## Report Format

```markdown
## React Analysis — <target> (<one-line stack>)

### Summary
- Grade per area (A–D) and the top 3 takeaways

### Findings
| # | Severity | Area | Location | Problem | Suggestion |
|---|---|---|---|---|---|
| 1 | 🔴 High | security | src/x.tsx:42 | ... | ... |

### Recommended order
1. (quick wins first) → which skill handles it: `react-improve`, `react-implement`, `react-test`
```

Severity: 🔴 High (bugs, security, data loss) / 🟠 Medium (maintainability, performance) / 🟡 Low (style, consistency).

## Boundaries
**Will**: findings backed by file:line evidence, prioritization, hand-off to follow-up skills
**Will Not**: modify code, report unverified grep hits, inflate taste differences into problems

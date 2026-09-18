---
name: react-map
description: Builds and reuses a cached, compact map of a React codebase (routes, exported components/hooks, stores, data hooks, import fan-in, test coverage) in .claude/cache/react-map.md, so skills grep one small file instead of globbing and reading the source tree. Also defines the token-budget rules every react-* skill follows. Use for "where is X", "which files use Y", "give me an overview of the codebase", "save tokens", "reduce context usage", or before any task that would otherwise explore many files.
argument-hint: "[projectDir] [--refresh]"
---

# react-map — Cached Project Map & Token Budget

Exploring a codebase with Glob and Read is the biggest token cost in most React tasks, and it is repeated in every session. This skill replaces that with a one-line-per-file index that is rebuilt only when source files change.

## Flags
| Flag | Meaning |
|---|---|
| `--refresh` | Rebuild even if the map is fresh |

## 1. Get a fresh map

The script lives in this skill's folder: `.claude/skills/react-map/scripts/build-map.mjs` (project install) or `~/.claude/skills/react-map/scripts/build-map.mjs` (global install). Node 18+, no dependencies.

```bash
node .claude/skills/react-map/scripts/build-map.mjs --check   # exit 0 = fresh, 2 = stale/missing
node .claude/skills/react-map/scripts/build-map.mjs           # (re)build → .claude/cache/react-map.md
```

Run `--check` first and build only when it exits non-zero (or with `--refresh`). The check hashes file paths, sizes, and mtimes, so it's cheap. The build prints the map's size and an approximate token count.

In a monorepo, pass the package directory (`build-map.mjs apps/web`). The map is written to that package's `.claude/cache/`.

If Node can't run, skip the map and apply the budget rules in section 3 anyway.

## 2. Use the map — grep it, don't read it

```
# Line format:   file LOC · exports · tags · ←N (imported by N files) · T (has colocated test)
OrderTable.tsx 184 · OrderTable(d) · client query · ←3 T
```

| Question | Instead of | Do |
|---|---|---|
| Where is `OrderTable` defined? | Glob + Read | `grep -n "OrderTable" .claude/cache/react-map.md` |
| Which page renders `/orders/[id]`? | Walking `app/` | Look under `## Routes` |
| What's a similar feature to copy? | Reading folders | grep the feature name or the `query`/`form` tag, then read **one** file |
| Blast radius of a change | Grep every import | `←N` fan-in; `## Hotspots` lists the most imported files |
| Which components lack tests? | Listing test folders | `.tsx` lines without ` T` |
| Where is global state? | Grep for store libraries | grep ` store` / ` ctx` tags |

- If the map is under ~300 lines, reading it whole once is fine. Otherwise grep it, or read only the `## Routes` / `## Hotspots` sections.
- The map is an index, not the truth. Before editing or reporting a finding, read the actual file. Tags come from regexes and can have false positives.
- Files created during this session aren't in the map until it is rebuilt. Don't rebuild mid-task just for that.

## 3. Token budget rules (all react-* skills)

1. **Map first.** Locate things through the map or a targeted `Grep`, not by globbing folders and opening files to see what's inside.
2. **Read narrowly.** Use `Grep -n` to find the spot, then `Read` with `offset`/`limit` around it. Read a file over ~300 lines whole only when the change really spans the whole file.
3. **Read once.** Don't re-read a file already read this session unless it changed. Don't re-read a file after editing it to check the edit.
4. **Skip noise.** Never open lockfiles, build output, `.next/`, `dist/`, coverage, minified bundles, snapshot files, or large JSON fixtures. Use `package.json` and the `react-stack` summary instead.
5. **Trim command output.** Run only the related tests (`vitest run src/features/orders`, `jest OrderTable`), use a compact reporter (`--reporter=dot`, `--silent`), and cap long output (`tsc --noEmit --pretty false 2>&1 | head -40`). Rerun only what failed.
6. **Delegate wide sweeps.** When answering needs 15+ files and you only need the conclusion, hand it to a sub-agent (e.g. the Explore agent) that returns findings with file:line, not file contents.
7. **Detect the stack once per session.** Reuse the `react-stack` summary instead of re-running it in every skill.
8. **Report with references.** Cite `file:line` and show only the lines that matter, not whole files.

## 4. Keep the cache out of git

`.claude/cache/` is machine-local (mtimes differ per checkout). Add it to `.gitignore`:

```
.claude/cache/
```

## Boundaries
**Will**: build and refresh the map, answer location/overview questions from it, apply the budget rules
**Will Not**: treat the map as proof of a bug, edit source files, commit the cache

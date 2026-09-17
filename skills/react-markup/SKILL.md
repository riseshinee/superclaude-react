---
name: react-markup
description: Converts a web publisher's static deliverable (HTML/CSS/jQuery) into React components while keeping the markup and CSS pixel-identical. Scans the deliverable for shared layout blocks, repeated structures, scripts, and broken assets, converts HTML to JSX with a script, then splits components and ports jQuery behavior to React state. Use for "convert publishing files to React", "wrap this HTML in React", "the publisher sent new markup", "HTML to JSX".
argument-hint: "<publishDir|file.html> [--pages a.html,b.html] [--assets mirror|bundle] [--update]"
---

# react-markup

Request: `$ARGUMENTS`

## Flags
| Flag | Meaning |
|---|---|
| `--pages` | Convert only these pages (default: plan all, convert in batches) |
| `--assets mirror` | Serve the publisher's CSS/images/fonts as-is from `public/` (default) |
| `--assets bundle` | Import CSS/assets through the bundler (use when the project already does this) |
| `--update` | The publisher sent a revised version — apply only the diff to existing components |

## Golden Rules

1. **Don't change the markup contract.** Keep tag structure, class names, and ids exactly — publisher CSS relies on selectors like `.gnb > li.on > a`. No renaming, no CSS Modules, no Tailwind conversion unless asked.
2. **Keep state classes.** Replace jQuery `addClass('on')` with conditional `className`, using the same class names the CSS expects.
3. **Never ship the publisher's jQuery.** Port behavior into React (state, refs, effects). Third-party widgets get React equivalents or a ref + effect wrapper with cleanup.
4. **Content stays hardcoded first.** Pull repeated items into typed arrays + `.map()`; don't invent API wiring unless requested.
5. **Visual parity is the acceptance test.** Compare the React page against the original HTML at each breakpoint.

## Scripts

Scripts live in this skill's `scripts/` folder (`.claude/skills/react-markup/scripts/` or `~/.claude/skills/react-markup/scripts/`). Node 18+, no dependencies.

```bash
# 1. Inventory the deliverable
node scripts/scan-markup.mjs <publishDir>

# 2. Convert HTML → JSX (notes about handlers/scripts/a11y/assets go to stderr)
node scripts/html-to-jsx.mjs <page.html> --select "header.header" --component Header --ts \
  --asset-base /publish --root <publishDir>
```

| `html-to-jsx.mjs` option | Use |
|---|---|
| `--select <sel>` / `--inner` | Convert one block (`tag`, `#id`, `.class`, `tag.class`); default is `<body>` contents |
| `--component <Name>` | Wrap in `export function Name()` |
| `--asset-base <url> --root <dir>` | Rewrite relative `src`/`srcset`/`url()` paths to `<url>/<path from root>` |
| `--ts` | TypeScript output (implied by `--out *.tsx`) |
| `--out <file>` | Write file (never overwrites without `--force`) |
| `--json` | `{ jsx, notes }` for programmatic use |

Git Bash on Windows rewrites arguments starting with `/`; prefix with `MSYS_NO_PATHCONV=1` (the script detects this and tells you).

The converter handles: `class`/`for` and 40+ attribute renames, `style` strings → objects (vendor prefixes, custom properties), `checked`/`value`/`selected` → `defaultChecked`/`defaultValue`, `<textarea>` content, SVG attribute camelCasing, `<pre>` whitespace, `{`/`}`/`>` escaping, numeric props (`maxLength={20}`), missing `<tbody>`, comments → `{/* */}`. It removes `<script>`, `<style>`, and inline `on*` handlers (left as `TODO(markup)` comments) and lists them in the notes.

## Behavioral Flow

1. **Detect** — Use `react-stack` for framework, TS, router, and styling.
2. **Scan** — Run `scan-markup.mjs`. Share the key findings: pages, layout candidates, repeated structures, libraries, breakpoints, broken references. Ask the publisher/user about broken references instead of guessing.
3. **Plan** — Produce a component map before converting:
   - Layout candidates → layout components (`identical` → no props; `only on/active classes differ` → derive the active item from the current route)
   - Repeated structures → item component + data array
   - Each page → route component in the framework's convention
   - Each jQuery behavior / plugin → React approach (`references/jquery-to-react.md`)
   - Asset strategy (below)
   For more than 5 pages, confirm the plan, then work in batches.
4. **Assets & CSS** — Apply the chosen strategy.
5. **Convert** — Run `html-to-jsx.mjs` per block/page, then refine by hand:
   - Split into the planned components; replace repeated items with `.map()` over a typed array (stable `key`)
   - `.html` links → router links (`<Link>` from the detected router / `next/link`)
   - `href="#"` / `javascript:` anchors that trigger actions → `<button type="button">` (keep classes; add a CSS reset for button only if appearance changes)
   - Resolve every `TODO(markup)` comment and every item in the notes
6. **Port behavior** — Implement interactions with state/handlers following `references/jquery-to-react.md`. Install replacement libraries only after confirming with the user; verify their API via Context7 when available.
7. **Verify** — typecheck, lint, build. Then check visual parity: with Playwright MCP, open the original HTML (serve the publish folder, e.g. `npx serve <publishDir>`) and the React route at each breakpoint from the scan plus a desktop width, and compare screenshots. Exercise each ported interaction (tabs, menus, sliders, modals). Check the console for React warnings.
8. **Report** — Component map, files created, ported behaviors, remaining gaps (unported plugins, missing assets, a11y notes, visual differences).

## Asset Strategies

| | `mirror` (default) | `bundle` |
|---|---|---|
| Where | Copy the deliverable's `css/`, `images/`, `fonts/` into `public/publish/` unchanged | `src/styles/` + `src/assets/`, imported through the bundler |
| CSS loading | `<link rel="stylesheet" href="/publish/css/common.css">` in the app shell: Vite/CRA `index.html`; Next.js App Router root `layout.tsx` `<head>`; Pages Router `_document.tsx` | `import './styles/common.css'` in the entry / root layout / `_app` |
| JSX assets | `--asset-base /publish --root <publishDir>` → `/publish/images/...` | Import images or move them to `public/` |
| CSS `url()` | Works unchanged (relative to the CSS file) | Check each `url()` resolves after moving; fix paths |
| Publisher updates | Overwrite `public/publish/` — done | Re-copy and re-check paths |
| Trade-off | No hashing/minification of publisher CSS (add `?v=` for cache busting) | Optimized, but more migration work |

Never put publisher CSS in CSS Modules — hashing class names breaks every selector.

## Handling Publisher Updates (`--update`)

1. Keep the original deliverable versioned (e.g. `publish-src/` in git, not served, or the publisher's own repo).
2. Diff the old and new HTML: `git diff --no-index old/page.html new/page.html`, or convert both with `html-to-jsx.mjs --select` and diff the JSX.
3. Apply only the changed blocks to the matching components — keep the React logic you added (state classes, handlers, maps).
4. For `mirror`, overwrite `public/publish/` CSS/images; for `bundle`, re-copy and re-check `url()` paths.
5. Re-run the visual parity check on the affected pages.

## Personas & MCP
- Large sites (many layouts, complex state) → have the `react-architect` agent review the component map.
- **Playwright MCP**: side-by-side screenshots and interaction checks. **Context7 MCP**: replacement library APIs.

## Boundaries
**Will**: preserve markup/class contracts, convert with the script then refine, port jQuery behavior to React, verify visual parity, report gaps
**Will Not**: rename classes or restyle, load jQuery or publisher scripts in React, install plugin replacements without confirmation, silently drop broken assets or unported behavior

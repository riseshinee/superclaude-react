# react-markup Guide

English | [한국어](react-markup.ko.md)

This skill moves a web publisher's HTML, CSS, and jQuery into React components.

The one rule it sticks to is **don't change the publisher's markup or CSS.** Publisher stylesheets lean on selectors like `.gnb > li.on > a`, so renaming a class or adding a wrapper element is enough to break the layout. The skill carries the markup over to JSX as-is and only rewrites the jQuery behavior as React state.

It's not the right tool if:

- you only have a Figma design and no HTML. Use `react-implement` instead.
- you want to rewrite the publisher's CSS in Tailwind or CSS Modules. This skill deliberately leaves the CSS alone.

## Install

You'll need Claude Code and Node.js 18 or later. If you want the step that compares the original pages with the React version, connect Playwright MCP too ([setup](../mcp/README.md)).

From your clone of this repo:

```bash
# Into one project
./install.sh ~/work/my-app --skills markup

# For every project on this machine
./install.sh --global --skills markup
```

On Windows PowerShell it's `.\install.ps1 C:\work\my-app -Skills markup` or `.\install.ps1 -Global -Skills markup`.

Installing `react-markup` also installs `react-stack`, which it uses to detect your framework. To add other skills at the same time, list them: `--skills markup,implement,test`.

## Where to put the deliverable

Drop the publisher's files into your project exactly as you received them. Any folder name works; this guide uses `publish-src/`.

```
my-app/
├── publish-src/        as received from the publisher
│   ├── html/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── fonts/
├── public/
├── src/
└── package.json
```

It's worth committing this folder. When a revision arrives, git shows you exactly what changed.

## How a conversion goes

### Start it

Open Claude Code in the project and run:

```
/react-markup ./publish-src
```

Plain language works too: "convert the publishing files in publish-src to React." To do only some pages, add `--pages main.html,about.html`.

### Read the scan

Claude first scans the whole deliverable and summarizes it. It looks roughly like this:

```
Layout candidates
  header.header   12 pages  only on/active classes differ
  footer#footer   12 pages  identical

Repeated structures
  ul.card-list > li.card   up to 8, on 3 pages

Libraries: jquery, swiper
Breakpoints: 768px, 1024px

Broken local references
  images/main/bg.jpg ← html/main.html
```

- **Layout candidates** are blocks shared across pages. If a header shows "only on/active classes differ," it becomes a single component that sets the `on` class based on the current route.
- **Repeated structures** are places where the same markup repeats. They become a data array rendered with `.map()`.
- **Broken local references** are files that the HTML or CSS points to but that don't exist. If you see any, get them from the publisher before going further.
- **Libraries** need React replacements. Claude asks before installing any new package.

### Agree on the component plan

Before writing code, Claude shows how it intends to split things up:

```
Layout
  Header   ← header.header (active menu item from the current route)
  Footer   ← footer#footer
Pages
  /        ← html/main.html   MainVisual (Swiper), CardList, Tabs
  /about   ← html/sub/about.html
Behavior
  mobile menu toggle → useState + "open" class
  tabs → selected index in state
  Swiper → needs swiper/react (install it?)
```

For more than five pages, Claude waits for your go-ahead here and then works through the pages in batches. This is the cheapest moment to change direction, so speak up now if the names or the split don't look right.

### Convert and port behavior

Once the plan is settled, Claude runs the converter on each block and cleans up the result:

- splits it into the planned components
- pulls repeated items into a data array rendered with `.map()`
- turns links to `.html` pages into router links
- turns `href="#"` links that act as buttons into `<button type="button">`, keeping the classes
- rebuilds jQuery behavior with React state, keeping class names like `on`, `active`, and `open` that the CSS expects

The patterns for each kind of jQuery code are in [jquery-to-react.md](../skills/react-markup/references/jquery-to-react.md).

### Check the result

Claude runs typecheck, lint, and build. With Playwright MCP connected, it also screenshots the original HTML and the React page at each breakpoint found in the scan, compares them, and clicks through interactions like tabs and menus.

At the end you get a list of files created and anything left over: missing images, plugins not yet ported, visual differences.

## Where the CSS and images go

By default the publisher's files are **copied unchanged into `public/publish/`**:

```
public/publish/css/
public/publish/images/
public/publish/fonts/
```

Because CSS and images keep their relative positions, `url(../images/bg.png)` inside the CSS keeps working without edits. Image paths in the JSX become `/publish/images/...`. When a revision arrives, you just overwrite this folder.

The stylesheet is loaded once for the whole app:

- **Vite, CRA:** add `<link rel="stylesheet" href="/publish/css/common.css">` to the `<head>` in `index.html`.
- **Next.js App Router:** put the same `<link>` in the `<head>` of `app/layout.tsx`.
- **Next.js Pages Router:** put it in `<Head>` in `pages/_document.tsx`.

If your project already manages CSS through the bundler, use `--assets bundle` instead. CSS moves to `src/styles/` and gets imported; images are imported or moved to `public/`. Since files move, some `url()` paths in the CSS may need fixing.

Either way, **don't load publisher CSS as CSS Modules.** The class names get hashed and every selector stops matching.

## When a revision arrives

1. Overwrite `publish-src/` with the new files. `git diff -- publish-src/` shows what changed.
2. Run `/react-markup ./publish-src --update`.
3. Claude finds the changed blocks and applies them to the matching components, keeping the state and event handlers you've added since.
4. The CSS and images in `public/publish/` get replaced with the new versions.
5. The affected pages are compared visually again.

## Using the scripts directly

The two scripts behind the conversion run fine without Claude. They only need Node 18+ and have no dependencies. A project install puts them in `.claude/skills/react-markup/scripts/`; a global install puts them in `~/.claude/skills/react-markup/scripts/`.

### scan-markup.mjs

Analyzes a deliverable folder and prints the scan you saw above.

```bash
node .claude/skills/react-markup/scripts/scan-markup.mjs ./publish-src
```

It lists pages, shared layout candidates, repeated structures, libraries and jQuery pattern counts, CSS sizes and breakpoints, and broken references. Add `--json` if another tool needs to read the output.

### html-to-jsx.mjs

Converts HTML to JSX. By default it converts everything inside `<body>`; use `--select` to pull out one block.

```bash
S=.claude/skills/react-markup/scripts

# Convert a whole page
node $S/html-to-jsx.mjs publish-src/html/main.html

# Save just the header as a component, with image paths rewritten to /publish/...
node $S/html-to-jsx.mjs publish-src/html/main.html --select header.header \
  --component Header --asset-base /publish --root publish-src \
  --out src/components/layout/Header.tsx

# Convert only the items inside a list
node $S/html-to-jsx.mjs publish-src/html/main.html --select .card-list --inner

# Convert a snippet you've copied
cat snippet.html | node $S/html-to-jsx.mjs -
```

| Option | What it does |
|---|---|
| `--select <selector>` | Convert only the first match. Accepts `tag`, `#id`, `.class`, or `tag.class` |
| `--inner` | Convert the selected element's contents, not the element itself |
| `--component <Name>` | Wrap the output in `export function Name() { ... }` |
| `--asset-base <path>` | Rewrite relative image and asset paths to `<path>/...` |
| `--root <folder>` | The folder `--asset-base` maps to, usually the top of the deliverable |
| `--ts` | Output for TypeScript. Turned on automatically when `--out` ends in `.tsx` |
| `--out <file>` | Write to a file. Won't overwrite an existing file without `--force` |
| `--json` | Print the result and notes as JSON |
| `--quiet` | Skip the conversion notes |

It takes care of the JSX syntax changes for you. For example:

```html
<label for="q" class="tit">Search</label>
<input id="q" value="hello" maxlength="20" readonly>
<div style="margin-top:10px; --gap:8px" onclick="openLayer()"></div>
```

```tsx
<label htmlFor="q" className="tit">Search</label>
<input id="q" defaultValue="hello" maxLength={20} readOnly />
<div style={{ marginTop: "10px", "--gap": "8px" } as React.CSSProperties} /* TODO(markup): onclick="openLayer()" */ />
```

It also handles SVG attributes, selected `<option>`s, `<textarea>` content, whitespace in `<pre>`, missing `<tbody>`, and `{` `}` inside text. `<script>` and `<style>` tags are removed, and inline handlers like `onclick` are left behind as `TODO(markup)` comments, as shown above.

After converting, it prints notes on what still needs a human: inline handlers, removed scripts, `.html` links that should become router links, images without `alt`, and so on. Work through the notes and delete the `TODO(markup)` comments as you go.

**Git Bash users:** Git Bash rewrites arguments that start with `/` into Windows paths, so `--asset-base /publish` turns into `C:/Program Files/Git/publish`. Put `MSYS_NO_PATHCONV=1` in front of the command. The script notices when this happens and tells you. PowerShell isn't affected.

## Things to agree on with the publisher

Conversion is much faster, and the result more accurate, when the deliverable follows these. Share them before the work starts.

- Header, footer, and menu markup is identical on every page apart from active classes (`on`, `active`)
- State changes use classes (`.on`, `.active`, `.open`), not inline `style`
- Repeated items like cards and list rows share the same structure and classes
- Interaction code lives in JS files, not inline `onclick`
- Clickable things that aren't links are `<button type="button">`, and links have real URLs
- Every image has `alt` (`alt=""` for decorative ones)
- Image and font paths are relative, and every referenced file is included
- Plugins and their versions are listed (for example, Swiper 11)
- Revisions come as whole files with a short note on what changed

## Common problems

**No styles apply at all.**
The stylesheet isn't loaded, or the path is wrong. Try opening `/publish/css/common.css` directly in the browser.

**Some styles are broken.**
Usually either the CSS was loaded as CSS Modules and the class names changed, or splitting components added a wrapper `div` that breaks a selector like `.a > .b`. Compare the DOM with the original HTML.

**Images return 404.**
`--asset-base` and `--root` don't line up. `--root` should be the folder that was copied into `public/publish/`, usually `publish-src`.

**A link turned into a `button` looks different.**
That's the browser's default button styling. Add `background: none; border: 0; padding: 0; font: inherit; color: inherit;` to that class.

**`Unsupported selector "ul > li"`.**
`--select` only handles simple selectors. Select the parent and use `--inner`, like `--select .card-list --inner`.

**`Refusing to overwrite`.**
The file given to `--out` already exists. Add `--force` if overwriting is what you want.

**Type error on a style with a CSS variable like `--gap`.**
Run with `--ts`, or give `--out` a `.tsx` filename, and the cast gets added.

**A slider or other plugin doesn't work.**
The publisher's plugin scripts are intentionally not loaded. Port them to the React alternatives listed in [jquery-to-react.md](../skills/react-markup/references/jquery-to-react.md).

**Hydration warnings in Next.js.**
Some plugin code touches `window` during render. Move it into `useEffect`, or load the component with `next/dynamic` and `ssr: false`.

## Limitations

- `--select` supports simple selectors only, and converts just the first match.
- The parser forgives most mistakes but isn't as thorough as a browser. Badly broken markup may come out nested differently, so always compare visually.
- The scripts stop at turning HTML into JSX. Splitting components, porting jQuery, and comparing screenshots are done by Claude following the skill.
- Text and list data stay hardcoded. Hooking up a real API is a separate job for `react-implement`.

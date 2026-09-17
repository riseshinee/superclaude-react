# SuperClaude React

English | [한국어](README.ko.md)

A set of Claude Code skills for React projects.

I liked how the [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) organizes commands and personas, but it's general-purpose, so on React work I kept re-explaining things like "this is Next.js with the App Router, state is in zustand, tests run on vitest." This repo is the React-specific subset, rebuilt so that explanation isn't needed.

Every skill starts by reading `package.json` and your config files to figure out the stack, then follows the conventions already in your code. It works with Next.js, Vite, CRA, Remix, and React Native.

## Install

Clone the repo and point the installer at your project:

```bash
git clone https://github.com/<your-org>/superclaude-react.git
cd superclaude-react

# macOS / Linux / WSL
./install.sh ~/work/my-app --with-mcp

# Windows
.\install.ps1 C:\work\my-app -WithMcp
```

This copies the skills and agents into your project's `.claude/` folder. Commit that folder and your teammates get the same setup without installing anything.

If you'd rather have the skills available in every project on your machine, use `--global` (`-Global` on Windows) instead of a path. They'll go into `~/.claude`.

## Usage

Open Claude Code in your project and call a skill:

```
/react-analyze src
/react-implement "order list page with a status filter and pagination" --with-tests
/react-troubleshoot "Maximum update depth exceeded in OrderTable"
```

You don't have to remember the names. Asking "write tests for LoginForm" picks `react-test` on its own.

## Skills

| Skill | What it does |
|---|---|
| `react-implement` | Builds features, components, and hooks, then runs typecheck, lint, and tests |
| `react-analyze` | Reviews quality, structure, performance, security, and accessibility, with file:line references. Doesn't change code |
| `react-improve` | Refactors without changing behavior: removing unneeded effects, extracting hooks, splitting components |
| `react-test` | Writes and runs tests with whatever the project already uses (Vitest, Jest, Testing Library, MSW, Playwright) |
| `react-troubleshoot` | Reproduces the bug and confirms the cause before fixing it, instead of trying things at random |
| `react-markup` | Moves a publisher's HTML/CSS/jQuery files into React components. More on this below |
| `react-stack` | Stack detection. The other skills call it first, so you rarely need it directly |

The first five map to SuperClaude's `/sc:implement`, `/sc:analyze`, `/sc:improve`, `/sc:test`, and `/sc:troubleshoot`.

Skills take SuperClaude-style flags too. The ones I use most:

- `react-analyze --focus performance`: check one area only
- `react-analyze --depth deep`: split the review across agents for a deeper pass
- `react-improve --preview`: show the plan without touching files
- `react-implement --safe`: ask before editing existing files
- `react-troubleshoot --fix`: go ahead and fix once the cause is confirmed

The rest are documented in each `skills/<name>/SKILL.md`.

## Converting publisher markup to React

A common setup, especially in agency work, is that a web publisher hands over finished HTML and CSS and developers wire it into React. `react-markup` is built for that. The rule it follows is simple: **don't touch the publisher's markup or CSS.** Class names stay as they are; only the jQuery behavior gets rewritten as React state.

```
/react-markup ./publish-src
```

It scans the whole deliverable first and shows you the shared header and footer, repeated card structures, plugins in use, and broken image paths. Once you agree on the component plan, it starts converting. When the publisher sends a revision, run it again with `--update` to apply only what changed.

The conversion scripts also work without Claude (Node 18+, no dependencies):

```bash
# Inventory the deliverable
node .claude/skills/react-markup/scripts/scan-markup.mjs ./publish-src

# Pull out just the header as a component file
node .claude/skills/react-markup/scripts/html-to-jsx.mjs ./publish-src/html/main.html \
  --select header.header --component Header --asset-base /publish --root ./publish-src \
  --out src/components/Header.tsx
```

One gotcha on Windows: Git Bash turns arguments that start with `/` (like `--asset-base /publish`) into Windows paths. Prefix the command with `MSYS_NO_PATHCONV=1`. PowerShell doesn't have this problem.

The [usage guide](docs/react-markup.md) covers the full walkthrough, every option, a checklist to share with publishers, and common problems.

## Agents

Out of SuperClaude's personas, these three are the ones I actually needed for React work:

- `react-architect`: folder structure, state management choices, server/client boundaries
- `react-qa`: what to test at which level, and how risky a change is
- `react-security`: XSS, secrets leaking into the client bundle, token storage

Skills bring them in when needed, or you can ask directly: "have the react-architect agent review this structure."

## MCP (optional)

Everything works without MCP servers, but these two make a noticeable difference:

- **Context7** looks up docs for the library versions you actually have installed, which cuts down on mistakes from APIs that changed between versions.
- **Playwright** drives a real browser to reproduce UI bugs, check E2E flows, and compare the React pages against the publisher's originals.

Passing `--with-mcp` (`-WithMcp`) at install time creates a `.mcp.json` in your project. It won't overwrite one that already exists. For manual setup, see [mcp/README.md](mcp/README.md).

## Installer options

| bash | PowerShell | Description |
|---|---|---|
| `[path]` | `[-Target] <path>` | Project to install into. Defaults to the current folder |
| `--global` | `-Global` | Install into `~/.claude` |
| `--skills a,b` | `-Skills a,b` | Install only some skills. The `react-` prefix is optional |
| `--no-agents` | `-NoAgents` | Skip the agents |
| `--with-mcp` | `-WithMcp` | Create `.mcp.json` |
| `--force` | `-Force` | Overwrite existing files |
| `--uninstall` | `-Uninstall` | Remove only what this repo installed |
| `--dry-run` | `-DryRun` | Print what would happen without changing anything |

To update, `git pull` this repo and run the installer again with `--force`.

## Adding your team's rules

The skills are plain Markdown, so you can edit the installed copies in `.claude/skills/` and the changes apply right away. I'd put team conventions ("use named exports", "API hooks live in `features/*/api`") in `react-stack/SKILL.md`, since every skill reads that first.

If your project has a `CLAUDE.md` or lint rules, those win over the general guidance in the skills.

## Repository layout

```
superclaude-react/
├── skills/        7 skills (react-markup includes the conversion scripts)
├── agents/        3 subagents
├── docs/          react-markup usage guide
├── mcp/           MCP config example
├── scripts/       validate.mjs
├── install.sh
└── install.ps1
```

## Contributing

A few things to keep in mind when changing or adding skills:

- Write everything under `skills/`, `agents/`, and `mcp/` in English. READMEs and guides have separate Korean versions.
- If a `SKILL.md` grows past 500 lines, move the details into `references/`.
- Run `node scripts/validate.mjs` before committing. It checks file format, referenced paths, and language.

## License

[MIT](LICENSE). The structure and ideas come from the SuperClaude Framework, but this is an independent project with no affiliation to SuperClaude or Anthropic.

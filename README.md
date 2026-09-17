# SuperClaude React

**English** | [한국어](README.ko.md)

React-focused [Claude Code](https://claude.com/claude-code) skills and agents, modeled on the [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework).
Copy them into any React project and Claude will detect your stack — Next.js, Vite, CRA, Remix, React Native, and more — and follow your project's conventions.

- **6 skills** — the core SuperClaude commands (`/sc:implement`, `/sc:analyze`, `/sc:improve`, `/sc:test`, `/sc:troubleshoot`) rebuilt for React, plus a shared stack detector
- **3 agents** — SuperClaude personas as Claude Code subagents (architect, QA, security)
- **Stack detection** — a zero-dependency script every skill runs first, so output matches the project instead of generic React
- **MCP guide** — Context7 and Playwright setup

## Quick Start

```bash
git clone https://github.com/<your-org>/superclaude-react.git
cd superclaude-react

# macOS / Linux / WSL / Git Bash
./install.sh ~/work/my-react-app --with-mcp

# Windows PowerShell
.\install.ps1 C:\work\my-react-app -WithMcp
```

Then open Claude Code in your project:

```
/react-analyze src
/react-implement "order list page with status filter and pagination" --with-tests
/react-troubleshoot "Maximum update depth exceeded in OrderTable"
```

Skills also trigger automatically from natural requests like *"write tests for LoginForm"* → `react-test`.

## Skills

| Skill | SuperClaude | What it does |
|---|---|---|
| `react-stack` | — | Detects framework, React version, state/styling/testing tools, structure, and commands. Run by every other skill |
| `react-implement` | `/sc:implement` | Implements features, components, and hooks following detected conventions; validates with typecheck/lint/tests |
| `react-analyze` | `/sc:analyze` | Quality, architecture, performance, security, a11y report with file:line evidence. Read-only |
| `react-improve` | `/sc:improve` | Behavior-preserving refactors: remove needless effects, extract hooks, split components, fix state shape |
| `react-test` | `/sc:test` | Behavior-driven tests with Testing Library, MSW, Playwright/Cypress — whatever the project uses |
| `react-troubleshoot` | `/sc:troubleshoot` | Reproduce → confirm root cause → fix → verify, with a React symptom table |

### Flags

Skills accept SuperClaude-style flags as arguments:

| Flag | Skills | Effect |
|---|---|---|
| `--focus <area>` | analyze | Narrow the scope (quality, architecture, performance, security, a11y) |
| `--depth deep` | analyze | Delegate areas to persona agents in parallel |
| `--safe` | implement, improve | Plan first / add characterization tests before refactoring |
| `--with-tests` | implement | Write tests alongside |
| `--preview` | improve | Show the plan without changing code |
| `--fix` | troubleshoot | Apply the fix once the root cause is confirmed |

See each `skills/<name>/SKILL.md` for the full list.

## Agents (Personas)

| Agent | SuperClaude persona | Use for |
|---|---|---|
| `react-architect` | architect / frontend | Structure, state strategy, server/client boundaries, design and refactor review |
| `react-qa` | qa | Test strategy, regression risk, flaky tests |
| `react-security` | security | XSS, secret exposure, token storage, RSC/Server Action leaks |

Skills delegate to these agents (e.g. `react-analyze --depth deep`), or call them directly: *"Use the react-architect agent to review this design."*

## MCP Servers (optional, recommended)

| Server | Improves |
|---|---|
| Context7 | Version-accurate library docs while implementing |
| Playwright | E2E flow exploration and UI bug reproduction in a real browser |

`--with-mcp` / `-WithMcp` writes a project `.mcp.json` (never overwrites an existing one; the PowerShell installer adds the `cmd /c` wrapper Windows needs). See [mcp/README.md](mcp/README.md) for manual setup.

## Installer Options

| bash | PowerShell | Description |
|---|---|---|
| `[TARGET_DIR]` | `[-Target] <dir>` | Project to install into (default: current directory) |
| `--global` | `-Global` | Install into `~/.claude` for all projects |
| `--skills a,b` | `-Skills a,b` | Install only some skills (`react-` prefix optional; `react-stack` always included) |
| `--no-agents` | `-NoAgents` | Skip agents |
| `--with-mcp` | `-WithMcp` | Create `.mcp.json` |
| `--force` | `-Force` | Overwrite existing skills/agents (use to update) |
| `--uninstall` | `-Uninstall` | Remove only what this repo ships |
| `--dry-run` | `-DryRun` | Show actions without changing files |

**Project vs. global:** Commit `.claude/` to share the same skills with your team and pin their version per project. Use `--global` for personal use across all projects.

**Updating:** `git pull` in this repo, then re-run the installer with `--force`.

## Customizing for Your Team

The skills are plain Markdown — edit the installed copies in `.claude/skills/` to encode team rules:

- Add your conventions to `react-stack/SKILL.md` (e.g. "always use named exports", "API hooks live in `features/*/api`")
- Add stack-specific rules to `react-stack/references/frameworks.md`

Project `CLAUDE.md` and lint config always take priority over the skills' general guidance.

## Repository Layout

```
superclaude-react/
├── skills/
│   ├── react-stack/          # scripts/detect-stack.mjs, references/frameworks.md
│   ├── react-implement/
│   ├── react-analyze/
│   ├── react-improve/
│   ├── react-test/
│   └── react-troubleshoot/
├── agents/                   # react-architect, react-qa, react-security
├── mcp/                      # mcp.example.json, README.md
├── scripts/validate.mjs      # structure/frontmatter/reference checks
├── install.sh
└── install.ps1
```

## Contributing

1. Keep shipped content (`skills/`, `agents/`, `mcp/`) in English.
2. `SKILL.md` stays under 500 lines — move detail into `references/`.
3. Run `node scripts/validate.mjs` before committing (frontmatter, names, referenced files, language).
4. Test the detector against real projects: `node skills/react-stack/scripts/detect-stack.mjs <path>`.

## Requirements

- Claude Code
- Node.js 18+ (stack detection script and MCP servers)

## Acknowledgements

Structure and command/persona concepts adapted from the [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework). This project is independent and not affiliated with SuperClaude or Anthropic.

## License

[MIT](LICENSE)

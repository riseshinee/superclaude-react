# MCP Integration

SuperClaude pairs commands with MCP servers. The React skills in this repo work without any MCP server, but become more accurate when these are connected.

| Server | Used by | Why |
|---|---|---|
| **Context7** | all skills (esp. `react-implement`) | Fetches up-to-date, version-specific docs for React, Next.js, TanStack Query, etc. instead of relying on model memory |
| **Playwright** | `react-test`, `react-troubleshoot`, `react-implement` | Drives a real browser: explore flows before writing e2e tests, reproduce UI bugs, check console and network |

Both run locally via `npx` and need Node.js 18+.

## Option A — project-scoped `.mcp.json` (shared with the team)

Copy `mcp.example.json` to your project root as `.mcp.json` and commit it. The installers do this with `--with-mcp` (never overwriting an existing file).

On **native Windows** (not WSL), wrap `npx` with `cmd /c` (the PowerShell installer does this for you):

```json
"context7": { "command": "cmd", "args": ["/c", "npx", "-y", "@upstash/context7-mcp@latest"] }
```

If `.mcp.json` already exists, merge the `mcpServers` entries by hand.

## Option B — CLI

```bash
# project scope (writes .mcp.json)
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp@latest
claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest

# or user scope (all your projects)
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp@latest
```

Check status with `claude mcp list` or `/mcp` inside Claude Code.

## Notes

- Context7 works without an API key; a key raises rate limits (see the Context7 docs).
- Playwright MCP launches its own browser; the first run may download browser binaries.
- Point Playwright at your running dev server (`http://localhost:5173`, `http://localhost:3000`, …).
- Package names and flags evolve — check each server's README if a command fails.

#!/usr/bin/env bash
# SuperClaude React installer (macOS / Linux / WSL / Git Bash)
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./install.sh [TARGET_DIR] [options]

Installs React skills and agents into TARGET_DIR/.claude (default: current directory).

Options:
  --global            Install into ~/.claude (available in every project)
  --force             Overwrite skills/agents that already exist
  --with-mcp          Copy mcp/mcp.example.json to TARGET_DIR/.mcp.json (skipped if it exists)
  --skills a,b,...    Install only these skills (react-stack is always included)
  --no-agents         Skip persona agents
  --uninstall         Remove the skills/agents shipped by this repo
  --dry-run           Print what would happen without changing anything
  -h, --help          Show this help
EOF
}

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="."
GLOBAL=0 FORCE=0 WITH_MCP=0 NO_AGENTS=0 UNINSTALL=0 DRY=0
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL=1 ;;
    --force) FORCE=1 ;;
    --with-mcp) WITH_MCP=1 ;;
    --no-agents) NO_AGENTS=1 ;;
    --uninstall) UNINSTALL=1 ;;
    --dry-run) DRY=1 ;;
    --skills) shift; ONLY="${1:-}" ;;
    --skills=*) ONLY="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *) TARGET="$1" ;;
  esac
  shift
done

if [[ $GLOBAL -eq 1 ]]; then
  CLAUDE_DIR="$HOME/.claude"
else
  [[ -d "$TARGET" ]] || { echo "Target directory not found: $TARGET" >&2; exit 1; }
  TARGET="$(cd "$TARGET" && pwd)"
  CLAUDE_DIR="$TARGET/.claude"
  [[ -f "$TARGET/package.json" ]] || echo "warning: no package.json in $TARGET — is this a React project?"
fi

run() { if [[ $DRY -eq 1 ]]; then echo "[dry-run] $*"; else "$@"; fi; }

# Resolve skill list
SKILLS=()
if [[ -n "$ONLY" ]]; then
  IFS=',' read -r -a REQ <<< "$ONLY"
  SKILLS+=("react-stack")
  for s in "${REQ[@]}"; do
    s="$(echo "$s" | xargs)"
    [[ "$s" == react-* ]] || s="react-$s"
    [[ -d "$SRC/skills/$s" ]] || { echo "Unknown skill: $s" >&2; exit 1; }
    [[ "$s" == "react-stack" ]] || SKILLS+=("$s")
  done
else
  for d in "$SRC"/skills/*/; do SKILLS+=("$(basename "$d")"); done
fi

AGENTS=()
if [[ $NO_AGENTS -eq 0 ]]; then
  for f in "$SRC"/agents/*.md; do AGENTS+=("$(basename "$f")"); done
fi

if [[ $UNINSTALL -eq 1 ]]; then
  for s in "${SKILLS[@]}"; do
    [[ -d "$CLAUDE_DIR/skills/$s" ]] && { run rm -rf "$CLAUDE_DIR/skills/$s"; echo "removed skill  $s"; }
  done
  for a in "${AGENTS[@]}"; do
    [[ -f "$CLAUDE_DIR/agents/$a" ]] && { run rm -f "$CLAUDE_DIR/agents/$a"; echo "removed agent  ${a%.md}"; }
  done
  echo "Uninstall complete."
  exit 0
fi

run mkdir -p "$CLAUDE_DIR/skills"
installed=0 skipped=0
for s in "${SKILLS[@]}"; do
  dest="$CLAUDE_DIR/skills/$s"
  if [[ -e "$dest" && $FORCE -eq 0 ]]; then
    echo "skip   skill  $s (exists; use --force)"; skipped=$((skipped + 1)); continue
  fi
  run rm -rf "$dest"
  run cp -R "$SRC/skills/$s" "$dest"
  echo "ok     skill  $s"; installed=$((installed + 1))
done

if [[ ${#AGENTS[@]} -gt 0 ]]; then
  run mkdir -p "$CLAUDE_DIR/agents"
  for a in "${AGENTS[@]}"; do
    dest="$CLAUDE_DIR/agents/$a"
    if [[ -e "$dest" && $FORCE -eq 0 ]]; then
      echo "skip   agent  ${a%.md} (exists; use --force)"; skipped=$((skipped + 1)); continue
    fi
    run cp "$SRC/agents/$a" "$dest"
    echo "ok     agent  ${a%.md}"; installed=$((installed + 1))
  done
fi

if [[ $WITH_MCP -eq 1 ]]; then
  if [[ $GLOBAL -eq 1 ]]; then
    echo "note   --with-mcp writes a project file; for user scope run the 'claude mcp add --scope user' commands in mcp/README.md"
  elif [[ -e "$TARGET/.mcp.json" ]]; then
    echo "skip   .mcp.json exists — merge entries from mcp/mcp.example.json manually"
  else
    run cp "$SRC/mcp/mcp.example.json" "$TARGET/.mcp.json"
    echo "ok     .mcp.json (context7, playwright)"
  fi
fi

echo
echo "Done: $installed installed, $skipped skipped → $CLAUDE_DIR"
echo "Start Claude Code and try: /react-stack  or  /react-analyze src"

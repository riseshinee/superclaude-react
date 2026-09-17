<#
.SYNOPSIS
  SuperClaude React installer (Windows PowerShell 5.1+ / PowerShell 7+).

.EXAMPLE
  .\install.ps1 C:\work\my-app -WithMcp
  .\install.ps1 -Global
  .\install.ps1 . -Skills implement,test
  .\install.ps1 C:\work\my-app -Uninstall
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Target = '.',
  [switch]$Global,
  [switch]$Force,
  [switch]$WithMcp,
  [string[]]$Skills,
  [switch]$NoAgents,
  [switch]$Uninstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Src = $PSScriptRoot

if ($Global) {
  $ClaudeDir = Join-Path $HOME '.claude'
} else {
  if (-not (Test-Path -LiteralPath $Target -PathType Container)) { throw "Target directory not found: $Target" }
  $Target = (Resolve-Path -LiteralPath $Target).Path
  $ClaudeDir = Join-Path $Target '.claude'
  if (-not (Test-Path -LiteralPath (Join-Path $Target 'package.json'))) {
    Write-Warning "no package.json in $Target - is this a React project?"
  }
}

function Invoke-Step([string]$Description, [scriptblock]$Action) {
  if ($DryRun) { Write-Host "[dry-run] $Description" } else { & $Action }
}

# Resolve skill list (react-stack is always included)
$skillList = @()
if ($Skills) {
  $skillList += 'react-stack'
  foreach ($s in ($Skills -join ',').Split(',')) {
    $name = $s.Trim()
    if (-not $name) { continue }
    if (-not $name.StartsWith('react-')) { $name = "react-$name" }
    if (-not (Test-Path -LiteralPath (Join-Path $Src "skills\$name"))) { throw "Unknown skill: $name" }
    if ($name -ne 'react-stack') { $skillList += $name }
  }
} else {
  $skillList = Get-ChildItem -LiteralPath (Join-Path $Src 'skills') -Directory | ForEach-Object Name
}

$agentList = @()
if (-not $NoAgents) {
  $agentList = Get-ChildItem -LiteralPath (Join-Path $Src 'agents') -Filter '*.md' | ForEach-Object Name
}

$skillsDir = Join-Path $ClaudeDir 'skills'
$agentsDir = Join-Path $ClaudeDir 'agents'

if ($Uninstall) {
  foreach ($s in $skillList) {
    $p = Join-Path $skillsDir $s
    if (Test-Path -LiteralPath $p) {
      Invoke-Step "remove $p" { Remove-Item -LiteralPath $p -Recurse -Force }
      Write-Host "removed skill  $s"
    }
  }
  foreach ($a in $agentList) {
    $p = Join-Path $agentsDir $a
    if (Test-Path -LiteralPath $p) {
      Invoke-Step "remove $p" { Remove-Item -LiteralPath $p -Force }
      Write-Host "removed agent  $([IO.Path]::GetFileNameWithoutExtension($a))"
    }
  }
  Write-Host 'Uninstall complete.'
  return
}

$installed = 0
$skipped = 0

Invoke-Step "mkdir $skillsDir" { New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null }
foreach ($s in $skillList) {
  $dest = Join-Path $skillsDir $s
  if ((Test-Path -LiteralPath $dest) -and -not $Force) {
    Write-Host "skip   skill  $s (exists; use -Force)"; $skipped++; continue
  }
  Invoke-Step "copy skill $s -> $dest" {
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $Src "skills\$s") -Destination $dest -Recurse
  }
  Write-Host "ok     skill  $s"; $installed++
}

if ($agentList.Count -gt 0) {
  Invoke-Step "mkdir $agentsDir" { New-Item -ItemType Directory -Force -Path $agentsDir | Out-Null }
  foreach ($a in $agentList) {
    $dest = Join-Path $agentsDir $a
    $label = [IO.Path]::GetFileNameWithoutExtension($a)
    if ((Test-Path -LiteralPath $dest) -and -not $Force) {
      Write-Host "skip   agent  $label (exists; use -Force)"; $skipped++; continue
    }
    Invoke-Step "copy agent $label -> $dest" { Copy-Item -LiteralPath (Join-Path $Src "agents\$a") -Destination $dest -Force }
    Write-Host "ok     agent  $label"; $installed++
  }
}

if ($WithMcp) {
  if ($Global) {
    Write-Host "note   -WithMcp writes a project file; for user scope run the 'claude mcp add --scope user' commands in mcp/README.md"
  } else {
    $mcpDest = Join-Path $Target '.mcp.json'
    if (Test-Path -LiteralPath $mcpDest) {
      Write-Host 'skip   .mcp.json exists - merge entries from mcp/mcp.example.json manually'
    } else {
      Invoke-Step "write $mcpDest" {
        # Native Windows needs `cmd /c npx` for MCP stdio servers
        $config = Get-Content -LiteralPath (Join-Path $Src 'mcp\mcp.example.json') -Raw | ConvertFrom-Json
        foreach ($server in $config.mcpServers.PSObject.Properties) {
          if ($server.Value.command -eq 'npx') {
            $server.Value.args = @('/c', 'npx') + $server.Value.args
            $server.Value.command = 'cmd'
          }
        }
        $json = $config | ConvertTo-Json -Depth 10
        [IO.File]::WriteAllText($mcpDest, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding $false))
      }
      Write-Host 'ok     .mcp.json (context7, playwright; cmd /c npx for Windows)'
    }
  }
}

Write-Host ''
Write-Host "Done: $installed installed, $skipped skipped -> $ClaudeDir"
Write-Host 'Start Claude Code and try: /react-stack  or  /react-analyze src'

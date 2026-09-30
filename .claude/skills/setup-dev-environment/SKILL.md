---
name: setup-dev-environment
description: >
  Step-by-step guided setup of a complete SAP BTP Joule A2A agent development environment on
  macOS or Windows. Use this skill whenever the user wants to set up their machine for SAP BTP
  development, install prerequisites for Joule A2A agent development, prepare a local
  environment for CAP or Cloud Foundry projects, or asks about installing any of: VS Code,
  Node.js, Cloud Foundry CLI, MTA Build Tool, MultiApps CF plugin, SAP CDS Development Kit,
  Joule CLI, or the Joule A2A Agent Toolkit. Also trigger when the user says "I need to set up
  my environment", "help me get started with Joule A2A", "what do I need to install", or
  mentions a missing tool from this stack (e.g. "cf: command not found", "mbt not found",
  "joule: command not found", "code: command not found"). Trigger for fresh-machine setups and
  for partial setups where some tools are already installed.
---

# SAP BTP Joule A2A — Development Environment Setup

The authoritative reference is **`docs/ex0/Setup-Local-Environment.md`**.

## How to approach this

1. **Detect the OS** — ask the user if not obvious from context (macOS or Windows).
2. **Run the auto-install script** for their OS below — it checks each tool and installs any that are missing or on the wrong version immediately, without asking first.
3. **Re-verify** after the script completes using the verification block.
4. **Report** what was already installed, what was newly installed, and anything that needs manual follow-up (e.g. Step 10 — SAP AI Core / LiteLLM).

---

## Auto-install script — macOS

Run this entire block in the terminal. Each tool is checked first; install only runs if needed.

```bash
set -e

# ── Homebrew (prerequisite for most installs) ────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo ">>> Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
fi

# ── VS Code ───────────────────────────────────────────────────────────────────
if ! command -v code &>/dev/null; then
  echo ">>> Installing VS Code..."
  brew install --cask visual-studio-code
  # Add 'code' to PATH via VS Code Command Palette after first launch:
  # Shell Command: Install 'code' command in PATH
else
  echo "✓ VS Code $(code --version | head -1)"
fi

# ── PowerShell 7 ──────────────────────────────────────────────────────────────
if ! command -v pwsh &>/dev/null; then
  echo ">>> Installing PowerShell 7..."
  brew install powershell/tap/powershell
else
  echo "✓ $(pwsh --version)"
fi

# ── Git ───────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo ">>> Installing Git..."
  brew install git
else
  echo "✓ $(git --version)"
fi

# ── Node.js v24 ───────────────────────────────────────────────────────────────
if ! node --version 2>/dev/null | grep -q "^v24"; then
  echo ">>> Installing Node.js v24..."
  brew install node@24
  brew link node@24 --force --overwrite
else
  echo "✓ Node.js $(node --version)"
fi

# ── CF CLI v8 ─────────────────────────────────────────────────────────────────
if ! cf --version 2>/dev/null | grep -q "^cf version 8"; then
  echo ">>> Installing CF CLI v8..."
  brew install cloudfoundry/tap/cf-cli@8
else
  echo "✓ $(cf --version)"
fi

# ── MTA Build Tool ────────────────────────────────────────────────────────────
if ! command -v mbt &>/dev/null; then
  echo ">>> Installing MTA Build Tool..."
  npm install -g mbt
else
  echo "✓ MBT $(mbt --version)"
fi

# ── MultiApps CF plugin ───────────────────────────────────────────────────────
if ! cf plugins 2>/dev/null | grep -q multiapps; then
  echo ">>> Installing MultiApps CF plugin..."
  cf install-plugin multiapps -f
else
  echo "✓ MultiApps CF plugin already installed"
fi

# ── SAP CDS Development Kit ───────────────────────────────────────────────────
if ! command -v cds &>/dev/null; then
  echo ">>> Installing SAP CDS Development Kit..."
  npm install -g @sap/cds-dk
else
  echo "✓ CDS $(cds --version 2>/dev/null | head -1)"
fi

# ── Joule CLI ─────────────────────────────────────────────────────────────────
if ! command -v joule &>/dev/null; then
  echo ">>> Installing Joule CLI..."
  npm install -g @sap/joule-studio-cli
else
  echo "✓ Joule CLI $(joule --version)"
fi

echo ""
echo "Setup complete. Run the verification block to confirm all versions."
```

---

## Auto-install script — Windows (PowerShell 7 — run as Administrator)

```powershell
$ErrorActionPreference = "Continue"

# ── VS Code ───────────────────────────────────────────────────────────────────
if (!(Get-Command code -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing VS Code..."
  winget install Microsoft.VisualStudioCode --accept-source-agreements --accept-package-agreements
} else { Write-Host "✓ VS Code $(code --version | Select-Object -First 1)" }

# ── PowerShell 7 ──────────────────────────────────────────────────────────────
if (!(Get-Command pwsh -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing PowerShell 7..."
  winget install Microsoft.PowerShell --accept-source-agreements --accept-package-agreements
  Write-Host "  Reopen this terminal as PowerShell 7 (pwsh) to continue."
} else { Write-Host "✓ $((pwsh --version))" }

# ── Git + Git Bash ────────────────────────────────────────────────────────────
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing Git for Windows (includes Git Bash)..."
  winget install Git.Git --accept-source-agreements --accept-package-agreements
} else { Write-Host "✓ $(git --version)" }

# ── Bash (from Git for Windows) ───────────────────────────────────────────────
if (!(Get-Command bash -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Bash not found — ensure Git for Windows is installed (see Git step above)."
} else { Write-Host "✓ Bash available" }

# ── ExecutionPolicy (required before npm-installed CLIs work) ─────────────────
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# ── Node.js v24 ───────────────────────────────────────────────────────────────
$nodeVer = node --version 2>$null
if (!$nodeVer -or $nodeVer -notmatch "^v24") {
  Write-Host ">>> Installing Node.js v24..."
  winget install OpenJS.NodeJS --version 24 --accept-source-agreements --accept-package-agreements
} else { Write-Host "✓ Node.js $nodeVer" }

# ── CF CLI v8 ─────────────────────────────────────────────────────────────────
$cfVer = cf --version 2>$null
if (!$cfVer -or $cfVer -notmatch "cf version 8") {
  Write-Host ">>> Installing CF CLI v8..."
  winget install CloudFoundry.CFCLIv8 --accept-source-agreements --accept-package-agreements
} else { Write-Host "✓ $cfVer" }

# ── MTA Build Tool ────────────────────────────────────────────────────────────
if (!(Get-Command mbt -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing MTA Build Tool..."
  npm install -g mbt
} else { Write-Host "✓ MBT $(mbt --version)" }

# ── MultiApps CF plugin ───────────────────────────────────────────────────────
if (!(cf plugins 2>$null | Select-String "multiapps")) {
  Write-Host ">>> Installing MultiApps CF plugin..."
  cf install-plugin multiapps -f
} else { Write-Host "✓ MultiApps CF plugin already installed" }

# ── SAP CDS Development Kit ───────────────────────────────────────────────────
if (!(Get-Command cds -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing SAP CDS Development Kit..."
  npm install -g @sap/cds-dk
} else { Write-Host "✓ CDS $(cds --version 2>$null | Select-Object -First 1)" }

# ── Joule CLI ─────────────────────────────────────────────────────────────────
if (!(Get-Command joule -ErrorAction SilentlyContinue)) {
  Write-Host ">>> Installing Joule CLI..."
  npm install -g @sap/joule-studio-cli
} else { Write-Host "✓ Joule CLI $(joule --version)" }

Write-Host ""
Write-Host "Setup complete. Run the verification block to confirm all versions."
```

---

## Final verification

Run after the auto-install script to confirm all tools are on the correct versions.

**macOS / Linux:**
```bash
echo "VS Code:     $(code --version 2>/dev/null | head -1 || echo NOT INSTALLED)"
echo "Bash:        $(bash --version 2>/dev/null | head -1 || echo NOT INSTALLED)"
echo "PowerShell:  $(pwsh --version 2>/dev/null || echo NOT INSTALLED)"
echo "Node.js:     $(node --version 2>/dev/null || echo NOT INSTALLED)  [required: v24.x]"
echo "CF CLI:      $(cf --version 2>/dev/null || echo NOT INSTALLED)  [required: v8.x]"
echo "MBT:         $(mbt --version 2>/dev/null || echo NOT INSTALLED)"
echo "CDS:         $(cds --version 2>/dev/null | head -1 || echo NOT INSTALLED)"
echo "Joule CLI:   $(joule --version 2>/dev/null || echo NOT INSTALLED)"
echo "Git:         $(git --version 2>/dev/null || echo NOT INSTALLED)"
echo "Claude CLI:  $(claude --version 2>/dev/null || echo NOT INSTALLED) (optional)"
```

**Windows (PowerShell):**
```powershell
"VS Code:    $(code --version 2>$null | Select-Object -First 1)"
"Bash:       $(bash --version 2>$null | Select-Object -First 1)"
"PowerShell: $((pwsh --version) 2>$null)"
"Node.js:    $((node --version) 2>$null)  [required: v24.x]"
"CF CLI:     $((cf --version) 2>$null)  [required: v8.x]"
"MBT:        $((mbt --version) 2>$null)"
"CDS:        $((cds --version) 2>$null | Select-Object -First 1)"
"Joule CLI:  $((joule --version) 2>$null)"
"Git:        $((git --version) 2>$null)"
```

---

## Key notes

- Node.js must be **v24.x** — not 20, not 22
- CF CLI must be **v8.x** — not v6 or v7
- On Windows: winget install for Node.js installs the latest LTS; if that is not v24, download the v24 installer directly from https://nodejs.org/en/download
- MultiApps CF plugin requires `cf` to be logged in to at least one CF endpoint; if `cf install-plugin` fails, have the user `cf login` first
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`) is **optional** — the VS Code extension and CLI serve the same purpose
- Step 10 (SAP AI Core / LiteLLM) cannot be automated — direct the user to the SAP Community blog post in `docs/ex0/Setup-Local-Environment.md`

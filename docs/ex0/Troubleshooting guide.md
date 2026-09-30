# SAP Generative AI Hub + LiteLLM + Claude Code — Windows PowerShell Runbook

> **Reference:** [SAP Blog — Joule A2A: Connect Code-Based Agents into Joule](https://community.sap.com/t5/technology-blog-posts-by-sap/joule-a2a-connect-code-based-agents-into-joule/ba-p/14329279)
>
> **Environment:** Windows 10 · Docker Desktop · PowerShell · WSL 2
> **Project directory:** `C:\Users\hp\Documents\litellm-sapaicore`

---

## Architecture Overview

```
Claude Code
    │
    │  ANTHROPIC_BASE_URL = http://localhost:4000
    ▼
LiteLLM Proxy (:4000)
    │
    ▼
SAP Generative AI Hub
    │
    ▼
Claude Model (Anthropic)
```

Supporting services started via Docker Compose: **LiteLLM**, **PostgreSQL**, **Prometheus**

---

## Issue 1 — Bash Syntax Does Not Work in PowerShell

**Problem:** The SAP tutorial uses Linux/macOS Bash syntax. Running it verbatim in PowerShell fails.

| Bash (tutorial) | PowerShell (use this) |
|---|---|
| `export VAR=value` | `$env:VAR="value"` |
| `curl` | `curl.exe` or `Invoke-RestMethod` |
| `\` line continuation | `` ` `` backtick |
| `0.0.0.0` (client URL) | `localhost` |

> `export` is a Linux shell built-in. PowerShell uses `$env:` prefix for environment variables.

---

## Issue 2 — WSL 2 Not Enabled / Docker Requires Virtualisation

**Problem:** Docker Desktop requires WSL 2 and Windows Hypervisor. Run the following **once** from an **Administrator Command Prompt**, restarting as indicated.

```cmd
:: Step 1 — Enable WSL (restart after)
wsl.exe --install --no-distribution
shutdown /r /t 0

:: Step 2 — After reboot: Enable required Windows features
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

:: Step 3 — Set WSL 2 as default
wsl --set-default-version 2

:: Step 4 — Enable hypervisor auto-launch
bcdedit /set hypervisorlaunchtype auto

:: Step 5 — Restart Windows
shutdown /r /t 0

:: Step 6 — Install Ubuntu (required for Docker WSL 2 engine)
wsl --install -d Ubuntu
:: Restart again if prompted: shutdown /r /t 0
```

**Verify (Administrator CMD after all reboots):**
```cmd
wsl --status
wsl -l -v
dism /online /get-featureinfo /featurename:VirtualMachinePlatform
systeminfo | findstr /i "Hyper-V"
bcdedit /enum {current}
```

Expected outputs:
- `Default Version: 2`
- `Ubuntu ... 2`
- `State : Enabled`
- `A hypervisor has been detected`
- `hypervisorlaunchtype    Auto`

---

## Issue 3 — Docker Desktop Not Using WSL 2 Engine

**Problem:** Docker Desktop may default to the Hyper-V backend and fail on this hardware.

**Fix (GUI):**
1. Open **Docker Desktop → Settings → General**
   - Enable: ☑ `Use the WSL 2 based engine`
2. Go to **Settings → Resources → WSL Integration**
   - Enable: ☑ `Enable integration with my default WSL distro`
   - Enable: ☑ `Ubuntu`
3. Click **Apply & Restart**

**Verify:**
```cmd
docker version
docker info
docker run hello-world
```

---

## Issue 4 — LiteLLM Docker Image Pull Fails (`main-latest` / `latest` tags)

**Problem:** Pulling `main-latest` or `latest` tags fails with a TLS decode error.

```
# DO NOT USE:
docker pull ghcr.io/berriai/litellm-database:main-latest   # ❌ tls: error decoding message
docker pull ghcr.io/berriai/litellm-database:latest         # ❌
```

**Fix — use the specific versioned tag:**
```cmd
docker pull ghcr.io/berriai/litellm-database:v1.98.0
```

**Verify:**
```cmd
docker images | findstr /i litellm
```
Expected: `ghcr.io/berriai/litellm-database    v1.98.0`

> In `docker-compose.yml`, always reference `v1.98.0` instead of `main-latest`.

---

## Issue 5 — Project Files Not Created

**Problem:** LiteLLM needs `.env`, `config.yaml`, and `docker-compose.yml` in the project directory.

```powershell
cd C:\Users\hp\Documents\litellm-sapaicore
```

**Generate random keys for LiteLLM (run twice — one value each):**
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Or:
```cmd
openssl rand -hex 32
```

**`.env` file structure:**
```env
# You generate these:
LITELLM_MASTER_KEY="YOUR_GENERATED_KEY_1"
LITELLM_SALT_KEY="YOUR_GENERATED_KEY_2"

# SAP AI Core provides these (from BTP service key):
AICORE_SERVICE_KEY='YOUR_SAP_AI_CORE_SERVICE_KEY_JSON'
AICORE_RESOURCE_GROUP="YOUR_RESOURCE_GROUP"
```
> Never commit `.env` to Git.

**`docker-compose.yml` — use the pinned image tag:**
```yaml
services:
  litellm:
    image: ghcr.io/berriai/litellm-database:v1.98.0
    ports:
      - "4000:4000"
    volumes:
      - ./config.yaml:/app/config.yaml
    env_file:
      - .env
    command: ["--config", "/app/config.yaml", "--port", "4000"]
```
> If the SAP tutorial provides a fuller Compose file (with PostgreSQL/Prometheus), use that structure but replace the image tag with `v1.98.0`.

---

## Issue 6 — LiteLLM API Test Fails in PowerShell (Bash `curl` syntax)

**Problem:** Copying the tutorial's `curl` command into PowerShell fails due to quoting and line-continuation differences.

**Fix — use PowerShell `Invoke-RestMethod`:**
```powershell
$body = @{
    model    = "claude-opus-4-7"
    max_tokens = 1000
    messages = @(@{ role = "user"; content = "What is the capital of France?" })
} | ConvertTo-Json -Depth 10

$headers = @{ Authorization = "Bearer YOUR_LITELLM_MASTER_KEY" }

$response = Invoke-RestMethod `
    -Uri         "http://localhost:4000/v1/messages" `
    -Method      POST `
    -Headers     $headers `
    -ContentType "application/json" `
    -Body        $body

$response | ConvertTo-Json -Depth 20
```

**Alternative — `curl.exe` with a JSON file:**
```powershell
# 1. Create request.json
@'
{
  "model": "claude-opus-4-7",
  "max_tokens": 1000,
  "messages": [{ "role": "user", "content": "What is the capital of France?" }]
}
'@ | Set-Content request.json

# 2. Send request
curl.exe -X POST "http://localhost:4000/v1/messages" `
  -H "Authorization: Bearer YOUR_LITELLM_MASTER_KEY" `
  -H "Content-Type: application/json" `
  --data-binary "@request.json"
```

---

## Issue 7 — Claude Code Environment Variables Not Set (PowerShell)

**Problem:** The tutorial uses `export VAR=value` which is not valid in PowerShell.

**Fix:**
```powershell
$env:ANTHROPIC_AUTH_TOKEN = "YOUR_LITELLM_MASTER_KEY"
$env:ANTHROPIC_BASE_URL   = "http://localhost:4000"
```

**Verify:**
```powershell
echo $env:ANTHROPIC_AUTH_TOKEN
echo $env:ANTHROPIC_BASE_URL
```

> These variables are session-scoped. Re-set them each time you open a new PowerShell window, or add them to your PowerShell profile.

---

## Standard Startup Sequence (Every Restart)

```powershell
# 1. Navigate to project
cd C:\Users\hp\Documents\litellm-sapaicore

# 2. Start containers
docker compose up -d

# 3. Verify containers are running
docker compose ps

# 4. Check port is open
Test-NetConnection localhost -Port 4000   # Expect: TcpTestSucceeded : True

# 5. Set Claude Code environment variables
$env:ANTHROPIC_AUTH_TOKEN = "YOUR_LITELLM_MASTER_KEY"
$env:ANTHROPIC_BASE_URL   = "http://localhost:4000"

# 6. Launch Claude Code
claude
```

---

## Useful Diagnostic Commands

```powershell
docker compose ps               # Container status
docker compose logs -f litellm  # LiteLLM live logs
docker compose logs -f          # All service logs
docker ps                       # Running containers
docker ps -a                    # All containers (including stopped)
docker images                   # Downloaded images

docker compose restart          # Restart all services
docker compose down             # Stop and remove containers
docker compose up -d            # Start containers (detached)

curl.exe http://localhost:4000/health         # LiteLLM health check
curl.exe http://localhost:4000/v1/models      # List configured models
Test-NetConnection localhost -Port 4000       # TCP connectivity check
```

---

## Setup Status Checklist

| Component | Status |
|---|---|
| Windows / PowerShell identified | ✅ |
| WSL 2 configured | ✅ |
| Docker Desktop working | ✅ |
| Docker networking & GHCR access | ✅ |
| LiteLLM image (`v1.98.0`) pulled | ✅ |
| Docker Compose configuration created | ✅ |
| `.env` concept established | ✅ |
| LiteLLM master/salt keys generated | ✅ |
| SAP AI Core credentials identified | ✅ |
| Docker Compose started successfully | ✅ |
| LiteLLM reachable on `localhost:4000` | ✅ |
| PowerShell API test approach identified | ✅ |
| Claude Code env variable syntax identified | ✅ |
| **Full chain verified (LiteLLM → SAP → Claude)** | ⚠️ Next step |

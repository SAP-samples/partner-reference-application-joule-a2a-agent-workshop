# Local Environment Setup

Install and configure development tools required for building the Joule A2A Agent.

---

## Prerequisites

- **Git CLI** — used to clone the Joule A2A Agent Toolkit. Download from [git-scm.com/install](https://git-scm.com/install/).

  ```bash
  git --version
  # Expected: git version 2.x.x
  ```

---

## Navigate to Your Workspace

Create a new folder as your workspace, then open a Terminal/Command Prompt and navigate to it.

```bash
cd /path/to/your/workspace
```

## 1. Install Node.js 24.x

This is the required runtime for the CAP application and build tools. Download it from [nodejs.org](https://nodejs.org), if it's not installed.

```bash
node --version
# Expected: v24.x.x
```

> [!NOTE]
> If `npm` is not recognized in the VS Code terminal, grant the required permissions to the current user:
>
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

## 2. Install VS Code

This is the primary IDE for development. Download it from [code.visualstudio.com](https://code.visualstudio.com).

---

## 3. Install Claude Code CLI

Claude Code CLI is Anthropic's agentic AI coding partner that runs directly inside your terminal. Run the below command to install.

**On Windows**, run this first in PowerShell to allow npm-installed CLI tools to execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then install Claude Code:

```bash
npm install -g @anthropic-ai/claude-code
```

After installation, **close and reopen the terminal**, then verify:

```bash
claude --version
```

---

## 4. Install Cloud Foundry CLI v8

This is required for deploying applications to SAP BTP, Cloud Foundry environment. Download it from [https://github.com/cloudfoundry/cli/releases](https://github.com/cloudfoundry/cli/releases).

```bash
cf --version
# Expected: cf version 8.x.x
```

---

## 5. Install MTA Build Tool (mbt)

This builds multi-target application archives.

```bash
npm install -g mbt
mbt --version
# Expected: mbt version 1.x.x
```

---

## 6. Install MultiApps CF CLI Plugin

This is required for deploying `.mtar` archives with `cf deploy`.

```bash
cf install-plugin multiapps
cf plugins
# Verify: multiapps plugin listed (version 3.x.x or later)
```

---

## 7. Install SAP CDS Development Kit

CAP framework command-line tools.

```bash
npm install -g @sap/cds-dk
cds --version
```

---

## 8. Install Joule CLI

This is required for deploying Joule capabilities.

```bash
npm install -g @sap/joule-studio-cli --allow-scripts=keytar
joule --version
```

> [!NOTE]
> The `--allow-scripts=keytar` flag is required. Without it, npm prints a warning and the `keytar` native module (used for credential storage) is not built, which causes silent failures when the CLI tries to access stored credentials.

---

## 9. Clone the Joule A2A Agent Toolkit

The [Joule A2A Agent Toolkit](https://github.com/SAP-samples/joule-a2a-agent-toolkit) provides the Claude Code plugin to build, deploy, and connect AI agents to SAP Joule using the A2A (Agent-to-Agent) protocol on SAP BTP, Cloud Foundry environment.

Clone the toolkit **into your workspace folder** (the same folder you created at the start of this guide):

```bash
git clone https://github.com/SAP-samples/joule-a2a-agent-toolkit.git
```

> [!NOTE]
> After cloning, note the **full absolute path** to the `joule-a2a-agent-toolkit` folder — you will need it when opening the claude code cli.

---

## 10. Connect Claude Code to SAP AI Core Instance

> [!IMPORTANT]
> **Skip this step** if you already have the necessary licenses for the models and are connected to Claude Code in your environment.

If you do not have the necessary licenses for the models and want to connect to SAP AI Core, you will need to install `uv` and `Python` to enable the connection between your Claude Code and the SAP AI Core instance.

### Windows

<details>

<summary>Click here for installation steps for Windows</summary>

#### 1. Install uv

Open **PowerShell**:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Restart PowerShell/Windows Terminal and verify:

```powershell
uv --version
```

#### 2. Install Python 3.14

```powershell
uv python install 3.14
```

Verify the installed Python versions:

```powershell
uv python list
```

</details>

### macOS

<details>

<summary>Click here for installation steps for macOS</summary>

#### 1. Install uv

Open Terminal:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Reload your shell:

```bash
source ~/.zshrc
```

Verify:

```bash
uv --version
```

#### 2. Install Python 3.14

```bash
uv python install 3.14
```

Verify:

```bash
uv python list
```

</details>

### Navigate to Your Workspace and Create a Dedicated Folder for LiteLLM

```bash
cd /path/to/your/workspace
mkdir litellm
cd litellm
```

### Create LiteLLM Config

Create a file litellm_config.yaml file and add the below configuration

```yaml
model_list:
  - model_name: claude-opus-4-8  # Name Claude Code will call locally
    litellm_params:
      model: sap/anthropic--claude-4.8-opus  # Instructs litellm to use the SAP provider
      api_key: '{"clientid": "<CLIENT_ID>", "clientsecret": "CLIENT_SECRET", "url": "<AUTHENTICATION_URL>/oauth/token", "serviceurls": {"AI_API_URL": "<API_URL>/v2"}}'
      resource_group: "default"
```

> [!NOTE]  
> If you have already copied the service bindings of SAP AI Core and saved them in your [Notes](../Notes.md), proceed to update the **api_key**. If not, follow the steps outlined below to retrieve the details and ensure you save them in [Notes](../Notes.md) for future reference.

**To get the SAP AI Core Service Key, follow these steps:**

1. Go to **BTP Cockpit** → **HOW-PA Joule Agent nnn Subaccount** → **Services** → **Instances & Subscriptions**
2. Choose the `psm-joule-agent-aicore` service instance.
3. Click on `psm-joule-agent-aicore-key` service binding.

Ensure you replace the placeholders <CLIENT_ID>, <CLIENT_SECRET>, <AUTHENTICATION_URL>, and <API_URL> in the api_key based on the below table.

| Variable             | Service Binding of Service Instance | JSON Value                            |
|----------------------|-------------------------------------|---------------------------------------|
| `API_URL`            | `SAP AI Core`                       | `serviceurls.AI_API_URL`              |
| `CLIENT_ID`          | `SAP AI Core`                       | `uaa.clientid`                        |
| `CLIENT_SECRET`      | `SAP AI Core`                       | `uaa.clientsecret`                    |
| `AUTHENTICATION_URL` | `SAP AI Core`                       | `Get uaa.url and append /oauth/token` |

### Create run_proxy

Create a file run_proxy.py file and add the below configuration

```python

import os
import sys

# 1. Force Pydantic to rebuild the specific chunk structures that crash mid-stream
try:
    from openai.types.chat import ChatCompletionChunk
    from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta, ChoiceLogprobs, ChoiceDeltaToolCall

    for cls in (ChatCompletionChunk, Choice, ChoiceDelta, ChoiceLogprobs, ChoiceDeltaToolCall):
        cls.model_rebuild(force=True)
    print("Successfully patched OpenAI stream chunk schemas.")
except ImportError:
    pass

# 2. Fix for Python 3.14 + uvloop incompatibility (Forces standard asyncio loop)
os.environ["UVICORN_LOOP_TYPE"] = "asyncio"

# 3. Corrected import path for LiteLLM's server engine
from litellm import run_server

if __name__ == "__main__":
    # Simulate: litellm --config litellm_config.yaml --port 4000
    sys.argv = ["litellm", "--config", "litellm_config.yaml", "--port", "4000"]
    run_server()

```

### Run the LiteLLM proxy server

```bash
uvx --refresh --with "litellm[proxy],openai,pydantic>=2.9.0" python run_proxy.py
```

### Configure Claude Code

Set the below environment variable or configure the claude setting directly

```text
ANTHROPIC_API_KEY="sk-sap-dummy-key"
ANTHROPIC_BASE_URL="http://localhost:4000/"

```

Or

Run below command in powershell to open the global claude code settings and update `ANTHROPIC_API_KEY="sk-sap-dummy-key"` and `ANTHROPIC_BASE_URL="http://localhost:4000/"`

```powershell
notepad $HOME\.claude\settings.json
```

### Run the Claude Code

Run the below command to start the claude code cli from your terminal/command prompt.

```bash
claude
```

Test the claude code connection with the below prompt.

```text
What is Barcelona famous for?
```

---

## Checklist

- [ ] Git installed (`git --version`)
- [ ] Node.js 24.x installed (`node --version`)
- [ ] VS Code installed
- [ ] Claude Code CLI installed
- [ ] CF CLI v8 installed (`cf --version`)
- [ ] MBT installed globally (`mbt --version`)
- [ ] MultiApps CF plugin installed (`cf plugins`)
- [ ] CDS DK installed (`cds --version`)
- [ ] Joule CLI installed (`joule --version`)
- [ ] Joule A2A Agent Toolkit cloned (note the full path)
- [ ] Claude Code connected

## Conclusion

You have successfully completed the local setup required to develop the Pro Code Agent. Next, proceed to [set up Joule and the SAP Build Work Zone](./Setup-Joule-Workzone.md) in the `HOW-PA Joule Agent nnn` subaccount.

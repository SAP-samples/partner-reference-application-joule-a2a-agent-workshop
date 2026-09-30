# psm-joule-agent

A LangGraph A2A agent on SAP CAP for Joule, powered by SAP GenAI Hub.

## Prerequisites

- `mbt` (MTA Build Tool): `npm install -g mbt`
- MTA CF CLI plugin: `cf install-plugin multiapps` (required for `cf deploy`)

## Local Development

```bash
npm install
cp .cdsrc.sample.json .cdsrc.json
# Edit .cdsrc.json with your AI Core credentials
npm run watch
# Test: curl http://localhost:4004/.well-known/agent.json
```

## Deploy to Cloud Foundry

```bash
npm install
mbt build
cf deploy mta_archives/psm-joule-agent_1.0.0.mtar
```

> **Note:** If `cf deploy` fails with "unknown command", install the MTA plugin first: `cf install-plugin multiapps`

## Connect to Joule

1. Create BTP destination `PsmJouleAgent_A2A` pointing to the deployed agent URL
2. Deploy the Joule capability:
   ```bash
   cd joule-capability
   joule login
   joule deploy ./da.sapdas.yaml --compile -n "psm_joule_agent_a2a"
   ```

> **Note:** The capability namespace in `joule-capability/capability.sapdas.yaml` must be `joule.ext` — any other value will cause deployment to fail.

## Customization

1. Edit `srv/tools/tools.ts` — add your agent's tools
2. Edit `srv/utils/prompts.ts` — customize the system prompt
3. Edit `srv/server.ts` — update agent card skills
4. Edit `joule-capability/scenarios/invoke_agent.yaml` — set the scenario description

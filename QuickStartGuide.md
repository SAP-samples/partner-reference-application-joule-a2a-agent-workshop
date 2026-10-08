# Quickstart Guide

This guide walks you through setting up your local environment and deploying the Joule A2A Agent to SAP BTP. By the end, you will have a running agent service, a configured Joule capability, and a test environment ready in SAP Build Work Zone.

## Prerequisites

- **Git CLI** — used to clone the Joule A2A Agent Toolkit. Download from [git-scm.com/install](https://git-scm.com/install/).

  ```bash
  git --version
  # Expected: git version 2.x.x
  ```

## Install Node.js 24.x

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

## Install VS Code

This is the primary IDE for development. Download it from [code.visualstudio.com](https://code.visualstudio.com).

---

## Navigate to Your Workspace and Open VS Code

Create a new folder as your workspace, then open a Terminal/Command Prompt and navigate to it.

```bash
cd /path/to/your/workspace
```

---

## Install Cloud Foundry CLI v8

This is required for deploying applications to SAP BTP, Cloud Foundry environment. Download it from [https://github.com/cloudfoundry/cli/releases](https://github.com/cloudfoundry/cli/releases).

```bash
cf --version
# Expected: cf version 8.x.x
```

---

## Install MTA Build Tool (mbt)

This builds multi-target application archives.

```bash
npm install -g mbt
mbt --version
# Expected: mbt version 1.x.x
```

---

## Install MultiApps CF CLI Plugin

This is required for deploying `.mtar` archives with `cf deploy`.

```bash
cf install-plugin multiapps
cf plugins
# Verify: multiapps plugin listed (version 3.x.x or later)
```

---

## Install SAP CDS Development Kit

CAP framework command-line tools.

```bash
npm install -g @sap/cds-dk
cds --version
```

---

## Install Joule CLI

This is required for deploying Joule capabilities.

```bash
npm install -g @sap/joule-studio-cli --allow-scripts=keytar
joule --version
```

> [!NOTE]
> The `--allow-scripts=keytar` flag is required. Without it, npm prints a warning and the `keytar` native module (used for credential storage) is not built, which causes silent failures when the CLI tries to access stored credentials.

---

## Clone the Repository

```bash
git clone https://github.com/SAP-samples/partner-reference-application-joule-a2a-agent-workshop.git

git checkout agent
```

---

## Login to Cloud Foundry

```bash
# Target the Agent subaccount Cloud Foundry endpoint
cf login -a https://api.cf.eu10-005.hana.ondemand.com --origin aywjhejac-platform
# Enter your BTP credentials and select the CF org and space
```

When prompted, choose org `prahowpa-ja<nnn>` and space `dev`.

## Login to Joule CLI

1. Go to **BTP Cockpit → HOW-PA Joule Agent nnn → Overview**.
2. For the `BTP_ACCOUNT_SUBDOMAIN`, get the `SubDomain` from the `General` section.
3. Go to **Services → Instances and Subscriptions**.
4. Find and open the `das-<nnn>` instance. You can search for it by name or look for **SAP Digital Assistant** in the service column.
5. Go to **Service Bindings** and click **View** on the `das-<nnn>-key` binding to see the credentials.
6. For the `AUTHENTICATION_URL`, get the `uaa.url` value.
7. Copy the values for `uaa.clientid` for `CLIENT_ID`, and `uaa.clientsecret` for `CLIENT_SECRET`.
8. Open a Terminal (in VS Code or your system terminal).
9. Run the following command:

   **macOS / Linux (bash):**

   ```bash
   joule login --sso-passcode --no-app-tid --apiurl https://<BTP_ACCOUNT_SUBDOMAIN>.eu10.sapdas.cloud.sap -a '<AUTHENTICATION_URL>' -c '<CLIENT_ID>' -s '<CLIENT_SECRET>'
   ```

   **Windows (PowerShell — use double quotes):**

   ```powershell
   joule login --sso-passcode --no-app-tid --apiurl "https://<BTP_ACCOUNT_SUBDOMAIN>.eu10.sapdas.cloud.sap" -a "<AUTHENTICATION_URL>" -c "<CLIENT_ID>" -s "<CLIENT_SECRET>"
   ```

   > **`--no-app-tid` flag:** Suppresses the application tenant ID prompt. Without this flag the CLI asks for an additional tenant ID that is not required in this setup.

You will receive a link to generate a passcode. Open the link in a browser and log in using your IAS tenant username and password. A passcode will be displayed after authentication — copy it and paste it back into the terminal.

> [!NOTE]
> If the login page redirects incorrectly or shows a "session already active" error, open the link in an **incognito / private browsing window** and log in there.

## Run the Dependencies

```bash
npm install
```

## Deploy the Agent

```bash
npm run deploy
```

**Verify that the application is running:**

```bash
cf apps
```

Expected output (truncated):

```
name                    requested state   processes   routes
psm-joule-agent-srv     started           web:1/1     <your-org>-<space>-psm-joule-agent-srv.cfapps.eu10-005.hana.ondemand.com
```

Copy the route of `psm-joule-agent-srv` — this is your `<AGENT-SERVICE-URL>`.

## Create PsmJouleAgent_A2A Destination

1. Log in to **SAP BTP cockpit** and navigate to the **HOW-PA Joule Agent nnn Subaccount**.
2. Go to **Connectivity → Destinations**.
3. Choose **New Destination**.
4. Fill in the following:

    | Property       | Value                                  |
    |----------------|----------------------------------------|
    | Name           | `PsmJouleAgent_A2A`                    |
    | Type           | HTTP                                   |
    | URL            | psm-joule-agent-srv URL you've copied earlier |
    | Proxy Type     | Internet                               |
    | Authentication | NoAuthentication                       |

5. Under **Additional Properties**, add:

    | Property                   | Value  |
    |----------------------------|--------|
    | `HTML5.DynamicDestination` | `true` |

6. Choose **Save**.

## Create PSM_CAP_APP Destination

1. Get the information of the Poetry Slam Manager Application Service Broker Key.
    1. Go to **BTP Cockpit → HOW-PA Consumer nnn Subaccount → Services → Instances & Subscriptions**.
    2. Click on `psm-sb-sub<nnn>-full` service instance.
    3. Under **Service Bindings**, click `psm-sb-sub<nnn>-full-key` to view its credentials.

2. Go to **BTP Cockpit → HOW-PA Joule Agent nnn Subaccount → Connectivity → Destinations**.

3. Create a new destination with the following field values:

   | Parameter Name              | Value                                                          |
   | :-------------------------- | :--------------------------------------------------------------|
   | **Name**                    | `PSM_CAP_APP`                                                  |
   | **Type**                    | `HTTP`                                                         |
   | **Description**             | Destination description. For example, `Poetry Slams Manager`.  |
   | **URL**                     | `endpoints.psm-servicebroker`                                  |
   | **Proxy Type**              | `Internet`                                                     |
   | **Authentication**          | `OAuth2ClientCredentials`                                      |
   | **Client Id**               | `uaa.clientid`                                                 |
   | **Client secret**           | `uaa.clientsecret`                                             |
   | **Token Service URL**       | `Get uaa.url and append /oauth/token`                          |
   | **Token Service URL Type**  | `Dedicated`                                                    |


## Deploy Joule Capability

```bash
cd psm-joule-agent/joule-capability

# Deploy
joule deploy ./da.sapdas.yaml --compile -n "psm_joule_agent_a2a"
```

Update the capability in `sap_digital_assistant`. This pushes the capability definition directly to the Joule digital assistant and can resolve cases where `joule deploy` completed but the capability is not yet visible or active in the Joule UI.

```bash
joule update "sap_digital_assistant" --capability-file capability.sapdas.yaml
```

## Generate test data in the Poetry Slam Manager application

1. Go to **BTP Cockpit → HOW-PA Consumer nnn Subaccount → Services → Instances & Subscriptions**.
2. Click on **Poetry Slam Manager** application subscription.
3. Click on action **Generate Sample data**.

Sample data is available.

## Create Site in SAP Build Work Zone and Enable Joule

### Create a Site

1. Go to **BTP Cockpit → HOW-PA Joule Agent nnn → Services → Instances and Subscriptions**.
2. Select the **SAP Build Work Zone, standard edition** subscription to open the **SAP Build Work Zone**.
3. Choose **Create Site**.
4. Enter a site name, for example, *Partner Reference Application*.
5. Choose **Create**.

> [!TIP]
> **Reference:** [Create a Site](https://help.sap.com/docs/build-work-zone-standard-edition/sap-build-work-zone-standard-edition/create-site)

### Enable Joule in the Site

1. In **Site Directory**, open the site you just created.
2. Choose **Settings** (gear icon) for the site.
3. Navigate to the **Services** tab.
4. Click on **Edit** .
5. Find **Joule** in the list of services.
6. Toggle **Joule** to **Enabled**.
7. Choose **Save**.

## Test

1. Log in to **SAP BTP cockpit** and navigate to the **HOW-PA Joule Agent nnn Subaccount**.
2. Go to **Services-> Instances and Subscriptions** and open **SAP Build Work Zone**.
3. Go to the site configured and open the **Joule** panel. (Joule icon in the top right)
4. Type the following test queries one by one:

    - Prompt: `List all poetry slams`

        Expected: Joule invokes the agent and returns a formatted list of all poetry slams.

    - Prompt: `Show me only published poetry slams`

        Expected: Lists only poetry slams with status "Published".

    - Prompt: `Show details of poetry slam number 3`

        Expected: Full details including visitors and booking status.
# Notes

Use this sheet to record credentials and values you collect during the workshop. You will refer to these values repeatedly across exercises.

> [!WARNING]
> Never commit this file with real credentials filled in. Keep it local only.

---

## User Details

| Field    | Value                              |
|----------|------------------------------------|
| Username | `PRAHOW-<nnn>`                     |
| Email    | `PRAHOW-<nnn>@education.cloud.sap` |

## BTP Subaccount Details - HOW-PA Joule Agent <nnn>

| Field                | Value                                                                                                                                 |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Global Account URL   | `https://emea.cockpit.btp.cloud.sap/cockpit/?idp=aywjhejac.accounts.ondemand.com#/globalaccount/b3eb37fc-460b-48ac-9768-6b5b419b389c` |
| Subaccount Name      | `HOW-PA Joule Agent <nnn>`                                                                                                            |
| Subaccount Subdomain | `prahowpa-ja<nnn>`                                                                                                                    |
| CF API Endpoint      | `https://api.cf.eu10-005.hana.ondemand.com`                                                                                           |
| CF Org               | `prahowpa-ja<nnn>`                                                                                                                    |
| CF Space             | `dev`                                                                                                                                 |
| IAS Origin           | `aywjhejac-platform`                                                                                                                  |

---

## SAP AI Core Service Key

1. Go to **BTP Cockpit → HOW-PA Joule Agent nnn → Services → Instances and Subscriptions**.
2. Click on `psm-joule-agent-aicore` service instance.
3. Under **Service Bindings**, click `psm-joule-agent-aicore-key` to view its credentials.

```json
    // Paste the copied credentials here
```

---

## Digital Assistant Service (DAS) Key

1. Go to **BTP Cockpit → HOW-PA Joule Agent nnn → Services → Instances and Subscriptions**.
2. Click on `das-<nnn>` service instance. You can search for it by name or look for **SAP Digital Assistant** in the service column.
3. Under **Service Bindings**, click `das-<nnn>-key` to view its credentials.

```json
    // Paste the copied json here
```

---

## Poetry Slam Manager Application Service Broker Key

1. Go to **BTP Cockpit → HOW-PA Consumer nnn Subaccount → Services → Instances & Subscriptions**.
2. Click on `psm-sb-sub<nnn>-full` service instance.
3. Under **Service Bindings**, click `psm-sb-sub<nnn>-full-key` to view its credentials.

```json
    // Paste the copied json here
```

---
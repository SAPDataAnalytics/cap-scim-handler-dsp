# DSP SCIM Handler (CAP Service)

This project is a small **SAP CAP** service that synchronizes users and roles from a **SCIM** source (e.g., SAP Analytics Cloud) into an HDI container and exposes virtual read-only views for UIs and integrations.

It consists of:
- `service.cds` — the public service (`DSPUsers`) exposing entities and actions under `/data`
- `service.js` — implementation with SCIM fetch & aggregation
- `schema.cds` — persistent HDI entities (`Users`, `Roles`, `UserRoles`)
- `scim_dsp.js` — SCIM client (OAuth2 Client Credentials + CSRF + Cookie)
- `secrets.js` / `credstore.js` — reads secrets from **SAP Credential Store**
- `manifest.yaml` — Cloud Foundry deployment descriptor
- `hdbroles` — database roles to enable DWC consumption

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Credential Store](#credential-store)
- [SCIM Configuration](#scim-configuration)
- [Database Schema](#database-schema)
- [Service API](#service-api)
- [Actions & Data Flows](#actions--data-flows)
- [Deployment (Cloud Foundry)](#deployment-cloud-foundry)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Appendix](#appendix)

---

## Architecture

```
SCIM (SAC/DSP)  -->  scim_dsp.js  -->  service.js  -->  CAP service /data
                          |                |
                    secrets.js        schema.cds
                          |
                 SAP Credential Store

Persistent HDI entities:
  - dsp.scim.Users
  - dsp.scim.Roles
  - dsp.scim.UserRoles
```

- **View-Models** (`UsersVH`, `RolesVH`, `UserRolesVH`) are **read-only** and **fetched live** from SCIM.
- **Actions** can **sync** view-model data into persistent tables for analytics/joins and keep role counts fresh.

---

## Prerequisites

- Node.js 18+ (LTS recommended)
- @sap/cds (globally or via `npx`)
- Cloud Foundry CLI (for deployment)
- Access to:
  - **HDI container** (service instance, plan `hdi-shared`)
  - **SAP Credential Store** (service instance, plan `standard`)
  - **XSUAA** service instance for authentication (configured to protect `/data` with `requires: 'authenticated-user'`)

> The app expects `VCAP_SERVICES` for local dev via `default-env.json` (see below).

---

## Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Provide `default-env.json`** (only in local dev)

`secrets.js` auto-loads `default-env.json` into `process.env.VCAP_SERVICES` if it’s not set. Create `default-env.json` next to `secrets.js` with the required **Credential Store** binding:

```json
{
  "VCAP_SERVICES": {
    "credstore": [
      {
        "name": "my-credentials",
        "credentials": {
          "url": "https://<credstore-host>/security/cred/v1/credentials",
          "username": "<credstore-technical-user>",
          "password": "<credstore-password>",
          "encryption": {
            "client_private_key": "<base64-PEM-body-without-markers>",
            "server_public_key": "<base64-PEM-body-without-markers>"
          }
        }
      }
    ]
  }
}
```

> If you also want to run with HDI locally, include the HDI service in `VCAP_SERVICES` as usual, or use SQLite for quick tests.

3. **Start the service**

```bash
npm run start
# or
npx cds run
```

The service will start (default: `http://localhost:4004`) and expose endpoints under `/data` (see [Service API](#service-api)).

---

## Credential Store

The project reads all SCIM-related secrets from **Credential Store** (namespace: `dsp-scim`) using `credstore.js`.

### Required entries (type: `password`)

| Key name                 | Description                              |
|--------------------------|------------------------------------------|
| `dsp-scim-token-url`     | OAuth2 token endpoint (for client creds) |
| `dsp-scim-base-url`      | Base URL of the SCIM host (no trailing `/`) |
| `dsp-scim-client-id`     | OAuth2 client id                          |
| `dsp-scim-client-secret` | OAuth2 client secret                      |

> `secrets.js` caches retrieved values in-memory. If keys are missing, it throws descriptive errors.

### (Optional) Write helper

You can write credentials into the store using the exported function in `credstore.js` (requires appropriate privileges of the technical user):

```js
const { writeCredential } = require('./credstore')
// Example: write a password-type entry
await writeCredential(binding, "dsp-scim", "password", {
  name: "dsp-scim-base-url",
  value: "https://<host>",
  metadata: { owner: "platform", system: "sac" }
})
```

> In the app itself we only **read** (`readCredential`).

---

## SCIM Configuration

`scim_dsp.js` performs:

1. **OAuth2 Client Credentials** to get an access token from `dsp-scim-token-url`.
2. **CSRF bootstrap**: `GET {baseUrl}/api/v1/csrf` with headers
   - `Authorization: Bearer <token>`
   - `x-sap-sac-custom-auth: true`
   - `x-csrf-token: fetch`
   (Returns `x-csrf-token` and `set-cookie` headers)
3. **Fetch Users**: `GET {baseUrl}/api/v1/scim2/Users/` with Bearer, CSRF, and Cookie headers.

Two helpers are exposed:
- `fetchUsers()` → normalized array `{ id, firstName, lastName, displayName, email, userName }`
- `fetchUsersRaw()` → raw SCIM resources (for role aggregation, etc.)

Errors are logged with response payloads when available.

---

## Database Schema

Defined in `schema.cds` (namespace `dsp.scim`):

- **Users** `(cuid, managed)`  
  `familyName`, `givenName`, `displayName`, `email`, `userName`

- **Roles** `(managed)`  
  `key value: String(200)`, `display: String(150)`, `userCount: Integer`

- **UserRoles** `(cuid, managed)`  
  `key user: Association to Users`, `key role: Association to Roles`

Two **HDI Roles** are included for consumption scenarios (e.g., DSP):
- `DWC_CONSUMPTION_ROLE` — `SELECT`, `SELECT METADATA`, `EXECUTE`
- `DWC_CONSUMPTION_ROLE#` — same with **GRANT OPTION** (for admins)

> Import these hdbroles with your MTA/HDI deployment so consumers can read tables and execute actions (if exposed via procedures).

---

## Service API

Service name: **`DSPUsers`** (path: `/data`, requires: `authenticated-user`).

### Entities (projections)

- `GET /data/Users` → persistent table
- `GET /data/Roles` → persistent table
- `GET /data/UserRoles` → persistent table

### Virtual, read-only views (live from SCIM)

- `GET /data/UsersVH`
  ```json
  [
    {
      "id": "uuid",
      "email": "a@b.c",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "displayName": "Ada Lovelace",
      "userName": "ada.l"
    }
  ]
  ```

- `GET /data/RolesVH`
  ```json
  [
    {
      "roleValue": "SAC_Admin",
      "roleDisplay": "SAC Admin",
      "userCount": 5
    }
  ]
  ```

- `GET /data/UserRolesVH`
  ```json
  [
    {
      "userId": "uuid",
      "roleValue": "SAC_Admin",
      "userName": "ada.l",
      "displayName": "Ada Lovelace",
      "email": "a@b.c",
      "roleDisplay": "SAC Admin"
    }
  ]
  ```

> `UsersVH`, `RolesVH`, `UserRolesVH` are built dynamically in `service.js` via SCIM calls; they do **not** read from HDI tables.

### Actions

- `POST /data/SyncUsersVHToUsers` → `Integer`  
  Upserts normalized `UsersVH` entries into **Users** table.

- `POST /data/SyncRolesFromSCIM` → `Integer`  
  Aggregates roles (`value`, `display`, `userCount`) and upserts into **Roles**.

- `POST /data/SyncUserRolesFromSCIM` → `Integer`  
  Refreshes **Roles** from SCIM and **rebuilds** the **UserRoles** association table (DELETE + INSERT).

> All actions run in a CAP transaction. `UPSERT` is used where appropriate.

---

## Actions & Data Flows

- **Live views** (`*VH`) → for quick UI dashboards without storage, always current.
- **Sync actions** → create durable records into HDI for modeling/joins, DSP, or downstream ETL.

Example run order for a full refresh:
1. `SyncUsersVHToUsers`
2. `SyncUserRolesFromSCIM` (keeps `Roles` fresh as part of the process)

---

## Deployment (Cloud Foundry)

`manifest.yaml` includes:
- App name: `dsp-scim-handler-srv`
- Buildpack: `nodejs_buildpack`
- Command: `npm run start:prod`
- Services to bind:
  - `dsp-scim-handler` (HDI container)
  - `my-credentials` (Credential Store)
  - `xsuaa-dsp-scim-handler` (XSUAA)

### Steps

```bash
# Login and target org/space
cf login

# Push app
cf push

# Check logs
cf logs dsp-scim-handler-srv --recent
```

> Ensure the service instance names in `manifest.yaml` match the actual instances in your space. The app relies on `VCAP_SERVICES.credstore[0].credentials` being present.

---

## Security Notes

- Endpoints are guarded with `requires: 'authenticated-user'`. Ensure your XSUAA is configured accordingly.
- Secrets are **never** committed; all SCIM endpoints & credentials come from **Credential Store**.
- `secrets.js` trims trailing `/` in base URLs to avoid double slashes.
- SCIM calls add `x-sap-sac-custom-auth: true` and CSRF token/cookies as required by the SAC API gateway.

---

## Troubleshooting

- **`VCAP_SERVICES.credstore[0].credentials not found`**  
  Provide `default-env.json` locally or bind the **Credential Store** service in CF.

- **SCIM 401/403**  
  Check OAuth client credentials in Credential Store and the token URL.

- **No `x-csrf-token` or cookies**  
  Verify CSRF endpoint `${baseUrl}/api/v1/csrf` is reachable with Bearer token and header `x-sap-sac-custom-auth: true`.

- **Empty views** (`*VH`) but actions work  
  Confirm the SCIM user data actually contains `emails`, `roles`, etc. Filtering excludes `active === false` users by design.

- **Role counts look wrong**  
  Only **active** users are counted. Adjust the filters in `aggregateRoles()` if you need different semantics.

- **`UPSERT` not defined**  
  Ensure `@sap/cds` is up to date and imported (`const cds = require('@sap/cds')`). In CAP runtime, `UPSERT` is available from the global CQN builder.

---

## Appendix

### Sample cURL (local, assuming approuter/auth already handled)

```bash
curl -s http://localhost:4004/data/UsersVH
curl -s http://localhost:4004/data/RolesVH
curl -s http://localhost:4004/data/UserRolesVH

# Actions (CAP will require POST)
curl -X POST http://localhost:4004/data/SyncUsersVHToUsers
curl -X POST http://localhost:4004/data/SyncRolesFromSCIM
curl -X POST http://localhost:4004/data/SyncUserRolesFromSCIM
```

### Folder Structure (suggested)

```
.
├─ srv/
│  ├─ service.cds
│  ├─ service.js
│  ├─ scim_dsp.js
│  ├─ secrets.js
│  └─ credstore.js
├─ db/
│  ├─ schema.cds
│  └─ src/hdbroles/*.hdbrole
├─ manifest.yaml
├─ default-env.json           # local only (gitignored)
└─ package.json
```

---

Happy syncing! 🚀

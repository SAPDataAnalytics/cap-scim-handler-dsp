# DSP SCIM Handler (CAP Service)

This project is a small **SAP CAP** service that synchronizes users and roles from a **SCIM** source (e.g., SAP Analytics Cloud) into an HDI container and exposes virtual read-only views for UIs and integrations.

It consists of:
- `service.cds` — the public service (`DSPUsers`) exposing entities and actions under `/data`
- `service.js` — implementation with SCIM fetch & aggregation
- `schema.cds` — persistent HDI entities (`Users`, `Roles`, `UserRoles`)
- `scim_dsp.js` — SCIM client (OAuth2 Client Credentials + CSRF + Cookie)
- `secrets.js` — reads secrets from environment variables
- `mta.yaml` — MTA deployment descriptor
- `hdbroles` — database roles to enable DWC consumption

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
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
                 Environment Variables

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
  - **XSUAA** service instance for authentication (configured to protect `/data` with `requires: 'authenticated-user'`)

> The app expects environment variables for SCIM configuration.

---

## Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Provide environment variables**

Copy `.env.example` to `.env` in the root directory and provide the required SCIM configuration locally. Real `.env` files are ignored by Git at every directory depth; never force-add them.

```env
DSP_SCIM_TOKEN_URL=https://<oauth-token-endpoint>
DSP_SCIM_BASE_URL=https://<scim-host>
DSP_SCIM_CLIENT_ID=<client-id>
DSP_SCIM_CLIENT_SECRET=<client-secret>
```

> Alternatively, set these as environment variables in your shell or IDE.

3. **Start the service**

```bash
npm run start
# or
npx cds run
```

The service will start (default: `http://localhost:4004`) and expose endpoints under `/data` (see [Service API](#service-api)).

---

## Environment Variables

The project reads all SCIM-related secrets from environment variables.

### Required variables

| Variable Name          | Description                              |
|------------------------|------------------------------------------|
| `DSP_SCIM_TOKEN_URL`   | OAuth2 token endpoint (for client creds) |
| `DSP_SCIM_BASE_URL`    | Base URL of the SCIM host (no trailing `/`) |
| `DSP_SCIM_CLIENT_ID`   | OAuth2 client id                          |
| `DSP_SCIM_CLIENT_SECRET` | OAuth2 client secret                      |

> `secrets.js` caches retrieved values in-memory. If variables are missing, it throws descriptive errors.

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

`mta.yaml` defines the MTA with modules for srv, db-deployer, and approuter, and resources for HANA and XSUAA.

### Steps

```bash
# Install MTA Build Tool if not present
npm install -g mbt

# Build the MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/cap-scim-handler-dsp_1.0.0.mtar

# Check logs
cf logs cap-scim-handler-dsp-srv --recent
```

> Ensure the service instance names in `mta.yaml` match the actual instances in your space. Inject the four `DSP_SCIM_*` variables into the srv module using your protected deployment pipeline. For a local deployment, copy `dev.template.mtaext` to the ignored `dev.mtaext`, fill it with rotated credentials, and supply that extension to the MTA deployment. Never commit populated extensions or place secrets in `mta.yaml`.

---

## Security Notes

<!-- Generated by GitHub Copilot - Nov-20-2026 -->
### Credential exposure remediation

Credentials were previously committed in `.env`, `dev.mtaext`, `mta.yaml`, `test_commands.sh`, `test_endpoint.py`, and `test_search_role.py`. Removing them from the current branch **does not remove them from Git history or revoke them**.

- Immediately revoke/rotate every exposed Datasphere SCIM OAuth client secret and XSUAA test client credential, including older values in Git history. Invalidate issued tokens where supported and review access logs for misuse.
- Update local configuration and protected deployment secrets with the new values, then restart/restage affected applications as required. Retained local `.env` and `dev.mtaext` files still contain the old, compromised values until replaced.
- Coordinate a complete history cleanup with repository administrators, including branches, tags, pull-request references, cached views, forks, and CI artifacts. A history rewrite requires a coordinated force-push and collaborators must re-clone or clean their clones without reintroducing old commits.
- Enable GitHub secret scanning and push protection where available. Ignore rules alone do not prevent force-adding a secret or hardcoding one in a source file.
- The test scripts read `XSUAA_CLIENT_ID` and `XSUAA_CLIENT_SECRET` from the process environment and fail before making requests if these are missing. Supply them through a secret manager or protected environment; the scripts do not automatically load `.env`.

- Endpoints are guarded with `requires: 'authenticated-user'`. Ensure your XSUAA is configured accordingly.
- Do not commit secrets; SCIM credentials must come from protected environment variables, not source-controlled deployment descriptors.
- `secrets.js` trims trailing `/` in base URLs to avoid double slashes.
- SCIM calls add `x-sap-sac-custom-auth: true` and CSRF token/cookies as required by the SAC API gateway.

---

## Troubleshooting

- **Environment variables not found**  
  Provide `.env` file locally or set environment variables in CF for the srv module.

- **SCIM 401/403**  
  Check OAuth client credentials in environment variables and the token URL.

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
│  └─ secrets.js
├─ db/
│  ├─ schema.cds
│  └─ src/hdbroles/*.hdbrole
├─ mta.yaml
├─ .env                      # local only (gitignored)
└─ package.json
```

---

Happy syncing! 🚀

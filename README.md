# Semantic Layer Editor for Keboola

A web UI for creating, browsing, and editing semantic layer objects (datasets, metrics, relationships, constraints, glossary terms) in the Keboola Metastore. Designed to be deployed as a **Keboola Data App** inside any project that has the `mcp-semantic-tooling` feature enabled.

> **Note:** This is a public mirror of `keboola-rnd/semantic-layer-ui` intended for customer data app deployments. The source repo is the canonical one — open PRs there.

## Quick start: deploy as a Keboola Data App

The fastest way to get this running in a customer project is via [`kbagent`](https://github.com/keboola/kbagent):

```bash
kbagent data-app create \
  --project <project-alias> \
  --name "Semantic Layer Editor" \
  --slug semantic-layer-editor \
  --git-repo https://github.com/keboola-rnd/semantic-layer-ui-public-mirror \
  --git-branch main \
  --git-public \
  --size small \
  --no-deploy

# Then set the required secrets (see below) and deploy:
kbagent data-app deploy --project <project-alias> --app-id <app-id> --wait
```

Or via the Keboola UI: **Data Apps → New Data App → Custom (Git repo)** with the same git URL.

## Required environment variables

Set these as **Data App secrets** (UI: app detail → Secrets, or `kbagent data-app secrets-set`):

| Variable | Required | Description |
|---|---|---|
| `KBC_METASTORE_TOKEN` | **yes** | Keboola Storage API **master token**. The Metastore API requires a master token (see [AI-3212](https://linear.app/keboola/issue/AI-3212)); regular Storage tokens won't work. Falls back to `KBC_TOKEN` if not set. |
| `ANTHROPIC_API_KEY` | **yes** | Anthropic API key for AI-assisted classification, metric suggestion, and document enrichment (uses `claude-sonnet-4`). Without this, AI features are disabled but the app still loads. |
| `METASTORE_URL` | no | Metastore API base URL. Auto-detected from `KBC_URL` if not set; defaults to `https://metastore.us-east4.gcp.keboola.com`. Override for EU/Azure stacks. |
| `KBC_URL` | no | Keboola Connection base URL for Storage API introspection. Defaults to `https://connection.us-east4.gcp.keboola.com`. Aliased as `KBC_STORAGE_URL`. |
| `PORT` | no | Express server port. Defaults to `3000`. The bundled nginx config in `keboola-config/` proxies port `8888` → `3000`. |

### Setting secrets via kbagent

```bash
# Use your master token from the kbagent project config
kbagent data-app secrets-set --project <alias> --app-id <id> \
  --key KBC_METASTORE_TOKEN \
  --value "$(kbagent --json project info --project <alias> | jq -r '.token.token')"

kbagent data-app secrets-set --project <alias> --app-id <id> \
  --key ANTHROPIC_API_KEY --value "sk-ant-..."

# Optional, only if not on us-east4 GCP:
kbagent data-app secrets-set --project <alias> --app-id <id> \
  --key METASTORE_URL --value "https://metastore.europe-west3.gcp.keboola.com"
```

## Prerequisites in the target project

1. **Master token access** — only project admins have a master token. The Metastore API enforces this. PAT tokens ([DMD-1335](https://linear.app/keboola/issue/DMD-1335)) will eventually relax this.
2. **`mcp-semantic-tooling` feature** — enable on the project (UI → Settings → Features, or via Manage API). Required so the Metastore exposes semantic layer endpoints.
3. **Anthropic API key** — for AI-assisted flows. Bring your own.

## Health check

After deploy, hit the data app URL — the `/health` endpoint reports config status:

```json
{
  "status": "ok",
  "metastoreUrl": "https://metastore.us-east4.gcp.keboola.com",
  "hasToken": true,
  "tokenPrefix": "12345-...",
  "hasAnthropicKey": true
}
```

If `hasToken` is `false`, set `KBC_METASTORE_TOKEN`. If `hasAnthropicKey` is `false`, AI features will return errors but browsing/manual editing still works.

## Local development

```bash
npm install
npm run dev            # Vite frontend on :5173
npm start              # Express backend on :3000 (set env vars first)
```

To run with the production layout (single port via nginx-style proxy): `npm run build && npm start`.

## Tech stack

- **Frontend:** React 19, Vite, TypeScript, TailwindCSS v4, shadcn/ui, React Query, React Router v7
- **Backend:** Express 5, direct calls to Keboola Storage API + Metastore API
- **AI:** Anthropic Claude (`claude-sonnet-4-20250514`) via raw HTTP — no SDK dependency
- **Deploy:** `keboola-config/` bundles nginx (port 8888) + supervisord for the Keboola Data App runtime

## Project structure

```
backend/         Node.js helpers — Keboola introspection, AI classification, heuristics
keboola-config/  nginx + supervisord config for Keboola Data App deployment
src/             React app — pages, components, wizard, providers
server.js        Express server: proxy to Metastore + AI endpoints
```

## Known issues / limitations

- **Master token requirement** is the biggest deployment friction. See [AI-3212](https://linear.app/keboola/issue/AI-3212).
- Only validated on **US east4 GCP** and **EU central 1** stacks. Other stacks should work but set `METASTORE_URL` + `KBC_URL` explicitly.
- AI features call Anthropic directly — no internal proxy/quota. Watch your API spend.

## Contributing

PRs go to the source repo: [`keboola-rnd/semantic-layer-ui`](https://github.com/keboola-rnd/semantic-layer-ui). This mirror is updated periodically; do not push directly here.

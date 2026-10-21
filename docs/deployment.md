# Deployment (Railway)

The app is built and started by the template's `Dockerfile`:

1. `npm ci --omit=dev`
2. `npm run build`
3. `npm run docker-start`, which runs `prisma generate && prisma migrate deploy` and then `react-router-serve ./build/server/index.js`.

`react-router-serve` listens on `PORT`, which Railway sets automatically.

## Railway project

### Service: `flexreviews-app`

- Source: GitHub repo `MrGhostsnow/flexreviews-app`, branch `main`.
- Builder: Dockerfile (detected from the repo root).
- Start command: leave empty to use the Dockerfile `CMD`, or set `npm run docker-start`.
- Networking: generate a public domain. Do not set `PORT` yourself.

### Database: PostgreSQL

Add a PostgreSQL database to the same project, then reference its connection
string from the app service.

### Variables (app service)

| Variable             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| `NODE_ENV`           | `production`                                                 |
| `DATABASE_URL`       | Reference to the Postgres service: `${{Postgres.DATABASE_URL}}` |
| `SHOPIFY_API_KEY`    | App client ID                                                |
| `SHOPIFY_API_SECRET` | App client secret                                            |
| `SHOPIFY_APP_URL`    | `https://` + the generated Railway domain                    |
| `SCOPES`             | Same value as `access_scopes.scopes` in `shopify.app.toml`   |

Optional: `SHOP_CUSTOM_DOMAIN`.

## Local development

`prisma/schema.prisma` uses PostgreSQL, so `shopify app dev` needs a
`DATABASE_URL` pointing at a local Postgres database. Put it in an untracked
`.env` file.

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
- Replicas: 1. The Judge.me auto-sync scheduler runs inside the server
  process (`app/lib/sync.server.ts`), so more replicas would sync the same
  shops more than once.

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
| `SCOPES`             | Same value as `access_scopes.scopes` in `shopify.app.toml` (`write_app_proxy,write_products`) |
| `ENCRYPTION_KEY`     | 32 random bytes, base64-encoded. Encrypts the Judge.me tokens. |

Optional: `SHOP_CUSTOM_DOMAIN`.

Generate `ENCRYPTION_KEY` once and keep it: changing it makes every stored
Judge.me token unreadable, and merchants would have to reconnect.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Local development

`prisma/schema.prisma` uses PostgreSQL, so `shopify app dev` needs a
`DATABASE_URL` pointing at a local Postgres database, and the Judge.me
connection needs an `ENCRYPTION_KEY`. Put both in an untracked `.env` file.

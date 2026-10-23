# Cutover from reviews-api to flexreviews-app

Until cutover, the released app version still points at the old
`reviews-api` service (`https://reviews-api-production-10bf.up.railway.app`)
and uses the `app-home` admin extension. Cutover moves the app URL, the auth
redirect URLs and the app proxy to this app and releases a new version.

Do every step in order. Do not run `shopify app deploy` before step 4: the
webhook URIs in `shopify.app.toml` are relative and would resolve against
the old service, which does not serve them.

## 1. Test on the dev store

1. Add `ENCRYPTION_KEY` to the local `.env` (see `docs/deployment.md`).
2. Run `shopify app dev` and open the app.
3. Settings: connect Judge.me with the store's private API token, wait for
   the first sync, then check Dashboard and Reviews.
4. Storefront: open a product page. During `app dev` the app proxy points at
   the tunnel, so the Custom Reviews block is served by this app.
5. Ask Sidekick about the store's reviews to exercise `sidekick-tools`.
6. Settings → Upgrade to Pro opens Shopify's plan selection page.
7. Stop `app dev` and clean the dev preview.

## 2. Rotate the client secret

The old `reviews-api` repository exposed its `.env`. Rotate the client secret
in the Dev Dashboard before going live, and use the new value in step 3. The
old service can stop verifying requests once its secret is revoked, so do
steps 3 to 5 close together.

## 3. Deploy to Railway

Follow `docs/deployment.md`: app service from `main`, PostgreSQL, and all
variables including a fresh `ENCRYPTION_KEY`. Wait until the logs show
`All migrations have been successfully applied` and `GET /` answers 200.

## 4. Point the app at the new service

In `shopify.app.toml`, replace the old URL with the new Railway domain
(`https://<new-domain>` below):

```toml
application_url = "https://<new-domain>"

[auth]
redirect_urls = [
  "https://<new-domain>/auth/callback",
  "https://<new-domain>/auth/shopify/callback",
  "https://<new-domain>/api/auth/callback"
]

[app_proxy]
url = "https://<new-domain>"
subpath = "reviews"
prefix = "apps"
```

Commit the change, then run:

```sh
shopify app deploy
```

The new version:

- removes the `app-home` extension (replaced by the embedded pages),
- keeps `custom-reviews` and `sidekick-tools` with their existing uids,
- reduces scopes to `write_app_proxy`,
- subscribes the webhooks to the new service.

The CLI asks to confirm removing `app-home`; confirm.

## 5. After release

1. Open the app on each installed store and reconnect Judge.me in Settings.
   No data is migrated from the old SQLite database: reviews are synced
   again and the plan is read from Shopify.
2. Check the Custom Reviews block on a product page.
3. Keep the old `reviews-api` service for a day as a fallback, then delete
   it together with its database.

## Rollback

In the Dev Dashboard, release the previous app version again. It points back
at `reviews-api`, which keeps working as long as it is running and its
client secret is still valid.

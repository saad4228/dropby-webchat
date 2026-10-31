# DropBy: standalone Cloudflare deployment

These are instructions for a later authorized release. Preparing/building the project does not publish it. No remote migrations, Worker changes, secret changes or deployments were performed during preparation.

## Verified resources — 31 October 2026

| Resource | Verified state |
| --- | --- |
| Cloudflare account | `234db92f4baccedce22a0d455666a638`, authenticated through Wrangler |
| Intended Worker | `dropby-webchat`; does not exist yet in this account |
| Production D1 | `dropby-db`, ID `1f8d95c5-6ae7-4ae8-b6ec-62260eeb8332`; only Cloudflare's internal table, no application schema |
| Supabase | `https://trufjmrgjxnbwhaylcrc.supabase.co`, private bucket `dropby-media` |
| R2 in this account | API returned `10042` (R2 not enabled), so there is no account bucket to migrate |
| Existing managed Site | Separate hosting environment: zero rooms, attachment records and music tracks; its schema predates smart media |

The managed Site tools expose its D1 records but not an R2 object inventory. Zero live references were verified; an empty physical managed bucket is not claimed. Its resources and objects were left intact. There was no required referenced media to migrate, and no remote media was deleted. If legacy data appears before a future cutover, stop: inventory it, copy objects into the private bucket, verify sizes and SHA-256 contents, update references/provider/path atomically, and verify authorized reads before retiring any source objects. Preserve the source as a rollback copy until the cutover is confirmed.

`wrangler.jsonc` contains the verified standalone account/database identifiers and public runtime defaults. `npm run build:cloudflare` selects the standalone entrypoint and verifies the generated D1 binding. `npm run build` retains the managed Sites integration using `wrangler.sites.jsonc`; its placeholder local D1 ID is not the standalone production database. Always use the Cloudflare build immediately before a standalone deployment.

## 1. Prepare locally

From the complete `dropby-webchat` checkout, use Node 22.13+ and run:

```powershell
npm ci
npm run typecheck
npm run test:unit
npm run build:cloudflare
```

The deployable configuration is `dist/server/wrangler.json`; the source configuration is `wrangler.jsonc`. Deploy the generated configuration so the built Worker and static assets travel together. The build runner preserves the verified account ID and `keep_vars` setting. No R2 binding is configured. The manifest's `r2: null` explicitly disables that managed-host capability.

The standalone Worker removes caller-supplied account-identity headers. Guest chat works normally; optional managed-host ChatGPT account linking remains available only on the managed host until an independent identity provider is configured. Do not copy the managed host's identity headers into an independent deployment.

## 2. Verify the database again

Open **Cloudflare Dashboard → Storage & databases → D1 SQL database → dropby-db → Settings**. Confirm its database ID exactly matches the table above and `wrangler.jsonc`. In its **Console**, inspect:

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

The verified account database is fresh. Do not confuse it with the existing managed Site's separate D1 database. If tables/data have appeared since the audit, inspect them and the migration ledger before proceeding; do not blindly apply the initial migration to an existing schema.

## 3. Apply pending migrations — only when authorized

| Migration | Change | Standalone production state at inspection |
| --- | --- | --- |
| 0000 | Initial identities, rooms, memberships, messages, attachments, reactions, reports, signals and rate limits | Pending |
| 0001 | Optional account ID on sessions and unique index | Pending |
| 0002 | Room emoji logo and uploaded-logo reference | Pending |
| 0003 | Music queue, shared playback state and listener choices | Pending |
| 0004 | Media alerts, session profile-image reference, attachment provider/path/purpose/state/reservation/preview/duration/waveform/deletion metadata | Pending |
| 0005 | Server-only upstream resumable-transfer URL | Pending |
| 0006 | Change new attachment provider default to Supabase; copy all existing attachment fields without changing IDs or references | Pending |

Migrations 0004/0005 are applied to the existing local development database, not either remote environment. The managed Site has the schema from 0000–0003 and no smart-media columns. Applied migration files 0000–0005 were preserved; 0006 is appended. Its metadata-preservation test and local application are verified.

For the verified fresh standalone database, run from the repository root:

```powershell
npx wrangler d1 migrations list DB --remote --config wrangler.jsonc
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

Review the target printed by Wrangler and the pending list before confirming. These commands use the actual database ID from the source configuration; they are not executed by a build. A schema created outside Wrangler's migration ledger needs reconciliation before using `migrations apply`, otherwise initial CREATE statements may collide. Do not edit old SQL to hide that mismatch.

For local standalone preview only, use the same command with `--local --persist-to .wrangler/state` instead of `--remote`, then `npm run dev:cloudflare -- --port 5178`. Local databases with different configured IDs are separate even when their binding is named DB. After a Cloudflare build, `npm run start -- --port 5177` previews the completed artifact locally using the canonical secret file. It uses Miniflare without reload watchers; on Windows, only local outbound network I/O is bridged through Node to avoid a workerd HTTPS socket-reset issue. Production Workers keep native fetch. The preview provisions no resources.

## 4. Create the Worker and configure runtime settings

There is no DropBy Worker in the verified account yet. When you are ready to authorize the first release, open **Cloudflare Dashboard → Workers & Pages → Create application → Create Worker / Start with Hello World**, name it **dropby-webchat**, and finish creation. This dashboard action publishes a bootstrap Worker; it was not performed during preparation. Leave the unrelated existing Worker alone.

Open **Workers & Pages → dropby-webchat → Settings → Variables and Secrets → Add**:

| Name | Type | Value/source |
| --- | --- | --- |
| `SUPABASE_URL` | Text | `https://trufjmrgjxnbwhaylcrc.supabase.co` — no `/rest/v1/` suffix |
| `SUPABASE_MEDIA_BUCKET` | Text | `dropby-media` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Paste the server key privately from the canonical local `.dev.vars` file |
| `MEDIA_STORAGE_BUDGET_BYTES` | Text, optional | `1000000000`, the default application estimate budget |
| `MEDIA_ADMIN_IDS` | Text | Add your real DropBy `user.id` after creating your first identity; see below |

Use **Secret**, not a plaintext variable, for the service-role key. Save/apply the settings when you authorize deployment. Settings changes can publish a new Worker version; do not do this as an inspection step. No browser environment variable, GitHub secret log, `.openai/hosting.json` value or source file should contain the key. A local `.dev.vars` does not configure the remote Worker.

`keep_vars` preserves dashboard variables not declared in source, including your administrator allowlist. Source-declared defaults such as the bucket URL/budget should be changed in `wrangler.jsonc` as well if you intentionally change them. Existing encrypted Worker secrets are separate from source variables.

Check **Bindings → Add binding → D1 database**: variable name **DB**, database **dropby-db**. The generated deployment config declares this exact binding too. Do not create an R2 binding. Check Supabase **Storage → Buckets → dropby-media** and keep visibility **Private**; broad public Storage policies are unnecessary for this server-authorized architecture.

## 5. Publish the prepared build — only when authorized

From the current complete local checkout, after the remote settings and schema are ready:

```powershell
npm run build:cloudflare
npx wrangler deploy --config dist/server/wrangler.json --keep-vars
```

This final command publishes production. It was not run during preparation. A GitHub push is not needed for this manual deployment. Do not deploy the managed-preview build or overwrite the Vite config with an old setup ZIP.

## 6. Configure your storage administrator

1. Open the deployed DropBy URL in your own browser and create/join a room to establish your identity.
2. In the **same browser and domain**, open `/api/session`. Copy the exact `user.id` from the JSON response. Do not copy a cookie, account ID, email, Supabase ID or room ID.
3. In the Worker's **Settings → Variables and Secrets**, add/edit `MEDIA_ADMIN_IDS` as **Text** and paste that ID. For multiple administrators, separate exact IDs with commas.
4. Save/apply the configuration and refresh DropBy. **More room options → Media storage** should appear for that identity; other room owners/members should not gain global storage access.

Parsing splits on commas, trims surrounding whitespace and compares exact identity IDs. No administrator is invented or hardcoded. An empty/unset allowlist grants nobody access. Guest IDs belong to the browser session; losing it requires reconfiguring the allowlist using the replacement ID. Retain your administrative browser session.

The panel shows D1 estimates and persistent 70/85/95% in-app warnings. Cleanup requires an administrator action and the documented confirmation; it preserves active content and retries failed deletion. There is no scheduled purge or automatic paid upgrade. Estimates are not Supabase billing or bandwidth measurements.

## 7. Post-release checks

Verify text chat, a photo/GIF, document, voice note, video-on-Play, a larger interrupted/resumed file, personal wallpaper, profile photo and room logo. Check that another room's/private draft media cannot be read, and temporary signed links expire. Verify admin warnings/cleanup with a controlled staging fixture rather than filling the production bucket. Check Worker logs without logging cookies, authorization headers, signed tokens or file contents.

The canonical local secret file is `dropby-webchat/.dev.vars`. The redundant sibling `dropby-webchat.dev.vars` was verified and removed. Project/workspace ignore rules protect both naming forms. Builds strip generated preview-secret files; local production preview explicitly reads the canonical file. No secret belongs in a deployment archive.

## Preparation verification

Passed: TypeScript, 28 unit tests, 49 API regression checks, 12 real Supabase media checks against the built Worker, 11 isolated storage/admin checks, all 33 browser journeys, missing-credential and invalid-URL checks for every upload endpoint, and both build profiles. The appended migration preserves every attachment field and its message reference in a round-trip test. A WebP/MP4 binary-header regression test prevents valid container size bytes being mistaken for UTF-8 text.

The final build has the verified D1 ID and no active R2 binding. Source/build/reference-file scans found no configured credential, and the duplicate secret file is absent. No GitHub push, production deployment, remote schema change or cloud secret update was performed. Physical managed-bucket inventory remains outside the connected tools; no claim or operation depends on deleting that bucket.

References: [Cloudflare encrypted secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/), [D1 migration tracking](https://developers.cloudflare.com/d1/reference/migrations/), [smart-media policy](SMART_MEDIA.md).

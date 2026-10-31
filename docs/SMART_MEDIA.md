# Smart media: configuration, accounting and recovery

DropBy keeps the existing React interface, Cloudflare Worker API and D1 database. All uploaded media uses the private Supabase `dropby-media` bucket. No active R2 binding or runtime fallback remains. Unmigrated file records fail explicitly rather than being silently reclassified or deleted. Text messaging never depends on a successful Supabase request.

## Configure the server

Local settings belong in the ignored `.dev.vars` file **inside** the project folder, beside package.json. Production settings belong in the Worker's runtime variables/secrets. Never put the service-role key in NEXT_PUBLIC variables, hosting.json, a browser component, a commit, or a screenshot.

```dotenv
SUPABASE_URL=https://trufjmrgjxnbwhaylcrc.supabase.co
SUPABASE_MEDIA_BUCKET=dropby-media
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
MEDIA_STORAGE_BUDGET_BYTES=1000000000
MEDIA_ADMIN_IDS=comma-separated-dropby-identity-ids
```

Use the project root URL, not its `/rest/v1/` database endpoint. Keep the bucket private. Browser users do not need a Supabase account or broad public storage policies. The Worker checks D1 identities and room membership; the service-role key is only used on the server. Both legacy JWT service-role keys and Supabase's newer server-key format require the API-key header when using the direct storage hostname.

An administrator is an explicitly allowlisted DropBy identity ID, **not every room owner**. While signed into your own DropBy identity, open `/api/session` and copy your `user.id` into MEDIA_ADMIN_IDS. Restart the local server after changing settings. On your Cloudflare deployment, store this value in runtime settings. The administrator gets **More room options → Media storage**, usage warnings, and explicit cleanup controls. Do not expose an endpoint allowing a normal member to make themselves an administrator.

Apply pending 0004/0005 and appended 0006 after the existing migrations. Migration 0006 changes the provider default to Supabase while preserving existing metadata. Historical SQL is immutable; old provider values are not treated as verified migrated files. See [the verified production target and exact commands](CLOUDFLARE_DEPLOYMENT.md).

The redundant sibling secret file was removed after verifying the canonical file; project/workspace ignore rules cover both naming forms. Production artifacts strip preview-secret files. No production deployment, paid upgrade, or automated cleanup job is created by this change. Adding these variables to a local file does not configure a remote Cloudflare account.

## Limits and formats

`lib/media-config.ts` is the common browser/Worker configuration. Edit it once and rebuild to adjust the application limits:

| Purpose | Default maximum |
| --- | ---: |
| Chat image | 8 MB |
| Video | 30 MB |
| Voice note / chat audio | 10 MB |
| PDF / plain-text document | 15 MB |
| Profile photo | 3 MB |
| Personal wallpaper | 8 MB |
| Room logo | 8 MB |
| Room radio audio | 15 MB, preserving its existing allowance |
| Room radio video | 30 MB |
| Generated thumbnail | 384 KB |

For file-limit calculations, MB in the interface means MiB (1024 × 1024 bytes), matching the previous app's convention. The default storage budget is a conservative **1,000,000,000 bytes**, configurable independently through MEDIA_STORAGE_BUDGET_BYTES. These are application limits, not a representation of a particular Supabase plan entitlement or bucket setting.

Images accept JPEG, PNG, WebP and GIF. Videos accept MP4/WebM. Audio accepts supported MPEG, MP4, WebM and Ogg containers. Documents accept PDF and plain text; SVG, HTML and executables are not allowed. Browser codec support still determines whether a particular media stream plays. The recording path prefers WebM/Opus, then Ogg/Opus, with a supported fallback.

Validation happens before browser optimization and again on the server. A renamed file does not gain permission: the server checks its signature, persisted size and content type. Supabase completion is verified before a file becomes usable in a message. Filenames are sanitized labels, not object paths. Object paths contain server-generated IDs and are not supplied by visitors.

## Image, video and voice preparation

`lib/media-prepare.ts` uses browser decoding and canvas APIs. Large static images can be resized, preserving aspect ratio, to a 2560-pixel maximum edge and encoded as high-quality WebP. PNG conversion uses a higher quality setting and keeps transparency. The new encoding is retained only if it saves meaningful space. Supported originals remain usable if the browser cannot prepare a conversion.

Chat thumbnails have a maximum edge of 640 pixels. A separate thumbnail is only uploaded when it is materially smaller than the full image. Small images reuse their original, avoiding redundant copies. Animated GIFs are uploaded byte-for-byte and displayed as GIFs; there is no static-canvas conversion that would destroy their animation.

Videos retain their original quality/container. The browser generates a small poster when possible. Conversation videos have no media source until Play is selected and use `preload="none"`; scrolling does not load a whole video. Once Play is selected, native playback/range behavior determines how much data the browser requests. No FFmpeg download, paid transcoder, or background video-processing service is introduced.

Voice recording prefers Opus at 64 kbps when supported, with pause/resume, preview and cancellation. Waveform samples are measured from the microphone while recording and saved with duration hints. They are display metadata, not trusted evidence used to bypass byte limits. Voice playback fetches the audio on demand once into an in-memory Blob, then reuses it for the audio element and seeking. It does not fetch a second copy just to draw a waveform. Legacy audio without waveform metadata uses a neutral placeholder until playback, rather than downloading every old recording while scrolling.

Room radio retains its existing buffered playback/synchronization engine; only its upload path is shared with smart media. Documents show the filename, type, size and a download control. Uploaded profile photos, room logos and personal wallpapers use their own purpose-specific authorization and limits.

## Resumable transfers

Files larger than 6 MiB use `tus-js-client` and Supabase's TUS mechanism. The browser sends 6 MiB chunks to a scoped Worker upload endpoint. The Worker forwards them to Supabase's direct storage hostname using server-side authorization. This extra hop deliberately keeps Supabase credentials/capabilities off the browser and allows membership, lease expiry, offsets, chunk sizes and cancellation to be enforced on every request.

1. The Worker validates the requested purpose/type/size and atomically reserves space in D1.
2. It returns an upload lease, expiring after 24 hours, scoped to this identity and room.
3. The Worker creates the upstream TUS transfer using a temporary signed upload token. Raw Supabase credentials and the upstream transfer URL stay server-side.
4. HEAD/PATCH resume from the acknowledged offset; temporary failures are retried with bounded backoff. The frontend supports pause, resume, retry and cancel.
5. Finalization checks actual Supabase object metadata and a bounded signature prefix before publishing the attachment.
6. The message references the verified attachment ID, rather than trusting an arbitrary storage URL.

Interrupted upload metadata and the TUS URL for the **Worker** endpoint are stored locally. After a refresh, the conversation offers to resume. The user reselects the same file; a SHA-256 fingerprint matches the prepared content to its existing lease. The binary file itself is not duplicated in localStorage. Smaller uploads show progress/retry/cancel but can restart their smaller request after interruption; they do not claim byte-level resume support.

Supabase TUS upload URLs have their own validity period. Expired or cancelled leases require a new upload. There is no promise of permanent resume after the provider's transfer expires or the user's session/membership is lost.

## Private loading and caching

The normal stable `/api/media/:id` route checks identity, room access, attachment state and references before serving bytes. Thumbnail access inherits the parent's authorization. Drafts are only visible to their uploader. Wallpapers are personal. Profile photos are visible to their owner and identities sharing a joined, non-banned room.

Media responses use private conditional caching, stable ETags and revalidation. Authorization happens **before** a 304 response. An authorized browser can reuse unchanged bytes without another Supabase object download. Video ranges are streamed. Images are lazily activated near the visible conversation; thumbnails appear first and the viewer requests the original when opened.

An authorized `/api/media/:id/url` request can issue a short-lived private signed URL (60 seconds). It is a temporary bearer link: a recipient can use it until expiry, and already downloaded bytes cannot be revoked from a device. Default conversation rendering continues through the membership-checked Worker route.

Supabase documents that Smart CDN is enabled on Pro and higher, with signed-URL tokens affecting cache keys. This feature **does not assume paid Smart CDN behavior on the Free plan**. The app does not rely on a new signed URL per render as a caching strategy. Provider changes, signed-URL expiry, browser caches and private-bucket policies still matter; inspect actual headers/logs for your project before making caching claims.

Local integration checks against the configured private project on 31 October 2026 verified that signed URLs worked and the same URLs without tokens failed. Repeated reads varied between `cf-cache-status: HIT` (`age: 0`) and `REVALIDATED` (no age), with no `Cache-Control` header. These are request observations, not proof of a paid CDN feature, a durable cache policy, or measured bandwidth savings. The Worker route independently passed its private ETag/304 authorization checks.

## What the estimate means

Every new file and generated preview has a D1 attachment record containing its ID, immutable path, MIME type, authoritative size, uploader, room, purpose, timestamps, state, optional parent/thumbnail links, and display metadata. Message association is represented by `messages.attachmentId`; music and image settings have their own references. A file can have multiple references, so one copied message ID is not used as its ownership model.

The administrator sees:

- Verified ready/attached file bytes, including previews.
- Reservations for unfinished/cancelled uploads.
- Pending deletion bytes, retained until absence is confirmed.
- Configured budget and 70%, 85%, 95% warning levels.

Warnings are stored in D1 and delivered through the administrator's in-app storage panel/notification count. Each threshold is recorded at most once per UTC day. Acknowledgement persists. No email, Slack message or external webhook is silently configured.

Space admission is a conditional D1 write including current files/reservations, so competing uploads cannot both claim the same remaining budget. When the budget cannot accept a file, the upload is rejected with a useful message; text and existing media are preserved. A failed upstream upload never becomes a successful message attachment.

This is an **estimate of the media represented by DropBy's records**, not Supabase billing. It excludes files added outside DropBy, provider-internal partial upload overhead and any external legacy objects. It is not an exact measurement of cached/uncached egress, request charges, organization-wide use, or actual bucket entitlement. No automatic paid upgrade occurs.

For authoritative usage, open your project/organization in the [Supabase dashboard](https://supabase.com/dashboard), review **Usage** for storage and cached/uncached egress, inspect the private bucket in **Storage**, and use **Logs → Storage** or the current log explorer to investigate download/range/cache events. Dashboard labels can change. Compare those values with DropBy's records; do not treat the D1 estimate as a substitute.

## Deletion and the explicit cleanup policy

An allowed deletion clears the live reference/content and makes the file unavailable through DropBy. The server claims the unreferenced object for deletion, removes it from Supabase, confirms it is absent, and only then marks its metadata deleted and releases its accounted bytes. Shared live message/music references are preserved. Preview children are removed with their unused parent. Provider errors leave a retryable `deleting` state whose bytes still count.

Cancelled transfers reject further chunks immediately. Their reservation is retained temporarily, because a request already in flight may still finish. Cleanup can release these after the safety interval and a storage check. Replacing/clearing a personal wallpaper explicitly requests cleanup of the old personal file; it is not a retention rule for conversations.

The administrator can choose **Review abandoned uploads**, read the policy, then explicitly request cleanup. It covers:

- Unfinished upload leases past their 24-hour expiry.
- Unsent `ready` drafts older than 48 hours.
- Cancelled transfers older than 10 minutes.
- Failed/pending deletions that have no live references.

It does **not** delete active chat history, queued/played music, current profile images, room logos, or personal wallpapers. No scheduled deletion job is installed. Provider-side expiry of unfinished TUS resources is separate from this application policy. A future automatic cleanup schedule would need an explicitly selected schedule and the same reference checks.

## Verification

```powershell
npm run typecheck
npm run test:unit
npm run build
```

With the app running and Supabase configured, use `TEST_ORIGIN` to point API/browser tests to the correct localhost port:

```powershell
$env:TEST_ORIGIN='http://localhost:5174'
npm run test:media
npx playwright test tests/browser/smart-media.spec.ts
```

The media API check creates isolated test rooms and temporary objects, tests private access, type/size limits, signatures, TUS offset recovery, conditional/range reads, signed URLs and deletion, then removes its unused test objects. It does not alter an existing user's room. Browser scenarios cover optimization, an actual two-frame GIF, video/audio demand loading, voice metadata, wallpaper persistence, resume after network interruption/reload, documents, avatars and mobile layout. Real-browser/device codec behavior and broader network conditions still need deployment-specific verification.

To repeat the same browser journeys at a phone-sized viewport in dark mode, set `$env:MEDIA_MOBILE='1'` before the Playwright command. Unset it afterward with `Remove-Item Env:MEDIA_MOBILE`.

Quota/concurrency and forced-failure tests must use an isolated local fixture, never the real bucket. From the repository root, `node tests/setup-media-fixture.mjs` creates `outputs/media-fixture-project` with dummy credentials and linked dependencies. It refuses to overwrite an existing fixture and excludes ignored real secrets. Apply the seven migrations to its local database:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config outputs/media-fixture-project/wrangler.fixture.jsonc --persist-to outputs/media-fixture-project/.wrangler/state
```

In separate terminals, start `node tests/media-storage-fixture.mjs` from the repository root, then run `npm run dev -- --port 5176` inside `outputs/media-fixture-project`. The mock listens only on loopback port 7799. Finally, from the repository root:

```powershell
$env:TEST_ORIGIN='http://localhost:5176'
$env:MEDIA_FIXTURE_ROOT=(Resolve-Path outputs/media-fixture-project).Path
node tests/media-failure-api.mjs
```

Those 11 checks deliberately seed synthetic usage, force provider deletion failures and review desktop/mobile admin UI. They require Node's SQLite module and the configured Chrome executable. Their database path is restricted to the named fixture folder. They reset only that fixture's rate/alert records for repeatability. The mock does not prove Supabase's internal behavior; the real-project API checks cover the provider boundary separately. Existing rate limits remain enabled, so repeated browser/API runs against one database can legitimately hit session or mutation limits.

See `CODE_GUIDE.md` for the main source map. The new responsibilities are `media-config.ts` (shared rules), `media-prepare.ts` (browser optimization), `media-upload.ts` (transfer lifecycle), `media-storage.ts` (server-only provider calls), and `media-server.ts` (leases, authorization, accounting, cleanup).

For the missing-configuration regression, stop the isolated fixture, temporarily clear only its dummy `SUPABASE_SERVICE_ROLE_KEY`, restart it, and run `node tests/storage-config-api.mjs` with the same fixture environment variables. It verifies all upload endpoints fail clearly while text still works. Restore the dummy key afterwards; do not change the real project's credentials for this test.

## Primary references

- [Supabase TUS uploads and presigned tokens](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Standard uploads and the 6 MB recommendation](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Private signed URLs and Smart CDN behavior](https://supabase.com/docs/guides/storage/cdn/smart-cdn)
- [Storage and egress usage](https://supabase.com/docs/guides/storage/serving/bandwidth)
- [Storage error codes](https://supabase.com/docs/guides/storage/debugging/error-codes)

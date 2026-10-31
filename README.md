# DropBy

A browser-based space for your people. Create a public or password-protected room, share a URL, and chat without mandatory account creation.

## Local development

Requires Node 22.13+, npm, and a current browser.

```powershell
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_green_gargoyle.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lively_black_tarantula.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_yellow_arclight.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_aspiring_dagger.sql
npm run dev -- --port 5173
```

Open the printed local URL. Run the initial migration once per local database. Local D1 and R2 state are in ignored `.wrangler/state`; they are separate from production. The Windows development server uses polling to avoid file-watcher locks.

## Implemented

- Responsive homepage, clearly labeled interactive demo, onboarding, room URLs, and optional Quick Join.
- Compact homepage composition with a continuous scenic background and consistent typography. Rooms can use an emoji logo or a persistent owner-uploaded JPG/PNG/WebP image (up to 7 MiB).
- Server-generated guest identities with hashed session secrets and 30-day HttpOnly cookies; no token in localStorage.
- Optional ChatGPT sign-in links a guest identity to a verified Site-scoped account ID, preserving the profile and its room memberships on other signed-in devices. Visitors can continue as guests.
- Public and password-protected rooms, salted PBKDF2 password hashing, atomic unique room creation, owner/moderator/member roles, and locked joins.
- Persistent messages, replies, emoji reactions with participant tooltips, ownership-checked editing/deletion, revision records, moderator pins, loaded-message search, and pagination.
- Server-backed presence, typing, reconnect handling, idempotent send retries, and visible network errors.
- R2 image/video/audio/PDF/text uploads (15 MiB), content-signature checks, authenticated downloads, inline players, photo viewer, shared-media panel, clipboard paste and drag-and-drop.
- Browser voice recording: pause/resume, cancel, stop, preview before attachment, native audio playback, seeking and speed controls.
- Actual small-group WebRTC audio/video calls, authorized signaling, microphone/camera/device selection, screen sharing, floating/expanded panels, and a four-person cap. A configurable LiveKit SFU integration supports larger groups.
- Ten themes, persistent personal overrides, shared owner-controlled presets, custom message/accent colors with contrasting text, uploaded local wallpapers, opacity/blur controls, light/dark mode, and reduced motion. Love letters, Football night, Cosmic daydream and Retro arcade change backgrounds, bubble shapes, controls and ambient details.
- Sent-message emoji performances last 1.8 seconds, then return to the original Unicode glyph. Common faces use original vector eyes, mouth, tears and expression details: crying/sobbing tears, laughing mouths, heart eyes, kisses, sleepy breathing and more. Other emoji use native-glyph motion. The picker and reaction choices stay still, including hover and selection; messages can replay on tap. Old history stays still on initial load. Joined characters, skin tones and flags stay intact. System reduced motion and the persistent Room motion switch disable effects.
- A dedicated `/about` creator page using Mohammad Saad’s supplied biography, Instagram and LinkedIn links, plus the contact email. The homepage navigation provides both Join and Create actions.
- A consistent slate and blue palette on the homepage and creator page, with the supplied profile illustration in both places.
- Room radio: a compact shared music player with a persistent 20-song queue, MP3/M4A/OGG/MP4/WebM uploads up to 15 MiB, per-song acceptance or rejection, personal volume/mute, change requests, and DJ/moderator playback controls. Videos use an audio element; no video is shown or transcoded to MP3.
- Wallpapers up to 7 MiB persist in IndexedDB; short browser object URLs display large images without CSS custom-property limits or localStorage quota failures. The categorized emoji picker includes 647 emojis for messages and reactions.
- Server-enforced mute/unmute, bans, moderator assignments, message reports and owner/moderator report review.
- Contextual floating panels, keyboard composer, focus-trapped dialogs, semantic controls, meaningful empty/error/loading states.

The product name is centralized in a few brand/metadata surfaces and is replaceable. Creator information is centralized in `lib/creator.ts` and uses the biography and links supplied by Mohammad Saad.

## Architecture

React 19 + TypeScript on Vinext. The Cloudflare Worker API is in `lib/server.ts`, validation in `lib/validation.ts`, and Drizzle schema in `db/schema.ts`. D1 stores identities, rooms, membership, messages, revisions, reactions, file metadata, reports, transient call signals and rate limits. R2 stores private file bytes. The frontend is split into onboarding, conversation, message, appearance/member panels, and call modules.

`.openai/hosting.json` declares `DB` and `BUCKET`. Sites provisions production resources and applies tracked Drizzle migrations during publication. Do not edit an applied migration. Schema updates use `npm run db:generate` and a new migration. Preserve the Sites Vite integration and Worker entrypoint when deploying.

Room synchronization uses **1.5-second polling**, not WebSockets. Each successful snapshot reconciles current messages, reactions, members, settings and recent call signals. Presence expires after 35 seconds without a heartbeat. Message IDs make network retries idempotent. This is appropriate for small rooms; a high-scale deployment should use authorized push transport and distributed presence.

## Calling and optional TURN configuration

WebRTC runs between browsers with a hard limit of four participants. The default ICE server is `stun:stun.cloudflare.com:3478`. Direct peer connections depend on network conditions. For restricted networks, set the server runtime environment variable `TURN_ICE_SERVERS` to an ICE-server JSON array supplied by your TURN provider, for example:

```json
[
  { "urls": "stun:stun.cloudflare.com:3478" },
  {
    "urls": "turns:your-turn-host:5349",
    "username": "short-lived-user",
    "credential": "short-lived-credential"
  }
]
```

Use short-lived TURN credentials. They are necessarily provided to authorized call participants; do not put an administrative API secret in this value or source control. Camera/microphone permission is requested only when explicitly recording or joining a call, and denial is surfaced.

For larger groups, set `LIVEKIT_URL` (a `wss://` server URL), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in server runtime settings. Set `CALL_MEMBER_LIMIT` to a number from 4 to 100 (default 32). With all three LiveKit values configured, the app automatically uses LiveKit rather than peer mesh, generates short-lived signed room-specific join tokens, publishes browser tracks, subscribes to remote media, handles reconnect/disconnect events and supports device switching and screen sharing. The secret never enters the client bundle. The SDK loads only when this provider is used.

Local server settings belong in ignored `.dev.vars`; production secrets belong in Sites runtime environment variables, never in the hosting manifest. No LiveKit server credentials were provided for this build, so the SFU token signature/grant logic is unit-tested, and an actual SFU session remains unverified. The native peer call has been verified between two isolated browsers with synthetic media. See [LiveKit token documentation](https://docs.livekit.io/home/server/generating-tokens) and the [client SDK](https://github.com/livekit/client-sdk-js).

## Security and retention

Every room read, message operation, upload, file retrieval, call/signaling operation and moderation change checks server-side membership. Administrative operations check the stored role. Cross-origin mutations are rejected. Request bodies are schema-validated; React renders message text rather than HTML. File types and signatures are checked; SVG/HTML/executables are rejected. Non-media documents download as attachments, with `nosniff` and a sandbox content policy.

Messages and media are retained until deleted by the author or an authorized moderator. Message deletion removes visible content, associated revisions/reactions and file bytes. Sign-out revokes the guest session while preserving the identity record needed by existing messages. A guest who clears the cookie cannot recover ownership; choose optional ChatGPT sign-in before losing the cookie to preserve that identity across devices. Account recovery is handled by the identity provider. Anonymous participation does not mean untraceable participation, and this app does not claim end-to-end encryption.

Unsent uploads can leave orphaned objects. Before a broad public launch, add a scheduled orphan-upload cleanup, rate-limit record pruning, operational storage quotas, backups, monitoring, abuse detection and an independent security/privacy review. This release uses per-minute and per-hour D1 rate buckets, per-session message/upload/action limits, IP mutation/session-creation limits and salted room-password hashes. A broad public deployment should add a dedicated edge abuse layer.

## Verification

With the local server running:

```powershell
npx tsc --noEmit
npm run test:api
npm run test:unit
npx playwright test
npm run build
```

The API suites use independent cookie jars and cover 40 room, music permissions and concurrency, shared theme, logo authorization, privacy, messaging, idempotency, permission, reaction, media range, moderation, signaling, CSRF, session and optional account scenarios. Fifteen unit tests verify SFU tokens/capacities, upload error handling, image limits, signature checks, emoji graphemes/expressions and music timeline calculations. Sixteen browser journeys cover onboarding, two-user conversations, actual peer calls with synthetic media, mobile/dark layouts, large image and logo uploads, wallpaper persistence, repeated emoji/reaction selections, navigation joining, native autofill appearance, text/button contrast, room details, creator/contact navigation, expressive theme persistence, sent and received facial animations, still emoji selection, reduced motion and actual MP3/video-audio synchronization between two isolated browsers. Screenshots are stored in ignored `outputs/`.

Room radio polls a server-authoritative playhead every two seconds and corrects local drift. The DJ or room owner/moderator can pause, seek, skip or end a session; anyone can add a song or ask for a change. If the DJ leaves, another member can take the seat. A new song requires each listener to opt in. Consent is saved per identity and current song; volume/mute stay on the device. Browsers may require an Enable sound click after a reload. Local tests verify playback within one second between two browsers; this is not sample-accurate synchronization. Container codec support and network buffering depend on the browser. The tests use generated sine tones and a synthetic video in `tests/fixtures`, not commercial music. Played tracks remain stored until an operational retention/cleanup policy is added; queued tracks can be removed by their uploader or a room moderator.

The default Playwright configuration uses installed Windows Chrome; set `PLAYWRIGHT_CHROME_PATH` to another Chrome/Chromium executable on a different host. Tests use synthetic microphone/camera devices. They do not prove real hardware quality, Safari/Firefox compatibility or connectivity across all NAT/firewall combinations. Browser permissions and device/network behavior require manual cross-browser testing.

Upload regressions additionally cover non-JSON 413 responses, image signature validation, 3 MiB room logos, 5 MiB chat images, 6 MiB wallpaper persistence, larger-than-7-MiB rejection, expanded emojis and live room-detail updates. `next.config.ts` allows 16 MiB in the framework multipart reader so the API's 15 MiB file limit can be reached; multipart overhead is included. Clients translate plain-text upstream failures into useful errors.

## Known scope limits

Invite-token access/revocation, configurable per-room retention and member limits, push notifications, message forwarding, multiple attachments per message, active-speaker detection and advanced moderation/anti-spam are not shipped. LiveKit and TURN require operator-supplied infrastructure settings; no real SFU session was verified. Search and the media/pin panels cover loaded history; load earlier messages to extend their scope. Reactions and edits synchronize on the next poll. A pending draft is retryable while the tab remains open but is not persisted across a tab crash. Personal appearance is device-local; signed-in profiles and room membership are cross-device, and file-backed chat media is server-persisted.

The Sites deployment starts owner-private. That hosting access gate is separate from in-app room passwords; an owner-private deployment is a review environment, not an anonymous public launch. Preserve access until the owner explicitly chooses a public audience.

## Assets

Alpine lake and stadium photos are locally stored Unsplash assets. The creator profile illustration was supplied by Mohammad Saad and is stored in `public/saad-profile.jpg`. Font files are DM Sans and Manrope, served locally under their included SIL Open Font Licenses in `public/fonts/`. Chat avatars use platform emoji; no external avatar service is required.

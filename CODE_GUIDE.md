# Reading the DropBy code

Start with one feature and follow its path from the screen to the server. The application uses React for screens, TypeScript for types, D1 for database records, and private Supabase Storage for all uploaded files. Missing storage settings return a clear error.

## Suggested reading order

1. **`lib/client.ts`** — the main data types (`Identity`, `Room`, `Message`, `Snapshot`) and the `api()` function used by the browser.
2. **`components/app.tsx`** — decides whether to show the homepage, onboarding, or a chatroom. It also owns the current identity and light/dark mode.
3. **`components/home.tsx`** and **`components/onboarding.tsx`** — joining and creating a room.
4. **`components/chat.tsx`** — connects the room's data, messages, composer, menus, and calls. Read its functions first, then its JSX.
5. **`components/message.tsx`** — renders one message, including its reactions, reply, attachment, and voice player.
6. **`app/api/[...path]/route.ts`** → **`lib/server.ts`** — receives browser requests and selects the matching API action.
7. **`db/schema.ts`** — describes the records saved in the database.

JSX describes what appears on screen. A hook is a function that owns React state and effects for a particular job. A ref stores a value across renders without causing another render.

## Where each feature lives

| Feature | Files to read |
| --- | --- |
| Room refresh, composing, sending, edits, history, deletion | `components/chat.tsx`, `lib/server.ts` |
| Appearance and wallpaper persistence | `hooks/use-appearance.ts`, `lib/appearance-store.ts`, `lib/themes.ts` |
| Recording voice notes | `hooks/use-voice-recorder.ts` |
| Calls, devices, screen sharing | `hooks/use-call.ts`, `components/call-panel.tsx`, `lib/call-token.ts` |
| Room settings, members, search, media, invitations | `components/room-panels.tsx`, `components/room-rail.tsx` |
| Shared music | `components/room-music.tsx`, `lib/music-server.ts`, `lib/music.ts`, `lib/music-sync.ts` |
| Emoji picker and message performances | `components/emoji-picker.tsx`, `components/animated-emoji.tsx`, `components/emoji-face.tsx`, `lib/emojis.ts`, `lib/emoji-motion.ts`, `lib/emoji-expressions.ts` |
| Brand, avatars, logos, dialogs | `components/brand.tsx`, `components/room-mark.tsx`, `components/room-logo-picker.tsx`, `components/modal.tsx` |
| Creator page and contact details | `components/creator-page.tsx`, `lib/creator.ts`, `app/about/page.tsx` |
| Authentication, permissions, passwords, rate limits | `lib/server-auth.ts` |
| Shared database queries and HTTP responses | `lib/server-utils.ts` |
| Input and upload rules | `lib/validation.ts`, `lib/media-config.ts`, `lib/upload-limits.ts` |
| Browser optimization and transfers | `lib/media-prepare.ts`, `lib/media-upload.ts`, `hooks/use-media-upload.ts` |
| Private storage, upload leases, estimates and cleanup | `lib/media-storage.ts`, `lib/media-server.ts`, `components/storage-panel.tsx` |
| Lazy photos, on-demand videos and voice playback | `components/media-content.tsx`, `components/upload-progress.tsx` |
| Small shared formatting functions | `lib/format.ts` |
| Interactive preview's example people/messages | `lib/demo.ts` |

## Follow a message

The composer in `chat.tsx` calls `send()`. That calls `api()`, which sends a request to `/api/rooms/:slug/messages`. The API route calls `handle()` in `server.ts`. The server checks membership, validates the message, and saves it. Room refreshes retrieve the saved messages; `message.tsx` renders each one.

Older messages are kept in a separate browser cache. Deletion responses carry message IDs and a deletion version so that cache can remove deleted content. Those checks prevent an older response from bringing deleted messages back.

## Follow a media upload

Start with `media-config.ts`: one place controls formats, limits, thumbnails and warnings. `media-prepare.ts` optimizes images in the browser while keeping GIF bytes intact. `MediaUpload` in `media-upload.ts` manages progress and resumable transfers; `use-media-upload.ts` connects that lifecycle to React.

On the server, `media-server.ts` checks room access and reserves space in D1. `media-storage.ts` makes server-only Supabase calls. Completion checks actual size, format and a signature prefix before allowing a message to reference the file. `media-content.tsx` loads thumbnails near the viewport, video on Play, and each voice note into one reusable audio Blob.

The states describe the lifecycle: `uploading` → `ready` → `attached`. Cancellation uses `cancelled`; removal uses `deleting` → `deleted`. Failed removal stays accounted until storage confirms absence. Read [SMART_MEDIA.md](docs/SMART_MEDIA.md) for configuration and cleanup rules.

## Read the music player in sections

`room-music.tsx` stays longer because shared playback needs to handle buffering, permissions, browser sound restrictions, and requests arriving out of order. Its main sections are:

- `receive()` and `refresh()` — accept server updates and estimate the server clock.
- `sync()` and the media-loading effect — prepare audio and keep it near the shared playhead.
- `command()` and `control()` — send shared controls.
- `previewSeek()` and `commitSeek()` — rewind immediately and reconcile with the server.
- `choose()`, `upload()`, and `enableAudio()` — the listener's decisions and uploads.
- The returned JSX — the small dock and expanded music panel.

The synchronization rules are also isolated in `lib/music-sync.ts` and covered by tests.

## Deployment profiles

`wrangler.jsonc` holds the verified standalone account/database identifiers and public defaults. `npm run build:cloudflare` chooses `worker/cloudflare.ts`, strips untrusted account headers, checks the generated binding, and prepares the deployable artifact. It never publishes. `npm run build` preserves managed Sites behavior through `wrangler.sites.jsonc` and `worker/index.ts`. Both use Supabase only.

`scripts/vite/strip-preview-secrets.ts` prevents generated preview-secret files entering build artifacts. `scripts/preview-build.mjs` reads the canonical ignored `.dev.vars` explicitly for local production preview. Read [the release steps](docs/CLOUDFLARE_DEPLOYMENT.md) before changing cloud resources.

## Styles and supporting files

`app/layout.tsx` lists CSS files in their rendering order. `globals.css` provides the original foundation; the refinement files and `studio.css` build on it. Theme files set room colors and scenery. `music.css`, `creator.css`, and `emoji-expressions.css` handle their respective features. CSS order and selectors were retained during this cleanup to preserve the current design.

`public/` contains images and fonts. `drizzle/` contains applied database migrations; preserve existing migration files and add a new migration when the schema changes.

`worker/`, connector-related files, `app/chatgpt-auth.ts`, and most of `scripts/` support Sites hosting, sign-in, and local development. Study these after the application code. `components/ui/button.tsx` remains for the hosting connector-error UI; unused starter widgets were removed.

`node_modules/`, `dist/`, `.wrangler/`, and `outputs/` are generated dependencies, builds, local data, and verification artifacts.

## Verify a change

```text
npm run typecheck
npm run test:unit
npm run test:api
npm run test:e2e
```

With localhost running, `npm run test:visual:record` records 82 still views **before** a refactor. After the refactor, `npm run test:visual` compares the same views. Baselines stay in ignored `outputs/visual-baseline/` and need to be recorded on the same computer/browser. The comparison fixes the clock and freezes motion; it tolerates one color-channel level of Chromium rounding. The browser tests separately check animations, calls, uploads, deletion, and music behavior.

# DropBy implementation

DropBy provides room-based chat, media sharing, calls, and synchronized music. Start with [CODE_GUIDE.md](CODE_GUIDE.md) for the source reading order and feature map.

## Architecture

React + TypeScript on Vinext; Cloudflare Workers API, D1 relational persistence, private Supabase media exclusively. HttpOnly guest sessions expire after 30 days. Rooms have owners, moderators and members; API operations check membership. Private rooms use salted PBKDF2 passwords. Short polling supplies state reconciliation, reconnect and idempotent message IDs. Presence expires after 35 seconds.

Data: sessions, rooms, memberships, messages, revisions, attachments, reactions, reports, call signals, rate limits, music states, tracks and listener choices. No sample content enters real rooms; preview data lives in `lib/demo.ts`.

## Milestones

- [x] Responsive design system, homepage and room layout
- [x] Guest identity, optional saved profiles, public/private rooms and onboarding
- [x] Persistent messages, replies, reactions, edits, deletion, pins and search
- [x] Private media, image optimization, animated GIFs, lazy previews, video-on-play, Opus recording and TUS recovery
- [x] Configurable purpose-specific caps, atomic storage reservations, administrator warnings and explicit retryable cleanup
- [x] Small group WebRTC calls, signaling and screen sharing; configurable LiveKit adapter
- [x] Themes, member management, reports and room settings
- [x] 49 existing API checks, 12 media API checks, 11 isolated storage-failure checks, 28 unit tests, 44 browser journeys, TypeScript validation and an 82-view comparison script

Smart-media changes remain local until explicitly approved for deployment. No production migration, secret update, scheduled cleanup job or deployment is performed automatically.

## Boundaries

The managed hosting integration declares DB and disables its object-storage binding. The standalone Cloudflare profile uses the verified production D1 ID and private Supabase bucket; see [deployment setup](docs/CLOUDFLARE_DEPLOYMENT.md). All upload/read/delete paths require Supabase; unsupported unmigrated records fail explicitly. Peer calls are limited to four participants; the implemented LiveKit adapter supports larger groups when server credentials are supplied. Networks blocking direct WebRTC require TURN configuration. LiveKit has unit-tested token logic but no verified live SFU session. Chrome browser journeys and API tests run locally; independent multi-browser and security audits remain follow-on work.

Messages persist until deleted. Every member can clear their authored messages from a room. Shared caps are images/wallpapers/logos 8 MiB, video 30 MiB, voice 10 MiB, documents 15 MiB and profile photos 3 MiB, with authorization on retrieval. Room-radio audio retains its existing 15 MiB allowance. The creator page uses Mohammad Saad's supplied profile information and image.

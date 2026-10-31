# DropBy implementation

DropBy provides room-based chat, media sharing, calls, and synchronized music. Start with [CODE_GUIDE.md](CODE_GUIDE.md) for the source reading order and feature map.

## Architecture

React + TypeScript on Vinext; Cloudflare Workers API, D1 relational persistence, R2 private media. HttpOnly guest sessions expire after 30 days. Rooms have owners, moderators and members; API operations check membership. Private rooms use salted PBKDF2 passwords. Short polling supplies state reconciliation, reconnect and idempotent message IDs. Presence expires after 35 seconds.

Data: sessions, rooms, memberships, messages, revisions, attachments, reactions, reports, call signals, rate limits, music states, tracks and listener choices. No sample content enters real rooms; preview data lives in `lib/demo.ts`.

## Milestones

- [x] Responsive design system, homepage and room layout
- [x] Guest identity, optional saved profiles, public/private rooms and onboarding
- [x] Persistent messages, replies, reactions, edits, deletion, pins and search
- [x] Private media upload, viewer and voice recording
- [x] Small group WebRTC calls, signaling and screen sharing; configurable LiveKit adapter
- [x] Themes, member management, reports and room settings
- [x] 49 API checks, 17 unit tests, 30 browser journeys, TypeScript validation and 82 still-view comparisons

Production build, source packaging and owner-private publication follow the final checks through the Sites workflow. The deployment tool result is the authority for publication status.

## Boundaries

Sites provisions DB and BUCKET. Peer calls are limited to four participants; the implemented LiveKit adapter supports larger groups when server credentials are supplied. Networks blocking direct WebRTC require TURN configuration. LiveKit has unit-tested token logic but no verified live SFU session. Chrome browser journeys and API tests run locally; independent multi-browser and security audits remain follow-on work. See README for explicit scope limits.

Messages persist until deleted. Every member can clear their authored messages from a room. Uploads are limited to 15 MiB and supported image/audio/video/PDF/text formats, with authorization on retrieval. The creator page uses Mohammad Saad's supplied profile information and image. See README for the current scope limits.

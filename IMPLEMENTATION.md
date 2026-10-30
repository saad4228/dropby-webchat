# DropBy implementation

DropBy is a replaceable name from the workspace. The two supplied references guide the design; a third homepage reference was not attached.

## Architecture

React + TypeScript on Vinext; Cloudflare Workers API, D1 relational persistence, R2 private media. HttpOnly guest sessions expire after 30 days. Rooms have owners, moderators and members; API operations check membership. Private rooms use salted PBKDF2 passwords. Short polling supplies state reconciliation, reconnect and idempotent message IDs. Presence expires after 35 seconds.

Data: sessions, rooms, memberships, messages, revisions, attachments, reactions, reports, call signals, rate limits. No sample content enters real rooms; the homepage conversation is explicitly a demo.

## Milestones

- [x] Responsive design system, homepage and room layout
- [x] Guest identity, optional saved profiles, public/private rooms and onboarding
- [x] Persistent messages, replies, reactions, edits, deletion, pins and search
- [x] Private media upload, viewer and voice recording
- [x] Small group WebRTC calls, signaling and screen sharing; configurable LiveKit adapter
- [x] Themes, member management, reports and room settings
- [x] 28 API scenarios, four SFU-token unit tests, two browser journeys, and TypeScript validation

Production build, source packaging and owner-private publication follow the final checks through the Sites workflow. The deployment tool result is the authority for publication status.

## Boundaries

Sites provisions DB and BUCKET. Peer calls are limited to four participants; the implemented LiveKit adapter supports larger groups when server credentials are supplied. Networks blocking direct WebRTC require TURN configuration. LiveKit has unit-tested token logic but no verified live SFU session. Chrome browser journeys and API tests run locally; independent multi-browser and security audits remain follow-on work. See README for explicit scope limits.

Messages persist until deleted. Uploads are limited to 15 MiB and supported image/audio/video/PDF/text formats, with authorization on retrieval. No end-to-end encryption claim. Creator information remains placeholder content.

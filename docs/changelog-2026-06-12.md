# Changelog — June 12, 2026

Covers all uncommitted work since the June 11 commit (`5f7b120`, "global darkmode, new rating evaluation, new colors, text changes"). This is the full diff a reviewer will see.

**Action required after deploy**

1. Open `GET /api/park/setup` once — creates the new `changelog` table (everything else, including the checklist `sessions`/`notes` columns, is already live in the shared Railway Postgres).
2. Confirm `ACCESS_PASSWORD` is set in the Railway environment — admin API access now depends on it server-side, not just in the UI.

---

## New pages & features

### Added a Manufacturers page (`/manufacturers`)
Hall-of-fame style page ranking coaster manufacturers by Best Coaster awards and average rating, with an animated podium for the top 3 and sortable list (awards / average / count / top coaster).
- `app/manufacturers/page.tsx` (server, aggregates from coasters API) + `ManufacturersClient.tsx`
- Schema.org ItemList JSON-LD, added to navbar (desktop + mobile), sitemap, and `llms.txt`

### Added a Visit Timeline on the About page
The old trip-grouping list is replaced by a chronological timeline: upcoming trips at the top, a "today" divider, then every past park visit grouped by year with a sticky year quick-nav and rating-colored progress dots.
- New component `app/components/aboutpage/VisitTimeline.tsx`; `AboutClient.tsx` slimmed down (trip management only)
- New endpoint `GET /api/visits`: published ratings joined with parks, window functions for "visit N of M" per park, cacheable (5 min max-age, 1 h SWR)

### Added an admin content changelog (`/admin/changelog`)
Every content mutation (ratings, park texts, images, parks, coasters) is now logged and browsable on a timeline, filterable by park and content type, with expandable old→new diffs. Text edits get inline word-level diff highlighting (removed words red strikethrough, added words green).
- New `changelog` table (migration in `/api/park/setup`): `park_id` (indexed, for the filter), `entity_type`, `entity_id`, `entity_label` (name snapshot so entries survive deletes), `action`, `summary`, `details` JSONB with full old/new values per changed field
- New helper `app/lib/changelog.ts`: `logChange()` (fire-and-forget INSERT — a failed log can never fail a save), `diffFields()` (only logs fields that actually changed; handles pg numeric-as-string and Date quirks), `getParkName()`, `getCoasterContext()`
- 13 API route files instrumented after their successful writes. Notable details: rating publish/unpublish logged as distinct actions; ride-count sync logs one summary entry, not one per coaster; coaster PUT diffs against the `RETURNING *` row because `ridecount` is additive in SQL; specs upsert logs create vs update; highlights (wipe-and-replace) only logs when the set actually changed
- Deliberately not logged: raw R2 `/api/upload` (the follow-up DB write is already logged), text drag-reorders, and Tier 2 entities (warnings, trips, checklists, lists — each is one `logChange()` call when wanted)
- New `GET /api/changelog`: **calls `isAdminRequest()` itself** since the middleware only guards non-GET methods; filters `parkId`/`types`, id-cursor pagination
- Full old/new text bodies in `details` double as version history (enables a future "restore")
- Word diff is LCS over word tokens (flat `Uint32Array` DP table), capped at 400k comparisons with side-by-side fallback; computed client-side so it works retroactively
- The log starts empty; only changes from deploy onward are recorded. No actor column (single shared admin credential)

### Added a custom 404 page
Theme-park-styled "This ride is closed" page with links home and to parks (`app/not-found.tsx`).

### Checklists: pause/resume, multi-day visits, and notes
A checklist visit is no longer a single start/end pair. Visits can be paused and resumed, span multiple days (with day numbering), and show elapsed time across all sessions. Each category can hold free-text notes taken in the park.
- `sessions` JSONB (array of `{start, end|null}`) and `notes` JSONB (keyed by category) on checklists; old single-visit checklists auto-migrate on first load
- `app/checklists/[slug]/ChecklistClient.tsx` (+380 lines), `app/api/checklists/*` use `COALESCE` so the fields are backward-compatible

### Checklist notes flow into the Rate a Park modal
When a checklist is synced while rating, its per-category notes appear next to the matching score inputs as context for writing the review (`RatingModal.tsx`, same 10 category keys as the checklist).

### Park rank lane: peek at existing reviews
While ranking a new park against existing ones, hovering/clicking an existing park slides up a read-only sheet with its latest review date and text snippets, without leaving the modal.
- `ParkRankLane.tsx`: portal-mounted sheet (avoids `position: fixed` re-anchoring inside transformed modal ancestors), per-park fetch cache

---

## Games

### Zoomle: multi-focal editor and no-repeat rounds
The config page moved from a fixed 3×3 focal grid to free-form focal points: click to add, drag to move, delete per point. The daily game now excludes coasters used in the last 2 days.
- Data model: `focuses: string[]` per image replaces `focuses_override: Record<slot, string>`
- `app/api/zoomle/route.ts`: seeded RNG anchored at a fixed epoch (2026-06-01) so answer chains stay deterministic and yesterday's answers are reconstructable (`shiftDate`, `pickForDate`, `recentAnswerIds`)
- Config page rewrite (+422 lines): add/edit state machine, flagged-zoom list, save progress and error states, Escape support

---

## Admin & security

### Admin access is now enforced server-side
Previously admin gating was client-side only — any visitor could call mutation APIs directly. Now a new root `middleware.ts` rejects every non-GET API request without a valid admin cookie.
- `POST /api/authenticate` sets an httpOnly `pr_admin` cookie: HMAC-SHA256 of a fixed string keyed by `ACCESS_PASSWORD` (30-day expiry). Stateless: rotating `ACCESS_PASSWORD` invalidates all sessions
- `app/lib/adminAuth.ts` uses Web Crypto (works in Node and Edge runtimes), constant-time comparison
- Allowlist for public mutations: `/api/authenticate`, `/api/zoomle/flag` (player flagging)
- Review point: GET endpoints are not guarded by the middleware; the only sensitive GET (`/api/changelog`) checks the cookie itself

---

## Performance & infrastructure

### One shared Postgres pool
Every API route created its own `new Pool()`, multiplying idle connections against the Postgres limit (and leaking on dev hot-reload). All 30+ routes now import a single pool from `app/lib/db.ts`, cached on `globalThis`.

### Site-wide cache tag + instant invalidation
Public server fetches are tagged `["content"]`; admin mutations call `revalidateContent()` (`app/lib/revalidate.ts` → `revalidateTag("content")`), so edits show up immediately without redeploys. Sitemap switched from `no-store` to `force-cache` with the same tag.

### Three lightweight endpoints replace heavy client fetches
- `GET /api/search-index` — single payload (parks + coasters with ratings/slugs) replacing the search bar's two separate full-table calls
- `GET /api/header-status` — just trip start dates and the park under review, replacing the header fetching entire trips + ratings tables
- `GET /api/visits` — minimal timeline payload (see above)

### Home page: server-rendered initial data and smoother carousel
`app/page.tsx` fetches ratings + parks server-side and passes them as props, removing the initial loading flash. `TeaserParkCard` and `FullBleedRatingCard` are memoized; a carousel blink on swipe was fixed by only fading back to the header when a category image was actually showing. Dates pinned to `en-GB` (SSR-safe).

### Edit modals: real thumbnails instead of full-res originals
The Edit Sections modal and image pickers were laggy. Two root causes fixed:
1. Picker grids loaded original R2 files (measured: 4.2 MB for an ~80px tile; 20+ images = hundreds of MB of decoded bitmaps). Grids now use the Next image optimizer — same image is 11 KB, verified end-to-end (`sharp` and the R2 domain config were already present). DPR-aware srcsets keep retina sharpness. First request per thumbnail pays a one-time resize, then it's disk-cached.
   - `ParkTextModal` (raw `<img>` → `next/image`), `ParkHeaderModal` (removed `unoptimized`), `CoasterHeaderModal` (added missing `sizes` — was serving ~1920px per tile), `admin/social` picker (raw `<img>` → `next/image`; IG aspect-ratio badge still works, the resizer preserves ratio)
   - Deliberately untouched: lightbox full views + preloads (8x zoom), `/api/download` (originals), `CropEditor` (needs real pixels), flag icons
2. Typing re-rendered the whole picker grid on every keystroke (controlled textarea in the same component). Grid extracted to a `React.memo` component with stable props — typing no longer touches it.

### Validation builds without killing the dev server
`next.config.js` honors `NEXT_DIST_DIR`, so CI/validation builds (`NEXT_DIST_DIR=.next-build`) don't clobber `.next` and crash HMR. `.next-build/` gitignored.

---

## Design & UX polish

- **Rating palette consolidated**: `RATING_TIERS` in `app/utils/design.ts` is now the single source for the 11-tier scale (GOATED → Worthless) with hex colors and labels; `getRatingHex()` added alongside `getRatingColor()`
- **Brand color via CSS variable**: hardcoded oranges replaced with `--brand` token (`text-brand` etc.) across components
- **Dark-mode class cleanup**: `dark:` prefixes removed site-wide (the site is dark-only), shrinking generated CSS
- **Navbar**: active-link highlighting via `usePathname()`, Manufacturers link added, Changelog added to Admin Tools
- **Search bar**: new `collapsible` prop (collapsed-by-default in the navbar, expands on click, Escape collapses), now backed by `/api/search-index`
- **Rating Evaluation page** (`/info`): redesigned with a sticky sidebar TOC and scroll-based active-section highlighting; threshold callout boxes for the 6+/8/below-4 scoring rules

---

## SEO & metadata

- `app/layout.tsx`: `metadataBase`, OpenGraph (siteName, images) and Twitter `summary_large_image` cards; unused Inter font removed (Roboto only)
- New metadata layouts for `/games`, `/games/coastle`, `/games/connections` with canonical URLs and descriptions
- `sitemap.ts`: static pages (info, about, games trio) + dynamic park/coaster routes
- `robots.txt`: disallow `/admin/`, `/api/`, `/games/zoomle/config`, `/lists/create`
- `llms.txt` updated with the new pages

---

## Verification & review points

- `next build` passes cleanly on the full working tree (54 pages, run against `.next-build`)
- Image optimizer verified live: 4,178,580 bytes original → 11,433 bytes thumbnail (HTTP 200)
- Changelog logging verified manually (text edit logged, retroactive diff highlighting confirmed)
- Checklist `sessions`/`notes` columns confirmed present in the shared DB (API returns 200)

For the reviewer specifically:
1. **Middleware allowlist** (`middleware.ts`) — confirm `/api/authenticate` and `/api/zoomle/flag` are the only mutations that should stay public
2. **Fire-and-forget logging** — a failed changelog INSERT only hits the console, by design
3. **Duplicate rating-create routes** (`/api/ratings` and `/api/park/[id]/ratings`) were instrumented separately; consolidating them is pre-existing debt, not addressed here
4. **`revalidateTag("content")` is all-or-nothing** — any admin mutation busts the whole public cache; fine at current scale, worth knowing

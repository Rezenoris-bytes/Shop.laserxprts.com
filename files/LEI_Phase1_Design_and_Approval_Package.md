# LEI — Phase 1 Design & Approval Package

**Date:** 18 August 2026 · **Status: AWAITING APPROVAL — no implementation, no migrations.**
**Companion document:** `LEI_Prisma_Schema_Proposal.md` (Section B)

---

## Contents

| § | Section | Your request |
|---|---|---|
| **A** | Validated Architecture | A |
| **B** | *Complete Prisma Schema* → **separate document** | B, and point 2 + 3 |
| **C** | Phase 1 Vertical-Slice Definition | C, point 4, point 6 |
| **D** | Customer Journey — technically accounted for, step by step | D, point 4 |
| **E** | Admin Journey | E |
| **F** | Required API / Domain Flow | F |
| **G** | Security Considerations | G |
| **H** | Catalogue / SKU Data Requirements | H, point 7 |
| **I** | Dependencies & Blockers | I |
| **J** | Risks & Open Decisions | J |
| **K** | Validation of External Decisions | point 8 |
| **L** | Measurable Deliverables (not hours) | point 9 |
| **M** | Missing Requirements Found During This Pass | point 10 |

---

## A. Validated Architecture

### A.1 What is confirmed unchanged from your specifications

| Layer | Decision | Status |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | ✅ Confirmed |
| Styling | Tailwind CSS | ✅ Confirmed |
| Backend | NestJS + Fastify, **modular monolith** | ✅ Confirmed |
| Database | MySQL **8.0+**, `utf8mb4_0900_ai_ci` | ✅ Confirmed, version now pinned |
| ORM | Prisma | ✅ Confirmed |
| Search | MySQL exact/prefix + FULLTEXT behind `SearchService` | ✅ Confirmed, with `searchKey` added |
| Auth | JWT access (memory) + refresh rotation (HttpOnly cookie), Argon2id | ✅ Confirmed, reuse-detection added |
| Files | Local VPS via backend-controlled upload | ✅ Confirmed, hardened |
| Cache | Redis — **rate limiting + refresh-token families only** | ✅ Confirmed, scope narrowed |
| Hosting | Hostinger VPS + Docker Compose + Nginx | ✅ Confirmed |
| CI | GitHub Actions — `ci.yml`, `database.yml`, `security.yml`; `dev` + `main` | ✅ Confirmed, unchanged |
| Payments | Excluded | ✅ Confirmed |

**No stack changes are proposed.** The architecture in your documents is sound. What follows
refines *ordering*, *boundaries* and *the pieces that were missing*.

### A.2 Runtime topology

```
                        ┌──────────────────────────────┐
   Customer browser ───▶│  Cloudflare (free, proxied)  │  ← pending decision K-11
                        │  TLS · CDN · WAF · DDoS      │
                        └───────────────┬──────────────┘
                                        │
                        ┌───────────────▼──────────────┐
                        │  Nginx (Hostinger VPS)       │
                        │  real_ip_header CF-Connecting-IP  ← critical, see §K.3
                        │  /            → Next.js :3000│
                        │  /api         → NestJS :4000 │
                        │  /uploads     → static, hardened
                        └───────┬──────────────┬───────┘
                                │              │
                   ┌────────────▼───┐   ┌──────▼─────────────────┐
                   │ Next.js        │   │ NestJS + Fastify       │
                   │ ISR + RSC      │──▶│ Modular monolith       │
                   │ (storefront)   │   │                        │
                   │ CSR (/admin)   │   │ auth · catalogue ·     │
                   └────────────────┘   │ sales · files · search │
                                        │ analytics · email      │
                                        └───┬──────────┬─────────┘
                                            │          │
                                   ┌────────▼──┐  ┌────▼──────┐
                                   │ MySQL 8   │  │ Redis     │
                                   │ (Docker)  │  │ ratelimit │
                                   └────┬──────┘  │ + token   │
                                        │         │   families│
                              nightly   │         └───────────┘
                              encrypted ▼
                              dump ──▶ OFF-HOST (B2/R2)   ← mandatory, review D.4.1
```

### A.3 Module boundaries (NestJS)

Unchanged from your specification, with three additions marked **[NEW]**:

```
src/
├── config/            env schema validation (fail fast on boot)
├── common/            guards · interceptors · filters · pipes · decorators
├── auth/              login · refresh rotation · reuse detection · password reset
├── users/             admin accounts
├── permissions/       module permission CRUD + PermissionGuard
├── catalogue/
│   ├── categories/  part-brands/  products/  variants/  attributes/
│   ├── compatibility/  media/  inventory/
│   └── import/        [NEW] CSV validate → dry-run → apply
├── machines/          brands · models · variants
├── customers/         find-or-create · addresses · machines
├── sales/             enquiries · leads · quotes · revisions · orders
├── services/          catalogue · service requests
├── search/            normalisation · ranking · provider abstraction
├── files/             upload · validation · derivative generation
├── notifications/     [NEW] email templates · queue · delivery log
├── documents/         [NEW] quote PDF rendering
├── analytics/         sessions · validated events · search logs
├── admin/             dashboard · audit log reader
└── prisma/            PrismaService + repository base
```

### A.4 Three architectural rules that are enforced mechanically, not by convention

| Rule | Enforcement |
|---|---|
| Controllers never touch Prisma | ESLint rule: `PrismaService` importable only in `*.repository.ts` |
| Every non-public route is permission-guarded | Boot-time assertion enumerates all routes; **process exits** if any lacks `@Public()` or `@RequirePermission()` |
| Soft-deleted rows are never read accidentally | Prisma Client Extension injects `deletedAt: null`; repository layer is the only access path |

Rule 2 is the one that matters most. It converts "someone forgot to guard an endpoint" from a
silent production vulnerability into a failed deployment.

### A.5 Scale-readiness — your point 6

**The architecture is not sized for 150 SKUs.** Concretely, nothing here changes when the
catalogue reaches 10,000 variants:

| Concern | Design | Holds to |
|---|---|---|
| Listing queries | Composite indexes on the exact query shapes; no `SELECT *` | 100k+ |
| Filtering | `valueDecimal` indexed ranges, not string comparison | 100k+ |
| Search | Indexed `searchKey` exact/prefix before FULLTEXT | ~50k, then Meilisearch behind the same `SearchService` interface |
| Pagination | Offset now; **keyset-ready** (all list queries ordered by an indexed tiebreaker) | Swap at ~10k rows without API change |
| Facet counts | Cached on `Category.productCount`, recomputed on save | Any size |
| Images | Derivatives pre-generated at upload; CDN-served | Any size |
| Catalogue loading | `ImportJob` pipeline, chunked, resumable, dry-run first | 50k rows/run |
| Rendering | ISR with on-demand revalidation per product | Any size |
| Admin lists | Server-side pagination + filtering on every screen from day one | Any size |

**The only thing scoped small is the *data*, not the *system*.** Loading the remaining SKUs
after launch is a CSV import, not a re-architecture.

---

## C. Phase 1 Vertical-Slice Definition

### C.1 The slice, stated precisely

> **One category — Nozzles — carried end to end from Google to a quote PDF in the customer's
> inbox, using the production architecture, with nothing stubbed in the path.**

**"Nothing stubbed in the path" is the defining constraint.** Real auth, real RBAC, real
search, real email, real PDF, real audit logging. If any part of the journey is faked, the
slice has not proved anything and Stage 4 will discover the fake.

### C.2 In scope

| Area | Included |
|---|---|
| **Catalogue** | Nozzles category only. ~8–12 products × 4–14 variants each (~60–100 variants) |
| **Machines** | Raytools + 1–2 other brands, the models nozzles actually fit |
| **Compatibility** | Real product↔model mapping for the Nozzles set |
| **Attributes** | Diameter (variant), thread/height (product), material, layer type |
| **Storefront** | Home · Nozzles category · product detail with variant selector · search · quote request drawer + review page · submit · confirmation · contact · About/Terms/Privacy |
| **Admin** | Login · dashboard (6 tiles) · products+variants · categories · part brands · attributes · compatibility · inventory · machines · enquiries · customers · quotes+revisions · admin users+permissions · audit log |
| **Backend** | auth, permissions, catalogue, machines, customers, sales(enquiry/lead/quote), files, search, notifications, documents, analytics |
| **Ops** | Docker Compose, 3 CI workflows, Nginx, TLS, off-host backup + **restore test**, `/health` |

### C.3 Explicitly out of scope for the slice

Services · service requests · orders/fulfilment · other categories · Hindi UI · CMS pages ·
reports beyond 6 tiles · customer login · order tracking · Meilisearch · payments ·
lead scoring · 2FA.

Their **tables exist** (so no migration churn later); **no code touches them.**

### C.4 Definition of Done for the slice

The slice is complete when **all fourteen** are true — not thirteen:

1. A visitor finds a nozzle via search **using its exact part number**
2. …and via the compatibility finder, by choosing brand → model
3. Product page shows variant selector, correct price per variant, stock status, compatibility list
4. Three variants can be added to a Quote Request; the badge and drawer are correct
5. The Quote Request survives a browser refresh and a browser restart
6. Submission creates: `Enquiry` + 3 `EnquiryItem` + `Customer` (find-or-create) + `Lead`
7. Customer receives a confirmation email with a **non-enumerable** reference
8. Sales receives an alert email within 60 seconds
9. Admin logs in; RBAC verified — a CATALOGUE admin **cannot** open Enquiries
10. Admin converts the enquiry to a quote **with lines pre-populated** (no retyping)
11. Quote calculates GST correctly for **both** intra-state (CGST+SGST) and inter-state (IGST)
12. PDF generates with LEI's real company details, HSN codes, correct totals
13. Customer receives the quote by email; the PDF is stored permanently
14. Every admin action appears in the audit log with the acting user

Plus: **restore the database from an off-host backup into a clean container and re-verify #10–13.**

---

## D. Customer Journey — technically accounted for

Your point 4, step by step. Each step lists what must exist for it to work.

### Step 0 — Arrival

```
Google "raytools bm110 nozzle 1.5mm"  →  /nozzles/raytools-single-layer-nozzle-h15
```

| Requires | Notes |
|---|---|
| ISR-rendered product page | revalidate 1h + on-demand on save |
| `Product` schema.org with `offers` per variant | `AggregateOffer` when variants differ in price |
| `BreadcrumbList`, canonical **derived** from slug | not the stored column — review G.3 |
| Dynamic sitemap with real `lastmod` | from `updatedAt` |
| `VisitorSession` created, `PAGE_VIEW` + `PRODUCT_VIEW` events | HttpOnly session cookie |

⚠️ **Depends on domain decision (I-1).** URL structure cannot be finalised without it.

### Step 1 — Search / browse

**Search path.** Rajesh types `D27.9 T4.1`.

```
input → normalise → "D279T41"
      → 1. exact   match on ProductVariant.searchKey
      → 2. prefix  match on ProductVariant.searchKey
      → 3. FULLTEXT on products(name, short_description)
      → 4. attribute/compatibility filter narrowing
      → rank · paginate
```

| Requires | Notes |
|---|---|
| `ProductVariant.searchKey` + index | **without this, exact part numbers return nothing** |
| Identical normaliser used at write and read time | one shared function, unit-tested |
| `SearchQueryLog` write incl. `resultCount` | zero-result searches are the stocking backlog |
| `SEARCH` / `SEARCH_NO_RESULTS` events | |

**Browse path.** Compatibility finder: Brand → Model → Category.

| Requires | Notes |
|---|---|
| `GET /api/v1/machines/tree` — **one cacheable payload** | not 3 sequential round-trips (review F.6) |
| Reverse compatibility query on `(machineModelId, productId)` index | |
| `COMPATIBILITY_SEARCH` event | |

### Step 2 — Product page

| Requires | Notes |
|---|---|
| Variant selector driven by `VariantAttributeValue` | diameter |
| Price + stock re-render per variant without navigation | `VARIANT_VIEW` event |
| `ON_REQUEST` variants render "Price on request" **at equal visual weight** | review H.4 |
| Compatibility list, verified vs claimed visually distinct | `isVerified` |
| Specs table from product + variant attributes | |
| `alt` text on every image from `ProductMedia.altText` | |
| Pre-generated derivatives served, no runtime transforms | |

### Step 3 — Add to Quote Request

**Client-side only. No server call. No basket table.** This is what keeps the "no cart" rule intact.

```js
localStorage["lei.quote-request.v1"] = {
  v: 1,
  updatedAt: "2026-08-18T09:14:22Z",
  items: [{ variantId, qty, note }]        // IDs + quantity ONLY — never prices
}
```

| Requires | Notes |
|---|---|
| Drawer, not navigation | never interrupt browsing (review H.3) |
| Badge count, toast, ARIA live-region announcement | |
| **Prices re-fetched from the API on open**, never trusted from storage | tamper-proofing |
| Schema-versioned key (`v: 1`) | future changes don't crash returning visitors |
| Graceful handling of a variant that has since been deactivated | show "no longer available", keep the rest |
| `QUOTE_REQUEST_ITEM_ADDED` event | |

### Step 4 — Review & submit

Form: name, phone, email, company (optional), city, message, machine context (**pre-filled**
if they used the finder), optional photo attachment, consent checkbox.

| Requires | Notes |
|---|---|
| Honeypot + min-time-on-form + per-IP rate limit | review E.2.3 |
| Server-side re-validation of every variant (exists, active, price) | never trust the client |
| Consent text + timestamp **stored** | DPDP Act — review E.2.9 |
| Attachment upload through the hardened file pipeline | see §G |
| `POST /api/v1/enquiries` — one atomic transaction | see §F.2 |

### Step 5 — Confirmation

| Requires | Notes |
|---|---|
| `publicRef` — random 12 chars, **not sequential** | review C-4 |
| On-screen: reference, item summary, expected response time | |
| `QUOTE_REQUEST_SUBMIT` event; `localStorage` cleared | |
| Confirmation email queued | |

### Step 6 — Emails out

| Email | To | Contains |
|---|---|---|
| Confirmation | Customer | `publicRef`, item list, response-time promise |
| Alert | Sales (from `Setting: notify.sales_emails`) | Contact, items, machine, deep link to admin |

| Requires | Notes |
|---|---|
| `EmailLog` row per send | so a bounce is visible to sales |
| Retry with backoff; failure **never** rolls back the enquiry | enquiry is saved first, always |
| SPF + DKIM + DMARC on the sending domain | see §K.1 |

### Step 7 — Customer receives the quote

| Requires | Notes |
|---|---|
| Email carries a **signed, expiring download link** — not an attachment | see §K.1; attachments hurt deliverability |
| PDF stored permanently in `File`, linked from `QuoteRevision.pdfFileId` | never regenerated |
| `QuoteRevision.sentAt` + `sentToEmail` recorded | |

### D.1 The journey as one line

```
Google → ISR page → search(searchKey) → variant select → localStorage basket
  → POST /enquiries {atomic: Customer + Enquiry + Items + Lead}
  → publicRef shown → 2 emails
  → [admin: quote build → revision → PDF → send]
  → customer email → signed link → PDF
```

**Every arrow above has a named owner in §F. There are no gaps left in this path.**

---

## E. Admin Journey

### E.1 Priya's path

| # | Action | System behaviour |
|---|---|---|
| 1 | Opens `/admin`, logs in | Argon2id verify · lockout counter · access token in memory · refresh cookie (HttpOnly/Secure/SameSite=Strict) · `LOGIN` audited |
| 2 | Sees dashboard | 6 tiles: new enquiries · unassigned · quotes awaiting response · expiring in 7 days · low stock · zero-result searches (7d) |
| 3 | Opens Enquiries | Server-side paginated list. **Nav shows only her permitted modules** |
| 4 | Opens the enquiry | Contact, all 3 items with part numbers, machine context, attachments, linked customer + history |
| 5 | Assigns to herself | `assignedToId` set · status `ACKNOWLEDGED` · audited |
| 6 | Clicks **Create Quote** | `Quote` + revision 1 + items **pre-populated from `EnquiryItem`** — no retyping. `quoteNumber` from `Counter` under row lock |
| 7 | Adjusts prices/qty, adds freight | Live recalculation. **Tax treatment auto-selected** from LEI's state vs customer's `stateCode` |
| 8 | Saves & generates PDF | Revision frozen · PDF rendered from `Setting` company data + snapshots · stored in `File` |
| 9 | Sends | Email queued · `sentAt`/`sentToEmail` set · quote → `SENT` · `QUOTE_SENT` audited |
| 10 | Customer asks for a discount | **Create Revision 2.** Revision 1 untouched. `currentRevisionId` moves |
| 11 | Customer accepts | Status → `ACCEPTED` · `acceptedRevisionId` + `acceptedAt` set · audited |

### E.2 RBAC verification built into the slice

| User | Must be able to | Must be **blocked** from |
|---|---|---|
| SUPER_ADMIN | Everything incl. audit logs, settings, user management | — |
| ADMIN · SALES | Enquiries, leads, quotes, customers | Products, inventory, users, audit, settings |
| ADMIN · CATALOGUE | Products, variants, attributes, compatibility, inventory, import | **Enquiries, customers, quotes** (PII boundary), users, audit |

Blocking is verified at **API level**, not just hidden in the UI. This is an automated test in
the slice, not a manual check.

### E.3 Admin UX decisions made once

- **One `DataTable` component** — search, filter, sort, paginate, bulk actions — configured per
  screen. Building 18 bespoke tables is where admin-panel estimates go wrong.
- **One `EntityForm` pattern** — Zod schema shared with the API DTO via `packages/shared-types`,
  so client and server validation can never drift.
- **Permission payload delivered once at login**, drives nav and control visibility. Never
  re-derived client-side.

---

## F. Required API / Domain Flow

### F.1 Endpoints for the slice

**Conventions:** `/api/v1`, envelope `{ data, meta?, error? }`, cursor-ready pagination,
`take` hard-capped at 100 server-side.

| Method | Route | Auth | Notes |
|---|---|---|---|
| `POST` | `/auth/login` | public | Rate-limited, lockout |
| `POST` | `/auth/refresh` | cookie | **Rotation + reuse detection** |
| `POST` | `/auth/logout` | auth | Revokes token family |
| `GET` | `/auth/me` | auth | Returns user + **full permission set** |
| `POST` | `/auth/password-reset/request` · `/confirm` | public | Hashed, single-use, expiring |
| `GET` | `/categories` · `/categories/:slug` | public | |
| `GET` | `/products` | public | `?category&brand&machineModel&attr[]&sort&page` |
| `GET` | `/products/:slug` | public | Includes variants, attributes, media, compatibility |
| `GET` | `/variants/resolve` | public | **Basket rehydration — validates ids, returns live prices** |
| `GET` | `/search` | public | Normalised pipeline; logs to `SearchQueryLog` |
| `GET` | `/machines/tree` | public | **One cacheable payload** for the finder |
| `GET` | `/machines/:modelId/products` | public | Reverse compatibility |
| `POST` | `/enquiries` | public | Honeypot + rate limit + consent. **Atomic — see F.2** |
| `POST` | `/files/enquiry-attachment` | public | Rate-limited, strict validation |
| `POST` | `/analytics/events` | public | Strict enum, aggressive rate limit, no free-form |
| `GET/POST/PATCH` | `/admin/products`, `/admin/variants`, `/admin/categories`, `/admin/part-brands`, `/admin/attributes`, `/admin/compatibility`, `/admin/inventory`, `/admin/machines/*` | `CATALOGUE`/`MACHINES` | |
| `POST` | `/admin/import/:type` · `GET /admin/import/:id` | `CATALOGUE` | Dry-run → apply |
| `GET/PATCH` | `/admin/enquiries` · `/:id` · `/:id/assign` | `ENQUIRIES` | |
| `GET/PATCH` | `/admin/customers` · `/:id` | `CUSTOMERS` | |
| `POST` | `/admin/quotes` · `/admin/quotes/from-enquiry/:id` | `QUOTES` | Pre-population |
| `POST` | `/admin/quotes/:id/revisions` | `QUOTES` | Creates N+1; never mutates N |
| `POST` | `/admin/quotes/:id/revisions/:rid/pdf` · `/send` | `QUOTES` | |
| `PATCH` | `/admin/quotes/:id/accept` · `/reject` | `QUOTES` | Sets `acceptedRevisionId` |
| `GET` | `/admin/dashboard` | auth | 6 tiles |
| `GET` | `/admin/audit-logs` | `AUDIT` | SUPER_ADMIN only |
| `GET/PUT` | `/admin/settings` | `SETTINGS` | SUPER_ADMIN only |
| `GET` | `/health` | public | DB + Redis + migration state + build SHA |

### F.2 The two transactions that must be atomic

**Enquiry submission**

```
BEGIN
  validate every variantId (exists, active, not deleted)
  customer = findOrCreate(emailNormalized ?? phoneNormalized)
  enquiry  = create(publicRef, contact SNAPSHOT, machine ctx, consent, ip)
  items    = createMany(EnquiryItem with name/partNo/price snapshots)
  lead     = findOrCreate(customer, type=PRODUCT, source=WEBSITE_QUOTE_REQUEST)
COMMIT
→ THEN queue emails (outside the transaction — email failure must never lose an enquiry)
```

**Quote creation from enquiry**

```
BEGIN
  SELECT … FROM counters WHERE scope='QUOTE' AND period='2026-27' FOR UPDATE
  quoteNumber = format(++currentValue)
  quote    = create(currentRevisionId = NULL)
  revision = create(quoteId, revisionNumber=1, terms snapshot, tax treatment)
  items    = createMany(from EnquiryItem, with hsn/gst/price snapshots)
  recalculate totals; UPDATE quote SET currentRevisionId = revision.id
  enquiry.status = QUOTED
COMMIT
```

`FOR UPDATE` is what prevents two admins receiving the same quote number.

### F.3 Domain rules the API layer enforces

| Rule | Where |
|---|---|
| Quote revisions are immutable | No update method exists on `QuoteRevisionService` |
| Inventory changes only via `InventoryService`, always writing `StockMovement` | Service boundary |
| Every service request creates/links a `SERVICE` lead | Stage 4 — rule recorded now |
| `machineVariantId` authoritative when present; fallback fields ignored | Validation pipe |
| Soft-deleted entities never appear in public reads | Prisma extension |
| Money arithmetic in `Decimal`, never JS number | Shared `Money` utility, unit-tested |
| GST rounding: per line, half-up to 2dp; header `roundOff` absorbs the remainder | `TaxService`, unit-tested |

---

## G. Security Considerations

### G.1 Built into the slice (not deferred to a hardening phase)

| Control | Implementation |
|---|---|
| **Deny-by-default authorization** | Boot assertion fails startup if any route lacks `@Public()` or `@RequirePermission()` |
| **Refresh reuse detection** | `RefreshToken` family; replay revokes the whole family + forces re-login |
| **Password policy** | ≥12 chars, checked against a common-password list (not composition rules) |
| **Login protection** | Per-account **and** per-IP throttling; lockout; constant-time response so email existence isn't revealed |
| **Password reset** | Single-use, 30-min, **hashed at rest**; invalidates all token families on use |
| **Token placement** | Access token in memory only. Refresh in HttpOnly + Secure + SameSite=Strict cookie. Refresh endpoint additionally checks `Origin` |
| **Upload validation** | Allowlist JPEG/PNG/WebP/PDF. **SVG blocked.** Magic-byte verification, not `Content-Type`. Raster re-encoded through `sharp` (strips payloads + EXIF) |
| **Upload serving** | Files stored **outside** the web root, served via `X-Accel-Redirect`. `nosniff`, `Content-Disposition: attachment` for PDFs, no directory listing, no script handler |
| **Public form abuse** | Honeypot + min-time + per-IP rate limit; `spamScore` recorded |
| **Analytics abuse** | Strict enum; **no free-form metadata**; per-session rate limit |
| **Audit redaction** | Field **allowlist**. Credentials never logged |
| **Error handling** | Global filter; generic messages in production. Prisma errors never surfaced |
| **Secrets** | Zod-validated env schema, fail-fast on boot. `.env` `chmod 600`, in `.dockerignore` |
| **Consent** | Stored with text + timestamp on every PII-collecting submission |
| **Headers** | Helmet + CSP; CORS whitelist (no wildcard) |

### G.2 Deferred, with interim mitigation

| Deferred | Interim mitigation |
|---|---|
| SUPER_ADMIN 2FA | Nginx IP allowlist on `/admin` if LEI has static IPs |
| Row-level customer scoping | Module-level permissions; **decision needed — J-4** |
| Automated pen-test | Manual OWASP checklist before launch |

### G.3 The Cloudflare rate-limiting trap

With Cloudflare proxying, every request reaches Nginx from a **Cloudflare IP**. Without
correction, a per-IP rate limiter sees all traffic as one client and **blocks every visitor at
once the moment any one of them trips a limit.**

Required in Nginx:

```
set_real_ip_from  <cloudflare ranges>;   # refreshed from CF's published list
real_ip_header    CF-Connecting-IP;
real_ip_recursive on;
```

and NestJS must `trustProxy` accordingly. **This must be configured on the same day Cloudflare
is enabled**, not later — otherwise the failure appears as an unexplained sitewide outage.

---

## H. Catalogue / SKU Data Requirements

Your point 7. **Where LEI's data is unavailable, it is marked as a dependency — nothing invented.**

### H.1 Per Product (the catalogue entity)

| Field | Required | Source | Status |
|---|---|---|---|
| Name | ✅ | LEI | ⛔ **Dependency** |
| Category | ✅ | LEI | ⛔ **Dependency** |
| Part brand | ✅ | LEI | ⛔ **Dependency** |
| Slug | ✅ | Auto from name | ✅ Derived |
| Short description | ✅ | LEI / supplier | ⛔ **Dependency** |
| Full description | ○ | LEI | ⛔ Dependency |
| **HSN code** | ✅ | **LEI's accountant** | 🔴 **Blocking — must not be guessed** |
| **GST rate** | ✅ | **LEI's accountant** | 🔴 **Blocking** |
| Product type | ✅ | LEI | ⛔ Dependency |
| Meta title / description | ○ | Generated, LEI-editable | ✅ Fallback rule defined |
| Primary image + alt text | ✅ | LEI | ⛔ **Dependency** |

### H.2 Per Variant (the sellable unit)

| Field | Required | Source | Status |
|---|---|---|---|
| **SKU** (globally unique) | ✅ | LEI | 🔴 **Blocking — needs a convention if none exists** |
| **Part number** | ✅ | LEI / OEM | 🔴 **Blocking — this is what customers search** |
| MPN | ○ | OEM catalogue | ⛔ Dependency |
| Variant name | ✅ | e.g. "D1.5" | ⛔ Dependency |
| Price | ✅ (if `FIXED`) | LEI | ⛔ **Dependency** |
| Price type | ✅ | LEI | ⛔ Dependency |
| Unit of measure / pack size | ✅ | LEI | ⛔ Dependency — **see schema Q4** |
| Min order qty | ○ | LEI | Default 1 |
| Stock qty / reorder level | ✅ | LEI | ⛔ Dependency |
| Search key | ✅ | Auto-computed | ✅ Derived |

### H.3 Compatibility — the highest-risk dataset

Per row: `product` × `machineBrand` × `machineModel` × `machineVariant?` × `notes` × `isVerified`.

| Question | Status |
|---|---|
| Does structured compatibility data exist (spreadsheet, OEM catalogue, ERP export)? | 🔴 **UNANSWERED — blocking, see I-2** |
| If not, who supplies it and at what rate (rows/day)? | 🔴 **UNANSWERED** |
| Which machine brands/models must be covered at launch? | 🔴 **UNANSWERED** |

> **Position:** I will not generate compatibility data. Wrong compatibility produces a confident
> wrong answer and a returned part, which damages LEI's credibility more than an incomplete
> catalogue. If the data isn't ready, the slice ships with a **small verified set** and the
> finder shows only covered machines.

### H.4 CSV import contracts (to be built, not yet built)

Five importers, each **dry-run first**, reporting row-level errors:

```
1. machines.csv       brand, model, variant, laser_type, power_watts
2. attributes.csv     name, slug, data_type, scope, unit, filterable
3. products.csv       name, category, part_brand, hsn, gst_rate, type, descriptions, seo
4. variants.csv       product_slug|sku, sku, part_number, variant_name, price,
                      price_type, uom, pack_size, stock_qty, reorder_level, attr:<slug>…
5. compatibility.csv  product_slug|sku, machine_brand, machine_model, machine_variant?,
                      notes, is_verified
```

Import order is a hard dependency chain: **1 → 2 → 3 → 4 → 5.**

### H.5 LEI's own data — needed for the quote PDF

**Absent from all four source documents.** Required before Step 7 of the journey can work:

legal name · GSTIN · registered address · **state code** (drives CGST/SGST vs IGST) · phone ·
email · logo · quote T&C · default validity days · payment terms · sales notification addresses ·
WhatsApp number · bank details (if quotes show them).

🔴 **Blocking for the PDF — see I-3.**

---

## I. Dependencies & Blockers

### 🔴 Blocking — implementation cannot correctly start

| # | Blocker | Blocks | Needed from |
|---|---|---|---|
| **I-1** | **Domain strategy.** `shop.laserxprts.com` vs `laserxprts.com` vs `/shop`. Does the main site exist today, what's on it, is it being retired? | URL structure, canonicals, sitemap, redirect map, Cloudflare setup | **You** |
| **I-2** | **Catalogue & compatibility data.** SKU count, whether structured compatibility exists, which machines at launch | Import design, search tuning, slice content, K-8 | **You / LEI** |
| **I-3** | **LEI company data + HSN codes + GST rates** | Quote PDF, tax calculation | **LEI's accountant** |
| **I-4** | **Schema sign-off**, especially the product/variant rule and enum values | Migration 001 | **You** |

### 🟠 Needed before the relevant stage

| # | Dependency | Needed by |
|---|---|---|
| I-5 | Email provider account + **DNS access for SPF/DKIM/DMARC** | Journey Step 6 |
| I-6 | Domain registrar access (Cloudflare nameservers) | Deployment |
| I-7 | Hostinger VPS credentials + specs (RAM matters — MySQL + Next.js contend) | Deployment |
| I-8 | Off-host backup target (B2/R2 account) | Deployment |
| I-9 | Brand assets: logo (SVG + PNG), colour tokens, font licences | Design system |
| I-10 | LEI WhatsApp Business number | Journey Step 0 |
| I-11 | Product photography for the Nozzles set | Slice content |
| I-12 | GitHub repo + branch protection permissions | Stage 1 |

### 🟢 Resolved in this pass

Quote basket · missing tables · `quoteRevisionId` on orders · money types · enums ·
`customers.user_id` · charset/collation · index gaps · unique constraints · soft-delete strategy ·
document numbering · LEI settings storage.

---

## J. Risks & Open Decisions

### J.1 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Catalogue data not ready** — the historical #1 cause of delay on projects like this | **High** | **High** | Slice needs only ~10 products. Build importers early. Track as I-2 |
| R2 | Compatibility data wrong or absent | Med | **High** | `isVerified` flag; ship verified-only; finder shows covered machines only |
| R3 | Product/variant rule doesn't match LEI's reality | Med | **High** | **Confirm before migration** — schema Q1 |
| R4 | Email deliverability to Indian corporate mail servers | Med | **High** | SPF/DKIM/DMARC day one; signed links not attachments; monitor `EmailLog` bounces |
| R5 | VPS under-specced; MySQL + Next.js contend | Med | Med | Container memory limits; Cloudflare offload; ISR over SSR |
| R6 | Scope creep back toward orders/CMS/reports | **High** | Med | Section C.3 is the contract; changes are explicit re-approvals |
| R7 | HSN misclassification | Low | **High** | Accountant-supplied only; never inferred |
| R8 | Admin panel exceeds estimate | Med | Med | Single `DataTable`/`EntityForm` pattern; 18 screens not 30 |
| R9 | Solo-developer bus factor | Med | **High** | Everything in git; documented setup; no undocumented manual server state |
| R10 | GST rules change | Low | Med | Rates in data, snapshotted per quote — not hardcoded |

### J.2 Open decisions

**On the schema** (7 questions in `LEI_Prisma_Schema_Proposal.md` §B.6):
product/variant rule · enum values · one-contact-per-customer · pack sizes · freight ·
quote validity default · multi-currency.

**On the product:**

| # | Decision | My recommendation |
|---|---|---|
| J-1 | Public prices? | Per-variant `priceType`; consumables visible, high-value on request |
| J-2 | Enquiry auto-assign or unassigned queue? | **Unassigned queue** + dashboard tile. Auto-assign needs rules that don't exist yet |
| J-3 | Duplicate enquiry within 24h — merge or separate? | **Separate records, flagged as possible duplicate.** Never auto-merge commercial records |
| J-4 | Can a SALES admin see *all* customers or only assigned? | **All, for Phase 1.** Row-level scoping is real work; confirm it's acceptable |
| J-5 | Who marks quotes `EXPIRED`? | Nightly job on `validUntil` + dashboard tile at 7 days |
| J-6 | Product discontinued between enquiry and quote? | Snapshots preserve the enquiry; admin sees a warning banner |
| J-7 | Freight on quotes? | Header-level amount (as modelled). Confirm |
| J-8 | Hour 40–50 stakeholder demo? | Not reachable with real data. Say if a stakeholder needs it and I'll reorder |

---

## K. Validation of External Decisions

Your point 8 — technical and operational implications **before** locking anything in.

### K.1 Email — Brevo

**Volume:** ~50–200 emails/day at launch. Brevo's free tier (300/day) covers it; paid tiers are
inexpensive beyond that.

| Implication | Detail |
|---|---|
| ✅ Volume fits | Free tier sufficient at launch |
| ✅ API + webhooks | Delivery/bounce webhooks feed `EmailLog` — sales learns when an address is dead |
| ⚠️ **DNS required** | SPF, DKIM, DMARC on the sending domain. **Depends on I-1 and I-6.** Without these, corporate Indian mail servers will spam-folder LEI |
| ⚠️ **Domain warm-up** | A brand-new sending domain has no reputation. Send low volume for the first 2 weeks |
| 🔴 **Design consequence** | **Do not attach the quote PDF.** Attachments degrade deliverability and are stripped by many corporate gateways. Send a **signed, expiring download link.** This is why `File.isPublic` and signed access exist in the schema |
| ⚠️ Free-tier limits | Verify whether Brevo's free transactional tier adds branding — **to confirm before locking** |
| **Alternatives** | Amazon SES (cheapest at scale; sandbox approval delay, more setup). Postmark (best deliverability; paid from day one) |

**Recommendation: Brevo, with the free-tier branding question verified first.** The
`NotificationsModule` is provider-abstracted, so switching is a config change.

### K.2 WhatsApp — `wa.me` deeplink

```
https://wa.me/91XXXXXXXXXX?text=Hi%2C%20I%20need%20a%20quote%20for%20part%20NZ-SL-H15-15
```

| Implication | Detail |
|---|---|
| ✅ Zero cost, no API, no Meta approval | Works on mobile and WhatsApp Web |
| ✅ Pre-filled part number | High-context enquiry lands directly with sales |
| ⚠️ **Click ≠ conversation** | You can log `WHATSAPP_CLICK` (intent) but never confirm a message was sent. Analytics must label it *intent*, not *lead* |
| ⚠️ **Conversations bypass the platform** | Enquiries arriving by WhatsApp are invisible to leads/quotes. Sales must manually create them, or the pipeline is systematically incomplete |
| ⚠️ **Single number, limited devices** | WhatsApp Business App supports ~5 linked devices. A larger sales team needs the Business API (paid, Meta approval, template pre-approval) |
| ⚠️ Number must be WhatsApp-registered | Verify LEI's number is on WhatsApp Business, not just a landline |

**Recommendation: deeplink for Phase 1.** Flagging the second point as a **real operational
risk** — it is a hole in your lead data that no code can close.

### K.3 Cloudflare — free tier

| Implication | Detail |
|---|---|
| ✅ CDN, TLS, DDoS, WAF, origin IP hidden | Removes TLS management from deployment |
| 🔴 **`CF-Connecting-IP` is mandatory** | Without it your rate limiter sees one client and blocks everyone at once — see §G.3 |
| 🔴 **SSL mode must be Full (Strict)** | "Flexible" leaves origin traffic unencrypted. Requires a real cert on origin (Let's Encrypt or Cloudflare Origin CA) |
| ⚠️ **HTML is not cached by default** | Cache Rules needed for `/uploads/*` and static assets. ISR pages benefit from `stale-while-revalidate` |
| ⚠️ **100 MB upload limit** on free tier | Fine for product images; matters if large catalogues/manuals are uploaded through the proxy |
| ⚠️ **Nameservers move to Cloudflare** | Registrar change. All existing DNS records (**including current mail**) must be replicated first, or LEI's email breaks |
| ⚠️ Cache purge on deploy | Needs a purge step in the deploy workflow |

**Recommendation: yes** — but the nameserver migration must inventory existing MX/TXT records
first. **This is a real "break LEI's email" risk if done carelessly.**

### K.4 GST / HSN

| Implication | Detail |
|---|---|
| ✅ **A quotation is a proforma, not a tax invoice** | Phase 1 does **not** need GST invoice numbering compliance, IRN/e-invoicing, or e-way bills. Meaningful scope protection |
| 🔴 **HSN codes must come from LEI's accountant** | Laser optics/machine parts span several chapters. Misclassification has tax consequences. **Will not be guessed** |
| ⚠️ **Place of supply drives treatment** | LEI's state vs customer's. Needs LEI's `state_code` (I-3) and customer capture at enquiry or quote time |
| ⚠️ **Rounding must be specified** | Per-line, half-up to 2dp, header `roundOff` absorbing the remainder. Unit-tested — a quote that doesn't add up is a credibility problem |
| ⚠️ **Rates change by notification** | Snapshotted per quote item; never recomputed historically |
| 🔵 **Future scope warning** | If LEI later wants to raise **invoices** from this system, e-invoicing (IRN) applies above the turnover threshold and is a substantially larger compliance project. Out of scope, flagged now |

### K.5 Hostinger VPS

| Implication | Detail |
|---|---|
| ⚠️ **RAM is the constraint.** MySQL + Next.js + NestJS + Redis on one box | Need the plan spec (I-7). Container memory limits mandatory |
| ⚠️ **Backups on the VPS are not backups** | Off-host target required (I-8) |
| ⚠️ No managed failover | Documented, tested restore converts an existential risk into hours of downtime |
| ✅ Cost-appropriate | Correct choice at this stage |

---

## L. Measurable Deliverables

Your point 9 — **240h is a planning estimate, not a commitment.** Progress is assessed against
working functionality.

| Stage | Deliverable — verified by demonstration, not by hours | Est. |
|---|---|---|
| **1.1** | `docker compose up` → API `/health` green, Next.js serves, MySQL + Redis connected | 12h |
| **1.2** | 3 CI workflows green on a PR; branch protection blocks direct push to `main` | 6h |
| **1.3** | Migration 001 applies to an empty DB; seed creates SUPER_ADMIN + 1 admin per department | 12h |
| **1.4** | Login works; **a CATALOGUE admin gets 403 on `/admin/enquiries`** (automated test) | 18h |
| **1.5** | Refresh rotation works; **replaying an old token revokes the family** (automated test) | 8h |
| **2.1** | Admin can create a product with 4 variants, upload an image, set compatibility | 22h |
| **2.2** | `variants.csv` dry-run reports row-level errors; apply loads 60 variants | 15h |
| **2.3** | Nozzles category page renders real data, responsive, Lighthouse ≥ 85 mobile | 20h |
| **2.4** | Product page: variant selector changes price + stock; compatibility listed | 14h |
| **2.5** | **Search for an exact part number returns the right variant first** | 12h |
| **2.6** | Compatibility finder: Raytools → BM110 → nozzles, in one round trip | 10h |
| **3.1** | 3 items added to Quote Request; **survives browser restart**; drawer correct | 14h |
| **3.2** | Submit → `Enquiry` + 3 items + `Customer` + `Lead` created atomically; `publicRef` returned | 12h |
| **3.3** | Confirmation email to customer + alert to sales, both logged in `EmailLog` | 12h |
| **3.4** | Admin sees enquiry with all 3 items, assigns, changes status; all audited | 10h |
| **3.5** | **Create Quote pre-populates all 3 lines with no retyping** | 12h |
| **3.6** | **GST correct for intra-state AND inter-state** (unit-tested both ways) | 8h |
| **3.7** | PDF renders with LEI details, HSN, correct totals; stored permanently | 14h |
| **3.8** | Quote emailed as a **signed link**; `sentAt` recorded; revision 2 leaves revision 1 untouched | 10h |
| **4** | Widen: services, remaining categories, orders, remaining admin screens | ~60h |
| **5.1** | Sitemap, robots, structured data validate; **zero soft-404s** on deactivated products | 14h |
| **5.2** | Security checklist signed off; upload of a malicious SVG **rejected** | 12h |
| **5.3** | Deployed; Cloudflare live; **DB restored from off-host backup into a clean container and journey re-verified** | 20h |

**Gate rule:** a stage is not "done" because its hours are spent. It is done when its
deliverable is demonstrated. If 3.5 takes 20h instead of 12h, that is data about the estimate —
not a reason to move on with it half-working.

---

## M. Missing Requirements Found During This Pass

Your point 10. These are **new** — not in the earlier review, found while walking the journey
end to end.

| # | Missing | Impact | Resolution |
|---|---|---|---|
| M-1 | **LEI's own company data** (legal name, GSTIN, address, state code, T&C, bank details) | 🔴 Quote PDF cannot render | `Setting` table added. **Data needed — I-3** |
| M-2 | **Concurrent-safe document numbering** | 🔴 Two admins could get the same quote number | `Counter` + `SELECT … FOR UPDATE` |
| M-3 | **Enquiry attachments** — customers photograph the broken part. Extremely common in this domain | 🟠 Sales loses the single most useful diagnostic input | `EnquiryAttachment` added |
| M-4 | **Unit of measure / pack size** — are nozzles sold singly or per box of 10? | 🟠 Quote quantities ambiguous; wrong quantities shipped | Fields added. **Confirm — schema Q4** |
| M-5 | **Freight / delivery charges on quotes** | 🟠 Quote total wrong vs. what's actually charged | `freightAmount` added. **Confirm — J-7** |
| M-6 | **Quote expiry** — nothing marks quotes `EXPIRED` | 🟠 Stale quotes accepted at old prices | Nightly job + dashboard tile |
| M-7 | **Sales notification routing** — which admin gets the alert? | 🟠 Enquiries sit unnoticed | `Setting: notify.sales_emails` + unassigned queue |
| M-8 | **Email bounce visibility** | 🟠 Sales believes a quote was delivered when it bounced | `EmailLog` + provider webhooks |
| M-9 | **Timezone handling** — UTC storage, IST display | 🟡 Quote dates off by hours near midnight | Convention fixed; formatting centralised |
| M-10 | **Stock movement history** — `Inventory` alone can't explain a change | 🟡 Stock disputes unanswerable | `StockMovement` ledger added |
| M-11 | **Zero-result search capture** | 🟡 Losing the highest-value commercial signal on the site | `SearchQueryLog` added |
| M-12 | **Basket rehydration when a variant is deactivated** | 🟡 Basket crashes or shows a dead product | `GET /variants/resolve` handles it explicitly |
| M-13 | **Compatibility verified vs claimed** | 🟠 Confident wrong answers → returned parts | `isVerified` + distinct UI treatment |
| M-14 | **Category product counts** (mockup shows "128+ Products") | 🟡 Aggregate per tile per request | Cached `Category.productCount` |
| M-15 | **Slug reuse after soft delete** | 🟡 Slug blocked forever | Rename-on-delete inside the transaction |
| M-16 | **Payment terms / delivery terms on quotes** | 🟡 Commercial ambiguity | Fields added to `QuoteRevision` |

---

## Approval Gate

**Nothing has been implemented. No migrations. No application code. No configuration.**

Delivered:

| | Section | Where |
|---|---|---|
| A | Validated architecture | §A |
| B | Complete Prisma schema — 41 models, 24 enums, with reasoning | `LEI_Prisma_Schema_Proposal.md` |
| C | Phase 1 vertical-slice definition | §C |
| D | Customer journey, technically accounted for | §D |
| E | Admin journey | §E |
| F | Required API / domain flow | §F |
| G | Security considerations | §G |
| H | Catalogue / SKU data requirements | §H |
| I | Dependencies & blockers | §I |
| J | Risks & open decisions | §J |
| + | External-decision validation (point 8) | §K |
| + | Measurable deliverables (point 9) | §L |
| + | Missing requirements (point 10) | §M |

### To move to implementation I need

**Blocking:**
1. **I-1** — domain strategy
2. **I-2** — catalogue & compatibility data reality
3. **I-3** — LEI company data, HSN codes, GST rates
4. **I-4** — schema sign-off, especially the product/variant rule (§B.3.1) and the enums (§B.2)

**Non-blocking but needed soon:** the 7 schema questions in §B.6 and the 8 product decisions in §J.2.

**On approval, the first implementation step is Stage 1.1** — repo scaffold, Docker Compose,
`/health` — and nothing beyond the scope defined in §C.

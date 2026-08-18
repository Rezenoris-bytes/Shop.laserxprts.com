# LEI MVP — Specification Review, Validation & Phase 1 Scope

**Reviewer:** Architecture review pass, pre-implementation
**Date:** 18 August 2026
**Inputs reviewed:**
- `LEI_MVP_Stack_Timeline_Execution_Plan_REVISED.md` (Rev 1.1) — hereafter **TIMELINE**
- `LEI_MVP_Backend_Architecture_Specification_REVISED.md` (Rev 1.1) — hereafter **BACKEND**
- `LEI_MVP_Database_Architecture_Admin_Two_Role_Model_REVISED.md` (Rev 1.1) — hereafter **DB**
- `LEI_GitHub_Actions_Development_Plan.md` — hereafter **CI**
- `reference.jpeg` — homepage UI mockup, hereafter **MOCKUP**

**Status: NO CODE WRITTEN. This document is review and validation only.**

---

## A. Executive Summary

### What the project is

Laser Experts India (LEI) sells spares and consumables for industrial fiber/CO₂ laser
cutting machines (nozzles, ceramic rings, protective windows, focus lenses, laser heads,
cables, sensors) and delivers technical services (CO₂→fiber retrofit, laser head repair,
remanufacturing, AMC, periodic maintenance, chiller repair, laser welding).

The platform being specified is **not an e-commerce store**. It is a **technical-catalogue-driven
lead generation and sales-operations system**:

> Discover the right part for your machine → raise an enquiry → sales qualifies it as a lead →
> quote (with revisions) → accept → fulfil.

The critical differentiator in the specification is **machine compatibility**: a customer with a
Raytools BM110 head needs to find parts that fit *that* head. The normalized
`machine_brands → machine_models → machine_variants` reference model shared between
`product_compatibility`, `customer_machines` and `service_requests` is the strongest
architectural decision in these documents, and it is correct.

### Overall assessment of the specification

**Quality: good-to-very-good.** These are unusually disciplined documents for an SMB project.
The Revision 1.1 corrections across all three specs show a prior review already caught the
four classic data-integrity traps, and caught them correctly:

| Correction | Verdict |
|---|---|
| Inventory single source of truth (no duplicate stock fields on `products`) | ✅ Correct |
| `quote_revision_id` on orders for exact commercial traceability | ✅ Correct |
| Service request always creates/links a `lead_type=SERVICE` lead | ✅ Correct — this is the item most projects get wrong |
| Translation tables instead of `*_en`/`*_hi` columns | ✅ Correct |
| `machine_variant_id` authoritative; `laser_type`/`laser_power` fallback only | ✅ Correct |
| No cart/checkout/payment in MVP | ⚠️ **Contradicted by the MOCKUP — see C-1** |

The **modular monolith on a single VPS is the right call** and is well argued. There is no
microservices temptation, no premature vector search, no premature object storage. The
engineering principles section is sound.

### The three findings that matter most

Everything else in this review is secondary to these:

> **🔴 BLOCKER 1 — The MOCKUP requires a multi-item quote basket. The schema cannot store one.**
> Every product card says "Add to Quote" and the header shows a basket badge (`2`). But
> `enquiries` has a single nullable `product_id`. There is no `enquiry_items` table.
> A customer who adds four parts to their quote basket has nowhere for those four lines to land.
> This is a schema-level gap in the primary conversion path of the entire site. See **C-1**.

> **🔴 BLOCKER 2 — There is no way to deliver a quote to a customer.**
> The workflow is `Quote → Revision → Customer accepts → Order`. But customer login is
> deferred, no email/SMTP provider is chosen anywhere in any document, there is no quote PDF
> generation, and there is no acceptance mechanism. The sales workflow terminates in a
> vacuum. See **K-2** and **M-3**.

> **🔴 BLOCKER 3 — The 175-hour estimate is roughly 2.5–3× optimistic for the scope described.**
> Phase 8 allocates 18 hours for an admin panel with ~30 CRUD screens (36 min/screen).
> Phase 2 allocates 18 hours for ~30 tables *plus* auth *plus* RBAC *plus* core APIs.
> Honest bottom-up estimate for the full documented scope: **~380–450 hours.**
> This is not a reason to abandon the plan — it is a reason to cut scope deliberately now
> rather than discover the overrun at hour 120. See **I** for a 175h scope that actually fits.

### Recommendation

**Do not begin schema migration coding yet.** Resolve the 11 blockers in section **K** first —
most are 15-minute decisions, not weeks of work. Then build the Phase 1 scope defined in
section **I**, which is deliberately narrower than the documents describe and is
achievable in the stated budget.

---

## B. Requirements Analysis

### B.1 Business requirements (derived — never stated explicitly in any document)

The documents describe *what to build* but never state the business objective in measurable
terms. Reconstructed from context:

| Inferred objective | Evidence | Confidence |
|---|---|---|
| Reduce time-to-quote for spare parts enquiries | Entire enquiry→lead→quote pipeline | High |
| Let customers self-serve part identification by machine | Compatibility model, MOCKUP "Find Parts That Fit Your Machine" | High |
| Capture organic search traffic for part numbers and machine models | Dedicated 12h SEO phase, SEO fields on every entity | High |
| Give sales one system instead of WhatsApp + spreadsheets | Leads, activity timeline, audit logs | High |
| Surface high-value service work (retrofit, remanufacturing) to sales | `lead_type=SERVICE` correction in Rev 1.1 | High |
| Sell online | ❌ Explicitly excluded in all three docs | N/A |

**Gap:** No success metrics are defined anywhere. Recommend agreeing on 2–3 before launch
(e.g. *enquiries/month*, *quote turnaround time*, *organic sessions to product pages*),
because the analytics event schema in BACKEND §13 should be validated against them.
The current event list looks reasonable but is unanchored.

### B.2 Functional requirements

Consolidated from TIMELINE §3, BACKEND §5/§8, DB §15:

**Public storefront** — homepage; category pages (nested); product listing with filters,
sorting, pagination; product detail with specifications, compatibility and downloads; related
products; services catalogue and detail; search; compatibility finder; enquiry/quote request;
contact; WhatsApp/phone actions; brochure downloads.

**Admin/sales** — dashboard; catalogue (products, categories, part brands, attributes,
compatibility, inventory, media); machines/OEM (brands, models, variants); services and
service requests; sales (enquiries, leads, quotes, quote revisions, orders); customers
(profiles, machine history, activity timeline); content/SEO (pages, FAQs, metadata);
reports; settings (admin users, functions, permissions).

**Cross-cutting** — two-role auth (SUPER_ADMIN/ADMIN) with module permissions; audit logging;
analytics event capture; file upload; bilingual content structure (en/hi).

### B.3 Non-functional requirements

| Area | What the documents specify | Assessment |
|---|---|---|
| Performance | Pagination everywhere, DB indexes, no N+1, SSR/RSC, image optimization, selective Redis | Directionally correct, **no numeric targets** |
| Security | Helmet, CORS whitelist, rate limiting, class-validator DTOs, Argon2id, HttpOnly cookies, file validation, audit | Good baseline, **significant gaps — see E** |
| SEO | Metadata, canonical, OG, sitemap, robots, breadcrumbs, schema.org, SEO URLs | Good list, **rendering/i18n/faceting strategy missing — see G** |
| Availability | UptimeRobot, Docker logs | Liveness only, no correctness check |
| Backup | "Automated database backups on the VPS from the beginning" | ⚠️ **Same-host backups are not backups — see D.4** |
| Scalability | Modular monolith, extraction path documented | Appropriate and correctly deferred |
| Accessibility | ❌ Not mentioned in any document | **Missing entirely — see H** |
| Data protection / privacy | ❌ Not mentioned in any document | **Missing — DPDP Act 2023 applies, see E.9** |
| Browser support | ❌ Not specified | Minor gap |
| Uptime/SLA | ❌ Not specified | Acceptable for MVP |

### B.4 Roles and permissions

The two-role model (`SUPER_ADMIN`, `ADMIN` + `function` + `admin_permissions` rows) is
**well designed and should be kept exactly as specified.** DB §1–§4 is the strongest section
across all documents. Reasoning:

- It avoids the classic mistake of encoding job titles as auth roles, which forces a schema
  migration every time the business reorganizes.
- `function` is descriptive (drives default permission templates and admin UI grouping);
  `admin_permissions` is authoritative (drives the guard). This separation is correct.
- `UNIQUE(user_id, module)` on `admin_permissions` is the right constraint.

Two refinements in **D.2**.

---

## C. Cross-Document Conflicts

Presented as: *Document A says → Document B says → Recommended decision → Reason.*

---

### 🔴 C-1. Quote basket / cart — CRITICAL

**MOCKUP says:** Header carries a basket icon with badge `2`. Every product card carries an
**"Add to Quote"** button. This is a multi-item quote basket and it is the primary
conversion mechanic of the entire homepage design.

**TIMELINE §Rev1.1 / BACKEND §Rev1.1 / DB §Rev1.1 say:** "No cart/checkout implementation is
part of the MVP." / "Do not introduce cart, checkout or payment modules."

**DB §11 says:** `enquiries` has a single nullable `product_id`. There is no line-item table.

**Recommended decision:**
**Build the quote basket. It is not a cart.** The exclusion in the specs is aimed at
*checkout and payment* — which should absolutely stay excluded — but it has been over-applied
and has removed a feature the UI depends on. Specifically:

1. Add an **`enquiry_items`** table (`enquiry_id`, `product_id?`, `service_id?`,
   `description`, `quantity`, `notes`, `machine_variant_id?`).
2. Keep the guest basket **client-side** (`localStorage`) and POST the whole basket as one
   enquiry on submit. **Do not build a server-side basket table, Redis basket, or basket
   sync in Phase 1** — that *would* be the cart the specs are warning against.
3. Rename the concept everywhere in code and UI to **"Quote Request"** / "Request List",
   never "cart", so the boundary stays unambiguous for future developers.
4. A quote request converts directly to `quote_revision_items` — the sales user gets a
   pre-populated quote instead of retyping four part numbers.

**Reason:** Requiring a customer to submit four separate enquiries for four parts on the same
machine is a conversion killer and creates four leads for one opportunity — actively harmful
to the sales pipeline this system exists to build. `enquiry_items` costs ~4 hours and removes
a schema migration later. The `localStorage`-only rule keeps the "no cart" principle intact
in substance.

Also remove `"cart"` from the Redis row in **TIMELINE §1** ("sessions/cart/rate limiting"),
which contradicts the same document's own Rev 1.1 note.

---

### 🔴 C-2. Customer login and account identity

**MOCKUP says:** Header shows **"Login / Register"** and **"Track Order"**.

**TIMELINE §Rev1.1 / BACKEND §7 say:** "Customer login is optional and deferred. Guest
visitors can browse products and submit enquiries/quote requests."

**DB §11 says:** `customers.user_id (FK, nullable)` → references `users`.

**DB §4 says:** `users.role` is constrained to `SUPER_ADMIN | ADMIN` only, and DB §21 says
"Keep the security model to two system roles only."

**Recommended decision:**
1. **Remove "Login / Register" and "Track Order" from the Phase 1 header.** A visible control
   that does nothing is worse than its absence.
2. **Drop `customers.user_id` from the Phase 1 schema entirely.**
3. When customer login is eventually built, use a **separate `customer_accounts` table with
   its own credential store and its own JWT audience** — do *not* add a `CUSTOMER` value to
   `users.role`.

**Reason:** This is a security decision, not a cosmetic one. `customers.user_id` pointing into
the admin `users` table means the customer principal and the admin principal share one
identity table, one password column, one token issuer and one role enum. Every future
authorization bug in that table becomes a privilege-escalation path from public internet to
admin panel. Keeping the two principal types in physically separate tables makes that class of
bug structurally impossible, and costs nothing now because the column is unused in Phase 1.

The `nullable user_id` also silently contradicts the document's own "only two system roles"
rule — it is the one place where the otherwise-excellent role model leaks.

---

### 🟠 C-3. "Secure Payments" trust badge

**MOCKUP says:** Trust bar reads **"Secure Payments — 100% safe & secure transactions"**,
repeated in the mobile view.

**All three specs say:** No payment integration in MVP. Razorpay/Stripe are post-MVP.

**Recommended decision:** Replace the fourth trust badge with something true and relevant —
**"Technical Support"**, **"OEM Compatibility Guaranteed"**, or **"GST Invoicing"**.

**Reason:** Advertising secure payment processing on a site that cannot accept payment is a
false representation, will generate support calls from customers looking for a checkout, and
undermines the credibility of the other three (accurate) badges beside it.

---

### 🟠 C-4. "Track Order" without customer authentication

**MOCKUP says:** "Track Order" link in the top utility bar.

**DB §12 says:** `orders` has `tracking_number`, `courier`, `shipped_at`, `delivered_at`.

**BACKEND §7 says:** No customer authentication in MVP.

**Recommended decision:** **Defer order tracking to Phase 2.** If it is required at launch,
implement it as a **tokenized link** — a single-use opaque token emailed with the shipment
notification, resolving to a read-only status page. Do **not** implement lookup by
`order_number` + email/phone, and never by `order_number` alone.

**Reason:** Order-number-only lookup is an enumeration vulnerability that exposes customer
names, addresses, phone numbers and purchase history — sequential order numbers make it
trivially scriptable. Order-number + email is better but still enumerable if order numbers
are sequential. A tokenized link has none of these properties and is less work than either.

---

### 🟡 C-5. Navigation IA — business lines vs. entity types

**MOCKUP nav:** `Home | About LEI | Field Service | Fiber Laser Source | Remanufacturing | Spares & Consumables`

**DB §15 / TIMELINE §3 IA:** A clean `Products` / `Services` split.

**Recommended decision:** **Follow the MOCKUP.** Drive the top navigation from a small
configurable menu structure that maps business-line labels onto the underlying
`categories` and `services` records. No schema change is needed.

**Reason:** The mockup nav reflects how LEI's customers actually think ("I need remanufacturing")
rather than how the database is organized ("I need a service record"). Entity-shaped
navigation is a common and avoidable mistake. The mapping layer is ~2 hours.
Note that `Fiber Laser Source` is a *product* line while `Field Service` and `Remanufacturing`
are *services* — the menu config must support mixed targets.

---

### 🟡 C-6. Deployment scope in the timeline vs. the CI plan

**TIMELINE Phase 12 says:** 20 hours for "Hostinger VPS deployment, Docker, Nginx, SSL,
production environment, backups, domain/DNS" — deployment is inside the 175h baseline.

**CI §1/§13 says:** "No deployment workflow yet — hosting phase deferred." Explicitly lists
`deploy.yml`, VPS/SSH deployment, SSL automation, Nginx deployment, production health checks,
and production backup workflow as **not to be created**.

**Recommended decision:** Both are correct at different times. **CI governs now** (build
validation only, no deployment secrets in the repo). The deployment workflow is authored at
the start of TIMELINE Phase 12, not before. Record this explicitly so the CI document is not
read as cancelling Phase 12.

**Reason:** These documents were written at different moments and neither is wrong. The risk
is silent — a developer reading CI in isolation concludes deployment is out of scope entirely
and the 20h is never planned for.

---

### 🟡 C-7. `quote_revision_id` on orders — correction not applied to the schema

**DB §Rev1.1 (line 26) says:** "Orders record the exact accepted quote revision through
`quote_revision_id`; `quote_id` remains for parent-level traceability."

**BACKEND §Rev1.1 says:** the same.

**DB §12 (the actual `orders` table definition) lists:** `id`, `order_number`, `quote_id`,
`customer_id`, `status`, `tracking_number`, `courier`, `subtotal`, `discount`, `tax`, `total`,
timestamps. **`quote_revision_id` is absent.**

**Recommended decision:** Add `quote_revision_id (FK quote_revisions, NOT NULL)` to `orders`.
The correction is right; the schema listing was simply not updated to match.

**Reason:** This is exactly the kind of drift that survives into production. The stated
correction is the whole point of the revision and it is missing from the one place a developer
will copy from.

---

### 🟡 C-8. Tables referenced but never defined

Five tables appear in ERDs, index tables, module lists or implementation order but have **no
schema definition anywhere**:

| Table | Referenced in | Defined? |
|---|---|---|
| `customer_events` | DB §6 ERD, DB §18 index table (3 indexes specified!), BACKEND §5 | ❌ No |
| `sessions` | DB §19 implementation order, BACKEND §5 "Sessions and approved events" | ❌ No |
| `product_media` | DB §6 ERD, DB §15 admin structure, BACKEND §6 project structure | ❌ No |
| File/attachment metadata | BACKEND §12 "Save file metadata in MySQL" | ❌ No |
| Service request attachments | BACKEND §19 "service requests, attachments" | ❌ No |

**Recommended decision:** Define all five before migration work begins. Proposed shapes are
in **D.3**. `customer_events` in particular has three indexes carefully specified in DB §18
for a table that does not exist — strong evidence the definition was lost in editing rather
than deliberately omitted.

---

### 🟢 C-9. Duplicate section numbering

**BACKEND** has two sections numbered `# 8` ("Data Integrity Rules" and "Core API Design").
Cosmetic, but worth fixing so section references in future review cycles are unambiguous.

---

### 🟢 C-10. Terminology inconsistencies

| Term | Used as | Recommendation |
|---|---|---|
| `part_brands` vs `brands` | DB uses `part_brands`; TIMELINE §3 admin list says "Brands" | Standardize on **`part_brands`** — the distinction from `machine_brands` is essential and must not blur |
| "Phase 1" | 3 different meanings — see **C-11** | Resolve per C-11 |
| "cart" | TIMELINE §1 Redis row, contradicting the same doc's Rev 1.1 | Delete; use "quote request" |
| `attributes` vs "Specifications" | DB uses `attributes`; TIMELINE §3 admin list says "Specifications" | `attributes` in code, "Specifications" in admin UI labels — document the mapping |
| `function` | DB column name | ⚠️ Rename to **`department`** — `function` is a reserved word in several SQL dialects and a keyword in JS/TS contexts; needless friction |

---

### 🔴 C-11. "Phase 1" means three different things

This directly affects what you are being asked to approve.

| Source | "Phase 1" means | Hours |
|---|---|---|
| **TIMELINE §4** | "Planning & Foundation" — repo, Docker, Prisma setup | Hours 1–10 |
| **BACKEND §19** | "Foundation" — NestJS, Docker, MySQL, Prisma, Redis, config | — |
| **Your instruction** | The entire first release / MVP | ~175 |

**Recommended decision:** Adopt this vocabulary and use it consistently from here:

- **Release 1 (R1)** = the first shippable product = what section **I** defines.
- **Build Phase 1…12** = the TIMELINE's internal work stages, always written as "Build Phase N".
- **Release 2+** = deferred scope (section **J**).

**Reason:** Without this, "approve Phase 1" is ambiguous between a 10-hour setup task and a
175-hour product. Section **I** of this document is scoped as **Release 1**.

---

## D. Architecture Review

### D.1 Verdict on the proposed architecture

| Dimension | Verdict | Note |
|---|---|---|
| Appropriate | ✅ Yes | Modular monolith is right for this team size and traffic profile |
| Over-engineered | ⚠️ In four places | Redis caching layer, EAV admin UI, Pages/FAQ CMS, Reports module — see D.6 |
| Under-engineered | ⚠️ In three places | Email/notifications absent, data import absent, no offsite backup |
| Cost-effective | ✅ Yes | Single VPS + one Cloudflare change (D.5) is close to optimal |
| Maintainable | ✅ Yes | Module boundaries and the "no controller→Prisma" rule are good |
| Scalable | ✅ For 5+ years at realistic LEI traffic | Extraction path documented and not prematurely taken |
| Secure | ⚠️ Baseline good, gaps real | See **E** |
| Suitable for Release 1 | ✅ With the scope cuts in **I** | |

**The stack itself needs no changes.** Next.js + NestJS/Fastify + Prisma + MySQL + Docker on a
Hostinger VPS is a defensible, boring, cost-appropriate choice, and the documents resist every
obvious temptation to over-build. I have no alternative stack to propose.

### D.2 Backend — findings

**✅ Keep as specified:**
- Modular monolith, one deployable. Correct.
- "Controllers must not query Prisma directly" (BACKEND §21) — enforce with an ESLint rule
  importing `PrismaService` outside `*.service.ts`, otherwise it will erode by week three.
- "No arbitrary cross-module table access" — same, enforce mechanically.
- `SearchService` provider abstraction for the future Meilisearch swap. Cheap and correct.
- Quote revision immutability. Correct and important.
- Soft-delete for catalogue items referenced by historical quotes/orders. Correct.

**⚠️ Change or add:**

**D.2.1 — Refresh token rotation needs a token store.** BACKEND §7 specifies refresh-token
rotation but no storage. Rotation without persistence cannot detect **token reuse**, which is
the entire security benefit of rotating. Add a `refresh_tokens` table (or Redis keyspace):
`jti`, `user_id`, `family_id`, `issued_at`, `expires_at`, `revoked_at`, `replaced_by`,
`user_agent`, `ip`. On presentation of an already-rotated token, revoke the whole family and
force re-login. ~4h, non-negotiable if rotation is claimed.

**D.2.2 — `function`/`department` should drive permission *templates*, not permissions.**
When SUPER_ADMIN assigns `department = SALES`, the UI should pre-fill the standard Sales
permission set from DB §2, which the SUPER_ADMIN can then adjust. The guard must read only
`admin_permissions`, never `department`. Otherwise you have two sources of authorization
truth that will diverge.

**D.2.3 — Permission guard must be deny-by-default.** Specify explicitly: an endpoint with no
`@RequirePermission()` decorator is **denied**, not open. Add a startup assertion that
enumerates all registered routes and fails boot if any non-public route lacks a decorator.
This single mechanism prevents the most common RBAC failure mode — the endpoint someone
forgot to guard. ~3h, very high value.

**D.2.4 — Audit logging belongs in an interceptor, not in each service.** BACKEND §14 defines
the table but not the mechanism. Implement one `AuditInterceptor` driven by a decorator, with a
**field redaction allowlist** so `password_hash`, tokens and full PII never enter
`old_values_json`/`new_values_json`. Writing audit calls by hand in 30 services guarantees gaps.

**D.2.5 — Define a Redis-unavailable policy.** If Redis is down: rate limiting should **fail
open** (serve traffic, log loudly) while refresh-token reuse detection should **fail closed**
(reject). Unspecified failure modes become outages.

**D.2.6 — Add a real `/health` endpoint.** UptimeRobot hitting `/` only proves Nginx is alive.
Expose `/health` returning DB connectivity, Redis connectivity, migration state and build SHA;
point UptimeRobot at that.

### D.3 Database — findings

The schema is largely well-normalized. Findings ordered by severity.

**🔴 D.3.1 — Money must be `DECIMAL`, never `Float`.**
No document specifies numeric types. Prisma's `Decimal` defaults to `DECIMAL(65,30)` in MySQL,
and a careless `Float` produces the classic rounding artifacts on quote totals. Mandate:

```
price, unit_price, subtotal, discount, tax, total  →  @db.Decimal(12, 2)
```

A quote that totals ₹1,24,999.99 in the admin panel and ₹1,24,999.98 on the PDF is a
commercial credibility problem, and this costs nothing to prevent.

**🔴 D.3.2 — No GST / HSN support, despite `customers.gstin` existing.**
`quote_revisions` has a single flat `tax` column. Indian B2B quotations and invoices require
HSN/SAC codes per line and a CGST/SGST vs IGST split determined by place of supply. Minimum
viable addition:
- `products.hsn_code`, `services.sac_code`
- `quote_revision_items.tax_rate`, `tax_amount`
- `quote_revisions.cgst`, `sgst`, `igst` (keep `tax` as the computed total)
- `customers.state_code` to drive intra- vs inter-state determination

This is not gold-plating; a quote without HSN and a correct GST split is not usable by LEI's
customers' accounts departments, which defeats the purpose of generating it. ~8h.

**🔴 D.3.3 — Missing `enquiry_items`.** See **C-1**. Blocker.

**🟠 D.3.4 — EAV numeric filtering will not work as specified.**
`product_attribute_values.value` is a string, indexed as `(attribute_id, value(100))`.
For a technical parts catalogue, the most valuable filters are numeric ranges — nozzle
diameter 1.0–3.0 mm, power 1000–6000 W, focal length. String comparison sorts `"10"` before
`"9"`. Add:

```
product_attribute_values.value_decimal  DECIMAL(14,4)  NULL
INDEX (attribute_id, value_decimal)
```

Populate it whenever `attributes.data_type` is numeric; range filters use `value_decimal`,
text filters use `value`. ~4h and it prevents a wrong-results bug that is very hard to notice.

**🟠 D.3.5 — Part-number search needs a normalized column.**
BACKEND §11's pipeline correctly puts "Exact SKU / Part Number match" *before* full-text —
but the schema has nothing to match against. Real part numbers look like `D28 H15`,
`M11-H15`, `D27.9 T4.1`. MySQL `FULLTEXT` tokenizes on punctuation and drops tokens under
`innodb_ft_min_token_size` (default 3), so `D28 H15` and `D28-H15` behave inconsistently and
short fragments vanish. Add:

```
products.search_key  VARCHAR(255)   -- UPPER(part_number + sku + name), non-alphanumerics stripped
INDEX (search_key)                   -- supports exact and prefix match
```

Try exact → prefix → `FULLTEXT` in that order. ~5h. Without it, a customer typing their exact
part number may get zero results — the single worst outcome for this site.

**🟠 D.3.6 — Guest enquiry has no customer record.**
Guests can submit enquiries (TIMELINE Rev 1.1), but `enquiries.customer_id` is a non-nullable
FK and guests have no `customers` row. Recommended resolution:

1. On submission, **find-or-create** a `customers` row keyed on normalized email
   (lowercased, trimmed) — and if absent, normalized phone (E.164).
2. **Snapshot the submitted contact details onto the enquiry itself**
   (`contact_name`, `contact_email`, `contact_phone`, `contact_company`).
3. Add a `customers.is_verified` flag, false for auto-created records.

The snapshot in step 2 matters: if sales later corrects a company name on the customer record,
the historical enquiry must still show what was actually submitted. Without it you lose the
audit trail on your own lead data.

**🟠 D.3.7 — Quote acceptance is not recorded on the quote.**
`quotes` has `current_revision_id` and `status`, but when `status = ACCEPTED` there is no record
of *which* revision was accepted until an order exists. If a quote is accepted but the order is
created later (or never), that information is unrecoverable. Add
`quotes.accepted_revision_id (FK, nullable)` and `quotes.accepted_at`.

**🟡 D.3.8 — Circular FK between `quotes` and `quote_revisions`.**
`quotes.current_revision_id → quote_revisions.id` and `quote_revisions.quote_id → quotes.id`.
Legal in MySQL with a nullable column, but Prisma needs an explicit relation name on both
sides and creation must be a two-step insert inside one transaction. Flag it now so it is not
discovered during the first migration.

**🟡 D.3.9 — Charset and collation must be specified.**
Hindi translation tables are in scope. Mandate **`utf8mb4`** with
**`utf8mb4_0900_ai_ci`** (MySQL 8.0+) at database, table and connection level. Legacy
`utf8` (3-byte) cannot store the full range and will corrupt Devanagari and emoji.
Also pin **MySQL 8.0+** explicitly — no document states a version, and 5.7 lacks the
collation, functional indexes and CTEs this schema benefits from.

**🟡 D.3.10 — Status enums are referenced everywhere and defined nowhere.**
`enquiries.status`, `leads.status`, `leads.priority`, `leads.source`, `service_requests.status`,
`quotes.status`, `orders.status`, `inventory.stock_status`, `customers.status`,
`products.product_type`, `services.pricing_type` — eleven enums, zero definitions. These must
be enumerated before schema work (it is a 30-minute exercise) or they will be invented
inconsistently across modules. See **K-6**.

**🟡 D.3.11 — Missing unique constraints.**
DB §18 specifies `UNIQUE(slug)` on `products` but not on `categories`, `services`,
`part_brands`, `machine_brands`, or `service_categories` — all of which are addressed by slug
in public URLs. Add `UNIQUE(slug)` to each. Add `UNIQUE(machine_model_id, name)` on
`machine_variants`. Add `UNIQUE(product_id, attribute_id)` on `product_attribute_values` and
`UNIQUE(product_id, machine_model_id, machine_variant_id)` on `product_compatibility` — both
are currently duplicable, which will produce duplicate rows in compatibility listings.

**🟡 D.3.12 — Missing table definitions.** Proposed shapes for the five tables from **C-8**:

```
customer_events                  sessions                       product_media
---------------                  --------                       -------------
id (PK)                          id (PK)                        id (PK)
customer_id (FK, nullable)       session_key (UNIQUE)           product_id (FK)
session_id (FK, nullable)        customer_id (FK, nullable)     file_id (FK files)
event_type (enum)                first_seen_at                  type  // IMAGE|PDF|VIDEO
entity_type / entity_id          last_seen_at                   alt_text        ← SEO + a11y
metadata_json                    ip_address                     sort_order
ip_address / user_agent          user_agent                     is_primary
created_at                       referrer / utm_*               created_at

files                                        service_request_attachments
-----                                        ---------------------------
id (PK)                                      id (PK)
original_name / stored_name / path           service_request_id (FK)
mime_type / extension / size_bytes           file_id (FK files)
checksum_sha256      ← dedupe + integrity    created_at
uploaded_by (FK users, nullable)
context  // PRODUCT|SERVICE|DOCUMENT|QUOTE|SERVICE_REQUEST
created_at
```

A single `files` table with typed join tables (`product_media`,
`service_request_attachments`, quote attachments) is preferable to per-context file
columns — one upload/validation/cleanup path instead of five.

**🟡 D.3.13 — No retention policy on the two fastest-growing tables.**
`customer_events` and `admin_audit_logs` grow without bound and will dominate the database
within a year. Define retention now (suggest: raw events 180 days then aggregate; audit logs
retained 3 years) and add a scheduled prune job. Cheap now, painful later.

### D.4 Infrastructure — findings

**🔴 D.4.1 — Backups on the same VPS are not backups.**
TIMELINE §7 says "Automate database backups on the VPS from the beginning." A `mysqldump`
written to the same disk as the database protects against `DROP TABLE` and nothing else —
not disk failure, not VPS termination, not ransomware, not a compromised host. **Mandatory:**
nightly encrypted dump pushed **off-host** (Backblaze B2 or Cloudflare R2, ~₹50–100/month),
plus a **documented, tested restore procedure**. BACKEND §15 already says "test restoration
before launch" — good — extend it to require offsite storage.

**🟠 D.4.2 — No staging environment.**
CI defines `dev → PR → main`, with no environment attached to either. When Build Phase 12
begins, the first deployment target is production. Recommend a second Docker Compose project
on the same VPS (different ports, separate DB) serving `staging.laserxprts.com` behind HTTP
basic auth and `noindex`. Cost: ~0. Value: every deployment is rehearsed.

**🟠 D.4.3 — Single point of failure with no defined recovery time.**
One VPS runs Nginx, Next.js, NestJS, MySQL and Redis. This is *acceptable* for MVP, but
document the consequence: host loss = full outage until restore. Combined with D.4.1, a
documented restore path turns an existential risk into a few hours of downtime.

**🟡 D.4.4 — `.env` on the VPS needs explicit handling.** Specify `chmod 600`, owned by the
deploy user, never inside the build context, never in the Docker image layer. Add
`.env*` (except `.env.example`) to `.dockerignore` as well as `.gitignore`.

**🟡 D.4.5 — Container resource limits.** MySQL and Next.js SSR on one box will contend.
Set explicit `mem_limit` in Compose so a Next.js memory spike cannot OOM-kill MySQL.

### D.5 One infrastructure addition worth making

**Put Cloudflare (free tier) in front of the VPS.** DNS-level change only, no application
changes, no vendor lock-in:

- CDN caching for `/uploads/*` and Next.js static assets — the single largest LCP win
  available for an image-heavy catalogue served from one Indian VPS
- Free TLS + automatic renewal, removing a Build Phase 12 task
- DDoS absorption and basic WAF on the public forms
- Origin IP concealment

This does not violate "avoid unnecessary services" — it removes work from Build Phase 12 while
improving the metric (Core Web Vitals) that TIMELINE Phase 10 exists to serve.

### D.6 What is over-engineered — challenge these

| Item | Documents say | Challenge | Recommendation |
|---|---|---|---|
| **Redis caching** | "sessions/cart/rate limiting", "short-lived cache" | At LEI's traffic, a cache layer in front of an indexed MySQL on the same host adds an invalidation bug surface for negligible gain | Keep Redis **only** for rate limiting + refresh-token family tracking. Build **no** application cache in R1 |
| **Attributes EAV admin UI** | Full CRUD on `attributes` with `data_type`, `is_filterable`, `is_searchable`, `sort_order` | Attributes change a few times a year, not daily | Seed via migration; ship a **read-only list + minimal create form**. Saves ~8h |
| **Content/SEO: Pages + FAQs** | DB §15 admin structure | This is a small CMS. About/Contact/Terms/Privacy change ~twice a year | Hardcode static pages as Next.js routes in R1. **Defer the CMS.** Saves ~15h |
| **Reports module** | "Basic reports" / "Reports: Full/Assigned" | Unbounded requirement — "reports" can absorb infinite time | R1 = **6 fixed dashboard tiles**, no report builder, no export designer. Saves ~12h |
| **Orders fulfilment tracking** | Full CONFIRMED→PACKED→SHIPPED→DELIVERED + courier + tracking | The value of this platform is discovery→enquiry→quote. Orders are ~5% of the traffic and 100% internal | R1 = order record + status field only. **Defer courier/tracking/timestamps UI.** Saves ~15h |
| **Translation tables** | en/hi in R1 | Correct to build the *tables*; wrong to build the *UI* with no Hindi content scheduled | **Create the tables** (avoids a later migration), build **no** locale routing, hreflang, or translation admin UI in R1 |

Total recoverable: **~50 hours** — a meaningful share of the gap identified in **K-1**.

### D.7 What is under-engineered — these are missing, not over-built

| Missing | Why it blocks R1 | Est. |
|---|---|---|
| **Email / notifications** | No SMTP provider chosen in any document. Enquiry confirmation to customer + alert to sales is the minimum viable loop. Without it the enquiry lands in a database nobody is watching | 12h |
| **Quote PDF generation** | Sales has no artifact to send. See **K-2** | 10h |
| **Bulk product import (CSV)** | Entering hundreds of SKUs with attributes and compatibility rows through a web form is not viable. **This is the most impactful omission in all four documents** | 15h |
| **Spam protection on public forms** | Public unauthenticated enquiry form on a lead-gen site will be scraped and spammed within weeks, poisoning the lead pipeline the system exists to build | 4h |
| **Admin password reset** | No flow specified. First forgotten password becomes a manual DB edit | 5h |
| **Offsite backup** | See D.4.1 | 4h |

---

## E. Security Review

### E.1 Strengths

The security baseline is genuinely above average for a project this size:

- ✅ **Argon2id** — correct choice, better than bcrypt for new work
- ✅ **Refresh token in HttpOnly + Secure + SameSite cookie**, explicit "never localStorage"
- ✅ **Two-role model with explicit permission rows** — auditable and simple
- ✅ **CORS whitelist** rather than wildcard
- ✅ **DTO validation before business logic**
- ✅ **Audit logging** of sensitive operations
- ✅ **Upload validation** (MIME, extension, size) with backend-controlled paths
- ✅ **"Never expose internal database or storage paths to the browser"**
- ✅ **Secrets in env vars**, `.env.example` only in the repo

### E.2 Gaps, ordered by severity

**🔴 E.2.1 — SVG uploads are stored XSS.**
BACKEND §12 validates MIME and extension but does not restrict types. An uploaded `.svg`
containing `<script>` served from the application origin executes with full access to the
admin session. Given that admins upload product and brand logos, this is a realistic
admin-account-takeover path.
**Fix:** Allowlist `image/jpeg`, `image/png`, `image/webp`, `application/pdf` only.
**Block SVG.** Verify by magic bytes, not by the client-supplied `Content-Type` header.
Re-encode all raster uploads through `sharp` (strips embedded payloads and EXIF).

**🔴 E.2.2 — `/uploads` served by Nginx needs hardening.**
Serving a user-writable directory from the web root risks execution and content-sniffing
attacks.
**Fix:** In the Nginx location block — no PHP/CGI handler, `add_header X-Content-Type-Options
nosniff`, `Content-Disposition: attachment` for PDFs, `default_type application/octet-stream`,
and disable directory listing. Ideally store uploads outside the web root and serve via
`X-Accel-Redirect`.

**🔴 E.2.3 — Public forms have no anti-abuse protection.**
`POST /api/v1/enquiries`, service requests and `POST /api/v1/analytics/events` are all
unauthenticated. The analytics endpoint in particular accepts writes from anyone with a
browser and will be used to poison your business intelligence, inflate `customer_events`, and
create junk `customers` rows via auto-creation (D.3.6).
**Fix:** honeypot field + minimum time-on-form + per-IP rate limit on enquiry endpoints;
strict server-side event-type enum with **no free-form metadata storage** and an aggressive
per-session rate limit on the analytics endpoint. Add Cloudflare Turnstile (free, privacy-
respecting, no Google dependency) if spam appears.

**🔴 E.2.4 — Refresh rotation without reuse detection.** See **D.2.1**. Rotation that cannot
detect replay provides the operational cost of rotation with none of the security benefit.

**🟠 E.2.5 — No account lockout or brute-force policy.**
"Rate limiting" is listed generically. Login needs specific treatment.
**Fix:** progressive delay + lockout after N failures per account *and* per IP; log
`ADMIN_LOGIN_FAILED` to the audit table; alert SUPER_ADMIN on repeated failures.
Ensure login timing does not reveal whether an email exists.

**🟠 E.2.6 — No password policy and no reset flow.**
Neither minimum strength, nor rotation, nor reset appears in any document. An admin panel
with no password reset means the first lockout is resolved by hand-editing the database.
**Fix:** minimum 12 characters checked against a common-password list (not composition rules);
single-use, time-limited, hashed-at-rest reset tokens; invalidate all refresh token families
on password change.

**🟠 E.2.7 — Audit log will capture secrets and PII.**
`old_values_json` / `new_values_json` on a `users` update will contain `password_hash`; on a
`customers` update, full PII.
**Fix:** field-level redaction **allowlist** (not denylist) in the audit interceptor.
Never log credential fields at all.

**🟠 E.2.8 — No CSRF strategy for the admin panel.**
Refresh tokens in cookies are correct, but if the access token is also cookie-borne, every
admin mutation is CSRF-exposed.
**Fix:** access token in memory (JS variable, never persisted), cookie for refresh only,
`SameSite=Strict` on the refresh cookie, and the refresh endpoint additionally protected by
an `Origin`/`Referer` check. Document this explicitly — it is currently ambiguous.

**🟠 E.2.9 — No privacy/data-protection posture. DPDP Act 2023 applies.**
The system collects names, emails, phone numbers, company names, GSTINs, addresses and
behavioural tracking data on Indian residents. No document mentions a privacy policy,
consent, retention, subject access, or deletion.
**Fix for R1 (minimum viable):** publish a privacy policy and terms page; add a consent
checkbox with explicit purpose on every form that collects PII; define retention (D.3.13);
document a manual data-deletion procedure. This is a legal prerequisite for launch, not a
nice-to-have.

**🟡 E.2.10 — IDOR risk on admin detail endpoints.**
Permission checks are module-level (`can_view` on `Customers`). Verify that
`GET /api/v1/customers/:id` also enforces any ownership/assignment scoping the business
expects — otherwise every Sales admin can read every customer regardless of assignment. If
that is intentional, state it; if not, the guard needs a row-level component.

**🟡 E.2.11 — No SUPER_ADMIN 2FA.** Acceptable to defer for R1, but the SUPER_ADMIN account
holds full access to all customer PII and commercial data. Recommend TOTP for SUPER_ADMIN in
Release 2, and IP-allowlist the `/admin` route at Nginx in the interim if LEI has static IPs.

**🟡 E.2.12 — Dependency scanning is `npm audit` only.**
CI §5 relies on `npm audit`, which is noisy and misses non-npm risks.
**Fix:** enable Dependabot (free), add `gitleaks` or `trufflehog` for committed secrets — CI §5
lists "accidentally committed secrets" as a check but names no tool.

**🟡 E.2.13 — Error responses must not leak internals.** Specify a global exception filter
that returns generic messages in production; Prisma errors in particular expose table and
column names.

### E.3 OWASP Top 10 coverage

| Risk | Covered? | Note |
|---|---|---|
| A01 Broken Access Control | ⚠️ Partial | Model is good; needs deny-by-default (D.2.3) + IDOR review (E.2.10) |
| A02 Cryptographic Failures | ✅ Mostly | Argon2id, TLS. Add: reset tokens hashed at rest |
| A03 Injection | ✅ Good | Prisma parameterizes. ⚠️ Any raw SQL for `FULLTEXT` must use bound params |
| A04 Insecure Design | ⚠️ Gaps | No threat model. C-2 and C-4 are design-level issues |
| A05 Security Misconfiguration | ⚠️ Gaps | Helmet ✅; `/uploads` hardening and Nginx config missing (E.2.2) |
| A06 Vulnerable Components | ⚠️ Partial | `npm audit` only; add Dependabot |
| A07 Auth Failures | ⚠️ Gaps | No lockout, no password policy, no reset, no reuse detection |
| A08 Data Integrity Failures | ✅ Good | Rev 1.1 corrections address this well |
| A09 Logging Failures | ⚠️ Partial | Audit logging ✅; no security event monitoring or alerting |
| A10 SSRF | ✅ N/A | No server-side fetching of user-supplied URLs in scope |

---

## F. Performance Review

### F.1 The largest risk: everything on one box

Nginx + Next.js SSR + NestJS + MySQL + Redis + image serving on a single Hostinger VPS.
Under load, **Next.js SSR and MySQL will contend for the same CPU**, and each makes the other
slower. Mitigations in priority order:

1. **Cloudflare in front (D.5)** — removes static and image traffic from the origin entirely.
   Highest impact, lowest effort.
2. **ISR instead of SSR for catalogue pages** — see F.2.
3. **Pre-generate image derivatives at upload** — see F.3.
4. **Container memory limits** — see D.4.5.

### F.2 Challenge the rendering strategy

**BACKEND §15 says:** "Prefer server-side rendering and server components in Next.js for public
catalogue pages."

**Challenge:** Product and category content changes a few times per week. Rendering every page
on every request burns CPU on the same box as the database, for content that is identical
between renders.

**Recommendation — per page type:**

| Page | Strategy | Reason |
|---|---|---|
| Homepage | **ISR**, revalidate 1h + on-demand | Near-static |
| Category pages | **ISR**, revalidate 1h + on-demand on product change | Near-static, highest SEO value |
| Product detail | **ISR**, revalidate 1h + on-demand on save | Highest page count, highest SEO value, rarely changes |
| Service pages | **ISR / static** | Essentially static |
| Search results | **SSR**, `noindex` | Genuinely dynamic |
| Filtered listings | **SSR**, `noindex` beyond canonical facets | Dynamic, see G.4 |
| Quote basket / forms | **Client** | Interactive, no SEO value |
| Admin panel | **CSR** | No SEO value, auth-gated |

Next.js on-demand revalidation triggered from the NestJS product-save handler gives near-instant
freshness *and* static performance. This is meaningfully better than blanket SSR for both
Core Web Vitals and hosting cost, and does not add architectural complexity.

### F.3 Images — the dominant factor for this site

A parts catalogue is images. Getting this wrong dominates every other performance decision.

- ⚠️ **Do not run `next/image` on-demand transforms against local storage on a small VPS.**
  Runtime `sharp` transforms will pin the CPU that MySQL needs.
- ✅ **Generate derivatives at upload time** (thumbnail 200px, card 400px, detail 800px, zoom
  1600px) in WebP + JPEG fallback, store paths in `product_media`. One-time cost per upload
  instead of per-request cost forever.
- ✅ Serve via Cloudflare with long `Cache-Control` and content-hashed filenames.
- ✅ `width`/`height` on every `<img>` to eliminate CLS.
- ✅ Lazy-load everything below the fold; the hero image should be `priority` + preloaded.
- ✅ **Compress source images before upload** — enforce a max upload dimension. Product photos
  arriving as 6 MB 4000px JPEGs from a phone is the normal case, not the exception.

### F.4 Database performance

**✅ The index set in DB §18 is well chosen.** Additions:

| Table | Add | Reason |
|---|---|---|
| `products` | `INDEX(is_active, category_id, created_at)` | Primary listing query shape |
| `products` | `UNIQUE(sku)`, `INDEX(search_key)` | SKU uniqueness is unenforced today; see D.3.5 |
| `product_attribute_values` | `INDEX(attribute_id, value_decimal)` | Numeric range filters, D.3.4 |
| `inventory` | `INDEX(stock_status)` | Low-stock dashboard tile |
| `leads` | `INDEX(status, assigned_to, created_at)` | Sales pipeline query |
| `quote_revisions` | `INDEX(quote_id, revision_number)` | Revision history |
| `enquiry_items` | `INDEX(enquiry_id)` | New table, C-1 |
| `customers` | `INDEX(email)`, `INDEX(phone)` | Required by the find-or-create in D.3.6 |
| `admin_audit_logs` | `INDEX(entity_type, entity_id, created_at)`, `INDEX(user_id, created_at)` | Audit lookup; unindexed today |
| `product_translations` etc. | `INDEX(locale)` | Locale-scoped queries |

**⚠️ The N+1 trap is EAV on listing pages.** Rendering 24 product cards each with 6 attributes
naively produces 145 queries. Mandate a single batched query with `include`, and add a CI check
or dev-mode query counter that fails when a page exceeds a threshold — this catches regressions
that code review misses.

**⚠️ Deep pagination.** `OFFSET 10000` scans 10,000 rows. Fine for R1 catalogue sizes; if any
listing exceeds ~10k rows, switch to keyset pagination. Note it, do not build it yet.

**⚠️ Faceted filter counts** ("Nozzles (128)") require an aggregate per facet per request and
are a classic hidden cost. For R1, either cache counts per category (refreshed on product save)
or omit the counts. The MOCKUP shows counts on category cards — cache them.

### F.5 Frontend performance

- Bundle budget: **< 200 KB gzipped JS** on the initial route. Set it in CI now; retrofitting
  a budget after the fact never happens.
- The MOCKUP's three concurrent search affordances (header search, hero search, compatibility
  finder) each need their own JS. Consolidating (see H.2) is a performance win as well as a UX one.
- Fonts: self-host, `font-display: swap`, subset. Do not load Google Fonts from the CDN —
  it costs a DNS lookup, a connection and a privacy question.
- Target for mobile 4G in India: **LCP < 2.5s, INP < 200ms, CLS < 0.1**. No document sets targets;
  set these.

### F.6 API performance

- Every list endpoint paginated with an **enforced maximum page size** (`take: Math.min(limit, 100)`).
  BACKEND §15 says "never return unbounded lists" — enforce it in a shared DTO, not by convention.
- Explicit Prisma `select` on list endpoints; never return `description` blobs in a listing payload.
- The compatibility finder's cascading dropdowns (brand → model → category) mean 3 sequential
  round-trips before the user can act. Either preload the brand→model tree once (it is small
  and rarely changes) or serve it as one cacheable static JSON. Sequential round-trips on
  mobile 4G is exactly the friction the finder exists to remove.

---

## G. SEO Review

SEO is a first-order requirement here: LEI's customers search for exact part numbers and machine
model names. The specification's SEO section is a good checklist but leaves four structural
decisions unmade.

### G.1 Strengths
- ✅ SEO fields on `products`, `categories`, `services`
- ✅ Slug-based URLs throughout
- ✅ Dedicated 12-hour phase with sitemap, robots, canonical, OG, breadcrumbs, schema
- ✅ Next.js chosen partly for SEO — correct

### G.2 🔴 The subdomain question — unresolved and consequential

The working directory is **`shop.laserxprts.com`**, yet the MOCKUP navigation contains
`About LEI`, `Field Service`, `Remanufacturing` — pages that read like main-site content.

**This must be decided before any URL is built:**

- **Option A — replace `laserxprts.com` entirely.** Strongest SEO outcome: one domain, one
  authority pool, all content compounding. Requires a full 301 map from the existing site.
- **Option B — `shop.` subdomain alongside the existing site.** Splits authority between two
  hostnames, duplicates About/Services content across both (cannibalization), and requires
  careful cross-canonical work.
- **Option C — path-based on the main domain** (`laserxprts.com/shop/...`). Retains authority
  but requires routing at the existing site.

**Recommendation: Option A** if the existing site is small or being retired; **Option C**
otherwise. Option B is the weakest and it is the one the directory name implies is currently
assumed. **See K-4 — this is a blocking decision** because it determines URL structure,
canonical strategy, the redirect map and the sitemap, all of which are expensive to change later.

### G.3 🟠 `canonical_url` as a stored column is an anti-pattern

`products.canonical_url`, `categories.canonical_url` and `services.canonical_url` store absolute
URLs in the database. On any domain change, protocol change, or slug change, every stored value
silently rots and starts pointing at 404s — canonicals pointing to dead URLs are worse than no
canonical at all.

**Fix:** derive the canonical from the slug + a single `SITE_URL` env var at render time. Keep
the column **only as an optional override** for the rare cross-domain case, and default it to
`NULL`.

### G.4 🟠 Faceted filters will create a crawl-budget explosion

Filters on category (~10) × brand (~15) × 6 attributes × sort × pagination generates tens of
thousands of crawlable permutations of largely identical content. This is the single most
common SEO failure in parts catalogues, and no document addresses it.

**Fix — decide the indexable URL set explicitly:**

| URL pattern | Directive |
|---|---|
| `/products` | `index, follow` |
| `/category/{slug}` | `index, follow` |
| `/category/{slug}?page=N` | `index, follow`, self-canonical (do not canonicalize to page 1 — it deindexes deep products) |
| `/category/{slug}?brand={b}` | `index, follow` — **only** this one high-value facet |
| Any multi-facet combination | `noindex, follow` |
| `/search?q=...` | `noindex, follow` |
| `/products/{slug}` | `index, follow` |

Add matching `Disallow` rules in `robots.txt` for multi-facet query patterns, and exclude all
non-canonical facets from the sitemap.

### G.5 🟠 Structured data needs a decision on `price_type`

`products.price_type` allows `ON_REQUEST` / `CONTACT_SALES`. A `schema.org/Product` without a
valid `offers.price` will not earn rich results and may be flagged in Search Console.

**Fix:** for `FIXED` products emit full `Offer` with `price`, `priceCurrency: INR`,
`availability` from `inventory.stock_status`. For `ON_REQUEST` products emit
`Product` + `Offer` with `availability: InStock` and **omit price**, or use
`PriceSpecification` without a value. Do **not** emit a fake `0` price.

Also add: `Organization` (sitewide), `BreadcrumbList` (every page), `Service` (service pages),
`FAQPage` (where FAQs exist), `WebSite` + `SearchAction`.

### G.6 🟠 No hreflang or locale routing strategy

Translation tables are in scope but no document defines *how* Hindi is served — `/hi/` prefix?
subdomain? `Accept-Language`?

**Recommendation for R1:** build the tables, serve English only at the current paths, emit **no**
hreflang. When Hindi content is actually scheduled, use `/hi/{slug}` sub-paths with reciprocal
`hreflang` including `x-default`. Half-implemented hreflang is worse than none — it splits
ranking signals for pages that do not exist.

### G.7 🟡 Soft-deleted and inactive product pages

BACKEND §21 mandates soft deletion for referenced catalogue items. No document says what the
public page returns.

**Fix:** `is_active = false` or `deleted_at` set → return **HTTP 410 Gone** (or 404) with a
helpful page linking to the category and similar products, and remove from the sitemap. Never
return 200 with an empty page — that is a soft-404 and it degrades sitewide quality signals.

### G.8 🟡 Other gaps

- **Sitemap generation is unspecified.** Generate dynamically from the DB with accurate
  `lastmod` from `updated_at`; split into an index if it exceeds 50,000 URLs; exclude
  noindexed and inactive URLs. A stale sitemap is an active liability.
- **No image alt text field** anywhere — added to `product_media` in D.3.12. Alt text on parts
  photos matters for both image search and accessibility.
- **No `og:image` strategy for products** — `products.og_image` exists but there is no fallback
  rule when it is null. Fall back to primary product image, then a branded default.
- **No 301 redirect table.** If slugs change (they will), old URLs must redirect. Add a small
  `redirects` table (`from_path`, `to_path`, `status_code`) and auto-create a row whenever a
  slug changes. ~3h, saves accumulated ranking loss.
- **No internal linking specification** beyond "internal linking" in Phase 10. The
  highest-value internal links here are *compatibility-driven*: "Other parts for Raytools BM110".
  This is unique, genuinely useful content that competitors cannot easily replicate, and the
  compatibility data to generate it already exists. Make it explicit.

---

## H. UI/UX Review

Reviewed against the MOCKUP and the (thin) UX content in the specifications.

### H.1 Strengths of the mockup

- ✅ **"Find Parts That Fit Your Machine"** (brand → model → category) is the single best element
  in the design. It matches exactly how this customer shops and it is backed by real
  compatibility data. **This must be a Release 1 must-have**, not a nice-to-have.
- ✅ Trust bar (genuine parts, pan-India delivery, expert support) addresses the real objection
  in this market — counterfeit parts.
- ✅ Category tiles with product counts give immediate scale and orientation.
- ✅ "Popular Searches" chips reduce the blank-search-box problem.
- ✅ "Need Bulk Orders?" panel targets the highest-value segment directly.
- ✅ Mobile layout is coherent and shows real thought, not a desktop afterthought.
- ✅ Products show real part identifiers (`D27.9 T4.1`, `M11 H15`, `(Raytools BM110)`) — correct
  for this audience, who buy by part number.

### H.2 🟠 Three search entry points compete on one screen

The homepage has a header search, a hero search, **and** the compatibility finder. Three
overlapping affordances create decision friction at precisely the moment of highest intent, and
triple the JS.

**Recommendation:** Keep the hero search (largest, most prominent) and the compatibility finder
(different job — browse by machine, not by keyword). Make the header search **collapse to an
icon** that expands on click, and become the primary search only once the hero scrolls out of
view. One keyword-search affordance visible at any time.

### H.3 🟠 "Add to Quote" needs visible, honest state

The basket badge shows `2` but the mockup does not show what happens on click, where the basket
lives, or how a user reviews it. This is the primary conversion path and it is unspecified.

**Required for R1:**
- Immediate feedback on add (toast + badge increment + brief button state change)
- A basket **drawer** (not a full page navigation — never interrupt browsing)
- A quote request review page: edit quantities, remove lines, add per-line notes
  (*"need the 1.5 mm variant"*), add machine context once for the whole request
- **Persistence across sessions** via `localStorage`, with a clear indication that it is
  device-local
- Empty state that actively guides toward the compatibility finder

### H.4 🟠 Prices are shown publicly — confirm this is intended

The mockup shows ₹850.00, ₹420.00, ₹1,250.00 on product cards. `price_type` supports
`ON_REQUEST` and `CONTACT_SALES`, so the schema anticipates hidden prices.

This is a **business decision with real consequences**: public prices improve SEO
(`schema.org/Offer`), conversion and trust, but expose margins to competitors and undermine
negotiated B2B pricing. **See K-7.** Whichever way it goes, the product card needs a designed
treatment for the `ON_REQUEST` case — "Price on request" with the same visual weight, never a
blank space where a price should be.

### H.5 🟠 Accessibility is absent from all four documents

No document mentions accessibility. For R1, target **WCAG 2.1 AA** on the public site:

- ⚠️ **Contrast check the yellow CTA.** Yellow (~`#F5B301`) with *white* text fails AA badly
  (~1.8:1). With near-black text it passes comfortably. The mockup appears to use dark text —
  verify and lock it in the design tokens.
- ⚠️ Yellow-on-dark-navy for the "Peak Performance." headline needs verification at that size.
- Keyboard navigation through the compatibility finder's three dependent dropdowns
- Visible focus indicators (do not remove the default outline without replacing it)
- Form labels bound to inputs; errors associated via `aria-describedby`
- `alt` on all product images (requires the field added in D.3.12)
- Semantic landmarks (`header`, `nav`, `main`, `footer`) — free, and also helps SEO
- Live-region announcement when items are added to the quote basket
- Minimum 44×44px touch targets on mobile

### H.6 🟠 State design is under-specified

TIMELINE Phase 3 mentions "loading/error states" in passing. That is not enough for a catalogue
with filtering and search. Specify and build once, as shared components:

| State | Requirement |
|---|---|
| **Loading** | Skeletons matching final layout (not spinners) to prevent CLS |
| **Empty — search** | "No parts matched *X*" + spelling suggestion + popular searches + link to the compatibility finder + "Can't find it? Request a quote" |
| **Empty — filters** | Show which filter is over-constraining, with one-click removal |
| **Empty — basket** | Guide to the compatibility finder |
| **Error** | Actionable message + retry, never a raw error code |
| **Success** | Enquiry submitted → reference number, expected response time, what happens next |
| **Offline / slow** | Graceful degradation on 3G |

**The most important of these is the empty search state.** A customer typing a part number LEI
does not stock is a *qualified lead*, not a dead end. "We don't list that part — request it and
we'll source it" converts a bounce into an enquiry. This should be an explicit requirement.

### H.7 🟡 Enquiry form friction

The enquiry form is the conversion point. Every field is a drop-off.

**Recommend for R1:** name, phone, email, company (optional), message. Machine context should be
**inherited automatically** from the compatibility finder or product page — never re-asked.
GSTIN is a *sales* field, collected later by the sales admin, **not** on the public form.
Make phone-or-email required rather than both. Show a clear response-time expectation.

### H.8 🟡 Admin UX

~30 admin screens are described with no UX guidance. Two decisions worth making once:

- **One list-view pattern** reused everywhere (search + filter + sort + paginate + bulk actions),
  built as a single configurable component. Building 30 bespoke tables is where the admin panel
  overrun in **K-1** actually comes from.
- **Permission-aware UI**: hide what the user cannot access rather than showing errors on click.
  This must be driven by the same `admin_permissions` payload the backend guard uses, delivered
  once at login — never by re-deriving rules on the client.

### H.9 🟡 Remove non-functional controls

Per **C-2** and **C-3**: remove "Login / Register", "Track Order" and the "Secure Payments"
badge from the R1 header/trust bar. A control that does nothing damages more trust than the
absence of the feature.

---

## I. Release 1 Scope (the "Phase 1" for approval)

Scoped to fit a realistic budget while delivering a coherent, launchable product.
**Theme: technical discovery → qualified enquiry → quote.** Everything not serving that
sentence is deferred.

### I.1 MUST HAVE — Release 1

**Foundation**
- Monorepo (`apps/web`, `apps/api`, `packages/shared-types`), Docker Compose (MySQL 8 + Redis),
  env config, structured logging
- Three GitHub Actions workflows exactly as CI specifies — `ci.yml`, `database.yml`, `security.yml`
- Branch protection on `main` per CI §9

**Database**
- Full Prisma schema with every correction from **C** and **D** applied
- Includes the five missing tables (**C-8**), `enquiry_items` (**C-1**), `refresh_tokens` (**D.2.1**),
  `redirects` (**G.8**)
- `DECIMAL(12,2)` money, `utf8mb4_0900_ai_ci`, all enums enumerated (**K-6**)
- Seed data: 1 SUPER_ADMIN, 1 ADMIN per function, machine brands/models, attributes, categories

**Auth & RBAC**
- JWT access (in-memory) + refresh rotation with **reuse detection**
- Argon2id, login lockout, admin password reset
- Deny-by-default permission guard + boot-time route assertion (**D.2.3**)
- Audit interceptor with field redaction (**D.2.4**)

**Catalogue (backend + admin)**
- Products, categories (nested), part brands, attributes + values, compatibility, inventory, media
- **CSV import for products, attributes and compatibility** ← non-negotiable for launch
- Machine brands / models / variants

**Services**
- Service categories, services, service requests → auto-create `lead_type=SERVICE` lead

**Sales**
- Customers (find-or-create on enquiry, with contact snapshot)
- Enquiries + `enquiry_items`, leads, quotes + immutable revisions + items
- **Quote PDF generation and email delivery**
- Orders: **record + status only** (created from accepted revision, carries `quote_revision_id`)

**Public site**
- Homepage per MOCKUP (minus the three removals in **H.9**)
- Category pages, product listing with filters/sort/pagination, product detail
- **Compatibility finder** (brand → model → category)
- Search (exact → prefix → full-text, per **D.3.5**)
- Services listing + detail
- **Quote basket** (localStorage) + review page + multi-item submission
- Contact page, WhatsApp/phone deeplinks
- Static pages: About, Contact, **Terms, Privacy** (legally required, **E.2.9**)

**Cross-cutting**
- Transactional email: enquiry confirmation to customer, alert to sales, quote delivery
- Spam protection on all public forms
- Analytics event capture (validated enum, rate-limited) + GA4
- SEO: metadata, derived canonicals, OG, dynamic sitemap, robots, breadcrumbs, structured data,
  the indexable-URL policy from **G.4**
- Security hardening per **E**
- Deployment: Nginx, TLS, Cloudflare, Docker Compose, **offsite backup with a tested restore**

**Admin panel (~18 screens, one reusable list pattern)**
- Dashboard (6 fixed tiles) · Products · Categories · Part Brands · Attributes (minimal)
- Compatibility · Inventory · Machine Brands/Models/Variants · Services · Service Requests
- Enquiries · Leads · Quotes + Revisions · Customers · Orders (list/detail only)
- Admin Users + Permissions · Audit Log viewer

### I.2 SHOULD HAVE — Release 1 (build if the budget holds)

- Related products on the product detail page
- "Other parts for {machine model}" compatibility-driven internal linking (**G.8**) — high SEO value
- Customer activity timeline in the admin panel
- Brochure/datasheet downloads on product pages
- Bulk enquiry form (the "Need Bulk Orders?" panel)
- Low-stock dashboard tile
- Product comparison (2–3 items)
- Recently viewed products

### I.3 DEFERRED — explicitly not Release 1

| Deferred | Reason | Target |
|---|---|---|
| Cart, checkout, payments | Out of business scope | When online sales are approved |
| Customer login / accounts | Deferred per spec; needs separate `customer_accounts` (**C-2**) | R2 |
| Order tracking (public) | Requires auth or tokenized links (**C-4**) | R2 |
| Full order fulfilment UI (courier, packed/shipped/delivered) | Low traffic, internal, high build cost | R2 |
| Hindi UI, locale routing, hreflang | Tables built, no content scheduled (**G.6**) | When content is scheduled |
| Pages/FAQ CMS | Hardcode static pages instead | R2 |
| Reports module | 6 fixed tiles instead | R2 |
| Meilisearch | MySQL FT + normalized key is sufficient at this catalogue size | When search quality complaints appear |
| Object storage (R2/B2) | Local + Cloudflare is sufficient | When volume justifies it |
| AI / semantic / vector search | Correctly excluded by the spec | Post-R2 |
| Lead scoring | `leads.score` column exists, unused | R2 |
| SUPER_ADMIN 2FA | Mitigate with IP allowlist in the interim | R2 |
| Attributes full CRUD admin | Seed via migration | R2 |
| Staging environment | Recommended but not blocking | Add at Build Phase 12 if budget allows |

### I.4 MISSING REQUIREMENTS — should exist, absent from all documents

1. **Email/notification infrastructure** — no provider, no templates, no failure handling
2. **Quote PDF generation** — the workflow produces nothing sendable
3. **Bulk data import** — the catalogue cannot realistically be populated without it
4. **Spam protection** on public forms
5. **Admin password reset**
6. **Privacy policy, terms, consent** — DPDP Act 2023
7. **GST/HSN** on quotes — despite `customers.gstin` existing
8. **Accessibility requirements** — entirely absent
9. **Offsite backup**
10. **Success metrics** — nothing to evaluate the launch against
11. **Content readiness plan** — TIMELINE §4 names product-data readiness as the main
    schedule risk but no document plans for it. **See K-8.**
12. **Empty/error/loading state specifications** beyond a passing mention
13. **Enum definitions** for eleven status/type columns
14. **Retention policy** for events and audit logs
15. **404/410 behaviour** for soft-deleted products

### I.5 BLOCKERS — resolve before implementation

See section **K**.

---

## J. Deferred Features — what must NOT be built yet

Restating the discipline, because scope creep on these is the main schedule risk:

- ❌ **No cart, checkout, or payment code.** The quote basket is `localStorage` + `enquiry_items`.
  No basket table, no Redis basket, no server-side basket sync.
- ❌ **No customer authentication.** No `CUSTOMER` role, no customer password column, no
  customer JWT. Remove `customers.user_id`.
- ❌ **No Meilisearch, no Elasticsearch, no vector DB, no embeddings.**
- ❌ **No object storage migration.** Local + Cloudflare.
- ❌ **No microservices, no message queue, no event bus.** One deployable.
- ❌ **No application cache layer.** Redis is for rate limiting and refresh-token families only.
- ❌ **No CMS.** Static pages are Next.js routes.
- ❌ **No report builder.** Six fixed tiles.
- ❌ **No Hindi UI.** Tables only.
- ❌ **No GraphQL, no tRPC.** REST as specified.
- ❌ **No `deploy.yml`** until Build Phase 12, per CI §13.
- ❌ **No lead scoring algorithm.** The column stays null.

---

## K. Critical Decisions Requiring Approval

Eleven items. Most are minutes of decision, not days of work — but each one blocks or reshapes
implementation.

---

### 🔴 K-1. Budget vs. scope — the fundamental decision

The documented scope does not fit 175 hours. Bottom-up estimate for the full documented scope:
**~380–450 hours** (~30 admin screens alone are ~90h at a realistic 3h/screen; TIMELINE
allocates 18h for all of them).

Three viable paths:

| Option | Hours | Delivers |
|---|---|---|
| **A. Release 1 as scoped in section I** ⭐ | **~230–260** | Complete discovery→enquiry→quote product. Orders minimal, no CMS/reports/i18n UI |
| **B. Hold 175h firm, cut further** | **175** | Drop orders entirely, drop the audit log viewer, drop service requests admin, drop CSV import. **Not recommended** — dropping CSV import makes launch impractical |
| **C. Full documented scope** | **~400+** | Everything as written |

**Recommendation: Option A.** It preserves everything that generates business value, cuts only
internal-facing and future-facing work, and is honest about the number. If 175h is a hard
commercial constraint, say so and I will produce a defensible 175h cut — but it will not include
order management.

**This is the single most important decision in this review.**

---

### 🔴 K-2. How does a quote reach the customer, and how is it accepted?

The workflow ends at "Customer accepts" with no mechanism. Options:

| Option | Effort | Note |
|---|---|---|
| **A. PDF emailed; acceptance recorded manually by sales** ⭐ | ~12h | Matches how LEI almost certainly works today (phone/email/WhatsApp confirmation). Zero customer-facing auth |
| **B. PDF + signed tokenized accept/reject link** | ~20h | Self-service acceptance, timestamped, no login. Good R2 upgrade |
| **C. Customer portal** | ~50h | Requires customer auth. Out of R1 |

**Recommendation: A for R1, B in R2.** But **which email provider?** No document names one.
Suggest a transactional provider with good India deliverability (Amazon SES, Postmark, or Brevo)
over SMTP-from-the-VPS, which will land in spam.

---

### 🔴 K-3. Confirm the quote basket (C-1)

The MOCKUP requires it; the specs forbid "cart". Confirm the resolution in **C-1**:
`enquiry_items` + `localStorage` basket, named "Quote Request" throughout, **no** server-side
basket. ~4h schema + ~16h UI.

**Without this decision the homepage cannot be built as designed.**

---

### 🔴 K-4. Domain strategy (G.2)

`shop.laserxprts.com` vs `laserxprts.com` vs `laserxprts.com/shop`. Determines URL structure,
canonical strategy, the 301 map and the sitemap. **Expensive to change after launch.**
Need to know: does `laserxprts.com` exist today, what content is on it, and is it being retired?

---

### 🔴 K-5. Confirm removal of `customers.user_id` (C-2)

Security-relevant. Confirm that customer identity will live in a **separate table** when
customer login arrives, and that `users` stays admin-only.

---

### 🟠 K-6. Enum definitions (D.3.10)

Eleven status/type columns are referenced with no defined values. Needed before schema work:
`enquiries.status`, `leads.status`, `leads.priority`, `leads.source`, `service_requests.status`,
`quotes.status`, `orders.status`, `inventory.stock_status`, `customers.status`,
`products.product_type`, `services.pricing_type`.

I can propose a complete set for review — ~30 minutes — but they must reflect LEI's actual
sales process, not a generic CRM's.

---

### 🟠 K-7. Public pricing policy (H.4)

Show prices publicly, hide behind enquiry, or per-product via `price_type`?
Affects product cards, structured data, SEO and competitive exposure.
**Recommendation:** per-product `price_type`, defaulting to visible for standard consumables
and `ON_REQUEST` for high-value items (heads, retrofits, remanufacturing).

---

### 🟠 K-8. Content and catalogue data readiness

TIMELINE §4 identifies product-data readiness as the primary schedule risk and then does not
plan for it. Needed before Build Phase 5:

- How many SKUs at launch? (10? 200? 2,000? — changes the search, import and pagination design)
- Do product images exist, and at what quality?
- Does compatibility data exist in any structured form, or must it be built by hand?
- Who writes the product descriptions and SEO metadata?
- Which machine brands/models must be covered at launch?

**Realistically this is the most likely cause of a delayed launch**, more than any engineering
task in this review.

---

### 🟠 K-9. GST/HSN on quotes (D.3.2)

Does an LEI quotation need HSN codes and a CGST/SGST/IGST split to be usable by customers'
accounts departments? If yes (very likely for B2B industrial supply), it is ~8h and must be in
the schema from the start, not retrofitted onto existing quote records.

---

### 🟡 K-10. WhatsApp integration depth

Tracking events and the MOCKUP both include WhatsApp.
**Recommendation:** `wa.me` deeplink with a pre-filled message containing the part number —
~2h, no API, no cost, no approval process. Confirm the WhatsApp Business API is **not** expected
in R1.

---

### 🟡 K-11. Cloudflare approval (D.5)

Free tier, DNS-level, reversible. Removes TLS management from Build Phase 12 and is the largest
single performance win available. Needs approval only because it changes where DNS is hosted.

---

## L. Final Recommendation

### L.1 Overall

**Proceed — with the scope in section I and after resolving the blockers in section K.**

These are good specification documents. The architecture is appropriate, the technology choices
are sensible and cost-conscious, the data model is largely correct, and the Revision 1.1
corrections show real architectural discipline. The core insight — that machine compatibility is
the product, and that services must feed the same commercial pipeline as parts — is right, and
it is what will make this platform useful.

The problems are **not architectural**. They are:
1. **A scope/budget mismatch** (~2.5×) that will surface around hour 120 if not addressed now
2. **Three workflow holes** (quote basket, quote delivery, data import) where the design stops
   short of a working loop
3. **A set of security and SEO details** that are cheap now and expensive later

None require rethinking the stack. All are resolvable this week.

### L.2 Recommended sequence

| Step | Work | Effort |
|---|---|---|
| **0** | Resolve K-1 … K-11 | *Decisions* |
| **1** | Rewrite the schema doc with all corrections applied; define the enums; produce the final Prisma schema **for review before migrating** | 8h |
| **2** | Foundation: monorepo, Docker, CI (3 workflows), branch protection | 18h |
| **3** | Auth + RBAC + audit + refresh rotation with reuse detection | 30h |
| **4** | Catalogue + machines backend, **CSV import**, files/media | 45h |
| **5** | Design system + layout + shared state components | 28h |
| **6** | Homepage + catalogue frontend + compatibility finder + search | 50h |
| **7** | Services + enquiry/quote basket + email notifications | 32h |
| **8** | Admin panel (one list pattern, ~18 screens) | 55h |
| **9** | Quotes, revisions, PDF, minimal orders | 25h |
| **10** | SEO + analytics | 22h |
| **11** | Performance + security hardening | 20h |
| **12** | Deployment, Cloudflare, backups + **restore test**, QA | 28h |
| | **Total** | **~360h** |

To reach the ~230–260h of Option A, compress steps 8–9 (fewer admin screens, order list only)
and move the SHOULD-HAVE items in I.2 to R2. I can produce that cut precisely once K-1 is decided.

### L.3 First-demo target

TIMELINE §5 targets a demo at hour 40–50 showing homepage + listing + search + product detail +
service page + basic admin. **That is not reachable at hour 50** on the sequence above, because
auth/RBAC and the catalogue backend must exist first.

**Realistic demo checkpoints:**
- **Hour ~55** — Homepage + category + product listing against seeded data, responsive.
  Visually complete, commercially convincing. *This is the demo that matters to stakeholders.*
- **Hour ~95** — Search, compatibility finder, product detail, quote basket, enquiry submission
  end-to-end.
- **Hour ~150** — Admin panel operational; sales can work a real enquiry through to a quote PDF.

Alternatively, hour 40–50 is reachable **if the demo is frontend-only against seed/mock data** —
build the homepage and catalogue UI before the full backend. That is a legitimate strategy if an
early stakeholder demo matters more than build order efficiency. **Worth deciding explicitly.**

### L.4 The three things to fix even if everything else is rejected

1. **Add `enquiry_items`** — without it, the homepage's primary call to action has nowhere to
   write.
2. **Choose an email provider and build quote PDF delivery** — without it, the sales workflow
   does not complete.
3. **Build CSV import** — without it, the catalogue cannot be populated and there is nothing to
   launch.

---

## Awaiting Approval

**No code, schema, migration, component, API, page, configuration or test has been written.**

To proceed I need decisions on **K-1** through **K-11**, with **K-1** (budget vs. scope),
**K-3** (quote basket) and **K-4** (domain) being the ones that block schema and URL design.

On approval, implementation will follow:
**Phase 1 scope → architecture → database → backend → API → frontend → UI/UX → security →
testing → final review**, and will not exceed the approved scope.

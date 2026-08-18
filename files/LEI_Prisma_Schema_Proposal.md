# LEI — Complete Prisma Schema Proposal (Section B)

**Status: PROPOSAL FOR REVIEW — not a migration, not implementation code.**
**Date:** 18 August 2026 · **Target:** MySQL 8.0+ · `utf8mb4` / `utf8mb4_0900_ai_ci`

> This document is deliberately written as reviewable Prisma DSL because that is the
> clearest way to express types, relations, indexes and constraints together. **Nothing here
> has been generated, migrated, or written into an application directory.** On approval it
> becomes `apps/api/prisma/schema.prisma`.

---

## B.0 How to review this

The schema has **41 models** and **24 enums**. To make review tractable, every model carries
a `Slice 1?` marker:

| Marker | Meaning |
|---|---|
| 🟢 **S1** | Required for the Nozzles vertical slice. Built and populated in Phase 1. |
| 🟡 **S1-thin** | Table created in Phase 1, but only partially used/exercised by the slice. |
| ⚪ **Later** | Table created in the same migration (so no future schema churn), but no code touches it until Stage 4. |

**Why create ⚪ tables now instead of later?** Because adding a table later is easy, but
adding a *column to a table that already holds production quote data* is not. The tables
below are all reachable from the Phase 1 slice within one or two relations — creating them
together keeps foreign keys sane and means one migration instead of six.

**What I need from you on review:** correctness of the *business* meaning, not the syntax.
Specifically the enum values in **B.2** and the Product/Variant split in **B.3.1** — those
two encode assumptions about how LEI actually sells, and I could be wrong about both.

---

## B.1 Global conventions

| Convention | Decision | Reason |
|---|---|---|
| Primary keys | `Int @id @default(autoincrement())` | Simple, index-friendly, human-readable in admin URLs. Public URLs use slugs, so sequential IDs are never exposed on the storefront |
| Public identifiers | `slug` (catalogue), `publicId` (enquiries/quotes) | See B.3.11 — enquiry/quote references must **not** be enumerable |
| Money | `Decimal @db.Decimal(14, 2)` | Never `Float`. 14 digits covers ₹99,99,99,99,999.99 |
| Percentages/rates | `Decimal @db.Decimal(5, 2)` | GST rates: `18.00` |
| Physical measures | `Decimal @db.Decimal(14, 4)` | Nozzle diameters need 4dp (`1.5000`, `0.0250`) |
| Strings in unique indexes | `@db.VarChar(190)` max | Safe under every MySQL index-length configuration |
| Long text | `@db.Text` / `@db.MediumText` | Descriptions, JSON payloads |
| Timestamps | `DateTime @db.DateTime(3)` | Millisecond precision; **stored UTC, displayed IST** |
| Audit fields | `createdAt`, `updatedAt` on all mutable models | `updatedAt` deliberately **absent** on immutable models |
| Actor fields | `createdById`, `updatedById` on business entities | Restrict-on-delete so an admin can never be deleted out from under history |
| Soft delete | `deletedAt DateTime?` — see B.3.12 | Only where historical references exist |
| Table naming | `snake_case` via `@@map` | SQL-idiomatic; Prisma client stays camelCase |
| FK behaviour | Explicit `onDelete` on every relation | Default `Restrict` is safe; `Cascade` used only for true child records |

**Two rules the schema cannot express and the application must enforce:**

1. **Soft-delete filtering.** Prisma has no global scope. Every read of a soft-deletable model
   must go through a repository that appends `deletedAt: null`. Enforced via a Prisma Client
   Extension plus an ESLint rule banning direct `prisma.product.*` outside the repository layer.
2. **Immutability.** `QuoteRevision` and `QuoteRevisionItem` have no update path. Enforced by
   exposing no update method on the service and by a DB trigger added in a later migration.

---

## B.2 Enums (24)

These encode LEI's business process. **This is the section most likely to contain my wrong
assumptions — please correct against how sales actually works today.**

```prisma
// ── Identity & access ──────────────────────────────────────────────
enum UserRole            { SUPER_ADMIN  ADMIN }

enum AdminDepartment     { SALES  SERVICE  CATALOGUE  CONTENT  OPERATIONS }

enum PermissionModule {
  CATALOGUE  INVENTORY  MACHINES  SERVICES  SERVICE_REQUESTS
  CUSTOMERS  ENQUIRIES  LEADS  QUOTES  ORDERS
  REPORTS    USERS      AUDIT  SETTINGS
}

// ── Catalogue ──────────────────────────────────────────────────────
enum ProductType         { SPARE_PART  CONSUMABLE  COMPONENT  ACCESSORY  KIT }

enum PriceType           { FIXED  ON_REQUEST  CONTACT_SALES }
// FIXED         → price shown publicly, used in schema.org Offer
// ON_REQUEST    → "Price on request", quote-only
// CONTACT_SALES → high-value; hides even the Add-to-Quote-Request button

enum UnitOfMeasure       { PIECE  SET  PACK  METRE  LITRE  KG  HOUR  VISIT  LOT }

enum StockStatus {
  IN_STOCK  LOW_STOCK  OUT_OF_STOCK  MADE_TO_ORDER  DISCONTINUED
}
// Derived from quantity vs reorderLevel, EXCEPT MADE_TO_ORDER and
// DISCONTINUED which are manual overrides. See B.3.8.

enum AttributeDataType   { STRING  DECIMAL  INTEGER  BOOLEAN  ENUM }

enum AttributeScope      { PRODUCT  VARIANT }
// PRODUCT = same across all variants (material, coating)
// VARIANT = differs per variant (diameter, thread)

enum MediaType           { IMAGE  DATASHEET  BROCHURE  MANUAL  CERTIFICATE  DRAWING }

enum FileContext {
  PRODUCT  VARIANT  CATEGORY  PART_BRAND  MACHINE_BRAND
  SERVICE  SERVICE_REQUEST  ENQUIRY  QUOTE  IMPORT
}

// ── Customers & sales ──────────────────────────────────────────────
enum CustomerType        { BUSINESS  INDIVIDUAL }
enum CustomerStatus      { PROSPECT  ACTIVE  INACTIVE  BLOCKED }

enum EnquiryType         { PRODUCT  SERVICE  BULK  GENERAL }

enum EnquiryStatus {
  NEW  ACKNOWLEDGED  IN_PROGRESS  QUOTED  CLOSED_WON  CLOSED_LOST  SPAM
}

enum LeadType            { PRODUCT  SERVICE  BULK }

enum LeadStatus {
  NEW  CONTACTED  QUALIFIED  QUOTED  NEGOTIATION  WON  LOST  DORMANT
}

enum LeadSource {
  WEBSITE_ENQUIRY  WEBSITE_QUOTE_REQUEST  SERVICE_REQUEST
  PHONE  WHATSAPP  EMAIL  REFERRAL  EXHIBITION  MANUAL
}

enum Priority            { LOW  MEDIUM  HIGH  URGENT }

enum QuoteStatus {
  DRAFT  SENT  UNDER_REVISION  ACCEPTED  REJECTED  EXPIRED  CANCELLED
}

enum OrderStatus {
  PENDING  CONFIRMED  PACKED  SHIPPED  DELIVERED  CANCELLED
}

// ── Tax (India) ────────────────────────────────────────────────────
enum TaxTreatment        { CGST_SGST  IGST  EXEMPT  ZERO_RATED }
// Determined by comparing LEI's state to the customer's place of supply.

// ── Services ───────────────────────────────────────────────────────
enum ServicePricingType  { FIXED  PER_HOUR  PER_VISIT  ON_REQUEST  CONTACT_SALES }

enum ServiceRequestStatus {
  NEW  ASSIGNED  ASSESSMENT  QUOTED  APPROVED  IN_PROGRESS  COMPLETED  CANCELLED
}

// ── Platform ───────────────────────────────────────────────────────
enum Locale              { en  hi }

enum EventType {
  PAGE_VIEW  PRODUCT_VIEW  VARIANT_VIEW  CATEGORY_VIEW  SERVICE_VIEW
  SEARCH  SEARCH_NO_RESULTS  FILTER_USED  COMPATIBILITY_SEARCH
  QUOTE_REQUEST_START  QUOTE_REQUEST_ITEM_ADDED  QUOTE_REQUEST_ITEM_REMOVED
  QUOTE_REQUEST_SUBMIT
  BROCHURE_DOWNLOAD  WHATSAPP_CLICK  PHONE_CLICK  CONTACT_SUBMIT  LOGIN
}
// SEARCH_NO_RESULTS is separated deliberately — it is the single most
// commercially valuable event on the site. See B.3.13.

enum AuditAction {
  CREATE  UPDATE  SOFT_DELETE  RESTORE  HARD_DELETE
  LOGIN  LOGIN_FAILED  LOGOUT  PASSWORD_RESET  PERMISSION_CHANGE
  QUOTE_SENT  QUOTE_ACCEPTED  QUOTE_REJECTED  STOCK_ADJUST  IMPORT
}

enum EmailStatus         { QUEUED  SENT  DELIVERED  BOUNCED  COMPLAINED  FAILED }

enum ImportStatus        { PENDING  VALIDATING  VALIDATED  APPLYING  COMPLETED  FAILED }
```

---

## B.3 Reasoning behind key schema decisions

*(Your point 3 — the "why" before the "what".)*

### B.3.1 🔴 Product vs SKU — the most important decision in this schema

**The documents model one flat `products` table** carrying `sku`, `part_number`, `price`, and a
1:1 `inventory` row. **I believe this is wrong, and Nozzles is exactly the category that proves it.**

Real laser nozzles are sold as a matrix:

```
Raytools Single Layer Nozzle, H15 thread
  ├── D0.8   part no. NZ-SL-H15-08   ₹  790
  ├── D1.0   part no. NZ-SL-H15-10   ₹  850
  ├── D1.2   part no. NZ-SL-H15-12   ₹  850
  ├── D1.5   part no. NZ-SL-H15-15   ₹  890
  ├── D2.0   part no. NZ-SL-H15-20   ₹  940
  └── … 9 more diameters
```

Under the flat model these become **14 separate products**. That produces:

- 14 near-identical product pages → **duplicate content**, and Google indexes maybe two of them
- A customer searching "nozzle" gets 14 results that look the same, and has to read part
  numbers to tell them apart
- 14 rows to maintain when the description or photo changes
- No way to render the diameter selector the mockup's design implies

**Proposed model — two levels:**

| Level | Owns | Cardinality |
|---|---|---|
| **`Product`** — the *catalogue entity* | Page, slug, SEO, description, images, category, brand, compatibility, HSN | 1 |
| **`ProductVariant`** — the *sellable unit* | SKU, part number, price, stock, dimensions, unit of measure | 1..n |

One page, one URL, one description, one set of SEO metadata, one compatibility list — with a
diameter selector, and **the variant is what goes into a quote.**

**Products with no variation still have exactly one variant** (`isDefault = true`,
`variantName = "Standard"`). The API and UI have one code path, never two. A focus lens
D30 F100 is a product with a single variant.

**The rule for deciding product vs variant — and it is a clean one:**

> **If it changes *fitment*, it is a different Product.**
> **If it changes *performance or quantity*, it is a Variant.**

Applied to nozzles: `H15` vs `H20` is thread — it changes what head it screws into, so those
are **two products**. `D1.0` vs `D1.5` is orifice diameter — it fits the same head and changes
cutting behaviour, so those are **variants**.

This rule is what makes compatibility mapping tractable (B.3.3). It is also the assumption I
am least certain about — **please confirm it matches how LEI's catalogue is actually organised.**

**Consequences of this decision, all of which the schema below reflects:**

- `Inventory` is 1:1 with **variant**, not product
- `price`, `sku`, `partNumber` live on **variant**
- `EnquiryItem`, `QuoteRevisionItem`, `OrderItem` reference **variant**
- `ProductCompatibility` references **product** (fitment is product-level by the rule above)
- Attributes split by scope — `ProductAttributeValue` and `VariantAttributeValue`

### B.3.2 Attributes — why two tables instead of one

Filterable specs divide cleanly:

- **Product-scoped:** material (copper), coating, series, OEM-genuine flag — identical across variants
- **Variant-scoped:** diameter, thread, height, length — the thing that *makes* it a variant

A single polymorphic table (`product_id` XOR `variant_id`) needs a CHECK constraint Prisma
can't express, and produces nullable-FK indexes that MySQL uses poorly. Two tables give clean
composite indexes and unambiguous joins. The `SearchService` unions them once, in one place.

**Both tables carry `valueDecimal` alongside `valueString`.** This is the fix for the review's
finding D.3.4 — without it, filtering diameter `1.0–3.0` returns the 10mm nozzle, because
`"10.0"` sorts between `"1.0"` and `"3.0"` as text. Numeric attributes populate both columns;
range filters read `valueDecimal`, text filters read `valueString`.

### B.3.3 Compatibility — why a join table and not a JSON column

`ProductCompatibility` is a genuine many-to-many between products and machine models, and it
is **the commercial core of this platform**. It must be a real table because:

- The compatibility finder queries it in reverse (*given a machine, list parts*)
- It generates the highest-value internal links (*"Other parts for Raytools BM110"*)
- It is filterable, indexable and countable; JSON is none of those at scale

**Three levels of precision, deliberately:**

```
machineBrandId    required   → "Raytools"
machineModelId    required   → "BM110"
machineVariantId  nullable   → "BM110 · 3kW"  (only when fitment is variant-specific)
```

`machineVariantId = NULL` means *fits all variants of this model* — the common case. This
avoids exploding one compatibility fact into ten rows.

`UNIQUE(productId, machineModelId, machineVariantId)` prevents the duplicate rows that would
otherwise show "Raytools BM110" three times on a product page. **The documents omit this
constraint; duplicates are currently possible.**

`isVerified` + `verifiedById` + `verifiedAt`: compatibility data imported from supplier
catalogues is *claimed*; compatibility confirmed by an LEI engineer is *verified*. **Wrong
compatibility data is worse than missing compatibility data** — it produces confident wrong
answers and a returned part. The UI must distinguish the two.

### B.3.4 Enquiry basket — header + items, contact snapshot on the header

```
Enquiry  (1) ──< EnquiryItem  (n)
```

The header carries **the machine context once** (`machineBrandId`/`ModelId`/`VariantId`),
because Rajesh's three parts are all for the same machine. Asking per line would be friction
for no gain. A line can still override it if needed.

**The contact details are snapshotted onto the enquiry**
(`contactName`, `contactEmail`, `contactPhone`, `contactCompany`) *in addition to* the
`customerId` link. This is not redundancy — it is the audit trail. If sales later corrects the
company name on the customer record, the enquiry must still show what was actually typed.
Without the snapshot you silently rewrite your own lead history.

`EnquiryItem` also snapshots `productNameSnapshot`, `partNumberSnapshot` and
`unitPriceSnapshot` — so an enquiry remains readable even if the variant is later renamed,
repriced, or discontinued.

`customerId` is **nullable** on `Enquiry`, unlike the source documents. Reason: the
find-or-create can fail (malformed email, spam) and an enquiry must never be lost because
customer resolution failed. The link is populated asynchronously and can be corrected by sales.

### B.3.5 Quote lifecycle — three tables, two of them immutable

```
Quote (mutable header)
  ├── currentRevisionId   → the revision being shown/worked on
  ├── acceptedRevisionId  → the revision the customer actually agreed to
  └──< QuoteRevision (IMMUTABLE)
         └──< QuoteRevisionItem (IMMUTABLE)
```

**Why `acceptedRevisionId` on the quote** (the documents don't have it): if a quote is accepted
but the order is created a week later — or never — there is otherwise no record of *which*
revision was agreed. Storing it only on `Order` means the fact exists only if fulfilment
happens. The commercial agreement and the fulfilment record are different events.

**Immutability is enforced structurally:** `QuoteRevision` has `createdAt` and **no
`updatedAt`**. A commercial change creates revision N+1; revision N is never touched. This is
what makes "what did we quote in March?" answerable.

**Every revision item is a full snapshot** — `productNameSnapshot`, `partNumberSnapshot`,
`hsnCodeSnapshot`, `unitPrice`, `gstRate`. A quote issued today must still render identically
in three years, after the product has been renamed, repriced and discontinued. **Foreign keys
on quote items are `onDelete: Restrict` and additionally nullable**, so even a hard-deleted
product cannot orphan a historical quote line.

`pdfFileId` on the revision: the generated PDF is stored **permanently and never regenerated**.
If the PDF template changes next year, old quotes must still look like what the customer
received. Regenerating from data would silently alter a document the customer already has.

### B.3.6 Circular FK between Quote and QuoteRevision

`Quote.currentRevisionId → QuoteRevision.id` and `QuoteRevision.quoteId → Quote.id` is a
genuine cycle. It is legal in MySQL because `currentRevisionId` is nullable. Prisma requires
**explicitly named relations** on both sides (shown in the schema), and creation must be a
two-step insert inside one transaction:

```
1. INSERT quote (currentRevisionId = NULL)
2. INSERT quote_revision (quoteId = <new id>)
3. UPDATE quote SET currentRevisionId = <new revision id>
```

Flagged here so it isn't discovered during the first migration.

### B.3.7 Customer records — find-or-create, and why `userId` is gone

`Customer` is created automatically on first enquiry, matched on **normalised email**
(lowercased, trimmed) then **normalised phone** (E.164, `+91…`). The normalised forms are
stored in dedicated indexed columns (`emailNormalized`, `phoneNormalized`) rather than computed
at query time, so the lookup uses an index instead of scanning.

`isVerified = false` marks auto-created records so sales can see which are unconfirmed.

**`customers.user_id` from the source documents is deliberately absent.** Per review finding
C-2: the `users` table holds SUPER_ADMIN. Linking customer records into it means customers and
admins would eventually share one credential store and one role column, turning any future
authorization bug into a privilege-escalation path from the public internet. When customer
login is built, it gets a separate `customer_accounts` table with its own token audience.

**Known limitation, accepted for Phase 1:** one contact per customer. A real B2B customer has
a purchase manager, an engineer and an accounts contact. `CustomerContact` is a clean additive
change later — flagged in section J of the design document, not built now.

### B.3.8 Pricing and stock

`price` and `priceType` live on the **variant**. `priceType` is per-variant so a product family
can show prices for standard diameters and "on request" for a specialised one.

`Inventory` is 1:1 with variant and is the **single source of truth** — the documents' Rev 1.1
correction, carried through to the variant level.

`stockStatus` is **derived** from `quantity` vs `reorderLevel` **except** for
`MADE_TO_ORDER` and `DISCONTINUED`, which are manual overrides. The `isManualOverride` flag
records which. Without it, a nightly recalculation job silently overwrites a deliberate
"discontinued" flag — a bug that is very hard to trace.

`StockMovement` gives an append-only ledger of every change with a reason and actor. Stock
disputes ("we had 40 last week") are otherwise unanswerable, and `Inventory.quantity` alone
cannot tell you *why* it changed.

### B.3.9 GST / HSN — the tax model

**`hsnCode` sits on `Product`, not variant** — HSN classifies a commodity type, and all
diameters of a nozzle share one. `gstRate` sits alongside it.

**Both are snapshotted onto `QuoteRevisionItem`.** Tax rates change by government notification;
a quote issued at 18% must keep showing 18% forever.

**Tax treatment is determined by place of supply:**

```
LEI's state code  ==  customer's state code   →  CGST + SGST  (split 50/50)
LEI's state code  !=  customer's state code   →  IGST         (full rate)
```

Hence `stateCode` on `Customer` and `CustomerAddress` (GST state codes `01`–`38`), and
`cgstAmount` / `sgstAmount` / `igstAmount` **stored separately** on the revision — not derived
at render time, because the treatment must be frozen with the document.

**Important scope finding:** a **quotation is not a tax invoice**. It is a proforma document.
This means Phase 1 does **not** need GST invoice numbering compliance, IRN/e-invoicing, or
e-way bills. Those obligations attach to invoices. If LEI later wants to raise invoices from
this system that is a separate, significantly larger compliance project — flagged in
section J of the design document.

**Dependency:** HSN codes must be supplied by LEI's accountant. Misclassification has tax
consequences and I will not invent them. See section H of the design document.

### B.3.10 Audit history

`AdminAuditLog` is append-only, written by a single NestJS interceptor driven by a decorator —
never by hand in individual services, which guarantees gaps.

**`oldValues`/`newValues` are populated through a field *allowlist*, not a denylist.** A
denylist forgets `passwordHash` exactly once. Credential fields are never logged at all.

`entityType` + `entityId` + `createdAt` is indexed so "show me everything that happened to this
quote" is a single index scan.

**Retention:** audit logs 3 years, `CustomerEvent` 180 days then aggregate. Both tables grow
unboundedly and will otherwise dominate the database within a year.

### B.3.11 Public identifiers must not be enumerable

`Enquiry.publicRef` and `Quote.quoteNumber` appear in emails and PDFs. Two different needs:

- **`quoteNumber`** is a human/commercial reference — sequential and financial-year scoped
  (`LEI/Q/2026-27/0042`), because accountants expect that. It is *fine* for it to be sequential
  because quotes are never fetched by number from a public endpoint.
- **`publicRef`** on `Enquiry` is a random 12-character token, **not** sequential. It is what
  the customer is given ("your reference is `K7M2QX8P4NRB`") and it is what any future status
  lookup would use. A sequential enquiry reference is an enumeration vulnerability — see
  review finding C-4.

**Sequence generation needs a `Counter` table with row-level locking**, not `MAX(id)+1`. Two
admins clicking "create quote" in the same second must not receive the same quote number.
`SELECT … FOR UPDATE` inside the same transaction as the insert.

### B.3.12 Soft-delete strategy — where and why

| Soft-deleted (`deletedAt`) | Reason |
|---|---|
| `Product`, `ProductVariant` | Referenced by historical quotes and orders |
| `Service` | Same |
| `Category`, `PartBrand` | Referenced by products |
| `User` | Referenced by `createdById`, `assignedToId`, audit logs |
| `Customer` | Referenced by enquiries, quotes, orders |

| **Never deleted** | Reason |
|---|---|
| `Enquiry`, `Lead`, `Quote`, `QuoteRevision*`, `Order*` | Commercial records. Use status `CANCELLED`/`CLOSED_LOST` |
| `AdminAuditLog` | Defeats the purpose |
| `StockMovement` | Append-only ledger |

| **Hard-deleted** | Reason |
|---|---|
| `CustomerEvent` | Retention pruning, no historical reference |
| `RefreshToken` | Expiry cleanup |
| `EmailLog` | Retention pruning |

**Uniqueness under soft delete is a real trap.** `@@unique([slug])` on a soft-deleted product
blocks reuse of that slug forever. Handled by appending the id on soft delete
(`old-slug--deleted-42`) inside the delete transaction. Composite `@@unique([slug, deletedAt])`
does *not* work — MySQL treats each NULL as distinct, so it would permit unlimited live
duplicates.

### B.3.13 Two tables the documents don't have, that pay for themselves

**`SearchQueryLog`** — every search, with result count and whether it converted.
`SEARCH_NO_RESULTS` is the single most commercially valuable signal this site produces: it is
a list of parts customers want that LEI either doesn't stock or hasn't listed correctly. That
is a stocking decision, a content backlog, and a synonym list, generated for free.

**`Setting`** — key/value store for LEI's own company details (legal name, GSTIN, registered
address, state code, phone, logo, bank details, quote terms & conditions, quote validity days,
notification recipients). **None of the four source documents contain LEI's own company data
anywhere**, yet a quote PDF cannot be rendered without it. This was a genuine gap.

---

## B.4 The schema

### B.4.1 Configuration

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"] // MySQL FT uses raw queries; see design doc §F
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// Migration 001 must additionally execute:
//   ALTER DATABASE lei CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
//   ALTER TABLE products      ADD FULLTEXT INDEX ft_products (name, short_description);
//   ALTER TABLE product_variants ADD FULLTEXT INDEX ft_variants (variant_name, part_number);
// Prisma does not model FULLTEXT indexes for MySQL; they are raw SQL in the migration.
```

---

### B.4.2 Identity, access & audit  🟢 **S1**

```prisma
model User {
  id                Int              @id @default(autoincrement())
  name              String           @db.VarChar(120)
  email             String           @unique @db.VarChar(190)
  emailNormalized   String           @unique @map("email_normalized") @db.VarChar(190)
  passwordHash      String           @map("password_hash") @db.VarChar(255)
  role              UserRole
  department        AdminDepartment?          // descriptive only — NEVER read by the guard
  phone             String?          @db.VarChar(20)
  isActive          Boolean          @default(true) @map("is_active")

  // Auth hardening — review finding E.2.5 / E.2.6
  lastLoginAt       DateTime?        @map("last_login_at")   @db.DateTime(3)
  failedLoginCount  Int              @default(0) @map("failed_login_count") @db.TinyInt
  lockedUntil       DateTime?        @map("locked_until")    @db.DateTime(3)
  passwordChangedAt DateTime?        @map("password_changed_at") @db.DateTime(3)
  mustChangePassword Boolean         @default(false) @map("must_change_password")

  createdAt         DateTime         @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt         DateTime         @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt         DateTime?        @map("deleted_at") @db.DateTime(3)

  permissions       AdminPermission[]
  refreshTokens     RefreshToken[]
  passwordResets    PasswordResetToken[]
  auditLogs         AdminAuditLog[]

  assignedEnquiries Enquiry[]        @relation("EnquiryAssignee")
  assignedLeads     Lead[]           @relation("LeadAssignee")
  ownedQuotes       Quote[]          @relation("QuoteOwner")
  createdRevisions  QuoteRevision[]  @relation("RevisionAuthor")
  assignedRequests  ServiceRequest[] @relation("ServiceRequestAssignee")
  stockMovements    StockMovement[]
  verifiedCompat    ProductCompatibility[] @relation("CompatibilityVerifier")
  imports           ImportJob[]

  @@index([role, isActive])
  @@index([deletedAt])
  @@map("users")
}

model AdminPermission {
  id        Int              @id @default(autoincrement())
  userId    Int              @map("user_id")
  module    PermissionModule
  canView   Boolean          @default(false) @map("can_view")
  canCreate Boolean          @default(false) @map("can_create")
  canUpdate Boolean          @default(false) @map("can_update")
  canDelete Boolean          @default(false) @map("can_delete")
  createdAt DateTime         @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime         @updatedAt      @map("updated_at") @db.DateTime(3)

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, module])              // prevents contradictory duplicate rows
  @@index([userId])
  @@map("admin_permissions")
}

// Review finding D.2.1 — rotation without a store cannot detect reuse.
model RefreshToken {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  tokenHash     String    @unique @map("token_hash") @db.VarChar(255)  // SHA-256, never raw
  familyId      String    @map("family_id") @db.VarChar(36)            // UUID per login session
  issuedAt      DateTime  @default(now()) @map("issued_at") @db.DateTime(3)
  expiresAt     DateTime  @map("expires_at") @db.DateTime(3)
  revokedAt     DateTime? @map("revoked_at") @db.DateTime(3)
  revokedReason String?   @map("revoked_reason") @db.VarChar(64)
  replacedById  Int?      @unique @map("replaced_by_id")
  ipAddress     String?   @map("ip_address") @db.VarChar(45)           // IPv6-capable
  userAgent     String?   @map("user_agent") @db.VarChar(255)

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  replacedBy    RefreshToken? @relation("TokenRotation", fields: [replacedById], references: [id], onDelete: SetNull)
  replaces      RefreshToken? @relation("TokenRotation")

  @@index([userId, familyId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model PasswordResetToken {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(255)  // hashed at rest
  expiresAt DateTime  @map("expires_at") @db.DateTime(3)
  usedAt    DateTime? @map("used_at") @db.DateTime(3)
  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}

model AdminAuditLog {
  id         Int         @id @default(autoincrement())
  userId     Int?        @map("user_id")          // nullable: system/cron actions
  action     AuditAction
  entityType String      @map("entity_type") @db.VarChar(64)
  entityId   String?     @map("entity_id")   @db.VarChar(64)
  oldValues  Json?       @map("old_values")       // allowlisted fields only
  newValues  Json?       @map("new_values")
  ipAddress  String?     @map("ip_address") @db.VarChar(45)
  userAgent  String?     @map("user_agent") @db.VarChar(255)
  createdAt  DateTime    @default(now()) @map("created_at") @db.DateTime(3)

  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("admin_audit_logs")
}
```

---

### B.4.3 Platform: settings, counters, files  🟢 **S1**

```prisma
// Review finding B.3.13 — the quote PDF cannot render without LEI's own details.
model Setting {
  id          Int      @id @default(autoincrement())
  key         String   @unique @db.VarChar(100)
  value       String   @db.Text
  valueType   String   @default("string") @map("value_type") @db.VarChar(20)
  group       String   @default("general") @db.VarChar(50)
  isSecret    Boolean  @default(false) @map("is_secret")   // masked in admin UI + audit
  description String?  @db.VarChar(255)
  updatedById Int?     @map("updated_by_id")
  updatedAt   DateTime @updatedAt @map("updated_at") @db.DateTime(3)

  @@index([group])
  @@map("settings")
}
// Seeded keys: company.legal_name, company.gstin, company.address, company.state_code,
// company.phone, company.email, company.logo_file_id, quote.terms, quote.validity_days,
// quote.number_prefix, notify.sales_emails, whatsapp.number, seo.site_url

// Review finding B.3.11 — concurrent-safe document numbering.
model Counter {
  id          Int      @id @default(autoincrement())
  scope       String   @db.VarChar(50)   // "QUOTE" | "ORDER" | "ENQUIRY"
  period      String   @db.VarChar(20)   // "2026-27" (Indian financial year) | "GLOBAL"
  currentValue Int     @default(0) @map("current_value")
  updatedAt   DateTime @updatedAt @map("updated_at") @db.DateTime(3)

  @@unique([scope, period])
  @@map("counters")
}
// MUST be read with SELECT … FOR UPDATE inside the same transaction as the insert.

model File {
  id             Int         @id @default(autoincrement())
  originalName   String      @map("original_name") @db.VarChar(255)
  storedName     String      @unique @map("stored_name") @db.VarChar(255)
  path           String      @db.VarChar(500)
  mimeType       String      @map("mime_type") @db.VarChar(100)
  extension      String      @db.VarChar(16)
  sizeBytes      Int         @map("size_bytes")
  checksumSha256 String      @map("checksum_sha256") @db.Char(64)  // dedupe + integrity
  context        FileContext
  width          Int?                                              // images only
  height         Int?
  isPublic       Boolean     @default(true) @map("is_public")      // false → signed access
  uploadedById   Int?        @map("uploaded_by_id")
  createdAt      DateTime    @default(now()) @map("created_at") @db.DateTime(3)
  deletedAt      DateTime?   @map("deleted_at") @db.DateTime(3)

  derivatives      FileDerivative[]
  productMedia     ProductMedia[]
  quoteRevisions   QuoteRevision[]        @relation("QuoteRevisionPdf")
  enquiryAttach    EnquiryAttachment[]
  requestAttach    ServiceRequestAttachment[]

  @@index([context, createdAt])
  @@index([checksumSha256])
  @@map("files")
}

// Review finding F.3 — pre-generate derivatives at upload; never transform per-request.
model FileDerivative {
  id       Int    @id @default(autoincrement())
  fileId   Int    @map("file_id")
  variant  String @db.VarChar(20)     // thumb | card | detail | zoom
  format   String @db.VarChar(10)     // webp | jpeg
  path     String @db.VarChar(500)
  width    Int
  height   Int
  sizeBytes Int   @map("size_bytes")

  file     File   @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([fileId, variant, format])
  @@map("file_derivatives")
}

// Review finding G.8 — slugs change; rankings shouldn't be lost.
model Redirect {
  id         Int      @id @default(autoincrement())
  fromPath   String   @unique @map("from_path") @db.VarChar(500)
  toPath     String   @map("to_path") @db.VarChar(500)
  statusCode Int      @default(301) @map("status_code") @db.SmallInt
  hitCount   Int      @default(0) @map("hit_count")
  createdAt  DateTime @default(now()) @map("created_at") @db.DateTime(3)

  @@map("redirects")
}

model EmailLog {
  id           Int         @id @default(autoincrement())
  toEmail      String      @map("to_email") @db.VarChar(190)
  template     String      @db.VarChar(64)
  subject      String      @db.VarChar(255)
  status       EmailStatus @default(QUEUED)
  providerId   String?     @map("provider_id") @db.VarChar(190)  // Brevo message id
  entityType   String?     @map("entity_type") @db.VarChar(64)
  entityId     String?     @map("entity_id") @db.VarChar(64)
  errorMessage String?     @map("error_message") @db.Text
  attempts     Int         @default(0) @db.TinyInt
  sentAt       DateTime?   @map("sent_at") @db.DateTime(3)
  createdAt    DateTime    @default(now()) @map("created_at") @db.DateTime(3)

  @@index([status, createdAt])
  @@index([entityType, entityId])
  @@index([toEmail])
  @@map("email_logs")
}
```

---

### B.4.4 Catalogue  🟢 **S1**

```prisma
model Category {
  id              Int       @id @default(autoincrement())
  parentId        Int?      @map("parent_id")
  name            String    @db.VarChar(150)
  slug            String    @unique @db.VarChar(190)
  description     String?   @db.Text
  imageFileId     Int?      @map("image_file_id")
  sortOrder       Int       @default(0) @map("sort_order")
  isActive        Boolean   @default(true) @map("is_active")

  // Cached for the mockup's "128+ Products" tiles — recomputed on product save.
  // Review finding F.4: computing this per request is an aggregate per tile.
  productCount    Int       @default(0) @map("product_count")

  metaTitle       String?   @map("meta_title") @db.VarChar(255)
  metaDescription String?   @map("meta_description") @db.VarChar(500)
  canonicalOverride String? @map("canonical_override") @db.VarChar(500) // NULL = derive
  seoIndexable    Boolean   @default(true) @map("seo_indexable")

  createdAt       DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime  @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt       DateTime? @map("deleted_at") @db.DateTime(3)

  parent          Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children        Category[] @relation("CategoryTree")
  products        Product[]
  translations    CategoryTranslation[]

  @@index([parentId, sortOrder])
  @@index([isActive, deletedAt])
  @@map("categories")
}

model PartBrand {
  id          Int       @id @default(autoincrement())
  name        String    @db.VarChar(150)
  slug        String    @unique @db.VarChar(190)
  logoFileId  Int?      @map("logo_file_id")
  description String?   @db.Text
  website     String?   @db.VarChar(255)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt   DateTime  @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt   DateTime? @map("deleted_at") @db.DateTime(3)

  products    Product[]

  @@index([isActive, deletedAt])
  @@map("part_brands")
}

/// THE CATALOGUE ENTITY — owns the page, the SEO, the compatibility. See B.3.1.
model Product {
  id                Int         @id @default(autoincrement())
  categoryId        Int         @map("category_id")
  partBrandId       Int?        @map("part_brand_id")

  name              String      @db.VarChar(255)
  slug              String      @unique @db.VarChar(190)
  productType       ProductType @default(SPARE_PART) @map("product_type")
  shortDescription  String?     @map("short_description") @db.VarChar(500)
  description       String?     @db.Text

  // Tax classification — commodity-level, so it lives here not on the variant. B.3.9
  hsnCode           String?     @map("hsn_code") @db.VarChar(12)
  gstRate           Decimal?    @map("gst_rate") @db.Decimal(5, 2)

  isFeatured        Boolean     @default(false) @map("is_featured")
  isActive          Boolean     @default(true)  @map("is_active")

  // Denormalised from variants for fast listing/sorting. Recomputed on variant save.
  minPrice          Decimal?    @map("min_price") @db.Decimal(14, 2)
  maxPrice          Decimal?    @map("max_price") @db.Decimal(14, 2)
  hasStock          Boolean     @default(false) @map("has_stock")

  metaTitle         String?     @map("meta_title") @db.VarChar(255)
  metaDescription   String?     @map("meta_description") @db.VarChar(500)
  canonicalOverride String?     @map("canonical_override") @db.VarChar(500)
  ogTitle           String?     @map("og_title") @db.VarChar(255)
  ogDescription     String?     @map("og_description") @db.VarChar(500)
  ogImageFileId     Int?        @map("og_image_file_id")
  seoIndexable      Boolean     @default(true) @map("seo_indexable")

  createdById       Int?        @map("created_by_id")
  updatedById       Int?        @map("updated_by_id")
  createdAt         DateTime    @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt         DateTime    @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt         DateTime?   @map("deleted_at") @db.DateTime(3)
  publishedAt       DateTime?   @map("published_at") @db.DateTime(3)

  category          Category    @relation(fields: [categoryId],  references: [id], onDelete: Restrict)
  partBrand         PartBrand?  @relation(fields: [partBrandId], references: [id], onDelete: Restrict)

  variants          ProductVariant[]
  media             ProductMedia[]
  attributeValues   ProductAttributeValue[]
  compatibility     ProductCompatibility[]
  translations      ProductTranslation[]
  relatedFrom       ProductRelation[] @relation("RelationSource")
  relatedTo         ProductRelation[] @relation("RelationTarget")

  @@index([categoryId, isActive, deletedAt])          // primary listing query shape
  @@index([partBrandId, isActive])
  @@index([isFeatured, isActive])
  @@index([isActive, deletedAt, createdAt])
  @@index([minPrice])
  @@map("products")
}

/// THE SELLABLE UNIT — owns SKU, part number, price, stock. See B.3.1.
model ProductVariant {
  id            Int           @id @default(autoincrement())
  productId     Int           @map("product_id")

  sku           String        @unique @db.VarChar(64)
  partNumber    String        @map("part_number") @db.VarChar(100)
  mpn           String?       @db.VarChar(100)      // manufacturer part number
  barcode       String?       @db.VarChar(64)

  /// Review finding D.3.5: UPPER(partNumber + sku + variantName), non-alphanumerics
  /// stripped. Exact + prefix match runs against this BEFORE full-text.
  /// "D27.9 T4.1" → "D279T41"
  searchKey     String        @map("search_key") @db.VarChar(255)

  variantName   String        @map("variant_name") @db.VarChar(120)  // "D1.0" | "Standard"
  isDefault     Boolean       @default(false) @map("is_default")
  position      Int           @default(0)

  price         Decimal?      @db.Decimal(14, 2)
  priceType     PriceType     @default(FIXED) @map("price_type")
  mrp           Decimal?      @db.Decimal(14, 2)     // for strike-through display
  unitOfMeasure UnitOfMeasure @default(PIECE) @map("unit_of_measure")
  packSize      Int           @default(1) @map("pack_size")   // "pack of 10"
  minOrderQty   Int           @default(1) @map("min_order_qty")
  leadTimeDays  Int?          @map("lead_time_days")

  weightGrams   Int?          @map("weight_grams")

  isActive      Boolean       @default(true) @map("is_active")
  createdAt     DateTime      @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt     DateTime      @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt     DateTime?     @map("deleted_at") @db.DateTime(3)

  product         Product     @relation(fields: [productId], references: [id], onDelete: Restrict)
  inventory       Inventory?
  attributeValues VariantAttributeValue[]
  enquiryItems    EnquiryItem[]
  quoteItems      QuoteRevisionItem[]
  orderItems      OrderItem[]
  stockMovements  StockMovement[]

  @@unique([productId, variantName])
  @@index([partNumber])                    // customers search by part number
  @@index([searchKey])                     // exact + prefix match
  @@index([productId, isActive, position])
  @@index([isActive, deletedAt])
  @@map("product_variants")
}

model ProductMedia {
  id        Int       @id @default(autoincrement())
  productId Int       @map("product_id")
  fileId    Int       @map("file_id")
  type      MediaType @default(IMAGE)
  altText   String?   @map("alt_text") @db.VarChar(255)   // SEO + a11y — absent in source docs
  title     String?   @db.VarChar(255)
  sortOrder Int       @default(0) @map("sort_order")
  isPrimary Boolean   @default(false) @map("is_primary")
  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  file      File      @relation(fields: [fileId],    references: [id], onDelete: Restrict)

  @@index([productId, sortOrder])
  @@index([productId, isPrimary])
  @@map("product_media")
}

model Attribute {
  id          Int               @id @default(autoincrement())
  name        String            @db.VarChar(120)      // "Nozzle Diameter"
  slug        String            @unique @db.VarChar(190)
  dataType    AttributeDataType @default(STRING) @map("data_type")
  scope       AttributeScope    @default(VARIANT)     // see B.3.2
  unit        String?           @db.VarChar(20)       // "mm"
  isFilterable Boolean          @default(true) @map("is_filterable")
  isSearchable Boolean          @default(false) @map("is_searchable")
  showInSpecs  Boolean          @default(true) @map("show_in_specs")
  sortOrder    Int              @default(0) @map("sort_order")
  createdAt    DateTime         @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt    DateTime         @updatedAt      @map("updated_at") @db.DateTime(3)

  productValues ProductAttributeValue[]
  variantValues VariantAttributeValue[]

  @@index([isFilterable, sortOrder])
  @@map("attributes")
}

model ProductAttributeValue {
  id           Int       @id @default(autoincrement())
  productId    Int       @map("product_id")
  attributeId  Int       @map("attribute_id")
  valueString  String?   @map("value_string") @db.VarChar(255)
  valueDecimal Decimal?  @map("value_decimal") @db.Decimal(14, 4)   // review finding D.3.4
  valueBool    Boolean?  @map("value_bool")

  product      Product   @relation(fields: [productId],   references: [id], onDelete: Cascade)
  attribute    Attribute @relation(fields: [attributeId], references: [id], onDelete: Restrict)

  @@unique([productId, attributeId])
  @@index([attributeId, valueDecimal])                  // numeric range filters
  @@index([attributeId, valueString(length: 100)])      // text facet filters
  @@map("product_attribute_values")
}

model VariantAttributeValue {
  id           Int            @id @default(autoincrement())
  variantId    Int            @map("variant_id")
  attributeId  Int            @map("attribute_id")
  valueString  String?        @map("value_string") @db.VarChar(255)
  valueDecimal Decimal?       @map("value_decimal") @db.Decimal(14, 4)
  valueBool    Boolean?       @map("value_bool")

  variant      ProductVariant @relation(fields: [variantId],   references: [id], onDelete: Cascade)
  attribute    Attribute      @relation(fields: [attributeId], references: [id], onDelete: Restrict)

  @@unique([variantId, attributeId])
  @@index([attributeId, valueDecimal])
  @@index([attributeId, valueString(length: 100)])
  @@map("variant_attribute_values")
}

model ProductRelation {                                  // 🟡 S1-thin
  id         Int     @id @default(autoincrement())
  productId  Int     @map("product_id")
  relatedId  Int     @map("related_id")
  type       String  @default("RELATED") @db.VarChar(20) // RELATED | ACCESSORY | REPLACES
  sortOrder  Int     @default(0) @map("sort_order")

  product    Product @relation("RelationSource", fields: [productId], references: [id], onDelete: Cascade)
  related    Product @relation("RelationTarget", fields: [relatedId], references: [id], onDelete: Cascade)

  @@unique([productId, relatedId, type])
  @@index([productId])
  @@map("product_relations")
}
```

---

### B.4.5 Inventory  🟢 **S1**

```prisma
model Inventory {
  id               Int            @id @default(autoincrement())
  variantId        Int            @unique @map("variant_id")   // 1:1 with the SELLABLE unit
  quantity         Int            @default(0)
  reservedQuantity Int            @default(0) @map("reserved_quantity")
  reorderLevel     Int            @default(0) @map("reorder_level")
  stockStatus      StockStatus    @default(OUT_OF_STOCK) @map("stock_status")

  /// TRUE when stockStatus was set by a human (MADE_TO_ORDER / DISCONTINUED).
  /// The recalculation job MUST skip these rows. See B.3.8.
  isManualOverride Boolean        @default(false) @map("is_manual_override")

  location         String?        @db.VarChar(100)
  lastCountedAt    DateTime?      @map("last_counted_at") @db.DateTime(3)
  updatedById      Int?           @map("updated_by_id")
  updatedAt        DateTime       @updatedAt @map("updated_at") @db.DateTime(3)

  variant          ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@index([stockStatus])
  @@index([quantity])
  @@map("inventory")
}

/// Append-only ledger. Answers "why did stock change?" — Inventory alone cannot.
model StockMovement {
  id             Int            @id @default(autoincrement())
  variantId      Int            @map("variant_id")
  quantityBefore Int            @map("quantity_before")
  quantityChange Int            @map("quantity_change")     // signed
  quantityAfter  Int            @map("quantity_after")
  reason         String         @db.VarChar(50)             // PURCHASE|SALE|COUNT|DAMAGE|RETURN|IMPORT
  reference      String?        @db.VarChar(100)            // order number, invoice
  notes          String?        @db.VarChar(500)
  performedById  Int?           @map("performed_by_id")
  createdAt      DateTime       @default(now()) @map("created_at") @db.DateTime(3)

  variant        ProductVariant @relation(fields: [variantId],     references: [id], onDelete: Restrict)
  performedBy    User?          @relation(fields: [performedById], references: [id], onDelete: SetNull)

  @@index([variantId, createdAt])
  @@index([createdAt])
  @@map("stock_movements")
}
```

---

### B.4.6 Machines & compatibility  🟢 **S1**

```prisma
model MachineBrand {
  id        Int       @id @default(autoincrement())
  name      String    @db.VarChar(150)              // "Raytools"
  slug      String    @unique @db.VarChar(190)
  logoFileId Int?     @map("logo_file_id")
  isActive  Boolean   @default(true) @map("is_active")
  sortOrder Int       @default(0) @map("sort_order")
  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt      @map("updated_at") @db.DateTime(3)

  models         MachineModel[]
  compatibility  ProductCompatibility[]
  customerMachines CustomerMachine[]
  serviceRequests  ServiceRequest[]

  @@index([isActive, sortOrder])
  @@map("machine_brands")
}

model MachineModel {
  id             Int          @id @default(autoincrement())
  machineBrandId Int          @map("machine_brand_id")
  name           String       @db.VarChar(150)          // "BM110"
  slug           String       @db.VarChar(190)
  description    String?      @db.Text
  isActive       Boolean      @default(true) @map("is_active")
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt      DateTime     @updatedAt      @map("updated_at") @db.DateTime(3)

  brand          MachineBrand @relation(fields: [machineBrandId], references: [id], onDelete: Restrict)
  variants       MachineVariant[]
  compatibility  ProductCompatibility[]
  customerMachines CustomerMachine[]
  serviceRequests  ServiceRequest[]

  @@unique([machineBrandId, slug])
  @@index([machineBrandId, isActive])
  @@map("machine_models")
}

model MachineVariant {
  id             Int          @id @default(autoincrement())
  machineModelId Int          @map("machine_model_id")
  name           String       @db.VarChar(150)         // "BM110 3kW"
  laserType      String?      @map("laser_type") @db.VarChar(50)   // FIBER | CO2 | YAG
  powerWatts     Int?         @map("power_watts")                  // 3000 — numeric, not "3kW"
  isActive       Boolean      @default(true) @map("is_active")
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt      DateTime     @updatedAt      @map("updated_at") @db.DateTime(3)

  model          MachineModel @relation(fields: [machineModelId], references: [id], onDelete: Restrict)
  compatibility  ProductCompatibility[]
  customerMachines CustomerMachine[]
  serviceRequests  ServiceRequest[]

  @@unique([machineModelId, name])
  @@index([machineModelId, isActive])
  @@map("machine_variants")
}

/// The commercial core. See B.3.3.
model ProductCompatibility {
  id               Int             @id @default(autoincrement())
  productId        Int             @map("product_id")
  machineBrandId   Int             @map("machine_brand_id")
  machineModelId   Int             @map("machine_model_id")
  machineVariantId Int?            @map("machine_variant_id")   // NULL = fits all variants
  notes            String?         @db.VarChar(500)

  /// Imported/claimed vs engineer-confirmed. Wrong compatibility is worse
  /// than missing compatibility — the UI must distinguish them.
  isVerified       Boolean         @default(false) @map("is_verified")
  verifiedById     Int?            @map("verified_by_id")
  verifiedAt       DateTime?       @map("verified_at") @db.DateTime(3)

  createdAt        DateTime        @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt        DateTime        @updatedAt      @map("updated_at") @db.DateTime(3)

  product          Product         @relation(fields: [productId],        references: [id], onDelete: Cascade)
  machineBrand     MachineBrand    @relation(fields: [machineBrandId],   references: [id], onDelete: Restrict)
  machineModel     MachineModel    @relation(fields: [machineModelId],   references: [id], onDelete: Restrict)
  machineVariant   MachineVariant? @relation(fields: [machineVariantId], references: [id], onDelete: Restrict)
  verifiedBy       User?           @relation("CompatibilityVerifier", fields: [verifiedById], references: [id], onDelete: SetNull)

  @@unique([productId, machineModelId, machineVariantId])   // absent in source docs
  @@index([machineModelId, productId])                      // "parts for this machine"
  @@index([machineBrandId, machineModelId])                 // cascading dropdowns
  @@index([productId])
  @@map("product_compatibility")
}
```

---

### B.4.7 Customers  🟢 **S1**

```prisma
model Customer {
  id              Int            @id @default(autoincrement())
  // NOTE: users.user_id from the source documents is deliberately ABSENT. See B.3.7 / review C-2.

  customerType    CustomerType   @default(BUSINESS) @map("customer_type")
  companyName     String?        @map("company_name") @db.VarChar(200)
  contactName     String         @map("contact_name") @db.VarChar(150)
  email           String?        @db.VarChar(190)
  phone           String?        @db.VarChar(20)

  /// Indexed match keys for find-or-create. Stored, not computed, so the
  /// lookup uses an index rather than a scan. See B.3.7.
  emailNormalized String?        @map("email_normalized") @db.VarChar(190)
  phoneNormalized String?        @map("phone_normalized") @db.VarChar(20)   // E.164

  gstin           String?        @db.VarChar(15)
  stateCode       String?        @map("state_code") @db.Char(2)   // GST 01–38 → tax treatment
  country         String         @default("IN") @db.Char(2)
  status          CustomerStatus @default(PROSPECT)
  isVerified      Boolean        @default(false) @map("is_verified")  // false = auto-created
  source          LeadSource?
  notes           String?        @db.Text

  createdById     Int?           @map("created_by_id")
  createdAt       DateTime       @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime       @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt       DateTime?      @map("deleted_at") @db.DateTime(3)

  addresses       CustomerAddress[]
  machines        CustomerMachine[]
  enquiries       Enquiry[]
  leads           Lead[]
  quotes          Quote[]
  orders          Order[]
  serviceRequests ServiceRequest[]
  events          CustomerEvent[]

  @@index([emailNormalized])
  @@index([phoneNormalized])
  @@index([status, deletedAt])
  @@index([companyName])
  @@index([createdAt])
  @@map("customers")
}

model CustomerAddress {                                   // 🟡 S1-thin
  id         Int      @id @default(autoincrement())
  customerId Int      @map("customer_id")
  label      String?  @db.VarChar(50)          // "Factory" | "Billing"
  line1      String   @db.VarChar(255)
  line2      String?  @db.VarChar(255)
  city       String   @db.VarChar(100)
  state      String   @db.VarChar(100)
  stateCode  String?  @map("state_code") @db.Char(2)
  pincode    String   @db.VarChar(10)
  country    String   @default("IN") @db.Char(2)
  isDefault  Boolean  @default(false) @map("is_default")
  isBilling  Boolean  @default(false) @map("is_billing")
  createdAt  DateTime @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt  DateTime @updatedAt      @map("updated_at") @db.DateTime(3)

  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId, isDefault])
  @@map("customer_addresses")
}

model CustomerMachine {                                   // ⚪ Later
  id               Int             @id @default(autoincrement())
  customerId       Int             @map("customer_id")
  machineBrandId   Int             @map("machine_brand_id")
  machineModelId   Int             @map("machine_model_id")
  machineVariantId Int?            @map("machine_variant_id")
  serialNumber     String?         @map("serial_number") @db.VarChar(100)

  /// Fallback ONLY when machineVariantId is NULL. When a variant is set,
  /// the variant is authoritative. Source docs Rev 1.1, carried through.
  laserTypeFallback  String?       @map("laser_type_fallback") @db.VarChar(50)
  powerWattsFallback Int?          @map("power_watts_fallback")

  installationYear Int?            @map("installation_year") @db.SmallInt
  notes            String?         @db.Text
  createdAt        DateTime        @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt        DateTime        @updatedAt      @map("updated_at") @db.DateTime(3)

  customer         Customer        @relation(fields: [customerId],       references: [id], onDelete: Cascade)
  machineBrand     MachineBrand    @relation(fields: [machineBrandId],   references: [id], onDelete: Restrict)
  machineModel     MachineModel    @relation(fields: [machineModelId],   references: [id], onDelete: Restrict)
  machineVariant   MachineVariant? @relation(fields: [machineVariantId], references: [id], onDelete: Restrict)

  @@index([customerId])
  @@index([machineModelId])
  @@map("customer_machines")
}
```

---

### B.4.8 Enquiries (the Quote Request basket)  🟢 **S1**

```prisma
model Enquiry {
  id              Int             @id @default(autoincrement())

  /// Random 12-char token — NOT sequential. Given to the customer.
  /// Sequential public refs are an enumeration vulnerability. See B.3.11.
  publicRef       String          @unique @map("public_ref") @db.VarChar(16)

  customerId      Int?            @map("customer_id")   // nullable: never lose an enquiry
  type            EnquiryType     @default(PRODUCT)
  status          EnquiryStatus   @default(NEW)
  priority        Priority        @default(MEDIUM)
  source          LeadSource      @default(WEBSITE_QUOTE_REQUEST)

  /// Contact snapshot — what was actually typed. NOT redundant with
  /// Customer; it is the audit trail. See B.3.4.
  contactName     String          @map("contact_name")    @db.VarChar(150)
  contactEmail    String?         @map("contact_email")   @db.VarChar(190)
  contactPhone    String?         @map("contact_phone")   @db.VarChar(20)
  contactCompany  String?         @map("contact_company") @db.VarChar(200)
  contactCity     String?         @map("contact_city")    @db.VarChar(100)

  subject         String?         @db.VarChar(255)
  message         String?         @db.Text

  /// Machine context captured ONCE for the whole basket — all of Rajesh's
  /// three parts are for the same machine.
  machineBrandId   Int?           @map("machine_brand_id")
  machineModelId   Int?           @map("machine_model_id")
  machineVariantId Int?           @map("machine_variant_id")

  // DPDP Act 2023 — consent must be recorded, not assumed. Review finding E.2.9.
  consentGiven    Boolean         @default(false) @map("consent_given")
  consentText     String?         @map("consent_text") @db.VarChar(500)
  consentAt       DateTime?       @map("consent_at") @db.DateTime(3)

  // Anti-abuse — review finding E.2.3
  ipAddress       String?         @map("ip_address") @db.VarChar(45)
  userAgent       String?         @map("user_agent") @db.VarChar(255)
  spamScore       Int             @default(0) @map("spam_score") @db.TinyInt
  sessionId       Int?            @map("session_id")

  assignedToId    Int?            @map("assigned_to_id")
  acknowledgedAt  DateTime?       @map("acknowledged_at") @db.DateTime(3)
  createdAt       DateTime        @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime        @updatedAt      @map("updated_at") @db.DateTime(3)

  customer        Customer?       @relation(fields: [customerId],   references: [id], onDelete: SetNull)
  assignedTo      User?           @relation("EnquiryAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  items           EnquiryItem[]
  attachments     EnquiryAttachment[]
  quotes          Quote[]
  lead            Lead?

  @@index([status, createdAt])
  @@index([assignedToId, status])
  @@index([customerId, createdAt])
  @@index([createdAt])
  @@map("enquiries")
}

/// THE FIX FOR REVIEW FINDING C-1. Without this table the mockup's
/// "Add to Quote" button has nowhere to write.
model EnquiryItem {
  id                  Int             @id @default(autoincrement())
  enquiryId           Int             @map("enquiry_id")
  variantId           Int?            @map("variant_id")   // NULL = free-text request
  serviceId           Int?            @map("service_id")

  /// Snapshots so the enquiry stays readable if the variant is later
  /// renamed, repriced or discontinued.
  productNameSnapshot String?         @map("product_name_snapshot") @db.VarChar(255)
  partNumberSnapshot  String?         @map("part_number_snapshot")  @db.VarChar(100)
  unitPriceSnapshot   Decimal?        @map("unit_price_snapshot")   @db.Decimal(14, 2)

  quantity            Int             @default(1)
  customerNote        String?         @map("customer_note") @db.VarChar(500)
  sortOrder           Int             @default(0) @map("sort_order")
  createdAt           DateTime        @default(now()) @map("created_at") @db.DateTime(3)

  enquiry             Enquiry         @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  variant             ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
  service             Service?        @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@index([enquiryId, sortOrder])
  @@index([variantId])
  @@map("enquiry_items")
}

/// Customers photograph the broken part. This is extremely common in
/// this domain and is absent from all four source documents.
model EnquiryAttachment {
  id        Int      @id @default(autoincrement())
  enquiryId Int      @map("enquiry_id")
  fileId    Int      @map("file_id")
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)

  enquiry   Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  file      File     @relation(fields: [fileId],    references: [id], onDelete: Restrict)

  @@index([enquiryId])
  @@map("enquiry_attachments")
}

model Lead {                                              // 🟡 S1-thin
  id           Int        @id @default(autoincrement())
  customerId   Int        @map("customer_id")
  enquiryId    Int?       @unique @map("enquiry_id")
  serviceRequestId Int?   @unique @map("service_request_id")

  leadType     LeadType   @default(PRODUCT) @map("lead_type")
  source       LeadSource @default(WEBSITE_ENQUIRY)
  status       LeadStatus @default(NEW)
  priority     Priority   @default(MEDIUM)
  score        Int?       @db.SmallInt            // reserved; unused in Phase 1
  estimatedValue Decimal? @map("estimated_value") @db.Decimal(14, 2)
  assignedToId Int?       @map("assigned_to_id")
  nextFollowUpAt DateTime? @map("next_follow_up_at") @db.DateTime(3)
  lostReason   String?    @map("lost_reason") @db.VarChar(255)
  notes        String?    @db.Text
  createdAt    DateTime   @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt    DateTime   @updatedAt      @map("updated_at") @db.DateTime(3)

  customer     Customer   @relation(fields: [customerId], references: [id], onDelete: Restrict)
  enquiry      Enquiry?   @relation(fields: [enquiryId],  references: [id], onDelete: SetNull)
  serviceRequest ServiceRequest? @relation(fields: [serviceRequestId], references: [id], onDelete: SetNull)
  assignedTo   User?      @relation("LeadAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)

  @@index([status, assignedToId, createdAt])
  @@index([customerId])
  @@index([leadType, status])
  @@index([nextFollowUpAt])
  @@map("leads")
}
```

---

### B.4.9 Quotes  🟢 **S1**

```prisma
model Quote {
  id                 Int            @id @default(autoincrement())
  quoteNumber        String         @unique @map("quote_number") @db.VarChar(50) // LEI/Q/2026-27/0042
  customerId         Int            @map("customer_id")
  enquiryId          Int?           @map("enquiry_id")

  currentRevisionId  Int?           @unique @map("current_revision_id")
  /// Which revision the customer actually agreed to. Absent from the source
  /// documents — without it, acceptance is unrecorded unless an order exists. B.3.5
  acceptedRevisionId Int?           @unique @map("accepted_revision_id")

  status             QuoteStatus    @default(DRAFT)
  ownerId            Int?           @map("owner_id")
  acceptedAt         DateTime?      @map("accepted_at") @db.DateTime(3)
  rejectedAt         DateTime?      @map("rejected_at") @db.DateTime(3)
  rejectionReason    String?        @map("rejection_reason") @db.VarChar(500)
  createdAt          DateTime       @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt          DateTime       @updatedAt      @map("updated_at") @db.DateTime(3)

  customer           Customer       @relation(fields: [customerId], references: [id], onDelete: Restrict)
  enquiry            Enquiry?       @relation(fields: [enquiryId],  references: [id], onDelete: SetNull)
  owner              User?          @relation("QuoteOwner", fields: [ownerId], references: [id], onDelete: SetNull)

  // Circular relation — see B.3.6. Both sides must be explicitly named.
  currentRevision    QuoteRevision? @relation("QuoteCurrentRevision",  fields: [currentRevisionId],  references: [id], onDelete: SetNull)
  acceptedRevision   QuoteRevision? @relation("QuoteAcceptedRevision", fields: [acceptedRevisionId], references: [id], onDelete: SetNull)
  revisions          QuoteRevision[] @relation("QuoteRevisions")
  orders             Order[]

  @@index([customerId, createdAt])
  @@index([status, createdAt])
  @@index([ownerId, status])
  @@map("quotes")
}

/// IMMUTABLE. No updatedAt — that absence is the enforcement signal.
/// A commercial change creates revision N+1; revision N is never touched.
model QuoteRevision {
  id             Int          @id @default(autoincrement())
  quoteId        Int          @map("quote_id")
  revisionNumber Int          @map("revision_number")

  validUntil     DateTime?    @map("valid_until") @db.DateTime(3)

  // Money — all Decimal(14,2). See B.3.9.
  subtotal       Decimal      @default(0) @db.Decimal(14, 2)
  discountAmount Decimal      @default(0) @map("discount_amount") @db.Decimal(14, 2)
  freightAmount  Decimal      @default(0) @map("freight_amount")  @db.Decimal(14, 2)
  taxableAmount  Decimal      @default(0) @map("taxable_amount")  @db.Decimal(14, 2)

  // GST split stored, not derived — the treatment must freeze with the document.
  taxTreatment   TaxTreatment @default(CGST_SGST) @map("tax_treatment")
  cgstAmount     Decimal      @default(0) @map("cgst_amount") @db.Decimal(14, 2)
  sgstAmount     Decimal      @default(0) @map("sgst_amount") @db.Decimal(14, 2)
  igstAmount     Decimal      @default(0) @map("igst_amount") @db.Decimal(14, 2)
  roundOff       Decimal      @default(0) @map("round_off")   @db.Decimal(6, 2)
  total          Decimal      @default(0) @db.Decimal(14, 2)

  currency       String       @default("INR") @db.Char(3)

  notes          String?      @db.Text
  termsSnapshot  String?      @map("terms_snapshot") @db.Text   // T&C frozen at issue time
  paymentTerms   String?      @map("payment_terms") @db.VarChar(255)
  deliveryTerms  String?      @map("delivery_terms") @db.VarChar(255)

  /// Generated ONCE and never regenerated. If the template changes next year,
  /// old quotes must still look like what the customer received. B.3.5
  pdfFileId      Int?         @unique @map("pdf_file_id")
  sentAt         DateTime?    @map("sent_at") @db.DateTime(3)
  sentToEmail    String?      @map("sent_to_email") @db.VarChar(190)

  createdById    Int?         @map("created_by_id")
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  // NO updatedAt — deliberate.

  quote          Quote        @relation("QuoteRevisions", fields: [quoteId], references: [id], onDelete: Restrict)
  createdBy      User?        @relation("RevisionAuthor", fields: [createdById], references: [id], onDelete: SetNull)
  pdfFile        File?        @relation("QuoteRevisionPdf", fields: [pdfFileId], references: [id], onDelete: SetNull)
  items          QuoteRevisionItem[]

  currentOf      Quote?       @relation("QuoteCurrentRevision")
  acceptedOf     Quote?       @relation("QuoteAcceptedRevision")
  orders         Order[]

  @@unique([quoteId, revisionNumber])
  @@index([quoteId, revisionNumber])
  @@index([validUntil])                    // expiry sweep job
  @@map("quote_revisions")
}

/// IMMUTABLE. Every field is a snapshot — this must render identically in 3 years.
model QuoteRevisionItem {
  id                  Int             @id @default(autoincrement())
  quoteRevisionId     Int             @map("quote_revision_id")

  variantId           Int?            @map("variant_id")   // nullable + Restrict: never orphan
  serviceId           Int?            @map("service_id")

  // ── Snapshots ────────────────────────────────────────────────────
  productNameSnapshot String          @map("product_name_snapshot") @db.VarChar(255)
  partNumberSnapshot  String?         @map("part_number_snapshot")  @db.VarChar(100)
  hsnCodeSnapshot     String?         @map("hsn_code_snapshot")     @db.VarChar(12)
  description         String?         @db.Text
  unitOfMeasure       UnitOfMeasure   @default(PIECE) @map("unit_of_measure")

  quantity            Decimal         @db.Decimal(12, 3)      // supports 2.5 metres
  unitPrice           Decimal         @map("unit_price")     @db.Decimal(14, 2)
  discountPercent     Decimal         @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineSubtotal        Decimal         @map("line_subtotal")  @db.Decimal(14, 2)
  gstRate             Decimal         @default(0) @map("gst_rate")   @db.Decimal(5, 2)
  gstAmount           Decimal         @default(0) @map("gst_amount") @db.Decimal(14, 2)
  lineTotal           Decimal         @map("line_total") @db.Decimal(14, 2)

  sortOrder           Int             @default(0) @map("sort_order")

  revision            QuoteRevision   @relation(fields: [quoteRevisionId], references: [id], onDelete: Cascade)
  variant             ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
  service             Service?        @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@index([quoteRevisionId, sortOrder])
  @@index([variantId])
  @@map("quote_revision_items")
}
```

---

### B.4.10 Orders  ⚪ **Later** (schema now, code in Stage 4)

```prisma
model Order {
  id              Int           @id @default(autoincrement())
  orderNumber     String        @unique @map("order_number") @db.VarChar(50)
  customerId      Int           @map("customer_id")
  quoteId         Int           @map("quote_id")

  /// The exact accepted commercial revision. This is the source documents'
  /// Rev 1.1 correction — which was stated in the corrections but MISSING
  /// from their orders table definition. Review finding C-7.
  quoteRevisionId Int           @map("quote_revision_id")

  status          OrderStatus   @default(PENDING)
  billingAddressId  Int?        @map("billing_address_id")
  shippingAddressId Int?        @map("shipping_address_id")

  subtotal        Decimal       @default(0) @db.Decimal(14, 2)
  discountAmount  Decimal       @default(0) @map("discount_amount") @db.Decimal(14, 2)
  freightAmount   Decimal       @default(0) @map("freight_amount")  @db.Decimal(14, 2)
  taxTreatment    TaxTreatment  @default(CGST_SGST) @map("tax_treatment")
  cgstAmount      Decimal       @default(0) @map("cgst_amount") @db.Decimal(14, 2)
  sgstAmount      Decimal       @default(0) @map("sgst_amount") @db.Decimal(14, 2)
  igstAmount      Decimal       @default(0) @map("igst_amount") @db.Decimal(14, 2)
  roundOff        Decimal       @default(0) @map("round_off") @db.Decimal(6, 2)
  total           Decimal       @default(0) @db.Decimal(14, 2)

  courier         String?       @db.VarChar(100)
  trackingNumber  String?       @map("tracking_number") @db.VarChar(100)
  customerPoNumber String?      @map("customer_po_number") @db.VarChar(100)
  notes           String?       @db.Text

  confirmedAt     DateTime?     @map("confirmed_at") @db.DateTime(3)
  packedAt        DateTime?     @map("packed_at")    @db.DateTime(3)
  shippedAt       DateTime?     @map("shipped_at")   @db.DateTime(3)
  deliveredAt     DateTime?     @map("delivered_at") @db.DateTime(3)
  cancelledAt     DateTime?     @map("cancelled_at") @db.DateTime(3)

  createdById     Int?          @map("created_by_id")
  createdAt       DateTime      @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime      @updatedAt      @map("updated_at") @db.DateTime(3)

  customer        Customer      @relation(fields: [customerId],      references: [id], onDelete: Restrict)
  quote           Quote         @relation(fields: [quoteId],         references: [id], onDelete: Restrict)
  quoteRevision   QuoteRevision @relation(fields: [quoteRevisionId], references: [id], onDelete: Restrict)
  items           OrderItem[]

  @@index([customerId, createdAt])
  @@index([status, createdAt])
  @@index([trackingNumber])
  @@map("orders")
}

model OrderItem {
  id                  Int             @id @default(autoincrement())
  orderId             Int             @map("order_id")
  variantId           Int?            @map("variant_id")
  serviceId           Int?            @map("service_id")
  productNameSnapshot String          @map("product_name_snapshot") @db.VarChar(255)
  partNumberSnapshot  String?         @map("part_number_snapshot")  @db.VarChar(100)
  hsnCodeSnapshot     String?         @map("hsn_code_snapshot")     @db.VarChar(12)
  description         String?         @db.Text
  quantity            Decimal         @db.Decimal(12, 3)
  unitPrice           Decimal         @map("unit_price")  @db.Decimal(14, 2)
  gstRate             Decimal         @default(0) @map("gst_rate")   @db.Decimal(5, 2)
  gstAmount           Decimal         @default(0) @map("gst_amount") @db.Decimal(14, 2)
  lineTotal           Decimal         @map("line_total") @db.Decimal(14, 2)
  quantityShipped     Decimal         @default(0) @map("quantity_shipped") @db.Decimal(12, 3)
  sortOrder           Int             @default(0) @map("sort_order")

  order               Order           @relation(fields: [orderId],   references: [id], onDelete: Cascade)
  variant             ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
  service             Service?        @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@index([orderId, sortOrder])
  @@map("order_items")
}
```

---

### B.4.11 Services  ⚪ **Later** (schema now, code in Stage 4)

```prisma
model ServiceCategory {
  id        Int       @id @default(autoincrement())
  name      String    @db.VarChar(150)
  slug      String    @unique @db.VarChar(190)
  description String? @db.Text
  iconFileId Int?     @map("icon_file_id")
  sortOrder Int       @default(0) @map("sort_order")
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt DateTime  @updatedAt      @map("updated_at") @db.DateTime(3)

  services  Service[]

  @@index([isActive, sortOrder])
  @@map("service_categories")
}

model Service {
  id                Int                @id @default(autoincrement())
  serviceCategoryId Int                @map("service_category_id")
  name              String             @db.VarChar(200)
  slug              String             @unique @db.VarChar(190)
  shortDescription  String?            @map("short_description") @db.VarChar(500)
  description       String?            @db.Text
  pricingType       ServicePricingType @default(ON_REQUEST) @map("pricing_type")
  price             Decimal?           @db.Decimal(14, 2)
  sacCode           String?            @map("sac_code") @db.VarChar(12)   // services use SAC
  gstRate           Decimal?           @map("gst_rate") @db.Decimal(5, 2)
  isFeatured        Boolean            @default(false) @map("is_featured")
  isActive          Boolean            @default(true)  @map("is_active")
  metaTitle         String?            @map("meta_title") @db.VarChar(255)
  metaDescription   String?            @map("meta_description") @db.VarChar(500)
  canonicalOverride String?            @map("canonical_override") @db.VarChar(500)
  seoIndexable      Boolean            @default(true) @map("seo_indexable")
  createdAt         DateTime           @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt         DateTime           @updatedAt      @map("updated_at") @db.DateTime(3)
  deletedAt         DateTime?          @map("deleted_at") @db.DateTime(3)

  category          ServiceCategory    @relation(fields: [serviceCategoryId], references: [id], onDelete: Restrict)
  requests          ServiceRequest[]
  translations      ServiceTranslation[]
  enquiryItems      EnquiryItem[]
  quoteItems        QuoteRevisionItem[]
  orderItems        OrderItem[]

  @@index([serviceCategoryId, isActive])
  @@index([isActive, deletedAt])
  @@map("services")
}

model ServiceRequest {
  id                 Int                  @id @default(autoincrement())
  publicRef          String               @unique @map("public_ref") @db.VarChar(16)
  customerId         Int?                 @map("customer_id")
  serviceId          Int                  @map("service_id")

  contactName        String               @map("contact_name")  @db.VarChar(150)
  contactEmail       String?              @map("contact_email") @db.VarChar(190)
  contactPhone       String?              @map("contact_phone") @db.VarChar(20)
  contactCompany     String?              @map("contact_company") @db.VarChar(200)

  machineBrandId     Int?                 @map("machine_brand_id")
  machineModelId     Int?                 @map("machine_model_id")
  machineVariantId   Int?                 @map("machine_variant_id")
  /// Fallback ONLY when machineVariantId is NULL. Source docs Rev 1.1.
  laserTypeFallback  String?              @map("laser_type_fallback") @db.VarChar(50)
  powerWattsFallback Int?                 @map("power_watts_fallback")
  serialNumber       String?              @map("serial_number") @db.VarChar(100)

  problemDescription String               @map("problem_description") @db.Text
  preferredDate      DateTime?            @map("preferred_date") @db.Date
  location           String?              @db.VarChar(255)
  status             ServiceRequestStatus @default(NEW)
  priority           Priority             @default(MEDIUM)
  assignedToId       Int?                 @map("assigned_to_id")

  consentGiven       Boolean              @default(false) @map("consent_given")
  ipAddress          String?              @map("ip_address") @db.VarChar(45)

  assessmentNotes    String?              @map("assessment_notes") @db.Text
  completedAt        DateTime?            @map("completed_at") @db.DateTime(3)
  createdAt          DateTime             @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt          DateTime             @updatedAt      @map("updated_at") @db.DateTime(3)

  customer           Customer?            @relation(fields: [customerId],       references: [id], onDelete: SetNull)
  service            Service              @relation(fields: [serviceId],        references: [id], onDelete: Restrict)
  machineBrand       MachineBrand?        @relation(fields: [machineBrandId],   references: [id], onDelete: Restrict)
  machineModel       MachineModel?        @relation(fields: [machineModelId],   references: [id], onDelete: Restrict)
  machineVariant     MachineVariant?      @relation(fields: [machineVariantId], references: [id], onDelete: Restrict)
  assignedTo         User?                @relation("ServiceRequestAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  attachments        ServiceRequestAttachment[]
  lead               Lead?

  @@index([status, createdAt])
  @@index([assignedToId, status])
  @@index([customerId])
  @@index([serviceId])
  @@map("service_requests")
}

model ServiceRequestAttachment {
  id               Int            @id @default(autoincrement())
  serviceRequestId Int            @map("service_request_id")
  fileId           Int            @map("file_id")
  createdAt        DateTime       @default(now()) @map("created_at") @db.DateTime(3)

  serviceRequest   ServiceRequest @relation(fields: [serviceRequestId], references: [id], onDelete: Cascade)
  file             File           @relation(fields: [fileId], references: [id], onDelete: Restrict)

  @@index([serviceRequestId])
  @@map("service_request_attachments")
}
```

---

### B.4.12 Translations  ⚪ **Later** (tables now, no UI — review finding G.6)

```prisma
model ProductTranslation {
  id               Int      @id @default(autoincrement())
  productId        Int      @map("product_id")
  locale           Locale
  name             String   @db.VarChar(255)
  shortDescription String?  @map("short_description") @db.VarChar(500)
  description      String?  @db.Text
  metaTitle        String?  @map("meta_title") @db.VarChar(255)
  metaDescription  String?  @map("meta_description") @db.VarChar(500)
  createdAt        DateTime @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt        DateTime @updatedAt      @map("updated_at") @db.DateTime(3)

  product          Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, locale])
  @@index([locale])
  @@map("product_translations")
}

model CategoryTranslation {
  id              Int      @id @default(autoincrement())
  categoryId      Int      @map("category_id")
  locale          Locale
  name            String   @db.VarChar(150)
  description     String?  @db.Text
  metaTitle       String?  @map("meta_title") @db.VarChar(255)
  metaDescription String?  @map("meta_description") @db.VarChar(500)
  createdAt       DateTime @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime @updatedAt      @map("updated_at") @db.DateTime(3)

  category        Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, locale])
  @@map("category_translations")
}

model ServiceTranslation {
  id               Int      @id @default(autoincrement())
  serviceId        Int      @map("service_id")
  locale           Locale
  name             String   @db.VarChar(200)
  shortDescription String?  @map("short_description") @db.VarChar(500)
  description      String?  @db.Text
  metaTitle        String?  @map("meta_title") @db.VarChar(255)
  metaDescription  String?  @map("meta_description") @db.VarChar(500)
  createdAt        DateTime @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt        DateTime @updatedAt      @map("updated_at") @db.DateTime(3)

  service          Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([serviceId, locale])
  @@map("service_translations")
}
```

---

### B.4.13 Analytics & import  🟡 **S1-thin**

```prisma
model VisitorSession {
  id           Int             @id @default(autoincrement())
  sessionKey   String          @unique @map("session_key") @db.VarChar(64)  // random, HttpOnly
  customerId   Int?            @map("customer_id")
  firstSeenAt  DateTime        @default(now()) @map("first_seen_at") @db.DateTime(3)
  lastSeenAt   DateTime        @updatedAt      @map("last_seen_at")  @db.DateTime(3)
  ipAddress    String?         @map("ip_address") @db.VarChar(45)
  userAgent    String?         @map("user_agent") @db.VarChar(255)
  referrer     String?         @db.VarChar(500)
  utmSource    String?         @map("utm_source")   @db.VarChar(100)
  utmMedium    String?         @map("utm_medium")   @db.VarChar(100)
  utmCampaign  String?         @map("utm_campaign") @db.VarChar(100)
  landingPath  String?         @map("landing_path") @db.VarChar(500)

  events       CustomerEvent[]

  @@index([customerId])
  @@index([lastSeenAt])
  @@map("visitor_sessions")
}

model CustomerEvent {
  id         Int             @id @default(autoincrement())
  sessionId  Int?            @map("session_id")
  customerId Int?            @map("customer_id")
  eventType  EventType       @map("event_type")
  entityType String?         @map("entity_type") @db.VarChar(64)
  entityId   Int?            @map("entity_id")
  path       String?         @db.VarChar(500)
  /// Strictly validated server-side. NO free-form storage — review finding E.2.3.
  metadata   Json?
  createdAt  DateTime        @default(now()) @map("created_at") @db.DateTime(3)

  session    VisitorSession? @relation(fields: [sessionId],  references: [id], onDelete: Cascade)
  customer   Customer?       @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([customerId, createdAt])
  @@index([sessionId, createdAt])
  @@index([eventType, createdAt])
  @@index([entityType, entityId, createdAt])
  @@index([createdAt])                          // retention pruning — B.3.10
  @@map("customer_events")
}

/// The most commercially valuable table on the site. See B.3.13.
model SearchQueryLog {
  id          Int      @id @default(autoincrement())
  query       String   @db.VarChar(255)
  normalized  String   @db.VarChar(255)         // same normalisation as searchKey
  resultCount Int      @map("result_count")
  sessionId   Int?     @map("session_id")
  filters     Json?
  clickedVariantId Int? @map("clicked_variant_id")
  createdAt   DateTime @default(now()) @map("created_at") @db.DateTime(3)

  @@index([normalized, createdAt])
  @@index([resultCount, createdAt])             // "show me every zero-result search"
  @@map("search_query_logs")
}

/// Review finding I.4 #3 — without this the catalogue cannot be populated.
model ImportJob {
  id             Int          @id @default(autoincrement())
  type           String       @db.VarChar(40)   // PRODUCTS|VARIANTS|COMPATIBILITY|ATTRIBUTES|INVENTORY
  fileId         Int?         @map("file_id")
  status         ImportStatus @default(PENDING)
  totalRows      Int          @default(0) @map("total_rows")
  processedRows  Int          @default(0) @map("processed_rows")
  successRows    Int          @default(0) @map("success_rows")
  errorRows      Int          @default(0) @map("error_rows")
  /// Row-level errors so the admin can fix the CSV and re-run, rather than
  /// being told only "import failed".
  errorReport    Json?        @map("error_report")
  isDryRun       Boolean      @default(true) @map("is_dry_run")
  startedById    Int?         @map("started_by_id")
  startedAt      DateTime?    @map("started_at")   @db.DateTime(3)
  completedAt    DateTime?    @map("completed_at") @db.DateTime(3)
  createdAt      DateTime     @default(now()) @map("created_at") @db.DateTime(3)

  startedBy      User?        @relation(fields: [startedById], references: [id], onDelete: SetNull)

  @@index([status, createdAt])
  @@map("import_jobs")
}
```

---

## B.5 Summary

| | Count |
|---|---|
| Models | **41** |
| Enums | **24** |
| Models required for Slice 1 (🟢) | 24 |
| Models created but idle in Slice 1 (⚪ / 🟡) | 17 |

### Deltas from the source documents

**Added (12):** `ProductVariant`, `VariantAttributeValue`, `EnquiryItem`, `EnquiryAttachment`,
`StockMovement`, `RefreshToken`, `PasswordResetToken`, `Setting`, `Counter`, `FileDerivative`,
`SearchQueryLog`, `ImportJob`, `Redirect`, `EmailLog`, `ProductRelation`

**Defined for the first time (5):** `CustomerEvent`, `VisitorSession`, `ProductMedia`, `File`,
`ServiceRequestAttachment` — all referenced in the source ERDs/indexes but never specified.

**Removed (1):** `customers.user_id` — review finding C-2.

**Materially changed (6):**
`Product` (split from variant; HSN added), `Inventory` (now per variant; override flag),
`Order` (`quoteRevisionId` added — the stated Rev 1.1 correction that was missing from the
table definition), `Quote` (`acceptedRevisionId` added), `QuoteRevision` (GST split, terms
snapshot, PDF reference), `ProductCompatibility` (unique constraint + verification fields).

---

## B.6 Open questions on this schema

These are the points where I made a judgement call and could be wrong. **Please confirm or correct.**

1. **The product/variant rule (B.3.1)** — *"fitment ⇒ product, performance ⇒ variant"*.
   Is `H15` vs `H20` really a separate product line at LEI, with diameters as variants underneath?
2. **Enum values (B.2)** — particularly `LeadStatus` and `EnquiryStatus`. Do these match how
   sales actually tracks work today, or are they a generic CRM's stages?
3. **One contact per customer (B.3.7)** — acceptable for Phase 1, or do LEI's customers routinely
   have separate engineering and purchasing contacts from day one?
4. **`packSize` / `unitOfMeasure`** — are any consumables sold in packs (10 nozzles per box)
   rather than singly? This changes how quantity reads on a quote.
5. **Freight on quotes** — is delivery charged as a quote line, a header-level amount (as modelled),
   or never quoted?
6. **Quote validity** — default validity period? 15 days? 30?
7. **Multi-currency** — are there any export customers, or is INR-only safe to assume permanently?

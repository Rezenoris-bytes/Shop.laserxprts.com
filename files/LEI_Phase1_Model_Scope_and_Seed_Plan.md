# LEI — Phase 1 Model Scope & Seed Data Plan (Revision 2)

**Date:** 18 August 2026 · **Status: REVISED DESIGN FOR REVIEW — no implementation**
**Supersedes:** Revision 1 of this document
**Companions:** `LEI_Prisma_Schema_Proposal.md` · `LEI_Phase1_Design_and_Approval_Package.md`

---

## 0. What changed in this revision, and why it matters

### 0.1 The correction

Revision 1 proposed a rule: *"changes fitment → separate Product; changes performance →
Variant"*, and applied it concretely as *H15/H20 = Product, diameter = Variant*.

**That was a hypothesis presented as a rule.** You checked the real catalogue and it cannot be
confirmed. The rule is withdrawn.

### 0.2 What replaces it

> **The Product ↔ Variant boundary is now a property of the imported data, not of the schema.**
>
> Nothing in the database, the API, or the UI encodes any assumption about what groups variants
> into a product. The grouping arrives in the CSV. Different nozzle families can group
> differently from each other, and the same schema serves all of them.

### 0.3 Why this is safe — the structural reason

The thing that makes a later regroup cheap is already in the design:

> **Every commercial record references a `ProductVariant`, never a `Product`.**
> `EnquiryItem`, `QuoteRevisionItem` and `OrderItem` all point at variants and carry full
> snapshots besides.

So regrouping the catalogue later is:

```sql
UPDATE product_variants SET product_id = <new grouping> WHERE …
```

Variant IDs never change. **Not one historical enquiry, quote, PDF or order is touched.** The
`Product` layer is a presentation and SEO grouping over a stable set of sellable units — it can
be reshaped at any time.

That is the property that makes deferring the decision genuinely safe rather than a deferred
problem.

### 0.4 Model count

Revision 1 said 49 (after correcting an earlier "41"). This revision **merges two attribute
tables into one**, giving **48**. Migration 001 will create **40**; the remaining 8 are deferred.

---

## 1. Product → ProductVariant → SKU (revised)

### 1.1 The three levels — with no grouping rule attached

```
┌───────────────────────────────────────────────────────────────────────┐
│ Category                                                              │
│   Browse tree · nesting · SEO · cached productCount                   │
└─────────────────────────────┬─────────────────────────────────────────┘
                              │ 1 : n
┌─────────────────────────────▼─────────────────────────────────────────┐
│ Product   ── A PRESENTATION GROUP OVER VARIANTS ──                    │
│                                                                       │
│   What it is:  one page, one URL, one SEO record, one image set,      │
│                one description — covering a set of variants that      │
│                LEI considers "one thing" in its catalogue.            │
│                                                                       │
│   ⚠️ WHAT DECIDES THE GROUPING:  the `product_key` column in the       │
│      import CSV.  Nothing in the schema. Nothing in the code.         │
│                                                                       │
│   Owns:   slug · SEO/OG · descriptions · media · category · brand     │
│           hsnCode · gstRate · productType                             │
│   Cached: minPrice · maxPrice · hasStock · variantAxes                │
└─────────────────────────────┬─────────────────────────────────────────┘
                              │ 1 : n   (always ≥ 1)
┌─────────────────────────────▼─────────────────────────────────────────┐
│ ProductVariant   ── THE SELLABLE UNIT · "a SKU" ──                    │
│                                                                       │
│   Fixed columns (commercial, same for every family):                  │
│     sku (UNIQUE) · partNumber · mpn · searchKey · variantName          │
│     price · priceType · mrp                                            │
│     unitOfMeasure · packSize · minOrderQty · leadTimeDays              │
│     weightGrams · position · isDefault · isSeedData                   │
│                                                                       │
│   Everything family-specific lives in ATTRIBUTES, not columns:        │
│     head/series · nozzle type · thread · height · orifice diameter    │
│     material · coating · layer count · taper · … anything             │
│                                                                       │
│   → THIS is what enters a Quote Request, quote line and order line.   │
└─────────────────────────────┬─────────────────────────────────────────┘
                              │ 1 : 1
                     ┌────────▼─────────┐        ┌──────────────────────┐
                     │ Inventory        │───────▶│ StockMovement ledger │
                     └──────────────────┘        └──────────────────────┘
```

### 1.2 The key mechanism — `variantAxes`

Since no spec is privileged by the schema, the product page has to work out **which
attributes actually vary** within a product, and build the selector from that.

This is derived, never configured:

```
For each attribute present on this product's variants:
    count DISTINCT value
    if count > 1  →  it is a SELECTOR AXIS   (rendered as a chooser)
    if count = 1  →  it is a SHARED SPEC     (rendered in the spec table)
```

Cached on `Product.variantAxes` (JSON), recomputed whenever a variant is saved or imported.

**The consequence:** the same product page component renders correctly whether a family varies
by one axis, two, three, or none. **No family-specific frontend code, ever.**

| Family shape | `variantAxes` | UI renders |
|---|---|---|
| 1 variant | `[]` | No selector |
| Varies by diameter only | `["orifice-diameter"]` | One row of chips |
| Varies by height × diameter | `["height","orifice-diameter"]` | Two-level selector |
| Varies by thread × height × diameter | 3 entries | Three-level selector |

### 1.3 Family-specific specifications — how they are represented

Everything you listed maps as follows:

| Characteristic | Where it lives | Why |
|---|---|---|
| Brand | `Product.partBrandId` → `PartBrand` | Relation — needed for filtering and brand pages |
| **Head / Series** | Attribute | Family-specific; not every family has one |
| **Nozzle type** | Attribute | Single/double layer, chrome, ceramic-tipped… |
| **Height** | Attribute (numeric) | May be an axis or a shared spec |
| **Thread** | Attribute | May be an axis or a shared spec |
| **Tip / orifice diameter** | Attribute (numeric) | Usually an axis |
| **Part number** | `ProductVariant.partNumber` | Fixed column — customers search it |
| **Internal SKU** | `ProductVariant.sku` (UNIQUE) | Fixed column |
| **Price** | `ProductVariant.price` + `priceType` | Fixed column |
| **Stock** | `Inventory` (1:1 with variant) | Single source of truth |
| **Unit / pack size** | `ProductVariant.unitOfMeasure`, `packSize` | Fixed columns |
| **Any other family spec** | Attribute | **Adding one is an `Attribute` row, not a migration** |

> **The dividing line:** fixed columns are the things that are *commercially* identical across
> every product LEI will ever sell — a price, a stock count, a SKU. Everything *technical* is an
> attribute, because technical characteristics differ by family and always will.

### 1.4 SKU terminology (unchanged, and unaffected by the correction)

| Term | Meaning here | Unique? |
|---|---|---|
| `sku` | LEI's internal stock code | ✅ Globally unique |
| `partNumber` | Printed on the part / OEM catalogue number | ❌ Indexed, **not** unique |
| `mpn` | Manufacturer part number when it differs | ❌ |
| "800 SKUs" (colloquial) | 800 `ProductVariant` rows | — |

`partNumber` is deliberately not unique: LEI does not control OEM numbering, and forcing
uniqueness would reject legitimate imports.

### 1.5 What has been removed from the design

| Removed | Reason |
|---|---|
| The fitment/performance rule | Unverified assumption |
| "H15 = Product, D1.5 = Variant" as a fixed example | Same |
| `AttributeScope` as a **structural** enum splitting two tables | An attribute must be able to sit at either level without a migration — §5.1 |
| Compatibility being **necessarily** product-level | Now supports either level — §5.2 |

---

## 2. Phase 1 model scope — 48 models, three tiers

Classified exactly as you asked: **required now / future foundation / safely deferred.**

### 2.1 Tier 1 — Required for Phase 1 (35)

Table + repository + service + API. These are exercised by the customer and admin journeys.

| # | Model | Phase 1 role | Admin UI? |
|---|---|---|---|
| 1 | `User` | Admin accounts, two-role model | ✅ |
| 2 | `AdminPermission` | Drives the permission guard | ✅ |
| 3 | `RefreshToken` | Rotation + reuse detection | — |
| 4 | `PasswordResetToken` | Admin password reset | — |
| 5 | `AdminAuditLog` | Every admin action | ✅ read-only |
| 6 | `Setting` | LEI details for the quote PDF | ✅ |
| 7 | `Counter` | Concurrent-safe quote numbering | — |
| 8 | `File` | All uploads | ✅ via forms |
| 9 | `FileDerivative` | Pre-generated image sizes | — automatic |
| 10 | `Category` | Browse, filter, SEO | ✅ |
| 11 | `PartBrand` | Filter, brand attribution | ✅ |
| 12 | **`Product`** | Presentation group + page | ✅ |
| 13 | **`ProductVariant`** | Sellable unit | ✅ |
| 14 | `ProductMedia` | Images + alt text | ✅ |
| 15 | `Attribute` | Spec/filter definitions | ✅ minimal |
| 16 | **`AttributeValue`** | **Merged** — all specs, both levels | ✅ via product form |
| 17 | `Inventory` | Stock, single source of truth | ✅ |
| 18 | `StockMovement` | Append-only ledger | ✅ read-only |
| 19 | `MachineBrand` | Compatibility finder step 1 | ✅ |
| 20 | `MachineModel` | Finder step 2 | ✅ |
| 21 | `MachineVariant` | Precision compatibility | ✅ |
| 22 | **`ProductCompatibility`** | The commercial core | ✅ |
| 23 | `Customer` | Find-or-create on enquiry | ✅ |
| 24 | **`Enquiry`** | Quote Request header | ✅ |
| 25 | **`EnquiryItem`** | Quote Request lines | ✅ |
| 26 | `EnquiryAttachment` | Customer photo of the part | ✅ view only |
| 27 | `Lead` | Auto-created on enquiry | ✅ list |
| 28 | `Quote` | Quote header | ✅ |
| 29 | `QuoteRevision` | Immutable revision | ✅ |
| 30 | `QuoteRevisionItem` | Immutable lines | ✅ |
| 31 | `EmailLog` | Delivery + bounce visibility | ✅ read-only |
| 32 | `ImportJob` | **Loads the seed catalogue** | ✅ |
| 33 | `VisitorSession` | Analytics sessions | — |
| 34 | `CustomerEvent` | Tracked events | — 1 tile |
| 35 | `SearchQueryLog` | Zero-result capture | — 1 tile |

### 2.2 Tier 2 — Future foundation, created but no code (5)

| # | Model | Why the table must exist in migration 001 |
|---|---|---|
| 36 | `ServiceCategory` | 🔴 Referenced by `Service` |
| 37 | `Service` | 🔴 `EnquiryItem.serviceId` and `QuoteRevisionItem.serviceId` reference it |
| 38 | `ServiceRequest` | 🔴 `Lead.serviceRequestId` references it |
| 39 | `ServiceRequestAttachment` | Child of `ServiceRequest` |
| 40 | `CustomerAddress` | Phase 1 uses `Customer.stateCode` for GST; the table is a cheap forward step |

**Why 36–38 genuinely cannot wait:** `QuoteRevisionItem` is **immutable** and will hold frozen
commercial documents. Adding `serviceId` to it later means altering a table full of issued
quotes. Creating it complete once is materially safer.

### 2.3 Tier 3 — Safely deferrable (8)

**Recommendation changed from Revision 1:** you asked not to overcomplicate Phase 1 just
because the schema exists. Agreed — **these 8 are now deferred out of migration 001.**

| # | Model | Arrives in |
|---|---|---|
| 41 | `Order` | Stage 4 (migration 002) |
| 42 | `OrderItem` | Stage 4 |
| 43 | `CustomerMachine` | Stage 4 |
| 44 | `ProductRelation` | Stage 4 |
| 45 | `Redirect` | Stage 5 |
| 46 | `ProductTranslation` | When Hindi content is scheduled |
| 47 | `CategoryTranslation` | " |
| 48 | `ServiceTranslation` | " |

Nothing in Tier 1 or 2 references any of these — they reference *inward* only. Adding them
later is purely additive with zero risk to existing data.

### 2.4 Summary

| Tier | Count | Migration 001 | Phase 1 code |
|---|---|---|---|
| 1 — Required | 35 | ✅ | ✅ |
| 2 — Foundation | 5 | ✅ | ❌ |
| 3 — Deferred | 8 | ❌ | ❌ |
| **Total** | **48** | **40** | **35** |

### 2.5 "Don't overcomplicate Phase 1" — how that is honoured

| Temptation | Phase 1 discipline |
|---|---|
| Full attribute admin because `Attribute` exists | Attributes seeded via CSV; admin gets list + simple create only |
| Stock adjustment workflows because `StockMovement` exists | Ledger is written automatically; UI is a read-only list |
| Analytics dashboards because events are captured | Two dashboard tiles. No analytics screens |
| Service module because the tables exist | **Zero service code.** Tables sit empty |
| Lead scoring because `score` exists | Column stays NULL |
| Multi-address UI because `CustomerAddress` exists | No UI. `Customer.stateCode` drives GST |
| Translation UI because the tables… | Tables aren't even created (Tier 3) |

---

## 3. Example dummy nozzle data

Deliberately built so that **five families have five different shapes** — proving the schema
carries them all without special-casing.

### 3.1 The five seed families

| # | Family | `product_key` groups by | Axes | Variants |
|---|---|---|---|---|
| **A** | Raytools BM110 Single Layer | series + type + thread | `diameter` (1) | 8 |
| **B** | Raytools BM110 Double Layer | series + type | `thread` × `diameter` (2) | 24 |
| **C** | Precitec ProCutter Single Layer | series + type | `height` × `diameter` (2) | 18 |
| **D** | WSX NC30 Chrome-Plated | series + type + height | `diameter` (1) | 10 |
| **E** | Ospri Ceramic-Tipped (specialist) | single item | — (0) | 1 |

> **Family A and Family B group differently on purpose.** In A, thread is part of the grouping
> key (so H15 and H20 are separate products). In B, thread is a selector axis (so one product
> covers both). **Both are represented by the identical schema, identical API and identical
> frontend component.** That is the proof the design is not encoding an assumption.

### 3.2 Family A — one axis

```
Product  "Raytools BM110 Single Layer Nozzle — H15"
  slug:      raytools-bm110-single-layer-nozzle-h15
  brand:     Raytools        hsn: 84669390 (PLACEHOLDER)   gst: 18.00 (PLACEHOLDER)
  isSeedData: true

  shared specs (1 distinct value each → spec table):
    head-series = BM110  ·  nozzle-type = Single Layer
    thread = H15  ·  material = Copper

  variantAxes: ["orifice-diameter"]      ← derived, not configured

  ├─ D0.8   sku NZ-RT-SL-H15-08   part "D0.8 H15"   ₹  790   qty  42   PIECE
  ├─ D1.0   sku NZ-RT-SL-H15-10   part "D1.0 H15"   ₹  850   qty 118   PIECE  ★default
  ├─ D1.2   sku NZ-RT-SL-H15-12   part "D1.2 H15"   ₹  850   qty  96   PIECE
  ├─ D1.5   sku NZ-RT-SL-H15-15   part "D1.5 H15"   ₹  890   qty  14   LOW_STOCK
  ├─ D2.0   sku NZ-RT-SL-H15-20   part "D2.0 H15"   ₹  940   qty   0   OUT_OF_STOCK
  ├─ D2.5   sku NZ-RT-SL-H15-25   part "D2.5 H15"   ₹  990   qty  31
  ├─ D3.0   sku NZ-RT-SL-H15-30   part "D3.0 H15"   ₹1,040   qty  22
  └─ D10.0  sku NZ-RT-SL-H15-A0   part "D10.0 H15"  ₹1,780   MADE_TO_ORDER
                                   ↑ deliberately included: proves the numeric
                                     range filter isn't comparing strings
```

### 3.3 Family B — two axes, thread is a *variant* here

```
Product  "Raytools BM110 Double Layer Nozzle"
  variantAxes: ["thread", "orifice-diameter"]     ← two-level selector

  shared specs:  head-series = BM110 · nozzle-type = Double Layer · material = Copper

  ┌ thread H15 ─ D1.0 …D3.0   (8 variants)   sku NZ-RT-DL-H15-xx
  └ thread H20 ─ D1.0 …D3.0   (8 variants)   sku NZ-RT-DL-H20-xx
              ─ D3.5, D4.0     (8 more, H20 only — deliberately asymmetric)

  → 24 variants under ONE product page, with a two-level selector.
  → Same schema as Family A. Same component. Different data.
```

**The asymmetry is deliberate**: D3.5/D4.0 exist only for H20. A naive matrix UI would render
empty cells; the seed forces that case to be handled.

### 3.4 Family C — different spec vocabulary entirely

```
Product  "Precitec ProCutter Single Layer Nozzle"
  variantAxes: ["nozzle-height", "orifice-diameter"]

  ⚠️ Precitec uses HEIGHT (in mm), not the H15/H20 thread convention.
     Different attribute, different family, ZERO code difference.

  shared specs:  head-series = ProCutter 2.0 · nozzle-type = Single Layer
                 thread = M11 · material = Copper (chrome-free)

  ┌ height 12mm ─ D1.0, D1.4, D2.0        sku NZ-PC-SL-12-xx
  ├ height 15mm ─ D1.0, D1.4, D2.0, D2.7  sku NZ-PC-SL-15-xx
  └ height 18mm ─ ...                      (18 variants total)

  part numbers: "M11 H12 D1.4"   ← punctuation + short tokens
```

### 3.5 Family D — pack sizes and units

```
Product  "WSX NC30 Chrome-Plated Nozzle — H15"
  variantAxes: ["orifice-diameter"]
  shared:  head-series = NC30 · nozzle-type = Chrome-Plated · thread = H15

  ├─ D1.0  sku NZ-WSX-CR-H15-10   ₹1,180   PIECE  packSize 1
  ├─ D1.5  sku NZ-WSX-CR-H15-15   ₹1,180   PIECE  packSize 1
  ├─ D2.0  sku NZ-WSX-CR-H15-20   ₹1,240   PACK   packSize 10   minOrderQty 1
  │                                          ↑ sold by the box — proves UoM handling
  └─ D2.5  sku NZ-WSX-CR-H15-25   priceType = ON_REQUEST
                                              ↑ proves the no-price presentation path
```

### 3.6 Family E — single variant, no selector

```
Product  "Ospri Ceramic-Tipped Nozzle — Specialist"
  variantAxes: []                        ← selector hidden entirely
  └─ Standard   sku NZ-OS-CT-STD   part "OS-CT-1.5"   ₹4,850   isDefault

  Same code path as the 24-variant family. No "simple product" branch anywhere.
```

### 3.7 Full seed volume

| Entity | Count | Purpose |
|---|---|---|
| Categories | 6 (2 levels) | Nesting, breadcrumbs, tiles |
| Part brands | 5 | Brand filter meaningful |
| Machine brands / models / variants | 4 / 12 / 20 | Cascading finder |
| Attributes | 14 | Mixed numeric + text, mixed levels |
| **Products** | **45** | 3 pages of pagination at 24/page |
| **Variants** | **~180** | 5 nozzle families ≈ 61 · rest across other categories |
| Compatibility rows | ~400 | All `isSeedData` + `isVerified=false` |
| Customers | 30 | Includes intra- **and** inter-state (both GST paths) |
| Enquiries | 25 | Every status, one with an attachment |
| Quotes | 8 | Two with 3 revisions each |
| Admin users | 6 | SUPER_ADMIN + one per department |

### 3.8 Edge cases deliberately present in the seed

| Case | Family | Proves |
|---|---|---|
| Part number with punctuation + short tokens (`D27.9 T4.1`, `M11 H12 D1.4`) | C | `searchKey` normaliser works where plain FULLTEXT fails |
| Diameter spanning `0.8` … `10.0` | A | Range filter isn't string-comparing |
| Thread as an **axis** in one family, part of the **grouping key** in another | A vs B | **The design encodes no grouping assumption** |
| Asymmetric variant matrix | B | Empty selector combinations handled |
| Different spec vocabulary per family | C | No family-specific code |
| `PACK` unit / `packSize` 10 | D | Quantity semantics on quotes |
| `ON_REQUEST` pricing | D | No-price presentation |
| Single-variant product | E | No branching code path |
| Two variants sharing an OEM part number | A/D | `partNumber` correctly non-unique |
| Zero-result search term | — | `SEARCH_NO_RESULTS` capture |

---

## 4. Import / seed flow

### 4.1 Seed data uses the production importer — no exceptions

```
apps/api/seed/csv/
├── 01-machines.csv          brands · models · variants
├── 02-attributes.csv        14 definitions, defaultScope advisory only
├── 03-categories.csv        6, two levels
├── 04-part-brands.csv       5
├── 05-products.csv          45   ← carries product_key
├── 06-variants.csv          ~180 ← carries product_key + attr:* columns
├── 07-compatibility.csv     ~400 (all flagged demo)
└── 08-inventory.csv         stock per SKU
            │
            ▼
   ImportJob — the SAME importer production will use
   validate → dry-run (row-level error report) → apply
            │
            ▼
        MySQL ──▶ NestJS API ──▶ Next.js
```

A small TypeScript seed handles only what CSV cannot: the SUPER_ADMIN account, one ADMIN per
department with permission sets, and the `Setting` placeholder rows.

### 4.2 `product_key` — the mechanism that makes grouping data-driven

**This is the single most important line in the import contract.**

```csv
# 06-variants.csv
product_key,sku,part_number,variant_name,price,uom,pack_size,attr:head-series,attr:nozzle-type,attr:thread,attr:orifice-diameter
RT-BM110-SL-H15,NZ-RT-SL-H15-10,D1.0 H15,D1.0,850.00,PIECE,1,BM110,Single Layer,H15,1.0
RT-BM110-SL-H15,NZ-RT-SL-H15-15,D1.5 H15,D1.5,890.00,PIECE,1,BM110,Single Layer,H15,1.5
RT-BM110-DL,NZ-RT-DL-H15-10,D1.0 H15 DL,H15 / D1.0,1180.00,PIECE,1,BM110,Double Layer,H15,1.0
RT-BM110-DL,NZ-RT-DL-H20-10,D1.0 H20 DL,H20 / D1.0,1180.00,PIECE,1,BM110,Double Layer,H20,1.0
```

Rows 1–2 share `RT-BM110-SL-H15` → **one product, thread is part of the grouping.**
Rows 3–4 share `RT-BM110-DL` → **one product, thread is a selector axis.**

**Both shapes, same importer, same schema, same frontend.** When the real LEI catalogue
arrives, whatever grouping it expresses is expressed in this column. No code changes.

### 4.3 `attr:` columns — adding a spec needs no migration

Any column prefixed `attr:` is matched to an `Attribute` by slug and written to
`AttributeValue`. A new characteristic for a new family is:

1. add a row to `02-attributes.csv`
2. add an `attr:new-spec` column to the variant CSV

**No schema change. No code change. No deployment.**

Numeric attributes populate `valueDecimal` as well as `valueString`, so range filters work.

### 4.4 The import pipeline

```
1. UPLOAD      CSV → File, ImportJob created (PENDING)
2. VALIDATE    headers · types · required fields · FK resolution by slug/sku
               → row-level error report; nothing written
3. DRY RUN     full transaction, computes "will create X / update Y / skip Z"
               → ROLLED BACK. Admin reviews before anything changes
4. APPLY       chunked (500 rows), resumable, inside a transaction per chunk
5. DERIVE      recompute Product.variantAxes · minPrice · maxPrice · hasStock
               · Category.productCount · ProductVariant.searchKey
6. AUDIT       ImportJob COMPLETED with counts; AdminAuditLog entry
```

Steps 2–3 are what make loading the real catalogue safe. **Nothing is ever written from an
unvalidated file.**

### 4.5 Swapping demo for real data

```
1. Export the real catalogue into the same 8 CSV templates
2. Dry-run → review the report
3. Purge:  DELETE FROM … WHERE is_seed_data = true   (dependency order, one transaction)
4. Apply the real import
5. Verify: zero rows with is_seed_data = true; zero settings containing "PLACEHOLDER"
6. DEMO_MODE=false
```

**No migration. No restructuring. No code change.** And if the real grouping differs from the
demo grouping, that difference lives entirely in `product_key`.

### 4.6 Regrouping after real quotes exist

Because quote lines reference **variants**:

```sql
BEGIN;
  UPDATE product_variants SET product_id = :newProductId WHERE sku IN (…);
  -- rebuild affected Product rows, recompute variantAxes / minPrice / hasStock
  -- create Redirect rows for any changed product slug
COMMIT;
```

Historical enquiries, quotes, PDFs and orders are **untouched** — they reference variant IDs
that did not change, and carry snapshots besides.

⚠️ **One caveat, stated plainly:** compatibility rows attached at *product* level need review
after a regroup, because their scope changed. Rows attached at *variant* level do not.
This is why compatibility now supports both levels — §5.2.

---

## 5. Schema changes caused by this decision

### 5.1 🔴 `ProductAttributeValue` + `VariantAttributeValue` → one `AttributeValue`

**Why:** two tables meant an attribute's level was structural. Moving "thread" from
product-level to variant-level would have meant moving rows between tables. Since the boundary
is now unknown, that must be a one-column `UPDATE`, not a data migration.

```prisma
model AttributeValue {
  id           Int             @id @default(autoincrement())
  attributeId  Int             @map("attribute_id")
  productId    Int?            @map("product_id")     // exactly one of these
  variantId    Int?            @map("variant_id")     // is non-null
  valueString  String?         @map("value_string")  @db.VarChar(255)
  valueDecimal Decimal?        @map("value_decimal") @db.Decimal(14, 4)
  valueBool    Boolean?        @map("value_bool")

  attribute    Attribute       @relation(fields: [attributeId], references: [id], onDelete: Restrict)
  product      Product?        @relation(fields: [productId],   references: [id], onDelete: Cascade)
  variant      ProductVariant? @relation(fields: [variantId],   references: [id], onDelete: Cascade)

  @@unique([productId, attributeId])
  @@unique([variantId,  attributeId])
  @@index([attributeId, valueDecimal])                 // numeric range filters
  @@index([attributeId, valueString(length: 100)])     // text facet filters
  @@map("attribute_values")
}
```

Enforced by a real DB constraint in the migration (MySQL 8.0.16+ enforces `CHECK`):

```sql
ALTER TABLE attribute_values ADD CONSTRAINT chk_attr_scope CHECK (
  (product_id IS NOT NULL AND variant_id IS NULL) OR
  (product_id IS NULL AND variant_id IS NOT NULL)
);
```

**Bonus:** filtering is now one table and one index instead of a union across two.

### 5.2 🔴 `ProductCompatibility.variantId` added

**Why:** with the grouping unknown, fitment might be product-wide or variant-specific.

```prisma
variantId  Int?  @map("variant_id")   // NULL = applies to ALL variants of the product
```

| `variantId` | Meaning | Typical use |
|---|---|---|
| `NULL` | Fits via every variant of this product | Family where all variants share fitment |
| set | Fits only via this variant | Family where thread/height is an axis |

Uniqueness needs care because MySQL treats each `NULL` as distinct, so a plain composite unique
would not stop duplicates. Handled with stored generated columns in the migration:

```sql
ALTER TABLE product_compatibility
  ADD COLUMN variant_key         INT AS (IFNULL(variant_id, 0))         STORED,
  ADD COLUMN machine_variant_key INT AS (IFNULL(machine_variant_id, 0)) STORED,
  ADD UNIQUE KEY uq_compat (product_id, variant_key, machine_model_id, machine_variant_key);
```

### 5.3 🟠 `Attribute.scope` → `Attribute.defaultScope` (advisory)

Was structural. Now it is **only** a hint the importer uses when a CSV doesn't say otherwise,
and a default in the admin form. **It never constrains where a value can live.**

### 5.4 🟠 `Product.variantAxes` added

```prisma
variantAxes Json? @map("variant_axes")   // ["thread","orifice-diameter"] — derived
```

Recomputed on variant save and after import (pipeline step 5). Never hand-edited.

### 5.5 🟢 `ProductVariant.variantName` — composed at import

Was assumed to be a single value like `"D1.5"`. Now composed from the axis values:
`"H20 / D1.5"`, `"15mm / D1.4"`, or `"Standard"` for single-variant products. Stored (not
computed at runtime) so it is importable, searchable and stable.

### 5.6 🟢 `isSeedData` — as agreed

On `Category`, `PartBrand`, `Product`, `ProductVariant`, `Attribute`, `MachineBrand`,
`MachineModel`, `MachineVariant`, `ProductCompatibility`, `Customer`, `Enquiry`, `Quote`.
Indexed where the purge needs it.

### 5.7 🟢 Tier 3 removed from migration 001

8 models deferred — §2.3.

### 5.8 Net effect

| | Before | After |
|---|---|---|
| Models | 49 | **48** |
| Created in migration 001 | 49 | **40** |
| With Phase 1 code | 30 | **35** *(re-tiered honestly, not scope growth)* |
| Assumptions about LEI's catalogue | 1 (the fitment rule) | **0** |

---

## 6. `DEMO_MODE` — implemented from the first commit

Single env var, read by both apps, driving every behaviour below.

| Behaviour | `DEMO_MODE=true` | `DEMO_MODE=false` |
|---|---|---|
| `robots.txt` | `User-agent: *` / `Disallow: /` | Real rules + sitemap |
| `X-Robots-Tag` header | `noindex, nofollow, noarchive` — **at Nginx, every response** | Absent |
| `<meta name="robots">` | `noindex, nofollow` | Per-page policy |
| Sitemap route | Returns 404 | Generated |
| HTTP Basic Auth | **Enabled at Nginx, whole host** | Disabled |
| Site banner | Persistent, dismissible-per-session | Absent |
| Quote PDF | Diagonal **"SAMPLE — NOT A COMMERCIAL DOCUMENT"** watermark | Clean |
| Quote emails | Subject prefixed `[SAMPLE]`, sends only to allowlisted addresses | Normal |
| Seed data in admin | "DEMO" chip on every `isSeedData` record | Absent |
| Compatibility display | "Sample data — not verified" caveat on unverified rows | Verified/unverified distinction only |
| GA4 | Disabled | Enabled |
| Search Console | Not verified, no submission | Configured |

**Banner text:**
> *Demonstration environment — product, pricing and compatibility data is sample data and is not
> verified LEI information.*

**Safety rail:** a startup assertion fails the boot if `DEMO_MODE=false` while any row has
`isSeedData = true` or any `Setting` value contains `PLACEHOLDER`. Demo data cannot reach
production by accident.

---

## 7. Domain flexibility (unchanged, restated)

`laserxprts.com` appears in **no** code, schema, migration or committed config.
`SITE_URL`, `ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, and Nginx `server_name` are all env-driven;
canonicals are derived at render, never stored. Moving to the production domain is an
environment change plus DNS/TLS — no code, no migration, no stored-data rebuild.

---

## 8. Sign-off requested

Five items, per your message:

| | Item | Where | The point to confirm |
|---|---|---|---|
| 1 | Product → Variant → SKU | §1 | **No grouping rule is encoded.** `product_key` decides it at import |
| 2 | Phase 1 model scope | §2 | 48 models · 40 in migration 001 · **35 with code** |
| 3 | Example dummy nozzle data | §3 | 5 families, 5 different shapes — including two that group *differently* |
| 4 | Import / seed flow | §4 | Seed uses the production importer; `product_key` + `attr:` columns |
| 5 | Schema changes | §5 | Merged attribute table · compatibility at either level · `variantAxes` |

### Open sub-questions

1. **Deferring Tier 3 (8 models) out of migration 001** — agreed? This is a change from
   Revision 1, made in response to "don't overcomplicate Phase 1".
2. **Seed brand names** — the plan uses real, publicly documented machine names (Raytools
   BM110, Precitec ProCutter, WSX NC30, Ospri) for structural realism, with every compatibility
   claim flagged `isSeedData` + `isVerified=false` + caveated in the UI. If you'd rather use
   fictional names, say so — it's a CSV edit, nothing more.

### On approval

```
Stage 1.1  — monorepo scaffold · Docker Compose (MySQL 8 + Redis)
             · env schema validation · /health · DEMO_MODE plumbing
             · nothing else
```

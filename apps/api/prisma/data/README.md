# Reference catalogue data

150 products extracted from the RMS Laser India reference storefront, with 555
product images. Loaded through the production CSV importer — the same code path
the demo seed uses.

## Layout

```
reference/          the importer's input, committed
  01-categories.csv     51 source categories
  02-attributes.csv    212 specification names (59 filterable)
  03-part-brands.csv    30 brands, from the source "Brand" specification
  04-products.csv      150 products + their specification values
  05-variants.csv      150 variants, one per product, MOQ from the source
  06-media.csv         555 image records

pipeline/           how the CSVs were produced, committed for reproducibility
  extract.py            saved HTML -> raw-extract.json
  verify_live.py        diffs the extract against the live pages
  fetch_images.py       downloads images into STORAGE_ROOT/products
  build_csv.py          raw-extract.json -> reference/*.csv
  image-manifest.json   source URL -> stored file, checksums and dimensions
```

## Loading

```
npm run db:import-reference            dry run
npm run db:import-reference -- --yes   apply
```

Import order is a dependency chain: categories, attributes and brands are
resolved by slug from the product rows, and variants and media resolve
`product_key` against the map the product pass builds. A dry run therefore only
validates as far as the product pass — later passes report unknown keys because
nothing was written for them to resolve against.

## Images are NOT in git

`storage/` is gitignored, so the 39 MB of image files exist only where they were
downloaded. To populate another environment, either copy
`apps/api/storage/products/` across, or re-run `pipeline/fetch_images.py`, which
re-downloads from the URLs in `image-manifest.json`.

Filenames are the SHA-256 of the file's bytes. That gives deduplication for free
— 555 image references resolve to 464 distinct files, because the source reuses
the same brand banner across many listings — and lets the API serve them with an
immutable cache header.

## What was deliberately not carried across

**Price.** The source publishes rupee prices and the customer-facing site must
not. No price reaches the database; `05-variants.csv` has no price column.

**Supplier identity.** The source's own copy names its company, city and
founding year. Published under LEI's name that would assert LEI *is* that
business, so any sentence naming it is dropped, along with brands and
specification values that do the same. Removal only: what survives is still
source text, never a rewrite. This emptied 97 of 150 descriptions, removed 3
part brands and 7 specification values.

**Machine compatibility.** The source states compatibility as free text inside
specifications ("Usage/Application: BODOR LASER CUTTING MACHINE"), never as
structured machine references. Those values are imported as specifications.
`product_compatibility` is left empty rather than guessing which machine models
the prose refers to.

## Generated identifiers

Three fields have no source counterpart. They are identifiers our schema
requires, not claims about the part:

| Field | Value |
| --- | --- |
| `sku` | `REF-<slug>` — LEI's internal stock code; the source publishes none |
| `variant_name` | `Standard` — each source listing is one sellable item |
| `part_number` | the source "Model Name/Number" when present, otherwise the sku |

`stock_status` is `MADE_TO_ORDER` throughout: the source publishes no stock
figure, and this states availability on request without inventing a shelf count.

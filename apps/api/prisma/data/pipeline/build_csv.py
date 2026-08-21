"""Turn the verified extract into the importer's CSV templates.

Everything written here traces back to the reference pages. Where the source is
silent the cell is left empty rather than filled with a plausible-looking value,
because a wrong specification on a laser consumable is worse than a missing one.

Three fields have no source counterpart and are generated. They are identifiers
our own system requires, not claims about the part:

  sku           LEI's internal stock code. The source publishes none.
  variant_name  "Standard" — each source listing is a single sellable item.
  part_number   the source "Model Name/Number" when present, otherwise the sku.

Deliberately NOT carried over: price. The customer-facing site quotes instead.
"""

import csv
import io
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = r"O:\Shop.laserxprts.com\apps\api\prisma\data\reference"

# Source category page -> the slug we store it under.
CATEGORY_SLUG_FIX = {"INNER OUTER CONE": "inner-outer-cone"}

UOM = {"piece": "PIECE", "pieces": "PIECE", "set": "SET", "sets": "SET",
       "pack": "PACK", "packs": "PACK", "box": "PACK", "boxes": "PACK",
       "meter": "METRE", "metre": "METRE", "litre": "LITRE", "liter": "LITRE",
       "kg": "KG", "unit": "PIECE", "units": "PIECE", "number": "PIECE",
       "numbers": "PIECE", "bottle": "PIECE", "packet": "PACK", "roll": "PIECE"}


def slugify(text):
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-{2,}", "-", text) or "item"


def unique(slug, taken, limit=180):
    base = slug[:limit]
    candidate = base
    n = 2
    while candidate in taken:
        suffix = f"-{n}"
        candidate = base[: limit - len(suffix)] + suffix
        n += 1
    taken.add(candidate)
    return candidate


# Sentences that identify the reference site's own business. Publishing these
# under LEI's name would assert LEI is that company, trading from that city,
# since that year — so the sentence is removed. Only removal happens here:
# nothing is paraphrased or written, so what survives is still source text.
SUPPLIER_CLAIM = re.compile(
    r"\bRMS\b|\bPune\b|\bMaharashtra\b|\bGarale\b"
    r"|since\s+2016|established\s+in\s+the\s+year|pan\s+india",
    re.I,
)


def strip_supplier(text):
    """Drop whole sentences that identify the source supplier."""
    if not text:
        return "", 0
    kept, dropped = [], 0
    for para in text.split("\n"):
        if not para.strip():
            kept.append("")
            continue
        sentences = re.split(r"(?<=[.!?])\s+", para.strip())
        keep = []
        for sentence in sentences:
            if SUPPLIER_CLAIM.search(sentence):
                dropped += 1
            else:
                keep.append(sentence)
        kept.append(" ".join(keep).strip())
    out = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()
    return out, dropped


def short_of(description, name):
    """First sentence of the source description, capped for the listing row.

    Truncation of real copy — never a written-from-scratch summary.
    """
    if not description:
        return ""
    first = re.split(r"(?<=[.!?])\s+", description.strip().replace("\n", " "), 1)[0]
    first = re.sub(r"\s+", " ", first).strip()
    if len(first) < 15 or len(first) > 480:
        first = re.sub(r"\s+", " ", description.strip())[:480]
    return first[:480]


def parse_moq(moq):
    """'10 Piece' -> (10, 'PIECE'). Absent or unparseable -> (1, 'PIECE')."""
    if not moq:
        return 1, "PIECE"
    m = re.match(r"\s*([\d,]+)\s*(.*)", moq)
    if not m:
        return 1, "PIECE"
    qty = int(m.group(1).replace(",", "")) or 1
    word = re.sub(r"[^a-z]", "", m.group(2).lower())
    return qty, UOM.get(word, "PIECE")


def write(name, header, rows):
    path = os.path.join(OUT, name)
    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=header, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"  {name:24} {len(rows):4} rows, {len(header):3} cols")


def main():
    os.makedirs(OUT, exist_ok=True)
    pages = json.load(io.open(os.path.join(HERE, "raw-extract.json"), encoding="utf-8"))
    manifest = json.load(io.open(os.path.join(HERE, "image-manifest.json")))["images"]

    # ── categories ───────────────────────────────────────────────────────
    cat_rows, cat_slug = [], {}
    taken = set()
    for order, page in enumerate(sorted(pages, key=lambda p: -len(p["products"])), 1):
        name = page["category"]
        slug = unique(CATEGORY_SLUG_FIX.get(name) or slugify(name), taken)
        cat_slug[name] = slug
        blurb, _ = strip_supplier(page["blurb"])
        cat_rows.append({"name": name, "slug": slug, "parent_slug": "",
                         "sort_order": order * 10, "description": blurb})

    # ── part brands, from the source "Brand" specification ───────────────
    # 'raytools' / 'Raytools' / 'RAYTOOLS' are one brand; group case-blind and
    # keep the spelling the source uses most often.
    spellings = defaultdict(Counter)
    for page in pages:
        for prod in page["products"]:
            for s in prod["specs"]:
                if s["name"].strip().lower() == "brand" and s["value"].strip():
                    spellings[s["value"].strip().lower()][s["value"].strip()] += 1

    brand_rows, brand_slug = [], {}
    taken = set()
    for key, counter in sorted(spellings.items()):
        display = counter.most_common(1)[0][0]
        # The reference site lists itself as the brand on a few house-label
        # items. Carrying that across would put a competitor's name on LEI's
        # products, so the brand is dropped and those products simply have
        # none — the column is optional.
        if SUPPLIER_CLAIM.search(display):
            continue
        slug = unique(slugify(display), taken)
        brand_slug[key] = slug
        brand_rows.append({"name": display, "slug": slug, "website": ""})

    # ── attributes ───────────────────────────────────────────────────────
    freq, values = Counter(), defaultdict(set)
    for page in pages:
        for prod in page["products"]:
            for s in prod["specs"]:
                freq[s["name"]] += 1
                values[s["name"]].add(s["value"])

    attr_rows, attr_slug = [], {}
    taken = set()
    for order, (name, count) in enumerate(freq.most_common(), 1):
        slug = unique(slugify(name), taken)
        attr_slug[name] = slug
        distinct = len(values[name])
        attr_rows.append({
            "name": name,
            "slug": slug,
            # Values are stored exactly as published ("15mm", "1mm, 28mm",
            # "50–200 W"). Splitting them into number + unit would mean deciding
            # what the source meant, so they stay STRING.
            "data_type": "STRING",
            "default_scope": "PRODUCT",
            "unit": "",
            # A facet is useful when several products share it and the value set
            # is small enough to list.
            "is_filterable": "true" if count >= 3 and distinct <= 25 else "false",
            "sort_order": order * 10,
        })

    # ── products + variants + media ──────────────────────────────────────
    attr_cols = [attr_slug[n] for n, _ in freq.most_common()]
    prod_header = ["product_key", "name", "slug", "category_slug", "part_brand_slug",
                   "product_type", "short_description", "description"] + [f"attr:{c}" for c in attr_cols]
    var_header = ["product_key", "sku", "part_number", "variant_name", "uom",
                  "pack_size", "min_order_qty", "stock_status", "is_default", "position"]
    media_header = ["product_key", "stored_name", "original_name", "path", "mime_type",
                    "extension", "size_bytes", "checksum_sha256", "width", "height",
                    "alt_text", "sort_order", "is_primary"]

    prod_rows, var_rows, media_rows = [], [], []
    stripped_sentences, emptied, dropped_specs = 0, [], []
    taken_slugs, taken_keys, taken_skus = set(), set(), set()
    missing_images = []

    for page in pages:
        for prod in page["products"]:
            slug = unique(slugify(prod["name"]), taken_slugs)
            key = unique(slug.upper()[:60], taken_keys)

            brand = ""
            for s in prod["specs"]:
                if s["name"].strip().lower() == "brand" and s["value"].strip():
                    brand = brand_slug.get(s["value"].strip().lower(), "")
                    break

            description, dropped = strip_supplier(prod["description"])
            stripped_sentences += dropped
            if prod["description"] and not description:
                emptied.append(prod["name"])

            row = {
                "product_key": key,
                "name": prod["name"],
                "slug": slug,
                "category_slug": cat_slug[prod["category"]],
                "part_brand_slug": brand,
                # Every source listing is a physical part; the enum's finer
                # distinctions are not something the source states.
                "product_type": "SPARE_PART",
                "short_description": short_of(description, prod["name"]),
                "description": description,
            }
            for s in prod["specs"]:
                # Same rule as the descriptions: a value naming the source
                # supplier or its city is about them, not about the part.
                if SUPPLIER_CLAIM.search(s["value"]):
                    dropped_specs.append((prod["name"], s["name"], s["value"]))
                    continue
                row[f"attr:{attr_slug[s['name']]}"] = s["value"]
            prod_rows.append(row)

            model = next((s["value"] for s in prod["specs"]
                          if s["name"].strip().lower() in ("model name/number", "model number", "model")), "")
            sku = unique(f"REF-{slug.upper()[:48]}", taken_skus)
            qty, uom = parse_moq(prod["moq"])
            var_rows.append({
                "product_key": key,
                "sku": sku,
                "part_number": model or sku,
                "variant_name": "Standard",
                "uom": uom,
                "pack_size": 1,
                "min_order_qty": qty,
                # The source publishes no stock figure. MADE_TO_ORDER states
                # availability on request without asserting a shelf count.
                "stock_status": "MADE_TO_ORDER",
                "is_default": "true",
                "position": 0,
            })

            if not prod["images"]:
                missing_images.append(prod["name"])
            for i, url in enumerate(prod["images"]):
                meta = manifest.get(url)
                if not meta:
                    continue
                media_rows.append({
                    "product_key": key,
                    **{k: meta[k] for k in ("storedName", "originalName", "path", "mimeType",
                                            "extension", "sizeBytes", "checksumSha256", "width", "height")},
                    "stored_name": meta["storedName"],
                    "original_name": meta["originalName"],
                    "mime_type": meta["mimeType"],
                    "size_bytes": meta["sizeBytes"],
                    "checksum_sha256": meta["checksumSha256"],
                    # The product name is the only alt text the source supports;
                    # it has no per-image captions.
                    "alt_text": prod["name"][:255],
                    "sort_order": i * 10,
                    "is_primary": "true" if i == 0 else "false",
                })

    print("writing to", OUT)
    write("01-categories.csv", ["name", "slug", "parent_slug", "sort_order", "description"], cat_rows)
    write("02-attributes.csv", ["name", "slug", "data_type", "default_scope", "unit", "is_filterable", "sort_order"], attr_rows)
    write("03-part-brands.csv", ["name", "slug", "website"], brand_rows)
    write("04-products.csv", prod_header, prod_rows)
    write("05-variants.csv", var_header, var_rows)
    write("06-media.csv", media_header, media_rows)

    print(f"\n  products without any image: {len(missing_images)}")
    for n in missing_images[:10]:
        print("   ", n)
    filt = sum(1 for a in attr_rows if a["is_filterable"] == "true")
    print(f"  attributes: {len(attr_rows)} ({filt} filterable)")


if __name__ == "__main__":
    main()

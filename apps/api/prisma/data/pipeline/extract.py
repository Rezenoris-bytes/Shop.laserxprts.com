"""Extract RMS reference catalogue data from the saved category pages.

Structure of a saved page (IndiaMART storefront template):
  h2                      -> category name
  section.pdp_img_txt     -> one product
    h3                    -> product name
    table.tbl             -> specification rows, td.fw6 = name, next td = value
    p.m_moq               -> minimum order quantity
    div[class^=cat_desc]  -> free-text description
    [data-multiimg]       -> comma-separated gallery URLs

Price is deliberately not extracted: the customer-facing site must not show it.
"""

import hashlib
import io
import json
import os
import re
import sys
from bs4 import BeautifulSoup

DOWNLOADS = r"C:\Users\Saran Devaraj\Downloads"

# Saved pages that are not RMS category pages.
SKIP = {
    "download.htm", "download (1).htm", "download (2).htm", "maps.htm",
    "share.htm", "share (1).htm", "sharer.htm", "enquiry.html", "photos.html",
    "profile.html", "sitemap.html", "terms-of-use.html", "testimonial.html",
}

# machine-lens.html was absent from the saved set and was fetched from the live
# site during the cross-check; it lives beside this script rather than in
# Downloads.
EXTRA_DIRS = [os.path.dirname(os.path.abspath(__file__))]
EXTRA_FILES = {"machine-lens.html"}
SKIP_PREFIX = ("metaspede-",)


def clean(text):
    return re.sub(r"\s+", " ", (text or "")).strip()


def best_images(raw):
    """Gallery URLs in source order, deduped, each at its largest resolution.

    IndiaMART serves the same asset at 125/250/500/1000px from paths differing
    only in that suffix, so the suffix is stripped to group them and the largest
    variant of each distinct image is kept.

    Source order is preserved deliberately: position 0 is the product's own
    listing photo, and the shots after it are often generic brand or catalogue
    banners shared across many listings. Sorting by resolution would promote a
    1000px banner over a 500px photo of the actual part and hand the wrong
    primary image to every such product.
    """
    if not raw:
        return []
    order = []
    best = {}
    for url in raw.split(","):
        url = url.strip()
        if not url or "imimg.com" not in url:
            continue
        m = re.search(r"-(\d+)x(\d+)\.(jpg|jpeg|png|webp|gif)$", url, re.I)
        size = int(m.group(1)) if m else 0
        key = re.sub(r"-\d+x\d+\.(jpg|jpeg|png|webp|gif)$", "", url, flags=re.I)
        if key not in best:
            order.append(key)
            best[key] = (size, url)
        elif size > best[key][0]:
            best[key] = (size, url)
    return [best[key][1] for key in order]


def extract_page(path):
    html = io.open(path, encoding="utf-8", errors="ignore").read()
    soup = BeautifulSoup(html, "lxml")

    h2 = soup.find("h2")
    category = clean(h2.get_text()) if h2 else None

    # The category blurb sits immediately after the h2 heading.
    blurb = None
    if h2:
        nxt = h2.find_next(string=re.compile(r"Providing you|We are|Prominent"))
        if nxt:
            blurb = clean(nxt)

    products = []
    for sec in soup.find_all("section", class_="pdp_img_txt"):
        h3 = sec.find("h3")
        if not h3:
            continue
        name = clean(h3.get_text())
        if not name:
            continue

        specs = []
        table = sec.find("table", class_="tbl")
        if table:
            for tr in table.find_all("tr"):
                tds = tr.find_all("td")
                if len(tds) >= 2:
                    key = clean(tds[0].get_text())
                    val = clean(tds[1].get_text())
                    if key and val:
                        specs.append({"name": key, "value": val})

        moq = None
        moq_el = sec.find("p", class_="m_moq")
        if moq_el:
            moq = clean(moq_el.get_text()).replace("Minimum order quantity:", "").strip()

        desc = None
        desc_el = sec.find("div", class_=re.compile(r"cat_desc"))
        if desc_el:
            for br in desc_el.find_all("br"):
                br.replace_with("\n")
            desc = re.sub(r"\n{3,}", "\n\n", desc_el.get_text()).strip()

        images = []
        img_el = sec.find(attrs={"data-multiimg": True})
        if img_el:
            images = best_images(img_el.get("data-multiimg"))

        products.append({
            "name": name,
            "category": category,
            "specs": specs,
            "moq": moq,
            "description": desc,
            "images": images,
            "sourceFile": os.path.basename(path),
        })

    return {"category": category, "blurb": blurb, "products": products}


def main():
    sources = [(DOWNLOADS, fn) for fn in sorted(os.listdir(DOWNLOADS))]
    for d in EXTRA_DIRS:
        sources += [(d, fn) for fn in sorted(os.listdir(d)) if fn in EXTRA_FILES]

    pages = []
    seen_files = {}
    for d, fn in sources:
        if not fn.lower().endswith((".html", ".htm")):
            continue
        if fn in SKIP or fn.startswith(SKIP_PREFIX):
            continue
        path = os.path.join(d, fn)

        # "laser-cutting-machine (1).html" is a second download of a page
        # already in the set. Hashing the body catches that without having to
        # hardcode which duplicate the browser happened to name first.
        digest = hashlib.md5(io.open(path, "rb").read()).hexdigest()
        if digest in seen_files:
            print(f"-- duplicate of {seen_files[digest]}, skipping: {fn}")
            continue
        seen_files[digest] = fn

        try:
            page = extract_page(path)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"!! {fn}: {exc}", file=sys.stderr)
            continue
        if page["products"]:
            pages.append(page)

    # A product listed under "New Items" is usually also listed in its real
    # category. Keep the categorised copy and drop the duplicate, matching on
    # name plus lead image so two genuinely different parts sharing a name are
    # not collapsed.
    primary = [p for p in pages if p["category"] != "New Items"]
    newitems = [p for p in pages if p["category"] == "New Items"]

    def key(prod):
        lead = prod["images"][0] if prod["images"] else ""
        return (prod["name"].lower(), lead)

    known = {key(prod) for page in primary for prod in page["products"]}
    for page in newitems:
        kept = []
        for prod in page["products"]:
            if key(prod) in known:
                print(f"-- also listed in a category, dropping from New Items: {prod['name']}")
            else:
                kept.append(prod)
        page["products"] = kept
    pages = primary + [p for p in newitems if p["products"]]

    total = sum(len(p["products"]) for p in pages)
    print(f"\npages with products: {len(pages)}   products: {total}")
    for p in pages:
        withimg = sum(1 for x in p["products"] if x["images"])
        withspec = sum(1 for x in p["products"] if x["specs"])
        imgs = sum(len(x["images"]) for x in p["products"])
        print(f"  {p['category'][:40]:42} n={len(p['products']):3}  img={withimg:3}  spec={withspec:3}  files={imgs:3}")

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw-extract.json")
    io.open(out, "w", encoding="utf-8").write(json.dumps(pages, indent=2, ensure_ascii=False))
    print("wrote", out)


if __name__ == "__main__":
    main()

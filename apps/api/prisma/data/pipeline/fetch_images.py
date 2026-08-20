"""Download the reference product images into the API's storage root.

Files are named by SHA-256 of their bytes, which gives the dedup the File model
already expects (checksum_sha256) for free: the same asset reused across two
products is stored once and referenced twice.

Writes image-manifest.json mapping each source URL to its stored file record.
"""

import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STORAGE = r"O:\Shop.laserxprts.com\apps\api\storage\products"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif"}

# A 1x1 transparent GIF is what the lazy-loading placeholders decode to. If one
# ever reaches this script the source URL was wrong, so fail loudly rather than
# storing it as a product photo.
PLACEHOLDER_MAX_BYTES = 512


def download(url, attempts=3):
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.rmslaserindia.com/"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (i + 1))
    raise last


def main():
    os.makedirs(STORAGE, exist_ok=True)
    pages = json.load(io.open(os.path.join(HERE, "raw-extract.json"), encoding="utf-8"))

    urls = []
    for page in pages:
        for prod in page["products"]:
            urls.extend(prod["images"])
    unique = list(dict.fromkeys(urls))
    print(f"{len(urls)} references -> {len(unique)} unique URLs")

    manifest = {}
    failures = []
    reused = 0

    for n, url in enumerate(unique, 1):
        try:
            data = download(url)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! {url}\n     {exc}")
            failures.append({"url": url, "error": str(exc)})
            continue

        if len(data) <= PLACEHOLDER_MAX_BYTES:
            print(f"  !! placeholder-sized response ({len(data)} bytes): {url}")
            failures.append({"url": url, "error": f"placeholder ({len(data)} bytes)"})
            continue

        digest = hashlib.sha256(data).hexdigest()
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
        if ext not in MIME:
            ext = ".jpg"
        stored = digest + ext
        path = os.path.join(STORAGE, stored)

        if os.path.exists(path):
            reused += 1
        else:
            io.open(path, "wb").write(data)

        try:
            with Image.open(io.BytesIO(data)) as im:
                width, height = im.size
                fmt = (im.format or "").lower()
        except Exception as exc:  # noqa: BLE001
            print(f"  !! not a decodable image: {url} ({exc})")
            os.path.exists(path) and os.remove(path)
            failures.append({"url": url, "error": f"undecodable: {exc}"})
            continue

        manifest[url] = {
            "storedName": stored,
            "originalName": os.path.basename(url.split("?")[0]),
            "path": "products/" + stored,
            "checksumSha256": digest,
            "mimeType": MIME[ext],
            "extension": ext.lstrip("."),
            "sizeBytes": len(data),
            "width": width,
            "height": height,
            "format": fmt,
        }

        if n % 25 == 0 or n == len(unique):
            print(f"  {n}/{len(unique)}  stored={len(manifest)}  reused={reused}  failed={len(failures)}")

    out = os.path.join(HERE, "image-manifest.json")
    io.open(out, "w", encoding="utf-8").write(
        json.dumps({"images": manifest, "failures": failures}, indent=2))

    distinct = len({v["checksumSha256"] for v in manifest.values()})
    total_mb = sum(v["sizeBytes"] for v in manifest.values()) / 1_048_576
    print(f"\nstored {len(manifest)} URLs -> {distinct} distinct files, {total_mb:.1f} MB")
    print(f"failures: {len(failures)}")
    for f in failures[:20]:
        print("   ", f["url"], "->", f["error"])
    print("wrote", out)
    return 1 if len(manifest) == 0 else 0


if __name__ == "__main__":
    sys.exit(main())

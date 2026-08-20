"""Cross-check the extract from the saved HTML against the live pages.

The saved pages were captured on 19 Aug; the live site may have moved on. This
re-fetches a sample of category pages and diffs product names and specification
name/value pairs, so any drift is reported rather than silently imported.
"""

import io
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import extract_page  # noqa: E402

BASE = "https://www.rmslaserindia.com/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

SAMPLE = [
    "laser-nozzle.html",
    "ceramic-rings.html",
    "focus-lenses.html",
    "cutting-head.html",
    "protective-lens.html",
]


def fetch(name):
    req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "ignore")


def specs_of(prod):
    return {(s["name"], s["value"]) for s in prod["specs"]}


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    saved = json.load(io.open(os.path.join(here, "raw-extract.json"), encoding="utf-8"))
    by_file = {}
    for page in saved:
        for prod in page["products"]:
            by_file.setdefault(prod["sourceFile"], []).append(prod)

    problems = 0
    for name in SAMPLE:
        tmp = os.path.join(here, "_live_" + name)
        try:
            io.open(tmp, "w", encoding="utf-8").write(fetch(name))
        except Exception as exc:  # noqa: BLE001
            print(f"!! could not fetch {name}: {exc}")
            problems += 1
            continue

        live = extract_page(tmp)["products"]
        mine = by_file.get(name, [])
        live_by = {p["name"]: p for p in live}
        mine_by = {p["name"]: p for p in mine}

        print(f"\n== {name}   saved={len(mine)}  live={len(live)}")

        only_saved = set(mine_by) - set(live_by)
        only_live = set(live_by) - set(mine_by)
        for n in sorted(only_saved):
            print(f"   ! in saved only: {n}")
            problems += 1
        for n in sorted(only_live):
            print(f"   ! on live only:  {n}")
            problems += 1

        for n in sorted(set(mine_by) & set(live_by)):
            a, b = specs_of(mine_by[n]), specs_of(live_by[n])
            if a != b:
                print(f"   ! spec drift: {n}")
                for row in sorted(a - b):
                    print(f"       saved only: {row}")
                for row in sorted(b - a):
                    print(f"       live only:  {row}")
                problems += 1
            ai, bi = mine_by[n]["images"], live_by[n]["images"]
            if len(ai) != len(bi):
                print(f"   ! image count differs: {n}  saved={len(ai)} live={len(bi)}")
                problems += 1

        os.remove(tmp)
        time.sleep(1)

    print(f"\n{'NO DIFFERENCES' if problems == 0 else str(problems) + ' DIFFERENCE(S)'} across {len(SAMPLE)} sampled pages")


if __name__ == "__main__":
    main()

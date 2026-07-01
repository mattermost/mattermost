#!/usr/bin/env python3
"""Extract redirects.py from sources/mattermost-docs and emit JSON for
@docusaurus/plugin-client-redirects.

Transforms each entry:
  "old/path.html": "https://docs.mattermost.com/new/path.html"   →  internal
  "old/path.html": "https://other.host/path.html"                →  external (logged, not migrated)

Output: redirects.json beside this script.

Run from repo root:
  python3 docs-site/scripts/migrate-main-docs/extract-redirects.py
"""
import json
import os
import sys
from urllib.parse import urlparse

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(REPO, "sources", "mattermost-docs", "source")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "redirects.json")

INTERNAL_HOST = "docs.mattermost.com"

sys.path.insert(0, SRC)
import redirects as r  # type: ignore


def normalize_from(key: str) -> str:
    """Sphinx key → leading-slash, .html-stripped path."""
    if key.endswith(".html"):
        key = key[:-5]
    if not key.startswith("/"):
        key = "/" + key
    return key


def normalize_to(value: str) -> tuple[str, bool]:
    """Returns (target, is_internal). Internal targets are stripped to a
    site-relative path; externals are returned verbatim."""
    parsed = urlparse(value)
    if parsed.scheme in ("http", "https") and parsed.netloc == INTERNAL_HOST:
        path = parsed.path
        if path.endswith(".html"):
            path = path[:-5]
        if not path.startswith("/"):
            path = "/" + path
        # Preserve anchor if present
        if parsed.fragment:
            path = f"{path}#{parsed.fragment}"
        return path, True
    # External or unrecognized — leave as-is; cannot use client-redirects
    return value, False


def main() -> int:
    internal: list[dict[str, str]] = []
    external: list[dict[str, str]] = []
    duplicates: list[str] = []
    seen: dict[str, str] = {}

    for key, value in r.redirects_map.items():
        src = normalize_from(key)
        dst, is_internal = normalize_to(value)
        if src in seen:
            duplicates.append(src)
            continue
        seen[src] = dst
        if is_internal:
            internal.append({"from": src, "to": dst})
        else:
            external.append({"from": src, "to": dst})

    payload = {
        "_meta": {
            "source": "sources/mattermost-docs/source/redirects.py",
            "internal_host": INTERNAL_HOST,
            "counts": {
                "internal": len(internal),
                "external": len(external),
                "duplicates_dropped": len(duplicates),
                "total_source_entries": len(r.redirects_map),
            },
        },
        "internal": internal,
        "external": external,
        "duplicates_dropped": duplicates,
    }

    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {OUT}")
    print(f"  internal:           {len(internal)}")
    print(f"  external:           {len(external)}")
    print(f"  duplicates dropped: {len(duplicates)}")
    print(f"  total source:       {len(r.redirects_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

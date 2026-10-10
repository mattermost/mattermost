#!/usr/bin/env python3
"""Hardlink-dedup images, drop sitemaps, emit client/_documentation tarball.

Usage: build-offline-bundle.py <build-dir> <output-tarball.tar.gz>

Redirect stubs are kept (~1 MB uncompressed); dropping them breaks legacy URLs.
"""

from __future__ import annotations

import hashlib
import os
import sys
import tarfile

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".avif", ".mp4"}


def die(msg: str) -> None:
    print(f"[build-offline-bundle] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def mb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB"


def walk_files(root: str):
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            yield os.path.join(dirpath, name)


def hardlink_dedup(build_dir: str) -> tuple[int, int, int]:
    """Collapse byte-identical images to hardlinks. Returns
    (groups_collapsed, links_created, bytes_saved)."""
    by_hash: dict[str, list[str]] = {}
    for path in walk_files(build_dir):
        ext = os.path.splitext(path)[1].lower()
        if ext not in IMAGE_EXTS:
            continue
        try:
            st = os.lstat(path)
        except OSError:
            continue
        if not os.path.isfile(path) or st.st_size == 0:
            continue
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                h.update(chunk)
        by_hash.setdefault(h.hexdigest(), []).append(path)

    groups = 0
    links = 0
    saved = 0
    for paths in by_hash.values():
        if len(paths) < 2:
            continue
        # Prefer an images/ path as the canonical inode when one exists.
        paths.sort(key=lambda p: (0 if "/images/" in p.replace("\\", "/") else 1, p))
        canonical = paths[0]
        canon_st = os.lstat(canonical)
        groups += 1
        for dup in paths[1:]:
            dup_st = os.lstat(dup)
            if (dup_st.st_dev, dup_st.st_ino) == (canon_st.st_dev, canon_st.st_ino):
                continue  # already the same inode
            # Link to a temp name in dup's directory, then atomically replace.
            # Never unlink(dup) before a successful link — a failed link would
            # leave the duplicate permanently deleted.
            tmp = os.path.join(
                os.path.dirname(dup),
                f".{os.path.basename(dup)}.{os.getpid()}.hl.tmp",
            )
            try:
                try:
                    os.unlink(tmp)
                except FileNotFoundError:
                    pass
                os.link(canonical, tmp)
                os.replace(tmp, dup)
            except OSError as exc:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                print(
                    f"[build-offline-bundle] WARN: hardlink failed for {dup}: {exc}",
                    file=sys.stderr,
                )
                continue
            links += 1
            saved += dup_st.st_size
    return groups, links, saved


def strip_sitemaps(build_dir: str) -> int:
    sitemaps = 0
    for path in list(walk_files(build_dir)):
        name = os.path.basename(path)
        if name == "sitemap.xml" or (name.startswith("sitemap-") and name.endswith(".xml")):
            os.unlink(path)
            sitemaps += 1
    return sitemaps


def disk_usage(root: str) -> tuple[int, int, int]:
    """Returns (file_count, apparent_bytes, unique_inode_bytes)."""
    files = 0
    apparent = 0
    seen: set[tuple[int, int]] = set()
    unique = 0
    for path in walk_files(root):
        try:
            st = os.lstat(path)
        except OSError:
            continue
        files += 1
        apparent += st.st_size
        key = (st.st_dev, st.st_ino)
        if key not in seen:
            seen.add(key)
            unique += st.st_size
    return files, apparent, unique


def emit_tarball(build_dir: str, out_path: str) -> int:
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    # dereference=False keeps hardlinks as links in the archive.
    with tarfile.open(out_path, "w:gz", dereference=False) as tf:
        tf.add(build_dir, arcname="_documentation")
    return os.path.getsize(out_path)


def main() -> None:
    if len(sys.argv) != 3:
        die(f"usage: {sys.argv[0]} <build-dir> <output-tarball.tar.gz>")
    build_dir = os.path.abspath(sys.argv[1])
    out_path = os.path.abspath(sys.argv[2])
    if not os.path.isdir(build_dir):
        die(f"build dir does not exist: {build_dir}")

    before_files, before_app, before_unique = disk_usage(build_dir)
    print(f"[build-offline-bundle] input: {build_dir}")
    print(f"[build-offline-bundle] before: {before_files:,} files, "
          f"apparent {mb(before_app)}, unique-inode {mb(before_unique)}")

    groups, links, saved = hardlink_dedup(build_dir)
    print(f"[build-offline-bundle] hardlink-dedup: {groups:,} groups, "
          f"{links:,} links created, {mb(saved)} saved")

    after_dedup_files, after_dedup_app, after_dedup_unique = disk_usage(build_dir)
    print(f"[build-offline-bundle] after dedup: {after_dedup_files:,} files, "
          f"apparent {mb(after_dedup_app)}, unique-inode {mb(after_dedup_unique)}")

    sitemaps = strip_sitemaps(build_dir)
    print(f"[build-offline-bundle] stripped: {sitemaps} sitemap(s)")

    final_files, final_app, final_unique = disk_usage(build_dir)
    print(f"[build-offline-bundle] final tree: {final_files:,} files, "
          f"apparent {mb(final_app)}, unique-inode {mb(final_unique)}")

    tar_size = emit_tarball(build_dir, out_path)
    print(f"[build-offline-bundle] wrote {out_path} ({mb(tar_size)} compressed)")


if __name__ == "__main__":
    main()

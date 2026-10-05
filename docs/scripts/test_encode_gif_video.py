#!/usr/bin/env python3
"""Tests for encode-gif-video.py. Run: python3 docs/scripts/test_encode_gif_video.py"""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import struct
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "encode-gif-video.py"


def load_mod():
    spec = importlib.util.spec_from_file_location("encode_gif_video", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = load_mod()


def write_solid_gif(path: Path, width: int, height: int, frames: int = 2, delay_cs: int = 10) -> None:
    """Minimal GIF87a with a 2-color global table and `frames` identical 1-color frames."""
    gct = bytes([0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF])
    header = b"GIF87a" + struct.pack("<HH", width, height) + bytes([0x80, 0x00, 0x00]) + gct
    body = bytearray()
    for _ in range(frames):
        body += bytes([0x21, 0xF9, 0x04, 0x00, delay_cs & 0xFF, (delay_cs >> 8) & 0xFF, 0x00, 0x00])
        body += bytes([0x2C, 0x00, 0x00, 0x00, 0x00])
        body += struct.pack("<HH", width, height)
        body += bytes([0x00, 0x02, 0x02, 0x4C, 0x01, 0x00])  # tiny LZW blob; decoder may warn
    path.write_bytes(header + bytes(body) + b"\x3B")


class DeriveVfTests(unittest.TestCase):
    def test_downscale_when_wider_than_1280(self):
        self.assertEqual(mod.derive_vf(2340, 1560), "scale=1280:-2:flags=lanczos")

    def test_crop_when_odd_height_no_downscale(self):
        self.assertEqual(mod.derive_vf(600, 1185), "crop=trunc(iw/2)*2:trunc(ih/2)*2")

    def test_crop_when_odd_width(self):
        self.assertEqual(mod.derive_vf(1035, 741), "crop=trunc(iw/2)*2:trunc(ih/2)*2")

    def test_passthrough_when_both_even_and_narrow(self):
        self.assertIsNone(mod.derive_vf(600, 1184))
        self.assertIsNone(mod.derive_vf(1280, 800))

    def test_1280_even_is_not_downscale(self):
        self.assertIsNone(mod.derive_vf(1280, 800))

    def test_1281_downscales(self):
        self.assertEqual(mod.derive_vf(1281, 800), "scale=1280:-2:flags=lanczos")


class SsimRefVfTests(unittest.TestCase):
    def test_crop_passed_through(self):
        self.assertEqual(
            mod.ssim_ref_vf("crop=trunc(iw/2)*2:trunc(ih/2)*2"),
            "crop=trunc(iw/2)*2:trunc(ih/2)*2",
        )

    def test_scale_and_null_skipped(self):
        self.assertIsNone(mod.ssim_ref_vf("scale=1280:-2:flags=lanczos"))
        self.assertIsNone(mod.ssim_ref_vf(None))


class GifParserTests(unittest.TestCase):
    def test_parse_real_inventory_gif(self):
        sample = mod.REPO_ROOT / "docs/site/static/images/create-team.gif"
        self.assertTrue(sample.is_file(), "create-team.gif missing from worktree")
        meta = mod.parse_gif(sample)
        self.assertEqual(meta["width"], 508)
        self.assertEqual(meta["height"], 547)
        self.assertEqual(meta["frames"], 43)
        self.assertGreater(meta["duration_s"], 2.0)
        self.assertLess(meta["duration_s"], 4.0)

    def test_rejects_non_gif(self):
        with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as fh:
            fh.write(b"not a gif")
            path = Path(fh.name)
        try:
            with self.assertRaises(mod.GifError):
                mod.parse_gif(path)
        finally:
            path.unlink()


class ManifestConsistencyTests(unittest.TestCase):
    def test_recorded_vf_matches_rule_for_every_entry(self):
        manifest_path = mod.MANIFEST_PATH
        if not manifest_path.is_file():
            self.skipTest("manifest not written yet")
        manifest = json.loads(manifest_path.read_text())
        mismatches = []
        for key, entry in manifest["files"].items():
            src = entry["source"]
            derived = mod.derive_vf(src["width"], src["height"])
            if entry.get("vf") != derived:
                mismatches.append((key, entry.get("vf"), derived))
        self.assertEqual(mismatches, [], msg=repr(mismatches[:5]))

    def test_every_committed_mp4_has_manifest_entry(self):
        if not mod.MANIFEST_PATH.is_file():
            self.skipTest("manifest not written yet")
        manifest = json.loads(mod.MANIFEST_PATH.read_text())
        recorded = {
            (entry.get("output") or {}).get("path")
            for entry in manifest["files"].values()
        }
        recorded.discard(None)
        dirs = [
            mod.REPO_ROOT / "docs/site/static/images",
            mod.REPO_ROOT / "docs/site/static/img/extend",
            mod.REPO_ROOT / "docs/develop/integrate/plugins/interactive-messages",
        ]
        orphans = []
        for d in dirs:
            if not d.is_dir():
                continue
            for p in d.glob("*.mp4"):
                rel = str(p.relative_to(mod.REPO_ROOT)).replace("\\", "/")
                if rel not in recorded:
                    orphans.append(rel)
        self.assertEqual(orphans, [])

    def test_output_sha256_matches_file_bytes(self):
        if not mod.MANIFEST_PATH.is_file():
            self.skipTest("manifest not written yet")
        manifest = json.loads(mod.MANIFEST_PATH.read_text())
        mismatches = []
        for key, entry in manifest["files"].items():
            out = entry.get("output") or {}
            path = out.get("path")
            if not path:
                mismatches.append((key, "no output path"))
                continue
            fp = mod.REPO_ROOT / path
            if not fp.is_file():
                mismatches.append((key, "missing file"))
                continue
            if fp.stat().st_size != out["bytes"]:
                mismatches.append((key, "size"))
            if mod.sha256_file(fp) != out["sha256"]:
                mismatches.append((key, "sha256"))
        self.assertEqual(mismatches, [])


class DeleteOnlyTests(unittest.TestCase):
    def test_poll_gifs_are_gone(self):
        leftovers = [
            p
            for p in (
                mod.REPO_ROOT / "docs/develop/integrate/faq/images/poll.gif",
                mod.REPO_ROOT / "docs/develop/integrate/plugins/interactive-messages/poll.gif",
            )
            if p.is_file()
        ]
        self.assertEqual(leftovers, [])

    def test_orphan_interactive_message_copies_are_gone(self):
        leftovers = [
            p
            for p in (
                mod.REPO_ROOT / "docs/develop/integrate/plugins/interactive-dialogs/interactive_message.gif",
                mod.REPO_ROOT / "docs/develop/integrate/faq/images/interactive_message.gif",
            )
            if p.is_file()
        ]
        self.assertEqual(leftovers, [])


class ReferenceIntegrityTests(unittest.TestCase):
    """Every markdown image / img useBaseUrl / Video src resolves on disk.

    While Phase 1.4 is blocked, GIF references must still resolve. After 1.4,
    the same walker covers <Video> targets. A miss is a broken docs image that
    Docusaurus only warns about.
    """

    IMG_MD = __import__("re").compile(r"!\[[^\]]*\]\(([^)]+)\)")
    USE_BASE = __import__("re").compile(r"useBaseUrl\(\s*['\"]([^'\"]+)['\"]\s*\)")
    VIDEO_SRC = __import__("re").compile(
        r"<Video\b[^>]*\bsrc=\{useBaseUrl\(\s*['\"]([^'\"]+)['\"]\s*\)\}"
        r"|<Video\b[^>]*\bsrc=[\"']([^\"']+)[\"']"
    )

    def _resolve(self, page: Path, target: str) -> Path | None:
        if target.startswith("/images/"):
            return mod.REPO_ROOT / "docs/site/static" / target.lstrip("/")
        if target.startswith("/img/"):
            return mod.REPO_ROOT / "docs/site/static" / target.lstrip("/")
        if "://" in target or target.startswith("#"):
            return None
        return (page.parent / target).resolve()

    def test_content_media_targets_exist(self):
        roots = [mod.REPO_ROOT / "docs/main", mod.REPO_ROOT / "docs/develop"]
        missing = []
        seen = 0
        for root in roots:
            for page in root.rglob("*"):
                if page.suffix not in {".md", ".mdx"}:
                    continue
                if "node_modules" in page.parts or "vendor" in page.parts:
                    continue
                text = page.read_text(encoding="utf-8")
                targets = []
                for m in self.IMG_MD.finditer(text):
                    targets.append(m.group(1).split()[0])
                for m in self.USE_BASE.finditer(text):
                    t = m.group(1)
                    if t.endswith((".gif", ".mp4", ".png", ".webp", ".jpg", ".jpeg")):
                        targets.append(t)
                for m in self.VIDEO_SRC.finditer(text):
                    targets.append(m.group(1) or m.group(2))
                for t in targets:
                    dest = self._resolve(page, t)
                    if dest is None:
                        continue
                    seen += 1
                    if t.endswith((".gif", ".mp4")) and not dest.is_file():
                        missing.append("%s -> %s" % (page.relative_to(mod.REPO_ROOT), t))
        self.assertGreater(seen, 50, "walker found too few media refs; pattern likely wrong")
        self.assertEqual(missing, [])


class WantsReencodeCrfTests(unittest.TestCase):
    def _matching_entry(self, src: Path, dst: Path, crf: int | None, recorded_crf: int) -> dict:
        src.write_bytes(b"gif-bytes")
        dst.write_bytes(b"mp4-bytes")
        return {
            "crf": crf,
            "vf": None,
            "source": {
                "width": 100,
                "height": 100,
                "sha256": mod.sha256_file(src),
            },
            "output": {
                "path": str(dst),
                "sha256": mod.sha256_file(dst),
                "crf": recorded_crf,
            },
        }

    def test_crf_patch_without_force_reencodes(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            src = td_path / "clip.gif"
            dst = td_path / "clip.mp4"
            entry = self._matching_entry(src, dst, crf=32, recorded_crf=32)
            self.assertFalse(mod.wants_reencode(entry, src, dst, force=False))
            entry["crf"] = 24
            self.assertTrue(mod.wants_reencode(entry, src, dst, force=False))

    def test_null_crf_patch_off_baseline_reencodes(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            src = td_path / "clip.gif"
            dst = td_path / "clip.mp4"
            entry = self._matching_entry(src, dst, crf=None, recorded_crf=mod.BASELINE_CRF)
            self.assertFalse(mod.wants_reencode(entry, src, dst, force=False))
            entry["crf"] = 26
            self.assertTrue(mod.wants_reencode(entry, src, dst, force=False))

    def test_missing_output_crf_reencodes(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            src = td_path / "clip.gif"
            dst = td_path / "clip.mp4"
            entry = self._matching_entry(src, dst, crf=26, recorded_crf=26)
            del entry["output"]["crf"]
            self.assertTrue(mod.wants_reencode(entry, src, dst, force=False))


class EncodeIdempotencyTests(unittest.TestCase):
    def test_second_encode_encodes_zero_files(self):
        if not mod.MANIFEST_PATH.is_file():
            self.skipTest("manifest not written yet")
        manifest = json.loads(mod.MANIFEST_PATH.read_text())
        if not any((e.get("output") or {}).get("sha256") for e in manifest["files"].values()):
            self.skipTest("nothing encoded yet")
        # Capture mtimes, run encode, assert no file rewritten.
        outputs = []
        for entry in manifest["files"].values():
            out = entry.get("output") or {}
            path = out.get("path")
            if not path:
                continue
            fp = mod.REPO_ROOT / path
            if fp.is_file():
                outputs.append((fp, fp.stat().st_mtime_ns, mod.sha256_file(fp)))
        self.assertGreater(len(outputs), 0)
        manifest = mod.load_manifest()
        mod.assert_tree_consistent(manifest)
        baseline = int((manifest.get("encoder") or {}).get("baseline_crf", mod.BASELINE_CRF))
        work = []
        for key, entry in manifest["files"].items():
            out = entry.get("output") or {}
            out_rel = out.get("path") or mod.output_path_for(key)
            if mod.wants_reencode(
                entry,
                mod.REPO_ROOT / key,
                mod.REPO_ROOT / out_rel,
                force=False,
                baseline=baseline,
            ):
                work.append(key)
        self.assertEqual(work, [], "refusing to encode with stale repository inputs or outputs")
        rc = mod.cmd_encode(manifest, only=None, force=False, jobs=1)
        self.assertEqual(rc, 0)
        changed = []
        for fp, mtime, digest in outputs:
            st = fp.stat()
            if st.st_mtime_ns != mtime or mod.sha256_file(fp) != digest:
                changed.append(str(fp))
        self.assertEqual(changed, [], "encode rewrote files that should have been skipped")


class CrfSeedTests(unittest.TestCase):
    def test_tier_a_starts_at_26(self):
        crf, note = mod.seed_crf("mobile-include-emojis-for-a-message-reaction.gif", 6_000_000, None)
        self.assertEqual(crf, 26)
        self.assertIn("tier A", note)

    def test_under_1mb_is_tier_c_except_message_navigation(self):
        crf, note = mod.seed_crf("teams.gif", 128_764, None)
        self.assertEqual(crf, 26)
        self.assertIn("tier C", note)
        crf_d, _ = mod.seed_crf("message-navigation.gif", 723_505, None)
        self.assertEqual(crf_d, 32)

    def test_existing_override_is_preserved(self):
        crf, note = mod.seed_crf("teams.gif", 128_764, {"crf": 24, "note": "reviewer"})
        self.assertEqual(crf, 24)
        self.assertEqual(note, "reviewer")


if __name__ == "__main__":
    os.chdir(mod.REPO_ROOT)
    unittest.main(verbosity=2)

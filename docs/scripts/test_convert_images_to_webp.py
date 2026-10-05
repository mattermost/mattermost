#!/usr/bin/env python3
"""Behavioral tests for docs/scripts/convert-images-to-webp.py.

These assert gate correctness, ICC handling, reference matching, skip
honouring, and idempotency. They do not assert that a .webp merely exists.
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "convert_images_to_webp", SCRIPT_DIR / "convert-images-to-webp.py"
)
conv = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
sys.modules[_spec.name] = conv
_spec.loader.exec_module(conv)

REPO = conv.repo_root_from_script()
MANIFEST = REPO / "docs/scripts/webp-manifest.toml"


def tools_or_skip():
    for name in ("cwebp", "dwebp", "ssimulacra2"):
        if not conv.which_tool(name):
            raise unittest.SkipTest(conv.INSTALL_LINE)
    return conv.require_tools()


def gradient_rgba(w: int, h: int, transparent_corner: bool = False) -> bytes:
    buf = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 4
            buf[i] = (x * 255) // max(w - 1, 1)
            buf[i + 1] = (y * 255) // max(h - 1, 1)
            buf[i + 2] = 80
            if transparent_corner and x < w // 4 and y < h // 4:
                buf[i + 3] = 0
            else:
                buf[i + 3] = 255
    return bytes(buf)


class ReferenceMatchingTests(unittest.TestCase):
    def test_left_boundary_does_not_rewrite_substring_basenames(self):
        text = (
            "![x](/images/ime.png) "
            "![y](/images/mattermost_system_server_start_time.png) "
            "![z](/images/new-azure-registration.png) "
            "![w](/images/ms-teams-meetings-new-azure-registration.png) "
            "![k](/images/kubernetes.png) "
            "![c](/images/calls-deployment-kubernetes.png)\n"
        )
        out, n = conv.replace_refs_in_text(text, "/images/ime.png")
        self.assertEqual(n, 1)
        self.assertIn("/images/ime.webp", out)
        self.assertIn("/images/mattermost_system_server_start_time.png", out)

        out, n = conv.replace_refs_in_text(text, "/images/new-azure-registration.png")
        self.assertEqual(n, 1)
        self.assertIn("/images/new-azure-registration.webp", out)
        self.assertIn("/images/ms-teams-meetings-new-azure-registration.png", out)

        out, n = conv.replace_refs_in_text(text, "/images/kubernetes.png")
        self.assertEqual(n, 1)
        self.assertIn("/images/kubernetes.webp", out)
        self.assertIn("/images/calls-deployment-kubernetes.png", out)

    def test_site_ref_strips_static_prefix(self):
        self.assertEqual(
            conv.site_ref_for("docs/site/static/images/notices.png"),
            "/images/notices.png",
        )
        self.assertEqual(
            conv.site_ref_for("docs/site/static/img/ime/logos/ask-sage.png"),
            "/img/ime/logos/ask-sage.png",
        )


class ManifestInventoryTests(unittest.TestCase):
    def test_manifest_paths_and_skip_reasons(self):
        m = conv.load_manifest(MANIFEST)
        self.assertEqual(m.threshold, 85.0)
        self.assertEqual(m.ladder, ["q80s", "q90s", "q95s", "q98s", "nl40", "lossless"])
        self.assertIn("-metadata", m.common)
        self.assertIn("icc", m.common)
        by_path = {i.path: i for i in m.images}
        self.assertGreaterEqual(len(m.images), 25)
        self.assertEqual(by_path["docs/site/static/img/ime/entadv.png"].skip, "generated")
        self.assertEqual(by_path["docs/site/static/images/ime.png"].skip, "orphaned")
        for img in m.images:
            src = REPO / img.path
            webp = conv.output_path_for(src)
            if img.skip == "orphaned":
                self.assertFalse(src.is_file(), img.path)
                self.assertFalse(webp.is_file(), str(webp))
            elif img.skip == "generated":
                self.assertTrue(src.is_file(), img.path)
                self.assertFalse(webp.is_file(), str(webp))
            else:
                # Dual PNG/JPG sources are dropped after conversion; only .webp remains.
                self.assertFalse(src.is_file(), img.path)
                self.assertTrue(webp.is_file(), str(webp))

    def test_converted_entries_match_state_hashes(self):
        m = conv.load_manifest(MANIFEST)
        state = conv.load_state(REPO / "docs/scripts/webp-state.json")
        converted = [i for i in m.images if not i.skip]
        self.assertGreaterEqual(len(converted), 23)
        for img in converted:
            webp = conv.output_path_for(REPO / img.path)
            self.assertTrue(webp.is_file(), str(webp))
            recorded = state[img.path]
            self.assertEqual(recorded["sha256"], conv.sha256_file(webp), img.path)
            self.assertIn("source_sha256", recorded, img.path)


class SkipHonourTests(unittest.TestCase):
    def test_skipped_entries_do_not_emit_webp(self):
        tools_or_skip()
        m = conv.load_manifest(MANIFEST)
        skipped = [i for i in m.images if i.skip]
        self.assertTrue(skipped)
        for img in skipped:
            webp = conv.output_path_for(REPO / img.path)
            self.assertFalse(webp.is_file(), f"{webp} should not exist for skip={img.skip}")
            rc = conv.main(
                [
                    "--repo",
                    str(REPO),
                    "--only",
                    img.path,
                    "--no-update-refs",
                    "--jobs",
                    "1",
                ]
            )
            self.assertEqual(rc, 0)
            self.assertFalse(webp.is_file())


class GateTests(unittest.TestCase):
    def test_lossless_round_trip_scores_100(self):
        tools = tools_or_skip()
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            src = tmp / "orig.png"
            conv.write_png_rgba(src, 128, 128, gradient_rgba(128, 128))
            ref = tmp / "ref.png"
            conv.strip_png_iccp(src, ref)
            ref_w = tmp / "ref_w.png"
            conv.composite_white(tools, ref, ref_w)
            webp = tmp / "lossless.webp"
            conv.encode_cwebp(
                tools,
                src,
                webp,
                ["-m", "6", "-metadata", "icc", "-lossless", "-z", "9", "-exact"],
            )
            score = conv.score_candidate(tools, ref_w, webp, tmp / "s")
            self.assertGreaterEqual(score, 99.5, score)

    def test_wrecked_q5_fails_threshold(self):
        tools = tools_or_skip()
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            src = tmp / "orig.png"
            w = h = 192
            buf = bytearray(w * h * 4)
            rng = 99
            for i in range(0, len(buf), 4):
                rng = (1_103_515_245 * rng + 12345) & 0x7FFFFFFF
                buf[i] = rng & 255
                buf[i + 1] = (rng >> 8) & 255
                buf[i + 2] = (rng >> 16) & 255
                buf[i + 3] = 255
            conv.write_png_rgba(src, w, h, bytes(buf))
            ref = tmp / "ref.png"
            conv.strip_png_iccp(src, ref)
            ref_w = tmp / "ref_w.png"
            conv.composite_white(tools, ref, ref_w)
            webp = tmp / "q5.webp"
            conv.encode_cwebp(tools, src, webp, ["-q", "5", "-m", "6"])
            score = conv.score_candidate(tools, ref_w, webp, tmp / "s")
            self.assertLess(score, 85.0, score)

    def test_icc_stripped_reference_scores_lossless_100(self):
        tools = tools_or_skip()
        # Real iCCP chunk from a former docs PNG (sources are dropped after WebP).
        iccp = bytes.fromhex(
            "4943432050726f66696c65000028916d90c12b837118c73f63acd68a83841c76"
            "90d388218e3624b5c38c154abc7bcdd0f6faf5ee95dc1c382ac5c54d737173e3"
            "e2e03fa09483240717675989f57a5ec336fc7e3d7d3f7d7b9ea7a72f54f934a5"
            "d26e206358666c34ec9f9a9ef17b9ef0e2a1866e5a343dab42d168445af8d6ca"
            "97bfc1e5e87587b3ebb179feb510c8ccd55a833b2b27f9d9bffd15cfbb90ccea"
            "a2ef52415d9916b8ba84a3eb96727853b8c194a384f71d4e15f9d8e14491cf3f"
            "7b266343c257c2f5fa92b620fc201c4894f9a932cea4d7f4af1b9ceb7d49233e"
            "21da28d5ca302344e4fb8913a45f7218605c32fa7fa6f773668855141b982c93"
            "62094ba643e228d22485c730d0e924201ca44baacfc9fa7786256f3507032f50"
            "bd5bf2120770b60d4db725afed10eab6e0f45269a6f693ac2befce2ef6048bec"
            "0b43cdbd6d3fb783670f0abbb6fd96b3edc291ecbf830be303a0456486"
        )
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            src = tmp / "orig.png"
            conv.write_png_rgba(src, 192, 192, gradient_rgba(192, 192), iccp=iccp)
            self.assertTrue(conv.png_has_iccp(src))
            stripped = tmp / "stripped.png"
            conv.strip_png_iccp(src, stripped)
            self.assertFalse(conv.png_has_iccp(stripped))
            webp = tmp / "lossless.webp"
            conv.encode_cwebp(
                tools,
                src,
                webp,
                ["-m", "6", "-metadata", "icc", "-lossless", "-z", "0", "-exact"],
            )
            decoded = tmp / "decoded.png"
            conv.run_checked(
                [tools["dwebp"], "-quiet", str(webp), "-o", str(decoded)],
                "dwebp lossless",
            )
            naive = conv.ssimulacra2_score(tools, src, decoded)
            good = conv.ssimulacra2_score(tools, stripped, decoded)
            self.assertGreaterEqual(good, 99.5, good)
            self.assertLess(naive, 90.0, naive)
            self.assertLess(naive, good)


class AlphaTests(unittest.TestCase):
    def test_output_keeps_alpha_and_transparent_pixels(self):
        tools = tools_or_skip()
        info = tools.get("webpinfo")
        if not info:
            self.skipTest("webpinfo not installed")
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            src = tmp / "alpha.png"
            conv.write_png_rgba(src, 128, 128, gradient_rgba(128, 128, transparent_corner=True))
            webp = tmp / "alpha.webp"
            conv.encode_cwebp(
                tools,
                src,
                webp,
                ["-m", "6", "-metadata", "icc", "-q", "90", "-sharp_yuv"],
            )
            proc = conv.run_checked([info, str(webp)], "webpinfo")
            out = (proc.stdout or b"").decode()
            self.assertIn("Alpha: 1", out)
            self.assertNotIn("-noalpha", ["-q", "90", "-sharp_yuv"])
            pam = tmp / "out.pam"
            conv.run_checked([tools["dwebp"], "-pam", str(webp), "-o", str(pam)], "dwebp pam")
            w, h, depth, body = conv.parse_pam(pam)
            self.assertEqual((w, h), (128, 128))
            # Fully transparent source pixels must stay fully transparent.
            self.assertEqual(body[3], 0)
            self.assertEqual(body[(10 * 128 + 10) * depth + 3], 0)
            opaque_i = (100 * 128 + 100) * depth + 3
            self.assertEqual(body[opaque_i], 255)


class EndToEndRepoTests(unittest.TestCase):
    def _mini_repo(self, tmp: Path, *, skip_generated: bool = False) -> Path:
        (tmp / "docs/scripts").mkdir(parents=True)
        (tmp / "docs/site/static/images").mkdir(parents=True)
        src = tmp / "docs/site/static/images/fixture.png"
        conv.write_png_rgba(src, 96, 96, gradient_rgba(96, 96))
        mdx = tmp / "docs/main"
        mdx.mkdir(parents=True)
        (mdx / "page.mdx").write_text("![f](/images/fixture.png)\n", encoding="utf-8")
        if skip_generated:
            gen = tmp / "docs/site/static/img/ime"
            gen.mkdir(parents=True)
            conv.write_png_rgba(gen / "entadv.png", 32, 32, gradient_rgba(32, 32))
        manifest = tmp / "docs/scripts/webp-manifest.toml"
        skip_block = ""
        if skip_generated:
            skip_block = """
[[image]]
path = "docs/site/static/img/ime/entadv.png"
skip = "generated"
reason = "ci"
"""
        manifest.write_text(
            f"""
[defaults]
threshold = 85.0
ladder = ["q80s", "q90s", "q95s", "q98s", "nl40", "lossless"]
common = ["-m", "6", "-metadata", "icc"]

[candidates]
q80s     = ["-q", "80", "-sharp_yuv"]
q90s     = ["-q", "90", "-sharp_yuv"]
q95s     = ["-q", "95", "-sharp_yuv"]
q98s     = ["-q", "98", "-sharp_yuv"]
nl40     = ["-near_lossless", "40", "-q", "100"]
lossless = ["-lossless", "-z", "9", "-exact"]

common = ["-m", "6", "-metadata", "icc"]

[[image]]
path = "docs/site/static/images/fixture.png"
{skip_block}
""",
            encoding="utf-8",
        )
        return tmp

    def test_idempotency_second_run_writes_nothing(self):
        tools_or_skip()
        with tempfile.TemporaryDirectory() as td:
            repo = self._mini_repo(Path(td))
            args = [
                "--repo",
                str(repo),
                "--manifest",
                str(repo / "docs/scripts/webp-manifest.toml"),
                "--jobs",
                "1",
            ]
            self.assertEqual(conv.main(args), 0)
            webp = repo / "docs/site/static/images/fixture.webp"
            src = repo / "docs/site/static/images/fixture.png"
            self.assertTrue(webp.is_file())
            page = (repo / "docs/main/page.mdx").read_text(encoding="utf-8")
            self.assertIn("/images/fixture.webp", page)
            self.assertNotIn("/images/fixture.png", page)
            mtime = webp.stat().st_mtime_ns
            digest = conv.sha256_file(webp)
            state = conv.load_state(repo / "docs/scripts/webp-state.json")
            self.assertEqual(
                state["docs/site/static/images/fixture.png"]["source_sha256"],
                conv.sha256_file(src),
            )
            # Simulate a fresh clone: source mtime newer than committed WebP.
            src.touch()
            self.assertGreater(src.stat().st_mtime_ns, webp.stat().st_mtime_ns)
            self.assertEqual(conv.main(args), 0)
            self.assertEqual(webp.stat().st_mtime_ns, mtime)
            self.assertEqual(conv.sha256_file(webp), digest)

    def test_verify_refs_catches_leftover_png(self):
        tools_or_skip()
        with tempfile.TemporaryDirectory() as td:
            repo = self._mini_repo(Path(td))
            conv.main(
                [
                    "--repo",
                    str(repo),
                    "--manifest",
                    str(repo / "docs/scripts/webp-manifest.toml"),
                    "--jobs",
                    "1",
                    "--no-update-refs",
                ]
            )
            m = conv.load_manifest(repo / "docs/scripts/webp-manifest.toml")
            errs = conv.verify_refs(repo, m.images)
            self.assertTrue(any("leftover" in e for e in errs), errs)

    def test_wrecked_encode_reports_failed_via_pinned_q5(self):
        tools_or_skip()
        with tempfile.TemporaryDirectory() as td:
            repo = Path(td)
            self._mini_repo(repo)
            # Dense high-frequency pattern so -q 5 cannot clear 85.
            src = repo / "docs/site/static/images/fixture.png"
            w = h = 160
            buf = bytearray(w * h * 4)
            rng = 1234567
            for i in range(0, len(buf), 4):
                rng = (1_103_515_245 * rng + 12345) & 0x7FFFFFFF
                buf[i] = rng & 255
                buf[i + 1] = (rng >> 8) & 255
                buf[i + 2] = (rng >> 16) & 255
                buf[i + 3] = 255
            conv.write_png_rgba(src, w, h, bytes(buf))
            text = (repo / "docs/scripts/webp-manifest.toml").read_text(encoding="utf-8")
            text = text.replace(
                'path = "docs/site/static/images/fixture.png"\n',
                'path = "docs/site/static/images/fixture.png"\npinned = "q5"\n',
            )
            text = text.replace(
                'q80s     = ["-q", "80", "-sharp_yuv"]\n',
                'q5       = ["-q", "5"]\nq80s     = ["-q", "80", "-sharp_yuv"]\n',
            )
            (repo / "docs/scripts/webp-manifest.toml").write_text(text, encoding="utf-8")
            rc = conv.main(
                [
                    "--repo",
                    str(repo),
                    "--manifest",
                    str(repo / "docs/scripts/webp-manifest.toml"),
                    "--jobs",
                    "1",
                    "--no-update-refs",
                ]
            )
            self.assertEqual(rc, 1)
            self.assertFalse((repo / "docs/site/static/images/fixture.webp").is_file())


if __name__ == "__main__":
    unittest.main()

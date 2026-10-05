#!/usr/bin/env python3
"""Encode inventoried docs GIFs to H.264 MP4. Standard library + ffmpeg only.

Commands: inventory | encode | verify | report | review
"""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
MANIFEST_PATH = SCRIPT_DIR / "gif-video-manifest.json"
DOCS_DIR = REPO_ROOT / "docs"
EXCLUDE_DIR_NAMES = {"node_modules", "build", "vendor", ".git"}
EXCLUDE_PREFIXES = (
    DOCS_DIR / "site" / "build",
    DOCS_DIR / "vendor",
)
DELETE_ONLY = [
    "docs/develop/integrate/faq/images/poll.gif",
    "docs/develop/integrate/plugins/interactive-messages/poll.gif",
    "docs/develop/integrate/plugins/interactive-dialogs/interactive_message.gif",
    "docs/develop/integrate/faq/images/interactive_message.gif",
]
ENCODER_ARGS = [
    "-an",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-tune",
    "animation",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
]
BASELINE_CRF = 32
MAX_WIDTH = 1280
REVIEW_DIR = Path("/tmp/gif-review")
TIER_A = {
    "mobile-include-emojis-for-a-message-reaction.gif",
    "mobile-start-a-call-in-a-channel.gif",
    "mobile-attach-a-file-to-send-in-a-channel.gif",
}
TIER_D = {
    "Retro.gif",
    "collapsed-reply-threads.gif",
    "MPA-Animated-GIF-Update-2023-08-15.gif",
    "dark-theme-via-os.gif",
    "unreads.gif",
    "restore-previous-edited-message.gif",
    "message-navigation.gif",
}
TIER_E = {
    "keywords-trigger-mentions.gif",
    "keywords-highlighted.gif",
}


class GifError(Exception):
    pass


def ffmpeg_bin() -> str:
    env = os.environ.get("FFMPEG")
    if env:
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    brew = "/opt/homebrew/bin/ffmpeg"
    if os.path.isfile(brew):
        return brew
    sys.exit("ffmpeg not found on PATH or at /opt/homebrew/bin/ffmpeg")


def ffprobe_bin() -> str:
    env = os.environ.get("FFPROBE")
    if env:
        return env
    found = shutil.which("ffprobe")
    if found:
        return found
    brew = "/opt/homebrew/bin/ffprobe"
    if os.path.isfile(brew):
        return brew
    return "ffprobe"


def cwebp_bin() -> str | None:
    found = shutil.which("cwebp")
    if found:
        return found
    brew = "/opt/homebrew/bin/cwebp"
    if os.path.isfile(brew):
        return brew
    return None


def skip_path(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except OSError:
        resolved = path
    for prefix in EXCLUDE_PREFIXES:
        try:
            resolved.relative_to(prefix)
            return True
        except ValueError:
            pass
    return any(part in EXCLUDE_DIR_NAMES for part in path.parts)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_gif(path: Path) -> dict:
    """GIF89a parser: logical-screen size, Image Descriptor count, delay sum."""
    data = path.read_bytes()
    if data[:6] not in (b"GIF87a", b"GIF89a"):
        raise GifError("not a GIF: magic=%r" % (data[:6],))
    width = int.from_bytes(data[6:8], "little")
    height = int.from_bytes(data[8:10], "little")
    packed = data[10]
    gct_flag = (packed & 0x80) != 0
    gct_size = 2 ** ((packed & 0x07) + 1)
    i = 13
    if gct_flag:
        i += 3 * gct_size

    frames = 0
    total_delay = 0
    pending_delay = 0

    def read_sub_blocks(j):
        while True:
            if j >= len(data):
                raise GifError("truncated sub-block chain")
            n = data[j]
            j += 1
            if n == 0:
                return j
            j += n

    while i < len(data):
        b = data[i]
        if b == 0x3B:
            break
        if b == 0x21:
            if i + 1 >= len(data):
                raise GifError("truncated extension")
            label = data[i + 1]
            i += 2
            if label == 0xF9:
                size = data[i]
                block = data[i + 1 : i + 1 + size]
                if size >= 4:
                    pending_delay = int.from_bytes(block[1:3], "little")
                i += 1 + size
                i = read_sub_blocks(i)
            else:
                size = data[i]
                i += 1 + size
                i = read_sub_blocks(i)
            continue
        if b == 0x2C:
            frames += 1
            total_delay += pending_delay
            pending_delay = 0
            lct_packed = data[i + 9]
            i += 10
            if lct_packed & 0x80:
                i += 3 * (2 ** ((lct_packed & 0x07) + 1))
            i += 1
            i = read_sub_blocks(i)
            continue
        raise GifError("unexpected block 0x%02X at offset %d" % (b, i))

    duration_s = total_delay / 100.0
    return {
        "width": width,
        "height": height,
        "frames": frames,
        "duration_s": duration_s,
        "fps": (frames / duration_s) if duration_s else 0.0,
    }


def derive_vf(width: int, height: int, max_width: int = MAX_WIDTH) -> str | None:
    """§1.4 filter: downscale >1280, crop odd dims, else no scale stage."""
    if width > max_width:
        return "scale=%d:-2:flags=lanczos" % max_width
    if (width % 2) or (height % 2):
        return "crop=trunc(iw/2)*2:trunc(ih/2)*2"
    return None


def effective_crf(entry: dict, baseline: int = BASELINE_CRF) -> int:
    crf = entry.get("crf")
    return baseline if crf is None else int(crf)


def output_path_for(source_rel: str) -> str:
    return str(Path(source_rel).with_suffix(".mp4"))


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return empty_manifest()
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def empty_manifest() -> dict:
    return {
        "encoder": {
            "ffmpeg": None,
            "libx264": None,
            "baseline_crf": BASELINE_CRF,
            "max_width": MAX_WIDTH,
            "args": list(ENCODER_ARGS),
        },
        "files": {},
        "delete_only": list(DELETE_ONLY),
    }


def dump_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    files = manifest.get("files") or {}
    manifest["files"] = dict(sorted(files.items()))
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def detect_encoder_versions() -> tuple[str, str]:
    out = subprocess.check_output([ffmpeg_bin(), "-version"], text=True, stderr=subprocess.STDOUT)
    m = re.search(r"ffmpeg version (\S+)", out)
    if not m:
        sys.exit("could not parse ffmpeg version from `ffmpeg -version`")
    ffmpeg_ver = m.group(1)
    m264 = re.search(r"libx264\s+(\d+\.\d+)", out)
    if m264:
        return ffmpeg_ver, m264.group(1)
    x264 = shutil.which("x264") or "/opt/homebrew/bin/x264"
    if os.path.isfile(x264):
        xout = subprocess.check_output([x264, "--version"], text=True, stderr=subprocess.STDOUT)
        m2 = re.search(r"x264\s+0\.(\d+)\.(\d+)", xout)
        if m2:
            return ffmpeg_ver, "%s.%s" % (m2.group(1), m2.group(2))
    sys.exit("could not parse libx264 version")


def iter_gifs() -> list[Path]:
    found = []
    for root, dirs, files in os.walk(DOCS_DIR):
        root_path = Path(root)
        dirs[:] = [d for d in dirs if not skip_path(root_path / d)]
        for name in files:
            if name.lower().endswith(".gif"):
                p = root_path / name
                if not skip_path(p):
                    found.append(p)
    found.sort()
    return found


def rel(path: Path) -> str:
    return str(path.resolve().relative_to(REPO_ROOT)).replace("\\", "/")


def seed_crf(filename: str, source_bytes: int, existing: dict | None) -> tuple[int | None, str | None]:
    if existing and existing.get("crf") is not None:
        return existing.get("crf"), existing.get("note")
    if existing and existing.get("note") and existing.get("crf") is None:
        # Explicit inherit after a reviewer cleared the override.
        return None, existing.get("note")
    if filename in TIER_A:
        return 26, "tier A: 600px 30fps mobile capture, plan §6.2"
    if filename in TIER_E:
        return 28, "tier E: text-highlight demo, plan §6.2"
    if filename in TIER_D:
        return 32, "tier D: downscaled desktop capture, plan §6.2"
    if source_bytes < 1_000_000:
        return 26, "tier C: under 1 MB, plan §6.2"
    return None, None


def cmd_inventory(manifest: dict) -> int:
    ffmpeg_ver, libx264_ver = detect_encoder_versions()
    manifest.setdefault("encoder", {})
    manifest["encoder"]["ffmpeg"] = ffmpeg_ver
    manifest["encoder"]["libx264"] = libx264_ver
    manifest["encoder"]["baseline_crf"] = BASELINE_CRF
    manifest["encoder"]["max_width"] = MAX_WIDTH
    manifest["encoder"]["args"] = list(ENCODER_ARGS)
    manifest["delete_only"] = list(DELETE_ONLY)

    files = manifest.setdefault("files", {})
    gifs = iter_gifs()
    on_disk = {rel(p) for p in gifs}
    delete_set = set(DELETE_ONLY)

    for path in gifs:
        key = rel(path)
        if key in delete_set:
            continue
        meta = parse_gif(path)
        size = path.stat().st_size
        digest = sha256_file(path)
        prev = files.get(key, {})
        crf, note = seed_crf(path.name, size, prev)
        vf = derive_vf(meta["width"], meta["height"])
        source = {
            "bytes": size,
            "sha256": digest,
            "width": meta["width"],
            "height": meta["height"],
            "frames": meta["frames"],
            "duration_s": round(meta["duration_s"], 3),
            "fps": round(meta["fps"], 3),
        }
        entry = {
            "crf": crf,
            "note": note,
            "source": source,
            "output": prev.get("output"),
            "vf": vf,
        }
        files[key] = entry

    stale = [k for k in files if k not in on_disk]
    if stale:
        print("removing %d manifest entries whose GIFs are gone:" % len(stale), file=sys.stderr)
        for k in stale:
            print("  " + k, file=sys.stderr)
            del files[k]

    dump_manifest(manifest)
    print("inventory: %d encode entries, %d delete_only, encoder ffmpeg=%s libx264=%s"
          % (len(files), len(DELETE_ONLY), ffmpeg_ver, libx264_ver))
    return 0


def ffmpeg_cmd(src: Path, dst: Path, crf: int, vf: str | None) -> list[str]:
    cmd = [
        ffmpeg_bin(),
        "-hide_banner",
        "-y",
        "-fflags",
        "+bitexact",
        "-i",
        str(src),
        "-an",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-tune",
        "animation",
        "-flags:v",
        "+bitexact",
        "-crf",
        str(crf),
    ]
    if vf:
        cmd.extend(["-vf", vf])
    cmd.append(str(dst))
    return cmd


def probe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            ffprobe_bin(),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    info = json.loads(raw)
    stream = (info.get("streams") or [{}])[0]
    return {"width": int(stream["width"]), "height": int(stream["height"])}


def encode_one(payload: dict) -> dict:
    """Worker: encode a single GIF. payload is JSON-serialisable."""
    src = Path(payload["src"])
    dst = Path(payload["dst"])
    crf = payload["crf"]
    vf = payload["vf"]
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + ".encoding.mp4")
    cmd = ffmpeg_cmd(src, tmp, crf, vf)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        if tmp.exists():
            tmp.unlink()
        return {
            "ok": False,
            "key": payload["key"],
            "error": proc.stderr[-4000:] if proc.stderr else "ffmpeg exited %d" % proc.returncode,
        }
    tmp.replace(dst)
    dims = probe_video(dst)
    return {
        "ok": True,
        "key": payload["key"],
        "output": {
            "path": payload["out_rel"],
            "bytes": dst.stat().st_size,
            "sha256": sha256_file(dst),
            "width": dims["width"],
            "height": dims["height"],
            "crf": crf,
        },
    }


def assert_tree_consistent(manifest: dict) -> None:
    files = manifest.get("files") or {}
    delete_set = set(manifest.get("delete_only") or [])
    errors = []
    on_disk = {rel(p) for p in iter_gifs()}
    for key in sorted(on_disk):
        if key in delete_set:
            continue
        if key not in files:
            errors.append("GIF on disk but missing from manifest: %s" % key)
    for key, entry in files.items():
        src = REPO_ROOT / key
        if not src.is_file():
            errors.append("manifest entry source missing: %s" % key)
            continue
        src_meta = entry.get("source") or {}
        vf = derive_vf(int(src_meta["width"]), int(src_meta["height"]))
        recorded = entry.get("vf")
        if recorded != vf:
            errors.append("vf mismatch for %s: recorded %r derived %r" % (key, recorded, vf))
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)


def wants_reencode(
    entry: dict, src: Path, dst: Path, force: bool, baseline: int = BASELINE_CRF
) -> bool:
    if force:
        return True
    source = entry.get("source") or {}
    output = entry.get("output") or {}
    if not dst.is_file():
        return True
    if sha256_file(src) != source.get("sha256"):
        return True
    if sha256_file(dst) != output.get("sha256"):
        return True
    recorded_vf = entry.get("vf")
    derived = derive_vf(int(source["width"]), int(source["height"]))
    if recorded_vf != derived:
        return True
    recorded_crf = output.get("crf")
    if recorded_crf is None:
        return True
    if int(recorded_crf) != effective_crf(entry, baseline):
        return True
    return False


def select_keys(manifest: dict, only: str | None) -> list[str]:
    keys = list(manifest.get("files") or {})
    if only:
        keys = [k for k in keys if fnmatch.fnmatch(k, only) or fnmatch.fnmatch(Path(k).name, only)]
        if not keys:
            sys.exit("no manifest files matched --only %s" % only)
    return sorted(keys)


def cmd_encode(manifest: dict, only: str | None, force: bool, jobs: int) -> int:
    assert_tree_consistent(manifest)
    keys = select_keys(manifest, only)
    work = []
    skipped = 0
    baseline = int((manifest.get("encoder") or {}).get("baseline_crf", BASELINE_CRF))
    for key in keys:
        entry = manifest["files"][key]
        src = REPO_ROOT / key
        out_rel = (entry.get("output") or {}).get("path") or output_path_for(key)
        dst = REPO_ROOT / out_rel
        source = entry.get("source") or {}
        vf = derive_vf(int(source["width"]), int(source["height"]))
        if entry.get("vf") != vf:
            print("vf mismatch for %s: recorded %r derived %r" % (key, entry.get("vf"), vf), file=sys.stderr)
            return 1
        if not wants_reencode(entry, src, dst, force, baseline):
            skipped += 1
            continue
        work.append(
            {
                "key": key,
                "src": str(src),
                "dst": str(dst),
                "out_rel": out_rel,
                "crf": effective_crf(entry, baseline),
                "vf": vf,
            }
        )

    encoded = 0
    failed = []
    if work:
        workers = max(1, jobs)
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(encode_one, payload) for payload in work]
            for fut in as_completed(futures):
                result = fut.result()
                key = result["key"]
                if not result["ok"]:
                    failed.append((key, result.get("error", "unknown")))
                    print("FAIL %s" % key, file=sys.stderr)
                    continue
                manifest["files"][key]["output"] = result["output"]
                encoded += 1
                print("encoded %s (%d bytes)" % (key, result["output"]["bytes"]))
        dump_manifest(manifest)

    print("%d up to date, %d encoded, %d failed." % (skipped, encoded, len(failed)))
    if failed:
        for key, err in failed:
            print("--- %s ---\n%s" % (key, err), file=sys.stderr)
        return 1
    print_report(manifest)
    return 0


def versions_match(manifest: dict) -> bool:
    ffmpeg_ver, libx264_ver = detect_encoder_versions()
    enc = manifest.get("encoder") or {}
    return enc.get("ffmpeg") == ffmpeg_ver and enc.get("libx264") == libx264_ver


def parse_ssim(stderr: str) -> float | None:
    # n:1 All:0.987654 (something)
    m = re.search(r"All:([0-9.]+)", stderr)
    if not m:
        return None
    return float(m.group(1))


def ssim_ref_vf(vf: str | None) -> str | None:
    """Crop-only preprocess for SSIM refs; scale is handled by measure_ssim."""
    if vf and vf.startswith("crop="):
        return vf
    return None


def measure_ssim(
    ref: Path, dist: Path, width: int, height: int, ref_vf: str | None = None
) -> float | None:
    if ref_vf:
        ref_chain = "%s,scale=%d:%d:flags=lanczos,setsar=1" % (ref_vf, width, height)
    else:
        ref_chain = "scale=%d:%d:flags=lanczos,setsar=1" % (width, height)
    filt = "[0:v]%s[r];[1:v]setsar=1[d];[d][r]ssim" % ref_chain
    proc = subprocess.run(
        [
            ffmpeg_bin(),
            "-hide_banner",
            "-i",
            str(ref),
            "-i",
            str(dist),
            "-lavfi",
            filt,
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    return parse_ssim(proc.stderr or "")


def cmd_verify(manifest: dict, only: str | None) -> int:
    assert_tree_consistent(manifest)
    keys = select_keys(manifest, only)
    match = versions_match(manifest)
    local_ff, local_x264 = detect_encoder_versions()
    enc = manifest["encoder"]
    if not match:
        print(
            "encoder version delta: manifest ffmpeg=%s libx264=%s; local ffmpeg=%s libx264=%s"
            % (enc.get("ffmpeg"), enc.get("libx264"), local_ff, local_x264)
        )
        print("hash comparison skipped; asserting size ±10% and SSIM ≥ 0.98")

    failures = 0
    with tempfile.TemporaryDirectory(prefix="gif-verify-") as tmp:
        tmp_path = Path(tmp)
        for key in keys:
            entry = manifest["files"][key]
            src = REPO_ROOT / key
            out_rel = (entry.get("output") or {}).get("path") or output_path_for(key)
            dst = REPO_ROOT / out_rel
            if not dst.is_file():
                print("missing output: %s" % out_rel, file=sys.stderr)
                failures += 1
                continue
            committed_hash = sha256_file(dst)
            expected_hash = entry["output"]["sha256"]
            if committed_hash != expected_hash:
                print(
                    "output hash mismatch %s: manifest %s committed %s"
                    % (key, expected_hash, committed_hash),
                    file=sys.stderr,
                )
                failures += 1
            source = entry["source"]
            vf = derive_vf(int(source["width"]), int(source["height"]))
            crf = effective_crf(entry, enc["baseline_crf"])
            redo = tmp_path / (Path(key).stem + ".mp4")
            proc = subprocess.run(ffmpeg_cmd(src, redo, crf, vf), capture_output=True, text=True)
            if proc.returncode != 0:
                print("re-encode failed for %s\n%s" % (key, proc.stderr[-2000:]), file=sys.stderr)
                failures += 1
                continue
            if match:
                got = sha256_file(redo)
                want = entry["output"]["sha256"]
                if got != want:
                    print("hash mismatch %s: committed %s re-encode %s" % (key, want, got), file=sys.stderr)
                    failures += 1
            else:
                committed_bytes = entry["output"]["bytes"]
                new_bytes = redo.stat().st_size
                if committed_bytes <= 0 or abs(new_bytes - committed_bytes) / committed_bytes > 0.10:
                    print(
                        "size delta >10%% %s: committed %d re-encode %d"
                        % (key, committed_bytes, new_bytes),
                        file=sys.stderr,
                    )
                    failures += 1
                dims = probe_video(dst)
                ssim = measure_ssim(dst, redo, dims["width"], dims["height"])
                if ssim is None or ssim < 0.98:
                    print("SSIM %.4f below 0.98 for %s" % (ssim or -1, key), file=sys.stderr)
                    failures += 1
    if failures:
        print("verify: %d failure(s)" % failures, file=sys.stderr)
        return 1
    print("verify: %d files ok" % len(keys))
    return 0


def mb(n: int) -> str:
    return "%.2f MB" % (n / 1e6)


def mib(n: int) -> str:
    return "%.2f MiB" % (n / 1048576)


def print_report(manifest: dict) -> None:
    rows = []
    baseline = (manifest.get("encoder") or {}).get("baseline_crf", BASELINE_CRF)
    for key, entry in sorted((manifest.get("files") or {}).items()):
        src_bytes = (entry.get("source") or {}).get("bytes") or 0
        out = entry.get("output") or {}
        out_bytes = out.get("bytes")
        crf = effective_crf(entry, baseline)
        cut = ""
        if out_bytes:
            cut = "%.1f%%" % (100.0 * (1.0 - out_bytes / src_bytes)) if src_bytes else "—"
        rows.append((key, src_bytes, out_bytes, cut, crf))

    print("")
    print("%-54s %10s %10s %7s %5s" % ("", "source", "mp4", "cut", "crf"))
    for key, src_bytes, out_bytes, cut, crf in rows:
        name = key.split("/")[-1]
        mp4s = mb(out_bytes) if out_bytes else "         —"
        print("%-54s %10s %10s %7s %5s" % (name, mb(src_bytes), mp4s, cut, crf))

    src_total = sum(r[1] for r in rows)
    mp4_total = sum(r[2] or 0 for r in rows)
    encoded_n = sum(1 for r in rows if r[2])
    cut_all = (100.0 * (1.0 - mp4_total / src_total)) if src_total else 0
    print("-" * 90)
    print("%-54s %10s %10s %6.1f%%" % ("%d encoded" % encoded_n, mb(src_total), mb(mp4_total), cut_all))

    deleted_bytes = 0
    for p in manifest.get("delete_only") or []:
        fp = REPO_ROOT / p
        if fp.is_file():
            deleted_bytes += fp.stat().st_size
        else:
            # After git rm, use last known poll/interactive_message sizes.
            pass
    # If already deleted, fall back to recorded sizes from the plan.
    if deleted_bytes == 0:
        deleted_bytes = 305941 + 305941 + 561742 + 561742
    print("%-54s %10s %10s %6.1f%%" % ("4 deleted, not encoded", mb(deleted_bytes), "—", 100.0))
    print("-" * 90)
    removed = src_total + deleted_bytes
    net_cut = (100.0 * (1.0 - mp4_total / removed)) if removed else 0
    print("%-54s %10s %10s %6.1f%%" % ("total removed from repo", mb(removed), mb(mp4_total), net_cut))
    print("  also %s source / %s mp4" % (mib(src_total), mib(mp4_total)))
    overrides = [effective_crf(e, baseline) for e in (manifest.get("files") or {}).values() if e.get("crf") is not None and e.get("crf") != baseline]
    if overrides:
        print("CRF overrides: %d files below baseline %d (lowest %d)" % (len(overrides), baseline, min(overrides)))
    else:
        print("CRF overrides: none (all baseline %d)" % baseline)


def cmd_report(manifest: dict) -> int:
    print_report(manifest)
    return 0


def extract_still(src: Path, dest: Path, time_s: float) -> None:
    subprocess.run(
        [
            ffmpeg_bin(),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            "%.3f" % max(0.0, time_s),
            "-i",
            str(src),
            "-frames:v",
            "1",
            str(dest),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def to_webp(png: Path, webp: Path) -> None:
    cwebp = cwebp_bin()
    if not cwebp:
        shutil.copy2(png, webp.with_suffix(".png"))
        return
    subprocess.run(
        [cwebp, "-lossless", "-z", "9", str(png), "-o", str(webp)],
        check=True,
        capture_output=True,
        text=True,
    )


def html_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def review_one(payload: dict) -> dict:
    key = payload["key"]
    src = Path(payload["src"])
    dst = Path(payload["dst"])
    stem = payload["stem"]
    duration = payload["duration"]
    media = Path(payload["media"])
    stills = Path(payload["stills"])
    ref_vf = ssim_ref_vf(payload.get("vf"))
    shutil.copy2(src, media / (stem + ".gif"))
    shutil.copy2(dst, media / (stem + ".mp4"))
    percents = (0.10, 0.35, 0.60, 0.85)
    still_cells = []
    for i, pct in enumerate(percents):
        gif_w = stills / ("%s-gif-%d.webp" % (stem, i))
        mp4_w = stills / ("%s-mp4-%d.webp" % (stem, i))
        if not (gif_w.is_file() and mp4_w.is_file()):
            t = duration * pct
            gif_png = stills / ("%s-gif-%d.png" % (stem, i))
            mp4_png = stills / ("%s-mp4-%d.png" % (stem, i))
            extract_still(src, gif_png, t)
            extract_still(dst, mp4_png, t)
            to_webp(gif_png, gif_w)
            to_webp(mp4_png, mp4_w)
            gif_png.unlink(missing_ok=True)
            mp4_png.unlink(missing_ok=True)
        still_cells.append((pct, gif_w.name, mp4_w.name))
    dims = probe_video(dst)
    ssim_path = stills / ("%s.ssim.txt" % stem)
    if ssim_path.is_file():
        ssim = float(ssim_path.read_text().strip())
    else:
        ssim = measure_ssim(src, dst, dims["width"], dims["height"], ref_vf=ref_vf)
        if ssim is not None:
            ssim_path.write_text("%.6f\n" % ssim)
    return {"key": key, "still_cells": still_cells, "ssim": ssim}


def cmd_review(manifest: dict, only: str | None) -> int:
    assert_tree_consistent(manifest)
    keys = select_keys(manifest, only)
    if REVIEW_DIR.exists():
        shutil.rmtree(REVIEW_DIR)
    media = REVIEW_DIR / "media"
    stills = REVIEW_DIR / "stills"
    media.mkdir(parents=True)
    stills.mkdir(parents=True)

    jobs = []
    for key in keys:
        entry = manifest["files"][key]
        src = REPO_ROOT / key
        out_rel = (entry.get("output") or {}).get("path") or output_path_for(key)
        dst = REPO_ROOT / out_rel
        if not dst.is_file():
            print("skip review, missing mp4: %s" % out_rel, file=sys.stderr)
            continue
        jobs.append(
            {
                "key": key,
                "src": str(src),
                "dst": str(dst),
                "stem": Path(key).stem,
                "duration": float((entry.get("source") or {}).get("duration_s") or 1.0),
                "vf": entry.get("vf"),
                "media": str(media),
                "stills": str(stills),
            }
        )
    results = {}
    workers = max(1, min(os.cpu_count() or 1, 8))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(review_one, job): job["key"] for job in jobs}
        for fut in as_completed(futs):
            result = fut.result()
            results[result["key"]] = result
            print("reviewed %s ssim=%s" % (result["key"], result.get("ssim")))

    rows_html = []
    for key in keys:
        if key not in results:
            continue
        entry = manifest["files"][key]
        still_cells = results[key]["still_cells"]
        ssim = results[key]["ssim"]
        crf = effective_crf(entry, manifest["encoder"]["baseline_crf"])
        stem = Path(key).stem
        risk = ""
        if Path(key).name.startswith("mobile-") or Path(key).name.startswith("mobile_"):
            risk = " high-risk-mobile"
        stills_html = "".join(
            """
            <div class="pair">
              <div class="lab">{pct:.0%} of duration</div>
              <div class="stack">
                <img class="one" src="stills/{g}" alt="gif still">
                <img class="one" src="stills/{m}" alt="mp4 still">
              </div>
              <div class="zoom">
                <div class="crop"><img src="stills/{g}" alt=""></div>
                <div class="crop"><img src="stills/{m}" alt=""></div>
              </div>
            </div>
            """.format(pct=pct, g=g, m=m)
            for pct, g, m in still_cells
        )
        patch = json.dumps({key: {"crf": crf, "note": entry.get("note")}}, indent=2)
        rows_html.append(
            """
<section class="row{risk}" id="{stem}">
  <h2>{name}</h2>
  <p class="meta">CRF {crf} · SSIM {ssim} · {src_b} → {dst_b} · vf={vf} · {note}</p>
  <div class="play">
    <div><div class="lab">GIF</div><img src="media/{stem}.gif" alt=""></div>
    <div><div class="lab">MP4</div><video src="media/{stem}.mp4" controls loop muted playsinline></video></div>
  </div>
  <div class="stills">{stills}</div>
  <label>new CRF <input data-key="{key}" value="{crf}" size="3"></label>
  <button type="button" data-patch="{patch}">copy manifest patch</button>
</section>
            """.format(
                risk=risk,
                stem=html_escape(stem),
                name=html_escape(Path(key).name),
                crf=crf,
                ssim=("%.4f" % ssim) if ssim is not None else "n/a",
                src_b=mb(entry["source"]["bytes"]),
                dst_b=mb(entry["output"]["bytes"]),
                vf=html_escape(str(entry.get("vf"))),
                note=html_escape(entry.get("note") or ""),
                stills=stills_html,
                key=html_escape(key),
                patch=html_escape(patch),
            )
        )

    html = """<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>GIF → H.264 review</title>
<style>
body { font-family: ui-sans-serif, system-ui, sans-serif; background: #111; color: #eee; margin: 1rem; }
.row { border: 1px solid #444; margin: 1.5rem 0; padding: 1rem; }
.high-risk-mobile { border-color: #c40; }
.play { display: flex; gap: 1rem; flex-wrap: wrap; }
.play img, .play video { max-width: 48vw; height: auto; background: #000; }
.stills { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
.pair .one { display: block; image-rendering: auto; }
.zoom .crop { width: 320px; height: 180px; overflow: hidden; }
.zoom img { width: 960px; height: auto; image-rendering: pixelated; image-rendering: crisp-edges; }
.lab { font-size: 12px; color: #aaa; }
.meta { color: #bbb; }
h2 { margin: 0 0 .25rem; }
</style>
</head><body>
<h1>GIF → H.264 review</h1>
<p>Pass criterion: at 100% zoom, in an ~800px column, every piece of UI text
legible in the GIF is legible in the MP4, and no colour fringing is visible
on highlighted text. High-risk mobile captures have an orange border.</p>
@@ROWS@@
<script>
document.querySelectorAll("button[data-patch]").forEach((b) => {
  b.addEventListener("click", () => {
    const input = b.parentElement.querySelector("input[data-key]");
    const key = input.getAttribute("data-key");
    const crf = Number(input.value);
    const text = JSON.stringify({[key]: {crf}}, null, 2);
    navigator.clipboard.writeText(text).then(() => { b.textContent = "copied"; });
  });
});
</script>
</body></html>
""".replace("@@ROWS@@", "\n".join(rows_html))
    index = REVIEW_DIR / "index.html"
    index.write_text(html, encoding="utf-8")
    print("review page: %s (%d files)" % (index, len(rows_html)))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inventory", help="parse every GIF, write/refresh manifest source blocks")
    enc = sub.add_parser("encode", help="encode GIFs that are stale")
    enc.add_argument("--only", help="glob against repo-relative path or basename")
    enc.add_argument("--force", action="store_true")
    enc.add_argument("--jobs", type=int, default=os.cpu_count() or 1)
    ver = sub.add_parser("verify", help="re-encode to a temp dir, compare against committed")
    ver.add_argument("--only", help="glob against repo-relative path or basename")
    sub.add_parser("report", help="before/after table, no encoding")
    rev = sub.add_parser("review", help="build /tmp/gif-review/index.html")
    rev.add_argument("--only", help="glob against repo-relative path or basename")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    manifest = load_manifest()
    if args.cmd == "inventory":
        return cmd_inventory(manifest)
    if args.cmd == "encode":
        return cmd_encode(manifest, args.only, args.force, args.jobs)
    if args.cmd == "verify":
        return cmd_verify(manifest, args.only)
    if args.cmd == "report":
        return cmd_report(manifest)
    if args.cmd == "review":
        return cmd_review(manifest, args.only)
    return 2


if __name__ == "__main__":
    sys.exit(main())

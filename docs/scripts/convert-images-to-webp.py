#!/usr/bin/env python3
"""Convert docs PNG/JPG sources to gated WebP at source (Phase 1b).

Developer tool: outputs are committed. Not wired into prebuild or CI.

Requires `cwebp`/`dwebp` (libwebp ≥ 1.2, for `-sharp_yuv` and `-near_lossless`) and
`ssimulacra2` (libjxl ≥ 0.7). On macOS: `brew install webp jpeg-xl`. Neither is
needed in CI — the encoded outputs are committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import tomllib
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import tomllib
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from pathlib import Path

INSTALL_LINE = (
    "Requires `cwebp`/`dwebp` (libwebp ≥ 1.2, for `-sharp_yuv` and `-near_lossless`) and "
    "`ssimulacra2` (libjxl ≥ 0.7). On macOS: `brew install webp jpeg-xl`. Neither is "
    "needed in CI — the encoded outputs are committed."
)

PNG_SIG = b"\x89PNG\r\n\x1a\n"
IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
SKIP_DIR_NAMES = {"node_modules", "vendor", "build", ".git"}
REF_TEXT_EXTS = {".md", ".mdx", ".tsx", ".ts", ".css", ".json", ".yml", ".yaml"}
REF_WALK_SKIP = {"node_modules", "vendor", "build", ".git", "webapp"}
SKIP_REASONS = {"generated", "orphaned", "quality", "external"}

print_lock = threading.Lock()


def die(msg: str, code: int = 1) -> None:
    print(f"[convert-webp] ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def log(msg: str) -> None:
    with print_lock:
        print(f"[convert-webp] {msg}", flush=True)


def repo_root_from_script() -> Path:
    return Path(__file__).resolve().parents[2]


def which_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    brew = Path("/opt/homebrew/bin") / name
    if brew.is_file() and os.access(brew, os.X_OK):
        return str(brew)
    return None


def require_tools() -> dict[str, str]:
    tools = {}
    for name in ("cwebp", "dwebp", "ssimulacra2"):
        path = which_tool(name)
        if not path:
            die(INSTALL_LINE)
        tools[name] = path
    webpinfo = which_tool("webpinfo")
    if webpinfo:
        tools["webpinfo"] = webpinfo
    return tools


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=False, capture_output=True, **kwargs)


def run_checked(cmd: list[str], what: str) -> subprocess.CompletedProcess:
    proc = run(cmd)
    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", "replace").strip()
        raise RuntimeError(f"{what} failed ({proc.returncode}): {err or cmd}")
    return proc


# --- PNG / JPEG header helpers ------------------------------------------------

def iter_png_chunks(data: bytes):
    if not data.startswith(PNG_SIG):
        raise ValueError("not a PNG")
    pos = 8
    while pos + 12 <= len(data):
        length = int.from_bytes(data[pos : pos + 4], "big")
        ctype = data[pos + 4 : pos + 8]
        start = pos + 8
        end = start + length
        crc_end = end + 4
        if crc_end > len(data):
            raise ValueError("truncated PNG chunk")
        yield ctype, data[start:end], data[end:crc_end]
        pos = crc_end
        if ctype == b"IEND":
            break


def png_has_iccp(path: Path) -> bool:
    data = path.read_bytes()
    return any(ctype == b"iCCP" for ctype, _d, _c in iter_png_chunks(data))


def strip_png_iccp(src: Path, dest: Path) -> None:
    data = src.read_bytes()
    out = bytearray(PNG_SIG)
    for ctype, cdata, crc in iter_png_chunks(data):
        if ctype == b"iCCP":
            continue
        out += len(cdata).to_bytes(4, "big")
        out += ctype
        out += cdata
        out += crc
    dest.write_bytes(out)


def png_ihdr(path: Path) -> tuple[int, int, int, int]:
    data = path.read_bytes()
    for ctype, cdata, _crc in iter_png_chunks(data):
        if ctype == b"IHDR":
            w, h, bit_depth, color_type = struct.unpack(">IIBB", cdata[:10])
            return w, h, bit_depth, color_type
    raise ValueError(f"no IHDR in {path}")


def jpeg_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:2] != b"\xff\xd8":
        raise ValueError("not a JPEG")
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            pos += 1
            continue
        marker = data[pos + 1]
        if marker in (0xD8, 0xD9) or marker == 0x00:
            pos += 2
            continue
        if marker >= 0xD0 and marker <= 0xD7:
            pos += 2
            continue
        seglen = int.from_bytes(data[pos + 2 : pos + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            h, w = struct.unpack(">HH", data[pos + 5 : pos + 9])
            return w, h
        pos += 2 + seglen
    raise ValueError(f"no SOF in {path}")


def crc32_png(ctype: bytes, data: bytes) -> bytes:
    return zlib.crc32(ctype + data).to_bytes(4, "big")


def write_png_rgba(path: Path, width: int, height: int, rgba: bytes, iccp: bytes | None = None) -> None:
    if len(rgba) != width * height * 4:
        raise ValueError("rgba length mismatch")
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        start = y * width * 4
        raw += rgba[start : start + width * 4]
    idat = zlib.compress(bytes(raw), 9)
    chunks: list[tuple[bytes, bytes]] = [
        (b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
    ]
    if iccp:
        chunks.append((b"iCCP", iccp))
    chunks.append((b"IDAT", idat))
    chunks.append((b"IEND", b""))
    out = bytearray(PNG_SIG)
    for ctype, cdata in chunks:
        out += len(cdata).to_bytes(4, "big")
        out += ctype
        out += cdata
        out += crc32_png(ctype, cdata)
    path.write_bytes(out)


def extract_png_iccp(path: Path) -> bytes | None:
    data = path.read_bytes()
    for ctype, cdata, _crc in iter_png_chunks(data):
        if ctype == b"iCCP":
            return cdata
    return None


def parse_pam(path: Path) -> tuple[int, int, int, bytes]:
    data = path.read_bytes()
    header, _, body = data.partition(b"ENDHDR\n")
    if not _:
        raise ValueError("not a PAM")
    meta = {}
    for line in header.splitlines():
        if line.startswith(b"P7"):
            continue
        parts = line.split(None, 1)
        if len(parts) == 2:
            meta[parts[0].decode()] = parts[1].decode()
    w = int(meta["WIDTH"])
    h = int(meta["HEIGHT"])
    depth = int(meta["DEPTH"])
    return w, h, depth, body


# --- inventory ----------------------------------------------------------------

def skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES


def iter_docs_rasters(docs_root: Path):
    for dirpath, dirnames, filenames in os.walk(docs_root):
        dirnames[:] = [d for d in dirnames if not skip_dir(d)]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext in IMAGE_EXTS:
                yield Path(dirpath) / name


def inventory_rows(repo: Path) -> list[dict]:
    rows = []
    docs = repo / "docs"
    for path in iter_docs_rasters(docs):
        rel = path.relative_to(repo).as_posix()
        size = path.stat().st_size
        ext = path.suffix.lower()
        try:
            if ext == ".png":
                w, h, bit_depth, color_type = png_ihdr(path)
                kind = "png"
            else:
                w, h = jpeg_size(path)
                bit_depth, color_type = 8, -1
                kind = "jpeg"
        except (ValueError, struct.error, OSError):
            w = h = bit_depth = color_type = 0
            kind = ext.lstrip(".")
        rows.append(
            {
                "path": rel,
                "bytes": size,
                "width": w,
                "height": h,
                "bit_depth": bit_depth,
                "color_type": color_type,
                "kind": kind,
            }
        )
    rows.sort(key=lambda r: (-r["bytes"], r["path"]))
    return rows


def emit_inventory(repo: Path) -> None:
    rows = inventory_rows(repo)
    print("path\tbytes\twidth\theight\tkind")
    for r in rows:
        print(f"{r['path']}\t{r['bytes']}\t{r['width']}\t{r['height']}\t{r['kind']}")


# --- references ---------------------------------------------------------------

def site_ref_for(rel_path: str) -> str:
    prefix = "docs/site/static/"
    if rel_path.startswith(prefix):
        return "/" + rel_path[len(prefix) :]
    return "/" + Path(rel_path).name


def anchored_ref_re(site_ref: str) -> re.Pattern[str]:
    return re.compile(r"(?<![\w./-])" + re.escape(site_ref) + r"\b")


def output_path_for(src: Path) -> Path:
    return src.with_suffix(".webp")


def iter_ref_files(repo: Path):
    for dirpath, dirnames, filenames in os.walk(repo):
        rel_parts = Path(dirpath).relative_to(repo).parts
        if rel_parts and rel_parts[0] in REF_WALK_SKIP:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in REF_WALK_SKIP and d not in SKIP_DIR_NAMES]
        for name in filenames:
            if Path(name).suffix.lower() in REF_TEXT_EXTS:
                yield Path(dirpath) / name


def replace_refs_in_text(text: str, site_ref: str) -> tuple[str, int]:
    stem, ext = os.path.splitext(site_ref)
    replacement = stem + ".webp"
    pattern = anchored_ref_re(site_ref)
    return pattern.subn(replacement, text)


def update_refs(repo: Path, rel_src: str) -> int:
    site_ref = site_ref_for(rel_src)
    total = 0
    for path in iter_ref_files(repo):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        new, n = replace_refs_in_text(text, site_ref)
        if n:
            path.write_text(new, encoding="utf-8")
            total += n
    return total


def verify_refs(repo: Path, entries: list["ImageEntry"], converted_only: bool = True) -> list[str]:
    errors: list[str] = []
    webp_refs: set[str] = set()
    file_texts: list[tuple[Path, str]] = []
    for path in iter_ref_files(repo):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        file_texts.append((path, text))
        for m in re.finditer(r"(?<![\w./-])(/[^\s\"')]+?\.webp)\b", text):
            webp_refs.add(m.group(1))

    for entry in entries:
        if entry.skip:
            continue
        if converted_only and not output_path_for(repo / entry.path).is_file():
            continue
        site_ref = site_ref_for(entry.path)
        pat = anchored_ref_re(site_ref)
        for path, text in file_texts:
            if pat.search(text):
                errors.append(f"leftover {site_ref} in {path.relative_to(repo).as_posix()}")

    static = repo / "docs" / "site" / "static"
    for ref in sorted(webp_refs):
        on_disk = static / ref.lstrip("/")
        if not on_disk.is_file():
            # Relative docs/develop images may live next to markdown; skip unknowns
            # that are not under /images or /img (top-25 all are).
            if ref.startswith("/images/") or ref.startswith("/img/"):
                errors.append(f"missing webp for reference {ref}")
    return errors


# --- manifest -----------------------------------------------------------------

@dataclass
class ImageEntry:
    path: str
    skip: str | None = None
    reason: str | None = None
    pinned: str | None = None
    pin_reason: str | None = None


@dataclass
class Manifest:
    threshold: float
    ladder: list[str]
    candidates: dict[str, list[str]]
    common: list[str]
    images: list[ImageEntry]

def load_manifest(path: Path) -> Manifest:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    defaults = data["defaults"]
    cands = {k: list(v) for k, v in data["candidates"].items() if k != "common"}
    common = list(
        defaults.get("common")
        or data.get("common")
        or data.get("candidates", {}).get("common")
        or []
    )
    images = [
        ImageEntry(
            path=item["path"],
            skip=item.get("skip"),
            reason=item.get("reason"),
            pinned=item.get("pinned"),
        )
        for item in data.get("image", [])
    ]
    for img in images:
        if img.skip and img.skip not in SKIP_REASONS:
            raise ValueError(f"unknown skip reason {img.skip!r} for {img.path}")
    return Manifest(
        threshold=float(defaults["threshold"]),
        ladder=list(defaults["ladder"]),
        candidates=cands,
        common=common,
        images=images,
    )


# --- encode / score -----------------------------------------------------------

@dataclass
class CandidateResult:
    name: str
    size: int
    score: float
    webp: Path


@dataclass
class FileOutcome:
    entry: ImageEntry
    status: str
    before: int = 0
    after: int = 0
    candidate: str = ""
    score: float | None = None
    ceiling: float | None = None
    sha256: str = ""
    detail: str = ""
    wrote: bool = False


def prepare_reference(src: Path, tmp: Path) -> Path:
    ext = src.suffix.lower()
    ref = tmp / "ref.png"
    if ext == ".png":
        strip_png_iccp(src, ref)
        return ref
    shutil.copy2(src, tmp / ("ref" + ext))
    return tmp / ("ref" + ext)


def composite_white(tools: dict[str, str], src: Path, dest_png: Path) -> None:
    blended = dest_png.with_suffix(".blend.webp")
    run_checked(
        [
            tools["cwebp"],
            "-blend_alpha",
            "0xFFFFFF",
            "-lossless",
            "-z",
            "0",
            "-quiet",
            str(src),
            "-o",
            str(blended),
        ],
        "cwebp -blend_alpha",
    )
    run_checked([tools["dwebp"], "-quiet", str(blended), "-o", str(dest_png)], "dwebp after blend")


def ssimulacra2_score(tools: dict[str, str], orig: Path, dist: Path) -> float:
    proc = run_checked(
        [tools["ssimulacra2"], str(orig), str(dist)],
        "ssimulacra2",
    )
    out = (proc.stdout or b"").decode().strip().splitlines()
    if not out:
        raise RuntimeError("ssimulacra2 produced no score")
    return float(out[-1])


def encode_cwebp(tools: dict[str, str], src: Path, dest: Path, flags: list[str]) -> None:
    cmd = [tools["cwebp"], *flags, "-quiet", str(src), "-o", str(dest)]
    run_checked(cmd, "cwebp")


def score_candidate(tools: dict[str, str], ref_white: Path, cand_webp: Path, tmp: Path) -> float:
    tmp.mkdir(parents=True, exist_ok=True)
    decoded = tmp / "cand.png"
    run_checked(
        [tools["dwebp"], "-quiet", str(cand_webp), "-o", str(decoded)],
        "dwebp candidate",
    )
    cand_w = tmp / "cand_white.png"
    composite_white(tools, decoded, cand_w)
    return ssimulacra2_score(tools, ref_white, cand_w)


def lossless_ceiling(tools: dict[str, str], src: Path, ref_white: Path, flags: list[str], tmp: Path) -> float:
    tmp.mkdir(parents=True, exist_ok=True)
    dest = tmp / "ceiling.webp"
    encode_cwebp(tools, src, dest, flags)
    return score_candidate(tools, ref_white, dest, tmp / "ceiling_score")


def max_error_crops(orig_pam: Path, dist_pam: Path, n: int = 3, cw: int = 400, ch: int = 300) -> list[tuple[int, int]]:
    w, h, depth, a = parse_pam(orig_pam)
    w2, h2, d2, b = parse_pam(dist_pam)
    if (w, h) != (w2, h2):
        return [(0, 0)]
    bpp = depth
    win_w = min(cw, w)
    win_h = min(ch, h)
    # Sample a grid rather than every pixel window.
    step_x = max(1, win_w // 2)
    step_y = max(1, win_h // 2)
    scored: list[tuple[int, int, int]] = []
    for y in range(0, h - win_h + 1, step_y):
        for x in range(0, w - win_w + 1, step_x):
            err = 0
            for yy in range(y, y + win_h, 4):
                for xx in range(x, x + win_w, 4):
                    i = (yy * w + xx) * bpp
                    err += abs(a[i] - b[i]) + abs(a[i + 1] - b[i + 1]) + abs(a[i + 2] - b[i + 2])
            scored.append((err, x, y))
    scored.sort(reverse=True)
    picks: list[tuple[int, int]] = []
    for _e, x, y in scored:
        if all(abs(x - px) >= win_w // 2 or abs(y - py) >= win_h // 2 for px, py in picks):
            picks.append((x, y))
        if len(picks) >= n:
            break
    return picks or [(0, 0)]


def write_contact_sheet(
    tools: dict[str, str],
    orig_png: Path,
    dist_png: Path,
    dest: Path,
) -> None:
    tmp = dest.parent / (dest.stem + "_sheet_tmp")
    tmp.mkdir(parents=True, exist_ok=True)
    orig_pam = tmp / "o.pam"
    dist_pam = tmp / "d.pam"
    run_checked([tools["cwebp"], "-lossless", "-z", "0", "-quiet", str(orig_png), "-o", str(tmp / "o.webp")], "sheet orig")
    run_checked([tools["dwebp"], "-pam", str(tmp / "o.webp"), "-o", str(orig_pam)], "sheet orig pam")
    run_checked([tools["cwebp"], "-lossless", "-z", "0", "-quiet", str(dist_png), "-o", str(tmp / "d.webp")], "sheet dist")
    run_checked([tools["dwebp"], "-pam", str(tmp / "d.webp"), "-o", str(dist_pam)], "sheet dist pam")
    crops = max_error_crops(orig_pam, dist_pam)
    w, h, depth, orig_body = parse_pam(orig_pam)
    _, _, _, dist_body = parse_pam(dist_pam)
    win_w = min(400, w)
    win_h = min(300, h)
    # Side-by-side RGB of up to 3 crops stacked vertically.
    out_w = win_w * 2
    out_h = win_h * len(crops)
    rgba = bytearray(out_w * out_h * 4)
    for i, (x, y) in enumerate(crops):
        for yy in range(win_h):
            for xx in range(win_w):
                src_i = ((y + yy) * w + (x + xx)) * depth
                dst_left = ((i * win_h + yy) * out_w + xx) * 4
                dst_right = ((i * win_h + yy) * out_w + win_w + xx) * 4
                rgba[dst_left : dst_left + 3] = orig_body[src_i : src_i + 3]
                rgba[dst_left + 3] = 255
                rgba[dst_right : dst_right + 3] = dist_body[src_i : src_i + 3]
                rgba[dst_right + 3] = 255
    write_png_rgba(dest, out_w, out_h, bytes(rgba))


def load_state(path: Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: dict) -> None:
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def convert_one(
    repo: Path,
    tools: dict[str, str],
    manifest: Manifest,
    entry: ImageEntry,
    state: dict,
    check_only: bool,
    accept_failures: bool,
    review_dir: Path,
) -> FileOutcome:
    src = repo / entry.path
    if entry.skip:
        before = src.stat().st_size if src.is_file() else 0
        return FileOutcome(
            entry=entry,
            status=f"skipped:{entry.skip}",
            before=before,
            detail=entry.reason or entry.skip,
        )
    if not src.is_file():
        return FileOutcome(entry=entry, status="FAILED", detail="source missing")

    out = output_path_for(src)
    before = src.stat().st_size
    recorded = state.get(entry.path, {})

    if (
        not check_only
        and out.is_file()
        and out.stat().st_mtime >= src.stat().st_mtime
        and recorded.get("sha256") == sha256_file(out)
    ):
        return FileOutcome(
            entry=entry,
            status="up to date",
            before=before,
            after=out.stat().st_size,
            candidate=recorded.get("candidate", ""),
            score=recorded.get("score"),
            ceiling=recorded.get("ceiling"),
            sha256=recorded.get("sha256", ""),
        )

    names = [entry.pinned] if entry.pinned else list(manifest.ladder)
    if check_only and recorded.get("candidate") and not entry.pinned:
        names = [recorded["candidate"]]
    with tempfile.TemporaryDirectory(prefix="webp-") as td:
        tmp = Path(td)
        ref = prepare_reference(src, tmp)
        ref_white = tmp / "ref_white.png"
        composite_white(tools, ref, ref_white)
        results: list[CandidateResult] = []
        for name in names:
            if name not in manifest.candidates:
                raise KeyError(f"unknown candidate {name} for {entry.path}")
            flags = list(manifest.common) + list(manifest.candidates[name])
            cand_path = tmp / f"{name}.webp"
            encode_cwebp(tools, src, cand_path, flags)
            score_tmp = tmp / f"score_{name}"
            score_tmp.mkdir()
            score = score_candidate(tools, ref_white, cand_path, score_tmp)
            results.append(CandidateResult(name, cand_path.stat().st_size, score, cand_path))
            log(f"{entry.path} {name} {cand_path.stat().st_size}B ss2={score:.2f}")
            # Score every ladder rung: output size is not monotonic in -q (PLAN 0.5 / 0.6).

        passing = [r for r in results if r.score >= manifest.threshold]
        pick: CandidateResult | None = None
        if passing:
            pick = min(passing, key=lambda r: r.size)
        else:
            lossless = next((r for r in results if r.name == "lossless"), None)
            if (
                lossless
                and lossless.size < before
                and lossless.score >= manifest.threshold
            ):
                pick = lossless

        ceiling = None
        if any(r.name == "lossless" for r in results):
            ceiling = next(r.score for r in results if r.name == "lossless")
        else:
            ceil_tmp = tmp / "ceil"
            ceil_tmp.mkdir()
            try:
                ceiling = lossless_ceiling(
                    tools,
                    src,
                    ref_white,
                    list(manifest.common) + list(manifest.candidates["lossless"]),
                    ceil_tmp,
                )
            except RuntimeError as exc:
                log(f"ceiling failed for {entry.path}: {exc}")

        if pick is None:
            best = max(results, key=lambda r: r.score) if results else None
            if best and not check_only:
                review_dir.mkdir(parents=True, exist_ok=True)
                decoded = tmp / "fail.png"
                run_checked([tools["dwebp"], "-quiet", str(best.webp), "-o", str(decoded)], "dwebp fail")
                try:
                    write_contact_sheet(
                        tools,
                        ref if ref.suffix.lower() == ".png" else decoded,
                        decoded,
                        review_dir / (src.stem + ".png"),
                    )
                except Exception as exc:  # noqa: BLE001 — review aid must not hide the failure
                    log(f"contact sheet failed for {entry.path}: {exc}")
            return FileOutcome(
                entry=entry,
                status="FAILED",
                before=before,
                after=best.size if best else 0,
                candidate=best.name if best else "",
                score=best.score if best else None,
                ceiling=ceiling,
                detail=f"best {best.name}={best.score:.2f}" if best else "no candidates",
            )

        if check_only:
            committed = output_path_for(src)
            if not committed.is_file():
                return FileOutcome(entry=entry, status="FAILED", detail="committed webp missing", before=before)
            got = sha256_file(pick.webp)
            want = sha256_file(committed)
            if got != want:
                return FileOutcome(
                    entry=entry,
                    status="FAILED",
                    before=before,
                    after=committed.stat().st_size,
                    candidate=pick.name,
                    score=pick.score,
                    ceiling=ceiling,
                    detail=f"--check mismatch {got} != {want}",
                )
            return FileOutcome(
                entry=entry,
                status="checked",
                before=before,
                after=committed.stat().st_size,
                candidate=pick.name,
                score=pick.score,
                ceiling=ceiling,
                sha256=want,
            )

        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pick.webp, out)
        digest = sha256_file(out)
        return FileOutcome(
            entry=entry,
            status="converted",
            before=before,
            after=out.stat().st_size,
            candidate=pick.name,
            score=pick.score,
            ceiling=ceiling,
            sha256=digest,
            wrote=True,
        )


def format_bytes(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.3f} MB"
    if n >= 1_000:
        return f"{n / 1_000:.1f} KB"
    return f"{n} B"


def render_report(outcomes: list[FileOutcome]) -> str:
    converted = [o for o in outcomes if o.status in {"converted", "up to date", "checked"}]
    skipped = [o for o in outcomes if o.status.startswith("skipped")]
    failed = [o for o in outcomes if o.status == "FAILED"]
    rows = sorted(converted + failed, key=lambda o: (o.before - o.after), reverse=True)
    lines = [
        "| # | path | before | after | saved | cut | candidate | ss2 | ceiling | status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for i, o in enumerate(rows, 1):
        saved = o.before - o.after if o.after else o.before
        cut = (saved / o.before * 100) if o.before else 0
        ss2 = f"{o.score:.2f}" if o.score is not None else "—"
        ceil = f"{o.ceiling:.2f}" if o.ceiling is not None else "—"
        after = format_bytes(o.after) if o.after else "—"
        lines.append(
            f"| {i} | `{o.entry.path}` | {format_bytes(o.before)} | {after} | "
            f"{format_bytes(saved)} | {cut:.1f}% | `{o.candidate or '—'}` | {ss2} | {ceil} | {o.status} |"
        )
    for o in skipped:
        lines.append(
            f"| — | `{o.entry.path}` | {format_bytes(o.before)} | — | — | — | — | — | — | {o.status} |"
        )

    # Bundle projection uses converted+skipped-generated kept at original size,
    # plus deleted orphans as full save.
    before_total = sum(o.before for o in outcomes)
    after_total = 0
    for o in outcomes:
        if o.status.startswith("skipped:orphaned"):
            after_total += 0
        elif o.status.startswith("skipped:"):
            after_total += o.before
        elif o.status == "FAILED":
            after_total += o.before
        else:
            after_total += o.after
    saved_total = before_total - after_total
    cut = saved_total / before_total * 100 if before_total else 0
    lines += [
        "",
        f"Converted: {len(converted)}  Skipped: {len(skipped)}  Failed: {len(failed)}",
        f"Total before: {before_total:,} B ({format_bytes(before_total)})",
        f"Total after: {after_total:,} B ({format_bytes(after_total)})",
        f"Saved: {saved_total:,} B ({format_bytes(saved_total)}, {cut:.1f}%)",
        "Projected offline bundle: design-doc ~95 MB waypoint minus this phase's measured cut; see PLAN §0.10.",
    ]
    return "\n".join(lines) + "\n"


def select_entries(manifest: Manifest, top: int | None, only: list[str]) -> list[ImageEntry]:
    images = list(manifest.images)
    if top is not None:
        images = images[:top]
    if only:
        wanted = {p.rstrip("/") for p in only}
        images = [i for i in images if i.path in wanted]
        missing = wanted - {i.path for i in images}
        if missing:
            raise SystemExit(f"--only paths not in manifest: {sorted(missing)}")
    return images


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=None)
    p.add_argument("--top", type=int, default=None)
    p.add_argument("--only", action="append", default=[])
    p.add_argument("--inventory", action="store_true")
    p.add_argument("--check", action="store_true")
    p.add_argument("--verify-refs", action="store_true")
    p.add_argument("--report", type=Path, default=None)
    p.add_argument("--jobs", type=int, default=os.cpu_count() or 1)
    p.add_argument("--accept-failures", action="store_true")
    p.add_argument("--no-update-refs", action="store_true")
    p.add_argument("--state", type=Path, default=None)
    p.add_argument("--review-dir", type=Path, default=None)
    p.add_argument("--repo", type=Path, default=None)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo = (args.repo or repo_root_from_script()).resolve()
    if args.inventory:
        emit_inventory(repo)
        return 0

    manifest_path = args.manifest or (repo / "docs/scripts/webp-manifest.toml")
    manifest = load_manifest(manifest_path)
    entries = select_entries(manifest, args.top, args.only)

    if args.verify_refs:
        tools_ok = True
        errs = verify_refs(repo, entries)
        for e in errs:
            log(e)
        return 1 if errs else 0

    tools = require_tools()
    state_path = args.state or (repo / "docs/scripts/webp-state.json")
    state = load_state(state_path)
    review_dir = args.review_dir or (repo / ".planning/phase-1b/review")
    state_lock = threading.Lock()

    outcomes: list[FileOutcome] = []
    jobs = max(1, args.jobs)

    def work(entry: ImageEntry) -> FileOutcome:
        return convert_one(
            repo,
            tools,
            manifest,
            entry,
            state,
            args.check,
            args.accept_failures,
            review_dir,
        )

    if jobs == 1:
        for entry in entries:
            outcomes.append(work(entry))
            if outcomes[-1].wrote:
                with state_lock:
                    state[entry.path] = {
                        "sha256": outcomes[-1].sha256,
                        "candidate": outcomes[-1].candidate,
                        "score": outcomes[-1].score,
                        "ceiling": outcomes[-1].ceiling,
                        "bytes": outcomes[-1].after,
                    }
                    save_state(state_path, state)
    else:
        with ThreadPoolExecutor(max_workers=jobs) as pool:
            futs = {pool.submit(work, e): e for e in entries}
            for fut in as_completed(futs):
                o = fut.result()
                outcomes.append(o)
                if o.wrote:
                    with state_lock:
                        state[o.entry.path] = {
                            "sha256": o.sha256,
                            "candidate": o.candidate,
                            "score": o.score,
                            "ceiling": o.ceiling,
                            "bytes": o.after,
                        }
                        save_state(state_path, state)

    # Keep report order stable: manifest order.
    by_path = {o.entry.path: o for o in outcomes}
    outcomes = [by_path[e.path] for e in entries]

    if not args.check and not args.no_update_refs:
        for o in outcomes:
            if o.status in {"converted", "up to date"}:
                n = update_refs(repo, o.entry.path)
                if n:
                    log(f"updated {n} ref(s) for {o.entry.path}")

    report = render_report(outcomes)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report, encoding="utf-8")
        log(f"wrote {args.report}")
    else:
        sys.stdout.write(report)

    failed = [o for o in outcomes if o.status == "FAILED"]
    if failed and not args.accept_failures:
        return 1
    if not args.check and not args.no_update_refs:
        ref_errs = verify_refs(repo, entries)
        if ref_errs:
            for e in ref_errs:
                log(e)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

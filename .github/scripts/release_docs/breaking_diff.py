"""Breaking changes read from the release diff, between the previous release's tag and the release branch.

Each finding names what changed and the PR that changed it: the commit in the range whose
patch removed (or changed) the line, found among the commits that touched the file.

- Plugin API and hooks (server/public/plugin): a method removed, or its signature changed.
- The server/public Go module: incompatible changes reported by apidiff (run in Actions,
  where Go is set up; see release-docs-task.yml).
- Config defaults (server/public/model/config.go): a setting's SetDefaults value changed.
- mmctl: a command or a flag removed.
- Minimum versions: PostgreSQL (MinimumPostgresMajorVersion), Go (server/public/go.mod), and
  browsers (the unsupported-browser page's labels and the server's browser check).
"""

import json
import os
import re
import shutil
import subprocess
import tempfile

PLUGIN_FILES = {"API": "server/public/plugin/api.go", "Hooks": "server/public/plugin/hooks.go"}
CONFIG = "server/public/model/config.go"
MMCTL_DIR = "server/cmd/mmctl/commands"
PUBLIC_MODULE = "server/public"
PUBLIC_GO_MOD = "server/public/go.mod"
EN_JSON = "server/i18n/en.json"
WEB_GO = "server/channels/web/web.go"
# The golang.org/x/exp version server/go.mod already uses.
APIDIFF = "golang.org/x/exp/cmd/apidiff@v0.0.0-20261014143641-f0251eb4aa3e"
MODULE_PATH = "github.com/mattermost/mattermost/server/public"


# ── Parsers: pure functions of a file's text ────────────────────────────────────────

def interface_methods(src: str | None, name: str) -> dict[str, str]:
    """``{method: signature}`` of ``type <name> interface { ... }``, comments left out."""
    match = re.search(rf"(?m)^type {re.escape(name)} interface \{{\n(.*?)^\}}", src or "", re.DOTALL)
    methods = {}
    for line in (match.group(1) if match else "").splitlines():
        line = line.split("//", 1)[0].strip()
        method = re.match(r"([A-Z]\w*)\s*(\(.*)$", line)
        if method:
            methods[method.group(1)] = " ".join(method.group(2).split())
    return methods


def _constants(src: str) -> dict[str, str]:
    consts = {}
    for block in re.findall(r"(?ms)^const \((.*?)^\)", src):
        for name, value in re.findall(r"(?m)^\s+(\w+)\s*(?:\w+\s*)?=\s*(.+?)\s*(?://.*)?$", block):
            consts[name] = value
    return consts


def config_defaults(src: str | None) -> dict[str, str]:
    """``{Settings.Field: default}`` from each ``SetDefaults`` method's ``if s.X == nil { s.X = new(v) }`` (or
    ``NewPointer(v)``), with constants resolved to their values. Conditional defaults are left out."""
    src = src or ""
    consts = _constants(src)
    defaults = {}
    for struct, body in re.findall(r"(?ms)^func \(s \*(\w+)\) SetDefaults\(.*?\{\n(.*?)^\}", src):
        for field, value in re.findall(r"if s\.(\w+) == nil \{\s*s\.\1 = (?:new|(?:model\.)?NewPointer)\((.*?)\)\s*\n\s*\}",
                                       body, re.DOTALL):
            value = " ".join(value.split())
            defaults[f"{struct}.{field}"] = re.sub(r"\b[A-Za-z_]\w*\b", lambda m: consts.get(m.group(0), m.group(0)), value)
    return defaults


_COMMAND = re.compile(r"var (\w+) = &cobra\.Command\{(.*?)\n\}", re.DOTALL)
_FLAG = re.compile(r"(\w+)\.(?:Persistent)?Flags\(\)\.\w+\((?:&[\w.\[\]]+,\s*)?\"([\w-]+)\"")


def mmctl_surface(sources: dict[str, str]) -> tuple[dict[str, str], set[tuple[str, str]]]:
    """(``{command variable: its Use line's first word}``, ``{(command variable, flag)}``) of mmctl's commands."""
    commands, flags = {}, set()
    for src in sources.values():
        for var, body in _COMMAND.findall(src or ""):
            use = re.search(r'Use:\s*"([^"]+)"', body)
            if use:
                commands[var] = use.group(1).split()[0]
        flags |= set(_FLAG.findall(src or ""))
    return commands, flags


def browser_minimums(en_json: str | None, web_go: str | None) -> dict[str, int]:
    """``{browser: minimum major version}`` from the unsupported-browser page's labels ("Version 156+")
    and the server's ``browserMinimumSupported`` check."""
    found = {}
    try:
        for entry in json.loads(en_json or "[]"):
            match = re.fullmatch(r"web\.error\.unsupported_browser\.min_browser_version\.(\w+)", entry.get("id", ""))
            number = re.search(r"(\d+)", entry.get("translation", "")) if match else None
            if number:
                found[match.group(1).capitalize()] = int(number.group(1))
    except ValueError:
        pass
    block = re.search(r"browserMinimumSupported = map\[string\]int\{(.*?)\}", web_go or "", re.DOTALL)
    for name, number in re.findall(r'"Browser(\w+)":\s*(\d+)', block.group(1) if block else ""):
        found.setdefault(name, int(number))
    return found


def go_directive(go_mod: str | None) -> str | None:
    match = re.search(r"(?m)^go (\S+)", go_mod or "")
    return match.group(1) if match else None


def postgres_minimum(config: str | None) -> int | None:
    match = re.search(r"(?m)^\s*MinimumPostgresMajorVersion\s*=\s*(\d+)\b", config or "")
    return int(match.group(1)) if match else None


def _version_key(text: str) -> tuple:
    return tuple(int(part) for part in re.findall(r"\d+", text))


_APIDIFF_LINE = re.compile(r"^- (?:\./)?([\w/]+)\.(.+?): (.*)$")
_SAME_CHANGE = re.compile(r"^changed from (.*) to \1$")
# Go 1.27 made encoding/json.RawMessage an alias of encoding/json/jsontext.Value: not a change.
_ALIASES = (("encoding/json/jsontext.Value", "encoding/json.RawMessage"),)


def parse_apidiff(output: str | None) -> list[tuple[str, str, str]]:
    """``[(package, name, change)]`` from ``apidiff -m -incompatible``, as in
    ``- ./model.(*Client4).GetPostsUsage: removed``. Additions and changes from a type to the
    same type (an alias swapped in) are left out."""
    found = []
    for line in (output or "").splitlines():
        match = _APIDIFF_LINE.match(line.strip())
        if not match:
            continue
        package, name, change = match.groups()
        same = change
        for alias, name_ in _ALIASES:
            same = same.replace(alias, name_)
        if change == "added" or _SAME_CHANGE.match(same):
            continue
        found.append((package, name, change))
    return found


# ── Who changed it ──────────────────────────────────────────────────────────────────

class Owners:
    """The PR whose commit, between the previous release and the release branch, removed (``-``) or
    added (``+``) a line containing a given text in one of the given paths."""

    def __init__(self, gh, repo: str, head: str, since: str | None):
        self.gh, self.repo, self.head, self.since = gh, repo, head, since
        self.commits, self.patches, self.pulls = {}, {}, {}

    def find(self, paths: list[str], needle: str, signs: str = "-") -> dict | None:
        for path in paths:
            if path not in self.commits:
                self.commits[path] = self.gh.commits_for_path(self.repo, path, self.head, self.since) if self.since else []
            for sha in self.commits[path]:
                if sha not in self.patches:
                    self.patches[sha] = self.gh.commit_patches(self.repo, sha)
                for name, patch in self.patches[sha].items():
                    if not name.startswith(path):
                        continue
                    if any(line[:1] in signs and not line.startswith(("---", "+++")) and needle in line
                           for line in (patch or "").splitlines()):
                        if sha not in self.pulls:
                            self.pulls[sha] = self.gh.commit_pulls(self.repo, sha)
                        pulls = self.pulls[sha]
                        if pulls:
                            return {"pr": f"{self.repo}#{pulls[0]['number']}", "url": pulls[0].get("html_url", "")}
        return None


def _finding(owners: Owners, paths: list[str], needle: str, reason: str, signs: str = "-") -> dict:
    owner = owners.find(paths, needle, signs) or {"pr": None, "url": ""}
    return {**owner, "reason": f"release diff: {reason}"}


# ── The checks ──────────────────────────────────────────────────────────────────────

def plugin_changes(file_at, owners: Owners, base: str, head: str) -> list[dict]:
    found = []
    for interface, path in PLUGIN_FILES.items():
        old, new = interface_methods(file_at(path, base), interface), interface_methods(file_at(path, head), interface)
        for method in sorted(old):
            if method not in new:
                found.append(_finding(owners, [path], f"{method}(", f"plugin {interface} method ``{method}`` was removed"))
            elif old[method] != new[method]:
                found.append(_finding(owners, [path], f"{method}(", f"plugin {interface} method ``{method}`` changed from "
                                      f"``{method}{old[method]}`` to ``{method}{new[method]}``", "-+"))
    return found


def config_default_changes(file_at, owners: Owners, base: str, head: str) -> list[dict]:
    old, new = config_defaults(file_at(CONFIG, base)), config_defaults(file_at(CONFIG, head))
    return [_finding(owners, [CONFIG], key.split(".", 1)[1], f"the default of ``{key}`` changed from ``{old[key]}`` to "
                     f"``{new[key]}``", "-+")
            for key in sorted(old) if key in new and old[key] != new[key]]


def mmctl_changes(gh, repo: str, owners: Owners, base: str, head: str) -> list[dict]:
    def surface(ref):
        names = [n for n in gh.list_dir(repo, MMCTL_DIR, ref) if n.endswith(".go") and not n.endswith("_test.go")]
        return mmctl_surface({n: gh.file(repo, f"{MMCTL_DIR}/{n}", ref) for n in names})
    (old_commands, old_flags), (new_commands, new_flags) = surface(base), surface(head)
    found = [_finding(owners, [MMCTL_DIR], f"var {var} ", f"the ``mmctl {use}`` command (``{var}``) was removed")
             for var, use in sorted(old_commands.items()) if var not in new_commands]
    for var, flag in sorted(old_flags - new_flags):
        if var in new_commands:
            found.append(_finding(owners, [MMCTL_DIR], f'"{flag}"', f"the ``--{flag}`` flag of ``mmctl "
                                  f"{new_commands[var]}`` was removed"))
    return found


def minimum_version_changes(file_at, owners: Owners, base: str, head: str) -> list[dict]:
    found = []
    old, new = postgres_minimum(file_at(CONFIG, base)), postgres_minimum(file_at(CONFIG, head))
    if old and new and new > old:
        found.append(_finding(owners, [CONFIG], "MinimumPostgresMajorVersion",
                              f"the minimum PostgreSQL version went from {old} to {new}", "+"))
    old, new = go_directive(file_at(PUBLIC_GO_MOD, base)), go_directive(file_at(PUBLIC_GO_MOD, head))
    if old and new and _version_key(new)[:2] > _version_key(old)[:2]:
        found.append(_finding(owners, [PUBLIC_GO_MOD], f"go {new}", f"the server/public module now needs Go {new} "
                              f"(was {old}), so plugins must build with it", "+"))
    old = browser_minimums(file_at(EN_JSON, base), file_at(WEB_GO, base))
    new = browser_minimums(file_at(EN_JSON, head), file_at(WEB_GO, head))
    for browser in sorted(old):
        if browser in new and new[browser] > old[browser]:
            found.append(_finding(owners, [EN_JSON, WEB_GO], str(new[browser]),
                                  f"the minimum {browser} version went from {old[browser]} to {new[browser]}", "+"))
    return found


def run_apidiff(base: str, head: str, run=subprocess.run, git=None) -> tuple[str | None, str | None]:
    """(apidiff's report of incompatible changes in the server/public module between two refs, a problem).

    Both refs are fetched shallowly into sparse worktrees holding only server/public; each side's
    export data is written with the Go version its go.mod names (GOTOOLCHAIN), then compared with
    the newer one. Needs Go and network access to the module proxy and Go downloads."""
    if shutil.which("go") is None:
        return None, "Go is not installed, so the server/public module was not compared (apidiff)"
    git = git or (lambda *args, cwd=None: run(["git", *args], capture_output=True, text=True, cwd=cwd))
    top = git("rev-parse", "--show-toplevel").stdout.strip()
    trees = []
    with tempfile.TemporaryDirectory() as directory:
        try:
            exports, toolchains = {}, {}
            for side, ref in (("old", base), ("new", head)):
                refspec = f"refs/tags/{ref}" if re.fullmatch(r"v\d+\.\d+\.\d+", ref) else f"refs/heads/{ref}"
                tree = os.path.join(directory, side)
                if git("fetch", "--quiet", "--depth=1", "origin", f"+{refspec}:refs/release-docs/{side}", cwd=top).returncode \
                        or git("worktree", "add", "--quiet", "--no-checkout", "--detach", tree, f"refs/release-docs/{side}",
                               cwd=top).returncode:
                    return None, f"{ref} could not be fetched, so the server/public module was not compared (apidiff)"
                trees.append(tree)
                git("sparse-checkout", "set", PUBLIC_MODULE, cwd=tree)
                git("checkout", "--quiet", cwd=tree)
                module = os.path.join(tree, PUBLIC_MODULE)
                with open(os.path.join(module, "go.mod"), encoding="utf-8") as f:
                    toolchains[side] = "go" + (go_directive(f.read()) or "")
                exports[side] = os.path.join(directory, f"{side}.export")
                wrote = run(["go", "run", APIDIFF, "-m", "-w", exports[side], MODULE_PATH], capture_output=True, text=True,
                            cwd=module, env={**os.environ, "GOTOOLCHAIN": toolchains[side]})
                if wrote.returncode:
                    return None, f"apidiff could not read server/public at {ref}"
            newer = max(toolchains.values(), key=_version_key)
            compared = run(["go", "run", APIDIFF, "-m", "-incompatible", exports["old"], exports["new"]],
                           capture_output=True, text=True, cwd=directory, env={**os.environ, "GOTOOLCHAIN": newer})
            if compared.returncode:
                return None, "apidiff could not compare the two versions of server/public"
            return compared.stdout, None
        finally:
            for tree in trees:
                git("worktree", "remove", "--force", tree, cwd=top)
            for side in ("old", "new"):
                git("update-ref", "-d", f"refs/release-docs/{side}", cwd=top)


def apidiff_changes(output: str | None, owners: Owners) -> list[dict]:
    found = []
    for package, name, change in parse_apidiff(output):
        needle = name.split(".")[-1].strip("()* ")
        text = change if len(change) <= 200 else change[:199] + "…"
        found.append(_finding(owners, [f"{PUBLIC_MODULE}/{package}"], needle,
                              f"incompatible change in the server/public Go API: ``{package}.{name}`` {text}", "-+"))
    return found


def diff_changes(gh, repo: str, base: str, head: str, apidiff=None) -> tuple[list[dict], list[str]]:
    """(every finding above, problems). ``apidiff`` is apidiff's output, or None when it didn't run."""
    def file_at(path, ref):
        return gh.file(repo, path, ref)

    # From the previous release branch's cut, when this release's work began; the tag comes weeks later.
    since = gh.merge_base_date(repo, base, head) if hasattr(gh, "merge_base_date") else None
    owners = Owners(gh, repo, head, since)
    problems = [] if owners.since else ["the previous release's date is unknown, so diff findings have no PR"]
    found = plugin_changes(file_at, owners, base, head)
    found += apidiff_changes(apidiff, owners)
    found += config_default_changes(file_at, owners, base, head)
    found += mmctl_changes(gh, repo, owners, base, head)
    found += minimum_version_changes(file_at, owners, base, head)
    return found, problems

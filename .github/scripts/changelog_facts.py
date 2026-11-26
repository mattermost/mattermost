#!/usr/bin/env python3
"""
Configuration, audit log, API and minimum-version facts for the changelog generator.

These are facts, not prose, so they are placed in the changelog by code rather than
by the model:

  - ``parse_checker_lines`` takes the lines config-change-checker writes into a PR's
    release note ("Added ``Group.Setting`` configuration setting.", "Added
    ``AuditEventX`` audit log event.", "Added ``METHOD /path`` (``handler``) API
    endpoint.") out of the note, leaving the developer's own text for the model.
  - ``code_facts`` reads the same kinds of change from the code between the previous
    release's tag and this release's branch (config.go fields and defaults,
    audit_events.go constants, and the minimum supported browser, OS and database
    versions), so a change with no release note is still listed.
  - ``render_facts`` writes them as changelog text: ``#### config.json`` grouped by
    plan, ``### Audit Log Event Changes``, ``### API Changes`` and ``#### Important
    Upgrade Notes``.

Standard library only, like changelog_release.py.
"""

import json
import re

CONFIG_PATH = "server/public/model/config.go"
AUDIT_EVENTS_PATH = "server/public/model/audit_events.go"
SERVER_I18N_PATH = "server/i18n/en.json"
SQLSTORE_PATH = "server/channels/store/sqlstore/store.go"
ADMIN_DEFINITION_PATH = "webapp/channels/src/components/admin_console/admin_definition.tsx"
ADMIN_CONSOLE_DIR = "webapp/channels/src/components/admin_console"

# Plans, highest first: the order the config.json section lists them in.
PLANS = ("Enterprise Advanced", "Enterprise", "Professional", "All")
# Each label names every plan that gets the setting, as published entries do.
PLAN_LABELS = {
    "Enterprise Advanced": "**Changes to Enterprise Advanced plan:**",
    "Enterprise": "**Changes to Enterprise and Enterprise Advanced plans:**",
    "Professional": "**Changes to Professional, Enterprise, and Enterprise Advanced plans:**",
    "All": "**Changes to All plans:**",
}

CONFIG_DESCRIPTION = (
    "New setting options were added to ``config.json``. Below is a list of the additions and their default "
    "values on install. The settings can be modified in ``config.json``, or the System Console when available."
)

# Section and subsection each kind of fact goes in.
CONFIG_SECTION = ("Upgrade Impact", "config.json")
UPGRADE_NOTES_SECTION = ("Upgrade Impact", "Important Upgrade Notes")
AUDIT_SECTION = ("Audit Log Event Changes", None)
API_SECTION = ("API Changes", None)


# ── Lines written by config-change-checker ──────────────────────────────────────────

_SETTING_LINE_RE = re.compile(
    r"^[ \t]*(?P<verb>Added|Removed)[ \t]+`{1,2}(?P<group>\w+)\.(?P<field>\w+)`{1,2}[ \t]+configuration setting\.?[ \t]*$"
)
# Not written by the checker today, but the same fact when a note gives it in this shape.
_DEFAULT_LINE_RE = re.compile(
    r"^[ \t]*Changed[ \t]+the[ \t]+default(?:[ \t]+value)?[ \t]+of[ \t]+`{1,2}(?P<group>\w+)\.(?P<field>\w+)`{1,2}"
    r"[ \t]+from[ \t]+`{1,2}(?P<old>[^`]*)`{1,2}[ \t]+to[ \t]+`{1,2}(?P<new>[^`]*)`{1,2}\.?[ \t]*$"
)
_AUDIT_LINE_RE = re.compile(
    r"^[ \t]*(?P<verb>Added|Removed)[ \t]+`{1,2}(?P<event>AuditEvent\w+)`{1,2}[ \t]+audit log event\.?[ \t]*$"
)
# After generate_changelog.resolve_endpoint_lines: always a full path.
_API_LINE_RE = re.compile(
    r"^[ \t]*(?P<verb>Added|Removed)[ \t]+`{1,2}[ \t]*(?P<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[ \t]+"
    r"(?P<path>/api/[^`]*?)[ \t]*`{1,2}[ \t]*\(`{1,2}(?P<handler>\w+)`{1,2}\)[ \t]*API endpoint\.?[ \t]*$"
)
# Checker lines that carry no fact a reader needs: dropped entirely. The Go version is
# read from the release branch's build image, so its lines are dropped too.
_DROPPED_LINE_RE = re.compile(
    r"^[ \t]*(?:🆕[ \t]*New API file:|🗑️?[ \t]*Removed API file:|Go runtime updated from \S+ to \S+\.|"
    r"Go runtime set to `{1,2}[^`]+`{1,2}\.)"
)


def parse_checker_lines(text: str, source: str) -> tuple[str, list[dict], list[str]]:
    """Split a release note into the developer's text, the checker's facts and the lines dropped.

    Returns (the note without checker lines, one fact per checker line, the lines dropped
    without a fact). A note made only of checker lines comes back with no text.
    """
    kept, facts, dropped = [], [], []
    for line in text.split("\n"):
        setting, default = _SETTING_LINE_RE.match(line), _DEFAULT_LINE_RE.match(line)
        audit, api = _AUDIT_LINE_RE.match(line), _API_LINE_RE.match(line)
        if setting:
            facts.append(config_fact(setting.group("verb"), setting.group("group"), setting.group("field"), source))
        elif default:
            facts.append(default_fact(default.group("group"), default.group("field"), default.group("old"),
                                      default.group("new"), source))
        elif audit:
            facts.append(audit_fact(audit.group("verb"), audit.group("event"), source))
        elif api:
            facts.append(api_fact(api.group("verb"), api.group("method"), api.group("path"), api.group("handler"), source))
        elif _DROPPED_LINE_RE.match(line):
            dropped.append(line.strip())
        else:
            kept.append(line)
    return "\n".join(kept).strip(), facts, dropped


# ── Facts ───────────────────────────────────────────────────────────────────────────

def config_fact(verb: str, group: str, field: str, source: str, default: str | None = None) -> dict:
    """A configuration setting added or removed. ``group`` is the config.go struct, as the checker names it."""
    return {"kind": "config", "verb": verb, "group": group, "field": field, "ident": f"{group}.{field}",
            "default": default, "source": source}


def default_fact(group: str, field: str, old: str, new: str, source: str) -> dict:
    """A configuration setting whose default value changed."""
    return {"kind": "config_default", "verb": "Changed", "group": group, "field": field,
            "ident": f"{group}.{field}", "old": old, "new": new, "source": source}


def audit_fact(verb: str, event: str, source: str) -> dict:
    """An audit log event added or removed."""
    return {"kind": "audit", "verb": verb, "ident": event, "source": source}


def api_fact(verb: str, method: str, path: str, handler: str, source: str) -> dict:
    """An API endpoint added or removed, with its full path."""
    return {"kind": "api", "verb": verb, "method": method, "path": path, "handler": handler,
            "ident": f"{method} {path}", "source": source}


def min_version_fact(name: str, old: str, new: str, source: str) -> dict:
    """A raised (or lowered) minimum supported version of a browser, OS or database."""
    return {"kind": "min_version", "verb": "Raised" if _version_key(new) > _version_key(old) else "Lowered",
            "ident": name, "old": old, "new": new, "source": source}


def fact_key(fact: dict) -> str:
    """The derived source key a fact found only in the code is recorded under in changelog-sources."""
    kind = {"config": "config", "config_default": "config-default", "audit": "audit", "api": "api",
            "min_version": "min-version"}[fact["kind"]]
    suffix = fact.get("new") if fact["kind"] in ("config_default", "min_version") else fact["verb"].lower()
    return f"{kind}:{fact['ident'].replace(' ', '_')}@{suffix}"


def _version_key(version: str) -> tuple:
    return tuple(int(part) for part in re.findall(r"\d+", version or "")) or (0,)


# ── Reading the code ────────────────────────────────────────────────────────────────

_STRUCT_DECL_RE = re.compile(r"^type\s+(\w+)\s+struct\s*\{")
_FIELD_LINE_RE = re.compile(r"^\t([A-Z][A-Za-z0-9_]*)\s+\S")


def config_fields(src: str) -> set[tuple[str, str]]:
    """``{(Struct, Field)}`` for every exported field of every named struct in config.go.

    The same walk as config-change-checker, so both name a setting the same way.
    """
    fields, stack, depth = set(), [], 0
    for line in (src or "").splitlines():
        declared = _STRUCT_DECL_RE.match(line)
        if declared:
            stack.append((declared.group(1), depth))
        depth += line.count("{") - line.count("}")
        while stack and depth <= stack[-1][1]:
            stack.pop()
        if len(stack) == 1 and depth == stack[0][1] + 1:
            field = _FIELD_LINE_RE.match(line)
            if field:
                fields.add((stack[0][0], field.group(1)))
    return fields


def config_groups(src: str) -> dict[str, list[str]]:
    """Each settings struct's ``config.json`` groups: ``{"SSOSettings": ["GitLabSettings", "GoogleSettings", ...]}``."""
    body = re.search(r"(?ms)^type Config struct \{\n(.*?)^\}", src or "")
    groups: dict[str, list[str]] = {}
    for name, struct in re.findall(r"(?m)^\t([A-Z]\w*)\s+\*?(\w+)\s*(?:`|//|$)", body.group(1) if body else ""):
        groups.setdefault(struct, []).append(name)
    return groups


_CONST_RE = re.compile(r"(?m)^\t(\w+)\s*=\s*(\"[^\"\n]*\"|-?\d+(?:\.\d+)?|true|false)\s*(?://.*)?$")
_SET_DEFAULTS_RE = re.compile(r"(?m)^func \(\w+ \*(\w+)\) SetDefaults\([^)]*\) \{\n")
# ``s.X = new(true)``, ``s.X = NewPointer("x")``, ``s.X = model.NewPointer(Const)``, ``*s.X = "gzip"``.
_ASSIGN_RE = re.compile(r"^\t+\*?s\.(\w+)\s*=\s*(?:new|(?:model\.)?NewPointer)\((.*)\)\s*$|^\t+\*?s\.(\w+)\s*=\s*(\".*\"|-?\d[\d.]*|true|false)\s*$")


def _func_body(src: str, start: int) -> str:
    """The text of the function body that opens just before ``start``."""
    depth, index = 1, start
    while index < len(src) and depth:
        depth += {"{": 1, "}": -1}.get(src[index], 0)
        index += 1
    return src[start:index - 1]


def config_defaults(src: str) -> dict[tuple[str, str], str]:
    """The default each SetDefaults gives a field: ``{("ServiceSettings", "WebserverMode"): '"gzip"'}``.

    Constants are resolved to their values. A field set to different values on install
    and on upgrade reads ``"<install> (new installs), <upgrade> (upgrades)"``; a field
    whose default is computed is left out, since there is no value to compare.
    """
    constants = dict(_CONST_RE.findall(src or ""))
    defaults: dict[tuple[str, str], str] = {}
    for match in _SET_DEFAULTS_RE.finditer(src or ""):
        struct = match.group(1)
        body = _func_body(src, match.end())
        values: dict[str, list[str]] = {}
        for line in body.splitlines():
            assign = _ASSIGN_RE.match(line)
            if not assign:
                continue
            field = assign.group(1) or assign.group(3)
            value = (assign.group(2) or assign.group(4)).strip()
            value = re.sub(r"^(?:u?int(?:8|16|32|64)?|float(?:32|64))\((.*)\)$", r"\1", value)
            value = constants.get(value, value)
            if not re.fullmatch(r"\".*\"|-?\d[\d.]*|true|false", value):
                values[field] = values.get(field, []) + ["?"]
                continue
            if value not in values.get(field, []):
                values[field] = values.get(field, []) + [value]
        for field, found in values.items():
            if "?" in found:
                continue
            if len(found) == 1:
                defaults[(struct, field)] = found[0]
            elif len(found) == 2 and re.search(r"if isUpdate", body):
                # ``if isUpdate { s.X = new(a) } else { s.X = new(b) }``: upgrade first.
                defaults[(struct, field)] = f"{found[1]} (new installs), {found[0]} (upgrades)"
    return defaults


def show_default(value: str | None) -> str:
    """A default as the changelog writes it: ``""`` is "an empty string", others in double backticks."""
    if value is None:
        return ""
    split = re.fullmatch(r"(.*) \(new installs\), (.*) \(upgrades\)", value)
    if split:
        return f"{show_default(split.group(1))} on new installs and {show_default(split.group(2))} on upgrade"
    if value == '""':
        return "an empty string"
    return f"``{value[1:-1] if value.startswith(chr(34)) else value}``"


_AUDIT_CONST_RE = re.compile(r"(?m)^\t(AuditEvent\w+)\s*=")


def audit_events(src: str) -> set[str]:
    """The AuditEvent* constants defined in audit_events.go."""
    return set(_AUDIT_CONST_RE.findall(src or ""))


# The minimum versions the server tells users about, and what to call each in a bullet.
_I18N_MINIMUMS = {
    "web.error.unsupported_browser.min_browser_version.chrome": "Chrome",
    "web.error.unsupported_browser.min_browser_version.edge": "Edge",
    "web.error.unsupported_browser.min_browser_version.firefox": "Firefox",
    "web.error.unsupported_browser.min_browser_version.safari": "Safari",
    "web.error.unsupported_browser.min_os_version.mac": "macOS",
    "web.error.unsupported_browser.min_os_version.windows": "Windows",
}
MINIMUM_SOURCES = (SERVER_I18N_PATH, CONFIG_PATH, SQLSTORE_PATH)


def minimum_versions(i18n: str | None, config_src: str | None, sqlstore_src: str | None) -> dict[str, str]:
    """``{"Chrome": "156", "macOS": "15", "PostgreSQL": "15"}``: the minimum supported versions in the code.

    Browsers and OSes come from the unsupported-browser page's strings ("Version 156+"),
    PostgreSQL from ``model.MinimumPostgresMajorVersion`` or, before that existed, the
    sqlstore's ``minimumRequiredPostgresVersion`` (major * 10000).
    """
    found = {}
    try:
        entries = json.loads(i18n) if i18n else []
    except ValueError:
        entries = []
    for entry in entries if isinstance(entries, list) else []:
        name = _I18N_MINIMUMS.get(entry.get("id"))
        number = re.search(r"\d+(?:\.\d+)*", entry.get("translation") or "") if name else None
        if number:
            found[name] = number.group(0)
    postgres = re.search(r"(?m)^\tMinimumPostgresMajorVersion\s*=\s*(\d+)", config_src or "")
    if postgres:
        found["PostgreSQL"] = postgres.group(1)
    else:
        literal = re.search(r"(?m)^\tminimumRequiredPostgresVersion\s*=\s*(\d+)\s*$", sqlstore_src or "")
        if literal:
            found["PostgreSQL"] = str(int(literal.group(1)) // 10000)
    return found


def code_facts(base_ref: str, head_ref: str, show) -> list[dict]:
    """Config, audit and minimum-version changes between two release refs, read from the code.

    ``show(ref, path)`` returns a file's text or None. Each fact's ``source`` is its
    derived key (see ``fact_key``); the PR that made it is found separately.
    """
    if not base_ref or not head_ref:
        return []
    facts = []
    base_config, head_config = show(base_ref, CONFIG_PATH) or "", show(head_ref, CONFIG_PATH) or ""
    base_fields, head_fields = config_fields(base_config), config_fields(head_config)
    head_defaults, base_defaults = config_defaults(head_config), config_defaults(base_config)
    settings = _setting_structs(head_config) | _setting_structs(base_config)
    for struct, field in sorted(head_fields - base_fields):
        if struct in settings:
            facts.append(config_fact("Added", struct, field, "", head_defaults.get((struct, field))))
    for struct, field in sorted(base_fields - head_fields):
        if struct in settings:
            facts.append(config_fact("Removed", struct, field, ""))
    for key in sorted(set(head_defaults) & set(base_defaults) & head_fields & base_fields):
        if head_defaults[key] != base_defaults[key] and key[0] in settings:
            facts.append(default_fact(key[0], key[1], base_defaults[key], head_defaults[key], ""))

    base_events = audit_events(show(base_ref, AUDIT_EVENTS_PATH))
    head_events = audit_events(show(head_ref, AUDIT_EVENTS_PATH))
    facts += [audit_fact("Added", event, "") for event in sorted(head_events - base_events)]
    facts += [audit_fact("Removed", event, "") for event in sorted(base_events - head_events)]

    before = minimum_versions(show(base_ref, SERVER_I18N_PATH), base_config, show(base_ref, SQLSTORE_PATH))
    after = minimum_versions(show(head_ref, SERVER_I18N_PATH), head_config, show(head_ref, SQLSTORE_PATH))
    for name in sorted(set(before) & set(after)):
        if _version_key(before[name]) != _version_key(after[name]):
            facts.append(min_version_fact(name, before[name], after[name], ""))
    for fact in facts:
        fact["source"] = fact_key(fact)
        fact["basis"] = "code"
    return facts


def _setting_structs(config_src: str) -> set[str]:
    """The structs that are ``config.json`` groups (and so hold settings), from the Config struct."""
    return set(config_groups(config_src))


def contradicted(fact: dict, base_ref: str, head_ref: str, show, endpoints=None) -> str | None:
    """Why a checker line is wrong about the release, or None.

    The checker compares a PR with the branch it was opened from, which can be older
    than the previous release: it then reports a setting or event the previous release
    already shipped as added. ``endpoints(ref)`` gives the router's ``(path, handler, method)``
    routes at a ref, for checking API lines; without it they are not checked.
    """
    if not base_ref or not head_ref or fact["kind"] not in ("config", "audit", "api"):
        return None
    if fact["kind"] == "api":
        if endpoints is None:
            return None
        base = {(path, method) for path, _, method in endpoints(base_ref)}
        head = {(path, method) for path, _, method in endpoints(head_ref)}
        key = (fact["path"], fact["method"])
    elif fact["kind"] == "config":
        base = config_fields(show(base_ref, CONFIG_PATH) or "")
        head = config_fields(show(head_ref, CONFIG_PATH) or "")
        key = (fact["group"], fact["field"])
    else:
        base = audit_events(show(base_ref, AUDIT_EVENTS_PATH))
        head = audit_events(show(head_ref, AUDIT_EVENTS_PATH))
        key = fact["ident"]
    if fact["verb"] == "Added" and key in base:
        if fact["kind"] == "api":
            return ("already in the previous release's router (a local-mode registration of an existing endpoint "
                    "reads the same; say so in the note's text)")
        return "already in the previous release"
    if fact["verb"] == "Added" and key not in head:
        return "not on the release branch"
    if fact["verb"] == "Removed" and key in head:
        return "still on the release branch"
    return None


# ── Finding the PR that made a change ───────────────────────────────────────────────

_PR_NUMBER_RE = re.compile(r"cherry[- ]?pick(?:ed)? (?:of )?#(\d+)|\(#(\d+)\)\s*$", re.IGNORECASE)


def _added_pattern(fact: dict) -> re.Pattern:
    """What the diff line that made ``fact`` looks like."""
    if fact["kind"] == "config":
        return re.compile(rf"(?m)^[{'+' if fact['verb'] == 'Added' else '-'}]\t{re.escape(fact['field'])}\s")
    if fact["kind"] == "config_default":
        return re.compile(rf"(?m)^\+.*\bs\.{re.escape(fact['field'])}\b.*=")
    if fact["kind"] == "audit":
        return re.compile(rf"(?m)^[{'+' if fact['verb'] == 'Added' else '-'}]\t{re.escape(fact['ident'])}\s*=")
    if fact["kind"] == "min_version":
        number = re.escape(fact["new"])
        if fact["ident"] == "PostgreSQL":
            return re.compile(rf"(?m)^\+.*(?:MinimumPostgresMajorVersion|minimumRequiredPostgresVersion)\s*=\s*{number}")
        return re.compile(rf"(?m)^\+.*\b{number}\b")
    return re.compile(r"(?!)")


def _paths(fact: dict) -> tuple[str, ...]:
    return {"config": (CONFIG_PATH,), "config_default": (CONFIG_PATH,), "audit": (AUDIT_EVENTS_PATH,),
            "min_version": MINIMUM_SOURCES}.get(fact["kind"], ())


def find_prs(facts: list[dict], commits_for) -> None:
    """Set each fact's ``pr`` to the PR whose commit made the change, when one is found.

    ``commits_for(path)`` returns the release branch's commits that touched ``path`` since
    the previous release was cut, newest first, each ``{"message", "patch"}`` with the
    patch of that path only. The PR is read from the squash commit's title.
    """
    cache: dict[str, list] = {}
    for fact in facts:
        pattern = _added_pattern(fact)
        for path in _paths(fact):
            if path not in cache:
                cache[path] = commits_for(path)
            for commit in cache[path]:
                if pattern.search(commit.get("patch") or ""):
                    title = (commit.get("message") or "").split("\n", 1)[0]
                    number = _PR_NUMBER_RE.search(title)
                    if number:
                        fact["pr"] = int(number.group(1) or number.group(2))
                        break
            if fact.get("pr"):
                break


# ── Plans, from the System Console's admin definition ───────────────────────────────

_SKU_PLANS = {"EnterpriseAdvanced": "Enterprise Advanced", "Enterprise": "Enterprise", "E20": "Enterprise",
              "Professional": "Professional", "E10": "Professional"}
# License features the admin definition gates pages on, and the plan each first comes with.
FEATURE_PLANS = {
    "Cluster": "Enterprise", "Elasticsearch": "Enterprise", "Compliance": "Enterprise",
    "DataRetention": "Enterprise", "MessageExport": "Enterprise", "CustomTermsOfService": "Enterprise",
    "SharedChannels": "Enterprise", "Announcement": "Enterprise", "LDAPGroups": "Enterprise",
    "IDLoadedPushNotifications": "Enterprise", "EmailNotificationContents": "Enterprise",
    "LockTeammateNameDisplay": "Enterprise", "CustomPermissionsSchemes": "Enterprise",
    "LDAP": "Professional", "SAML": "Professional", "MFA": "Professional", "GoogleOAuth": "Professional",
    "Office365OAuth": "Professional", "OpenId": "Professional", "GuestAccounts": "Professional",
    "GuestAccountsPermissions": "Professional",
}
_PLAN_SIGNALS = (
    (re.compile(r"it\.not\(\s*it\.minLicenseTier\(\s*LicenseSkus\.(\w+)"), _SKU_PLANS),
    (re.compile(r"getRestrictedIndicator\([^)]*?LicenseSkus\.(\w+)"), _SKU_PLANS),
    (re.compile(r"it\.not\(\s*it\.licensedForSku\(\s*LicenseSkus\.(\w+)"), _SKU_PLANS),
    (re.compile(r"it\.not\(\s*it\.licensedForFeature\(\s*['\"](\w+)['\"]"), FEATURE_PLANS),
)


def _brace_spans(src: str) -> list[tuple[int, int]]:
    """``(open, close)`` of every ``{...}`` block, skipping braces in strings and comments."""
    spans, stack, index, quote = [], [], 0, None
    while index < len(src):
        char = src[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char in "'\"`":
            quote = char
        elif src.startswith("//", index):
            index = src.find("\n", index)
            if index < 0:
                break
            continue
        elif char == "{":
            stack.append(index)
        elif char == "}" and stack:
            spans.append((stack.pop(), index))
        index += 1
    return spans


def _own_text(src: str, span: tuple[int, int], spans: list[tuple[int, int]]) -> str:
    """The text of a block without the blocks nested in it."""
    start, end = span
    children = sorted((s, e) for s, e in spans if start < s and e < end)
    out, at = [], start + 1
    for s, e in children:
        if s < at:
            continue
        out.append(src[at:s])
        at = e + 1
    out.append(src[at:end])
    return "".join(out)


def plan_at(src: str, position: int, spans: list | None = None) -> str | None:
    """The plan the admin definition requires for the setting or page at ``position``: the highest
    plan any block around it is gated on, or None when none is."""
    spans = spans if spans is not None else _brace_spans(src)
    plans = set()
    for span in spans:
        if span[0] < position < span[1]:
            own = _own_text(src, span, spans)
            for pattern, table in _PLAN_SIGNALS:
                plans.update(table[name] for name in pattern.findall(own) if name in table)
    return next((plan for plan in PLANS if plan in plans), None)


def setting_plan(struct: str, field: str, groups: dict, admin_src: str, components=None) -> tuple[str, str]:
    """``(plan, basis)`` for a setting, read from the System Console admin definition.

    The setting's ``key: 'Group.Field'`` is looked up for each config.json group its struct
    is used for; a struct shared by several groups (SSOSettings) takes the lowest plan
    among them. A setting a custom component edits is looked up by that component's page,
    found by ``components(key)``: the names of the admin definition components whose files
    name the key. A setting the System Console doesn't show is on all plans.
    """
    spans = _brace_spans(admin_src or "")
    found = []
    for group in groups.get(struct, [struct]):
        key = f"{group}.{field}"
        positions = [m.start() for m in re.finditer(rf"key:\s*['\"]{re.escape(key)}['\"]", admin_src or "")]
        basis = f"`{key}` in the admin definition"
        if not positions and components:
            for name in components(key):
                positions += [m.start() for m in re.finditer(rf"component:\s*{re.escape(name)}\b", admin_src or "")]
                basis = f"`{key}` in the {name} System Console page"
        for position in positions:
            found.append((plan_at(admin_src, position, spans) or "All", basis))
    if not found:
        return "All", "not shown in the System Console"
    found.sort(key=lambda item: -PLANS.index(item[0]))
    return found[0]


def admin_components(key: str, grep, admin_src: str) -> list[str]:
    """Names the admin definition imports custom components under, for the files that name ``key``.

    ``grep(text)`` returns the admin console files that contain ``text``.
    """
    names = []
    for path in grep(key):
        module = re.sub(r"\.(tsx?|jsx?)$", "", path.removeprefix(ADMIN_CONSOLE_DIR + "/"))
        module = re.sub(r"/index$", "", module)
        for name, target in re.findall(r"(?m)^import\s+(\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+['\"]([^'\"]+)['\"]", admin_src or ""):
            target = re.sub(r"^(?:components/admin_console/|\./)", "", target)
            if target in (module, re.sub(r"/[^/]+$", "", module)) and name not in names:
                names.append(name)
    return names


# ── Rendering ───────────────────────────────────────────────────────────────────────

def bullet(fact: dict) -> str:
    """The changelog text for one fact."""
    kind = fact["kind"]
    if kind == "config" and fact["verb"] == "Added":
        default = show_default(fact.get("default"))
        tail = f" The default value is {default}." if default else ""
        return f"Under ``{fact['group']}`` in ``config.json``, added ``{fact['field']}`` configuration setting.{tail}"
    if kind == "config":
        return f"Removed ``{fact['ident']}`` configuration setting."
    if kind == "config_default":
        return (f"Under ``{fact['group']}`` in ``config.json``, changed the default value of ``{fact['field']}`` "
                f"from {show_default(fact['old'])} to {show_default(fact['new'])}.")
    if kind == "audit":
        return f"{fact['verb']} ``{fact['ident']}`` audit log event."
    if kind == "api":
        return f"{fact['verb']} ``{fact['method']} {fact['path']}`` (``{fact['handler']}``) API endpoint."
    raise ValueError(f"no single bullet for a {kind} fact")


def _min_version_bullets(facts: list[dict]) -> list[tuple[str, list[dict]]]:
    """One bullet per new minimum version, naming everything raised to it: "Chrome and Edge versions to 156+"."""
    by_version: dict[tuple[str, str], list[dict]] = {}
    for fact in facts:
        by_version.setdefault((fact["verb"], fact["new"]), []).append(fact)
    out = []
    for (verb, version), group in sorted(by_version.items(), key=lambda item: _version_key(item[0][1])):
        names = [fact["ident"] for fact in group]
        listed = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
        plural = "s" if len(names) > 1 else ""
        suffix = "" if group[0]["ident"] == "PostgreSQL" else "+"
        verb_text = "Updated" if verb == "Raised" else "Lowered"
        out.append((f"{verb_text} the minimum supported {listed} version{plural} to {version}{suffix}.", group))
    return out


def render_facts(facts: list[dict], ids: dict) -> str:
    """Changelog text for ``facts``, each bullet ending with its note marker ``[[Nk]]``.

    ``ids`` maps ``id(fact)`` to its note ID. config.json bullets are grouped under plan
    labels (Enterprise Advanced, Enterprise, Professional, All Plans), with removed
    settings as top-level bullets after them.
    """
    def marked(text, group):
        return f"{text} [[{','.join(ids[id(f)] for f in group)}]]"

    # The same change named by two PRs (a cherry-pick and its original) is one bullet carrying both.
    by_text: dict[str, list[dict]] = {}
    for fact in facts:
        if fact["kind"] != "min_version":
            by_text.setdefault(bullet(fact), []).append(fact)
    same = {id(fact): group for group in by_text.values() for fact in group}
    facts = [fact for fact in facts if fact["kind"] == "min_version" or same[id(fact)][0] is fact]

    def marked_one(fact):
        return marked(bullet(fact), same[id(fact)])

    config = [f for f in facts if f["kind"] in ("config", "config_default")]
    minimums = [f for f in facts if f["kind"] == "min_version"]
    audits = [f for f in facts if f["kind"] == "audit"]
    apis = [f for f in facts if f["kind"] == "api"]
    out = []
    if config or minimums:
        out.append("### Upgrade Impact")
    if config:
        out += ["", "#### config.json", CONFIG_DESCRIPTION]
        for plan in PLANS:
            planned = [f for f in config if f.get("plan", "All") == plan and not _is_removal(f)]
            if planned:
                out.append(f" - {PLAN_LABELS[plan]}")
                out += [f"   - {marked_one(f)}" for f in sorted(planned, key=_config_order)]
        out += [f" - {marked_one(f)}" for f in sorted(config, key=_config_order) if _is_removal(f)]
    if minimums:
        out += ["", "#### Important Upgrade Notes"]
        out += [f" - {marked(text, group)}" for text, group in _min_version_bullets(minimums)]
    for title, group in (("API Changes", apis), ("Audit Log Event Changes", audits)):
        if group:
            out += ["", f"### {title}"]
            order = (lambda f: (f["verb"] != "Added", f["path"], f["method"])) if title == "API Changes" else \
                (lambda f: (f["verb"] != "Added", f["ident"]))
            out += [f" - {marked_one(f)}" for f in sorted(group, key=order)]
    return ("\n".join(out).strip() + "\n") if out else ""


def _is_removal(fact: dict) -> bool:
    return fact["kind"] == "config" and fact["verb"] == "Removed"


def _config_order(fact: dict) -> tuple:
    return (fact["kind"] != "config", fact["group"], fact["field"])


def mentioned(fact: dict, text: str) -> bool:
    """Whether ``text`` (release notes, or an entry a reviewer edited) already states ``fact``."""
    if fact["kind"] in ("config", "config_default"):
        if re.search(rf"\b{re.escape(fact['group'])}\.{re.escape(fact['field'])}\b", text):
            return True
        return any(re.search(rf"\b{re.escape(fact['field'])}\b", line) and fact["group"] in line
                   for line in text.splitlines())
    if fact["kind"] == "audit":
        return re.search(rf"\b{re.escape(fact['ident'])}\b", text) is not None
    if fact["kind"] == "api":
        return fact["path"] in text and fact["method"] in text
    if fact["kind"] == "min_version":
        return any(fact["ident"].lower() in line.lower() and re.search(rf"\b{re.escape(fact['new'])}\b", line)
                   and re.search(r"(?i)minimum|at least|or later|\+", line) for line in text.splitlines())
    return False

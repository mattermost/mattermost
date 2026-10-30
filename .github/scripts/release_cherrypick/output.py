"""The run summary (public), the Hub reply and the release-agent-log line.

The public summary names ticket keys and PRs, but never shows the title of a PR in
mattermost/enterprise (or any non-public repo): those appear as "(private repo)" and the
number. The Hub message is private and has titles and links.
"""

from .labeller import ADDED, PUBLIC_REPOS, SET, WOULD_ADD, WOULD_SET, Report

STATUS_MARKER_PROP = "release_agent_marker"
RELEASE_CHANNELS = ("Release: {short}", "Release: {short} (ESR)", "Release: {short} ESR")
MAX_PAGES = 10


def _what(change) -> str:
    parts = []
    if change.label in (ADDED, WOULD_ADD):
        parts.append("label")
    if change.milestone in (SET, WOULD_SET):
        parts.append("milestone")
    return " and ".join(parts)


def _pr(change, private: bool) -> str:
    if private:
        return f"[{change.repo.split('/')[-1]}#{change.number}]({change.url}) {change.title}".rstrip()
    ref = change.public_ref
    return f"{ref} {change.title}".rstrip() if change.repo in PUBLIC_REPOS else ref


def _outside(pr, private: bool) -> str:
    if private or pr.public:
        return f"[{pr.repo}#{pr.number}]({pr.url})"
    return f"(private repo) #{pr.number}"


def report_lines(report: Report, private: bool = False) -> list[str]:
    version = report.version
    verb = "Labelled" if report.live else "Would label"
    lines = []
    if version:
        lines.append(f"### {version.short}: `CherryPick/Approved` and milestone {version.milestone}")
        lines.append(f"{len(report.tickets)} Submitted ticket{'' if len(report.tickets) == 1 else 's'} "
                     f"with {version.name}.")

    def section(title, entries):
        if entries:
            lines.extend(["", f"**{title}** ({len(entries)})"] + [f"- {entry}" for entry in entries])

    section(verb, [f"{c.ticket}: {_pr(c, private)} ({_what(c)})" for c in report.labelled])
    section("Already done", [f"{c.ticket}: {_pr(c, private)}" for c in report.already_done])
    section("Submitted tickets with no linked PR", report.no_pr)
    section("PRs outside the allowlist, not changed", [f"{p.ticket}: {_outside(p, private)}" for p in report.outside])
    section("Milestone conflicts, not changed", [
        f"{c.ticket}: {_pr(c, private)} has milestone {c.current_milestone}, not {version.milestone}"
        + (" (found by its title, so not labelled either)" if c.by_title else "") for c in report.conflicts])
    section("Skipped", [f"{c.ticket}: {_pr(c, private)} {c.skipped}" for c in report.skipped])
    section("Other fix versions, to handle by hand", [
        f"{ticket}: {', '.join(names)}" for ticket, names in sorted(report.other_versions.items())])
    section("Notes", report.notes)
    section("Errors", report.errors)
    return lines


def summary(reports: list[Report], live: bool, problems: list[str] = ()) -> str:
    lines = [f"## Cherry-pick labels · {'live' if live else 'dry run (nothing changed)'}"]
    if problems:
        lines += [""] + [f"- :warning: {p}" for p in problems]
    if not reports and not problems:
        lines += ["", "No active release: no unreleased vX.Y (Month Year) fix version has a release branch yet."]
    for report in reports:
        lines += [""] + report_lines(report)
    return "\n".join(lines) + "\n"


def counts(report: Report) -> str:
    verb = "labelled" if report.live else "to label"
    parts = [f"{len(report.labelled)} {verb}", f"{len(report.already_done)} already done",
             f"{len(report.no_pr)} without a PR", f"{len(report.outside)} outside the allowlist",
             f"{len(report.conflicts)} milestone conflicts"]
    if report.errors:
        parts.append(f"{len(report.errors)} errors")
    return ", ".join(parts)


def log_line(reports: list[Report], live: bool, run_url: str, problems: list[str] = ()) -> str:
    mode = "live" if live else "dry run"
    body = "; ".join(f"{r.version.short if r.version else 'ticket'}: {counts(r)}" for r in reports) or "no active release"
    if problems:
        body += f"; {len(problems)} problems"
    icon = ":warning:" if problems or any(r.errors for r in reports) else ":white_check_mark:"
    return f"{icon} Cherry-pick labels ({mode}) · {body} · [run]({run_url})"


def hub_message(report: Report) -> str:
    version = report.version
    lines = [f"Labelled approved cherry-picks for {version.short} with `CherryPick/Approved` and milestone "
             f"{version.milestone}:"]
    lines += [f"- {c.ticket}: {_pr(c, True)} ({_what(c)})" for c in report.labelled]
    if report.conflicts:
        lines += ["Milestone conflicts, not changed:"] + [
            f"- {c.ticket}: {_pr(c, True)} has milestone {c.current_milestone}" for c in report.conflicts]
    if report.other_versions:
        lines += ["Other fix versions, to handle by hand:"] + [
            f"- {ticket}: {', '.join(names)}" for ticket, names in sorted(report.other_versions.items())]
    return "\n".join(lines)


def release_channel(hub, short: str) -> dict | None:
    names = {" ".join(name.format(short=short).split()).casefold() for name in RELEASE_CHANNELS}
    found = [c for c in hub.my_channels() if " ".join((c.get("display_name") or "").split()).casefold() in names]
    return found[0] if len(found) == 1 else None


def status_post(hub, channel_id: str, short: str) -> dict | None:
    """The release agent's live status post for the release in ``channel_id``."""
    marker, bot_id = f"release-agent:status:{short}:live", hub.me()["id"]
    for page in range(MAX_PAGES):
        posts = hub.channel_posts(channel_id, page=page)
        for post in posts:
            if post.get("user_id") == bot_id and (post.get("props") or {}).get(STATUS_MARKER_PROP) == marker:
                return post
        if len(posts) < 200:
            return None
    return None


def post_to_release(hub, report: Report) -> str:
    """Reply under the status post in the release channel, or post there. Returns what happened."""
    if not report.labelled:
        return "nothing labelled"
    channel = release_channel(hub, report.version.short)
    if not channel:
        return "no release channel"
    post = status_post(hub, channel["id"], report.version.short)
    hub.create_post(channel["id"], hub_message(report), root_id=post["id"] if post else "")
    return "replied to the status post" if post else "posted in the release channel"

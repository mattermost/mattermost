"""The Marketing hand-off on Release Day: the release email and the social post.

As in the release manager's own asks in the Marketing channel, each post mentions its
owner and gives the copy and the date:

- Email: a post for the email owner, with the email (the ``drafts`` task's, without sources)
  as a reply. The Asana request stays with the release manager: the form text is posted,
  ready to copy, in the review channel, and the "Queue the email" item is theirs to tick.
- Social: a post for the social owner with one or two sentences and the changelog link.
  Its playbook item is ticked once posted.
- In an ESR comms month, the forum post draft goes in the email thread too.

Nothing is posted when a draft has a TODO or names a Jira key or an enterprise PR.
"""

from . import hub as hublib
from .changelog import join_names
from .drafts import internal_references
from .result import TODO_MARKER, Result

TASK = "marketing"
ASANA_FORM = "https://form.asana.com/?k=v7z8NcqgcM2wH326VnUlJA&d=279683980846511"
SOCIAL_ITEMS = ["Queue the Twitter announcement…"]
EMAIL_ITEM = "Queue the email for the Marketing team"


def markers(short: str) -> dict:
    return {key: f"release-docs:marketing-{key}:{short}"
            for key in ("email", "email-copy", "forum", "social", "asana")}


def social_text(version, highlights: list, changelog: str, result: Result) -> str:
    names = [h.name for h in highlights][:3]
    if not names:
        return result.todo("no highlights for the social post")
    return f"Mattermost {version.short} is out, with {join_names(names)}. See what's new: {changelog}"


def asana_text(version, day_text: str, email: str, marketing_link: str, manager: dict | None) -> str:
    return "\n".join([
        f"{hublib.mention(manager)} The release email for Mattermost {version.short} is in Marketing. Submit the "
        f"[Marketing request form]({ASANA_FORM}) with these values, then tick \"{EMAIL_ITEM}\":",
        "",
        "| Form field | Value |",
        "|---|---|",
        "| How urgent is this request? | Medium (Needs to be resolved within 1 week) |",
        f"| Is there a hard deadline? | {day_text} |",
        "| Please describe your request | The text below |",
        "| What type of support do you need? | Email |",
        "",
        "Please describe your request:",
        "```",
        "A release email copy is ready to be sent out:",
        "",
        email.strip(),
        "",
        f"Marketing post: {marketing_link}",
        "```",
    ])


def check(name: str, text: str, result: Result) -> None:
    if TODO_MARKER in text:
        result.todo(f"the {name} draft has a TODO, so it was not posted")
    found = internal_references(text)
    if found:
        result.todo(f"the {name} draft names {len(found)} Jira key(s) or enterprise PR(s), so it was not posted")


def run(version, day_text: str, email: str, email_todos: list, social: str, forum: str, hub, env: dict,
        live: bool) -> Result:
    result = Result(TASK, version.tag)
    if email_todos:
        # Not repeated here: they can name Jira keys and enterprise PRs. The drafts task posts them to Hub.
        result.todo(f"the email draft has {len(email_todos)} missing input(s); run the drafts task to see them in Hub")
    check("email", email, result)
    check("social", social, result)
    if forum:
        check("forum", forum, result)
    marketing = env.get("MARKETING_CHANNEL_ID", "")
    if hub is None or not marketing:
        result.todo("RELEASE_AGENT_MM_TOKEN or RELEASE_DOCS_MARKETING_CHANNEL_ID is not set")
    if result.failed:
        result.text = "Nothing posted."
        return result

    mark = markers(version.short)
    email_owner = env.get("MARKETING_EMAIL_OWNER") or "caroline.knoche"
    social_owner = env.get("MARKETING_SOCIAL_OWNER") or "a-rosa.lear"
    channel = hublib.release_channel(hub, version)
    run_ = hublib.release_run(hub, channel)
    manager = hublib.release_manager(hub, run_)
    review = env.get("REVIEW_CHANNEL_ID") or (channel or {}).get("id", "")
    done = []

    def post(channel_id, key, message, root_id=""):
        """Create the post once; returns it (or a stand-in in a dry run)."""
        existing = hublib.find_reply(hub, root_id, mark[key]) if root_id else hublib.find_post(hub, channel_id, mark[key])
        if existing:
            done.append(f"{key}: already posted")
            return existing
        if not live:
            done.append(f"{key}: dry run, would have posted")
            return {"id": "", "dry_run": True}
        created = hub.create_post(channel_id, message, {hublib.MARKER_PROP: mark[key]}, root_id=root_id)
        done.append(f"{key}: posted")
        return created

    email_post = post(marketing, "email", f"@{email_owner} Release email for Mattermost {version.short}, to be sent on "
                                          f"{day_text}. Email copy below.")
    if email_post.get("id"):
        post(marketing, "email-copy", email.strip(), root_id=email_post["id"])
        if forum:
            post(marketing, "forum", f"Forum post draft (to post by hand):\n\n{forum.strip()}", root_id=email_post["id"])
    elif forum and not live:
        done.append("forum: dry run, would have posted")
    post(marketing, "social", f"@{social_owner} Social post for Mattermost {version.short}, for {day_text}:\n\n{social}")
    if review:
        link = f"{hub.base_url}/_redirect/pl/{email_post['id']}" if email_post.get("id") else "(the Marketing post)"
        post(review, "asana", asana_text(version, day_text, email, link, manager))
    else:
        result.notes.append("No review or release channel, so the Asana form text was not posted.")
    result.notes.append(hublib.tick(hub, run_, SOCIAL_ITEMS, live))
    result.notes.append(f'"{EMAIL_ITEM}" stays with the release manager, who ticks it after submitting the form.')
    result.text = "\n".join(f"- {line}" for line in done)
    return result

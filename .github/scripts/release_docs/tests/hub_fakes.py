"""In-memory Hub, Google Calendar and Jira for the Hub and calendar tasks.

Each records the calls that would change something in ``writes``, so a dry run can be
shown to change nothing.
"""

import itertools
from datetime import date, timedelta

from release_docs import hub as hublib

BOT = {"id": "bot", "username": "release-bot"}
AMY = {"id": "amy", "username": "amy.blais"}
OWNER = {"id": "owner", "username": "release.manager"}


class FakeHub:
    base_url = "https://hub.example.com"

    def __init__(self, channels=(), run=None):
        self.users = {u["id"]: u for u in (BOT, AMY, OWNER)}
        self.channels = {c["id"]: c for c in channels}
        self.posts = {}  # id -> post, oldest first
        self.reaction_list = {}  # post id -> reactions
        self.scheduled = []
        self.run = run
        self.writes = []
        self._ids = (f"p{n}" for n in itertools.count(1))

    # setup helpers
    def react(self, post_id, user, emoji="white_check_mark"):
        self.reaction_list.setdefault(post_id, []).append({"user_id": user["id"], "emoji_name": emoji})

    def edit(self, post_id, message):
        self.posts[post_id] = {**self.posts[post_id], "message": message, "edit_at": 1}

    def posts_in(self, channel_id, root=None):
        return [p for p in self.posts.values() if p["channel_id"] == channel_id and (root is None or p["root_id"] == root)]

    # the Hub interface
    def me(self):
        return BOT

    def user(self, user_id):
        return self.users[user_id]

    def user_by_username(self, username):
        return next((u for u in self.users.values() if u["username"] == username), None)

    def channel(self, channel_id):
        return self.channels.get(channel_id, {"id": channel_id, "team_id": "team"})

    def my_channels(self):
        return list(self.channels.values())

    def channel_posts(self, channel_id, page):
        posts = [p for p in reversed(list(self.posts.values())) if p["channel_id"] == channel_id]
        return posts[page * hublib.PER_PAGE:(page + 1) * hublib.PER_PAGE]

    def thread(self, post_id):
        return [p for p in self.posts.values() if p["id"] == post_id or p["root_id"] == post_id]

    def reactions(self, post_id):
        return self.reaction_list.get(post_id, [])

    def create_post(self, channel_id, message, props, root_id=""):
        post = {"id": next(self._ids), "channel_id": channel_id, "message": message, "props": dict(props),
                "root_id": root_id, "user_id": BOT["id"]}
        self.posts[post["id"]] = post
        self.writes.append(("post", channel_id, message))
        return post

    def schedule_post(self, channel_id, message, props, at_ms):
        self.scheduled.append({"channel_id": channel_id, "message": message, "props": dict(props), "scheduled_at": at_ms})
        self.writes.append(("schedule", channel_id, message))
        return self.scheduled[-1]

    def scheduled_posts(self, team_id):
        return list(self.scheduled)

    def runs_in_channel(self, channel_id):
        return [self.run] if self.run and self.run.get("channel_id") == channel_id else []

    def close_item(self, run_id, checklist, item):
        self.run["checklists"][checklist]["items"][item]["state"] = "closed"
        self.writes.append(("tick", self.run["checklists"][checklist]["items"][item]["title"]))


def playbook_run(channel_id, *titles):
    return {"id": "run", "channel_id": channel_id, "owner_user_id": OWNER["id"],
            "checklists": [{"items": [{"title": t, "state": ""} for t in titles]}]}


class FakeCalendar:
    def __init__(self, events=()):
        self.items = [dict(e) for e in events]
        self.writes = []
        self.series_instances = {}  # series id -> instances

    def events(self, start, end, query="", single=True):
        found = []
        for event in self.items:
            if not single and "recurrence" in event:
                if query.casefold() in event.get("summary", "").casefold():
                    found.append(event)
                continue
            if "recurrence" in event:
                continue
            day = date.fromisoformat(event["start"].get("date") or event["start"]["dateTime"][:10])
            if start <= day <= end and query.casefold() in event.get("summary", "").casefold():
                found.append(event)
        return found

    def instances(self, event_id, start):
        return [i for i in self.series_instances.get(event_id, [])
                if (i["start"].get("dateTime") or i["start"].get("date"))[:10] >= start.isoformat()]

    def create_all_day(self, title, day):
        event = {"id": f"e{len(self.items)}", "summary": title, "start": {"date": day.isoformat()},
                 "end": {"date": (day + timedelta(days=1)).isoformat()}, "transparency": "transparent"}
        self.items.append(event)
        self.writes.append(("create", title, day))
        return event

    def set_description(self, event_id, description):
        for instances in self.series_instances.values():
            for instance in instances:
                if instance["id"] == event_id:
                    instance["description"] = description
        self.writes.append(("describe", event_id))


def all_day(title, day):
    return {"id": title, "summary": title, "start": {"date": day}, "transparency": "transparent"}


class FakeJira:
    base_url = "https://jira.example.com"

    def __init__(self, page=""):
        self.page = page
        self.issues = []
        self.writes = []

    def confluence_page(self, page_id):
        return self.page

    def find_by_summary(self, summary, label):
        return next((i["key"] for i in self.issues if i["summary"] == summary and label in i["labels"]), None)

    def create_issue(self, summary, description, labels):
        key = f"MM-{9000 + len(self.issues)}"
        self.issues.append({"key": key, "summary": summary, "description": description, "labels": labels})
        self.writes.append(("issue", summary))
        return key

    def browse_url(self, key):
        return f"{self.base_url}/browse/{key}"


# The Release Dates calendar on 2026-11-03, v12.2 and v12.3, titles exactly as they are
# (leading and trailing spaces included).
RELEASE_DATES = [all_day(t, d) for t, d in (
    (" v12.2 & Mobile v2.47 Release Branch Cut", "2026-11-10"),
    ("v12.2 & Mobile v2.47 Feature Complete", "2026-11-23"),
    ("v12.2 & Mobile v2.47 RC1 Cut & QA Qualification Starts", "2026-11-24"),
    (" v12.2 & Mobile v2.47 Code Freeze", "2026-12-08"),
    ("v12.2 & Mobile v2.47 Final Release Build Cut", "2026-12-09"),
    ("v12.2 Cloud Freemium & Professional Releases", "2026-12-10"),
    (" v12.3 & Mobile v2.48 Release Branch Cut", "2026-12-10"),
    (" v12.2 Cloud Enterprise Release", "2026-12-11"),
    (" v12.2 & Mobile v2.47 Release Day", "2026-12-16"),
    ("v12.3 & Mobile v2.48 Feature Complete", "2026-12-21"),
    (" v12.3 & Mobile v2.48 RC1 Cut & QA Qualification Starts", "2026-12-22"),
    (" v12.3 & Mobile v2.48 Code Freeze", "2027-01-07"),
    ("v12.3 & Mobile v2.48 Release Build Cut ", "2027-01-08"),
    (" v12.3 Cloud Freemium & Professional Releases", "2027-01-11"),
    (" v12.3 Cloud Enterprise Release", "2027-01-12"),
    ("Mobile v2.48 Release Day", "2027-01-14"),
    ("v12.3 Release Day", "2027-01-15"),
)]

"""In-memory stand-ins for the GitHub, Jira, Confluence, Hub and Playbooks clients."""

import copy
import re
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text()


class FakeGitHub:
    def __init__(self):
        self.searches = {}      # regex on the query -> items
        self.pulls = {}         # (repo, number) -> pull
        self.branch_commits = {}  # (repo, branch) -> [commit]
        self.on_branch = set()  # (repo, sha, branch)
        self.tags = {}          # repo -> [tag]
        self.dates = {}         # (repo, ref) -> ISO date
        self.queries = []
        self.head_prs = {}      # "owner:branch" -> [pull], newest first as GitHub lists them
        self.reviews_of = {}    # (repo, number) -> [review]
        self.files = {}         # (repo, ref, path) -> text
        self.trees = {}         # (repo, ref, path) -> {file name}

    def pulls_by_head(self, repo, head):
        self.queries.append(f"head:{head}")
        return list(self.head_prs.get(head, []))

    def reviews(self, repo, number):
        return self.reviews_of.get((repo, number), [])

    def file_text(self, repo, path, ref):
        return self.files.get((repo, ref, path))

    def tree_files(self, repo, ref, path):
        return set(self.trees.get((repo, ref, path), set()))

    def search_issues(self, query, limit=1000, sort=None):
        self.queries.append(query)
        for pattern, items in self.searches.items():
            if re.search(pattern, query):
                return items[:limit]
        return []

    def pull(self, repo, number):
        return self.pulls[(repo, number)]

    def commits(self, repo, sha, since=None, path=None, limit=1000):
        commits = self.branch_commits.get((repo, sha), [])
        if path:
            commits = [c for c in commits if path in c.get("files", [path])]
        return commits[:limit]

    def commit_date(self, repo, ref):
        return self.dates[(repo, ref)]

    def is_on_branch(self, repo, sha, branch):
        return (repo, sha, branch) in self.on_branch

    def tags_with_prefix(self, repo, prefix):
        return [tag for tag in self.tags.get(repo, []) if tag.startswith(prefix)]

    # Release actions
    branches = None  # repo -> {branch}; set by tests that need it
    releases_by_tag = None  # (repo, tag) -> release
    compares = None  # (repo, base, head) -> [commit]
    milestone_titles = None  # repo -> [title]

    def branch_exists(self, repo, branch):
        return branch in (self.branches or {}).get(repo, set())

    def release_by_tag(self, repo, tag):
        return (self.releases_by_tag or {}).get((repo, tag))

    def compare_commits(self, repo, base, head):
        return list((self.compares or {}).get((repo, base, head), []))

    def milestones(self, repo):
        return [{"title": t} for t in (self.milestone_titles or {}).get(repo, [])]

    def tag_date(self, repo, tag):
        return self.dates[(repo, tag)]


class FakeJira:
    base_url = "https://jira.example"

    def __init__(self, issues=None):
        self.issues = issues or {}  # regex on the JQL -> issues
        self.queries = []
        self.links = {}  # issue key -> [remote link URL]
        self.extra_fields = []

    def remote_links(self, key):
        return [{"id": n, "object": {"url": url, "title": url}} for n, url in enumerate(self.links.get(key, []))]

    def search(self, jql, limit=1000, extra_fields=()):
        self.queries.append(jql)
        self.extra_fields = list(extra_fields)
        for pattern, issues in self.issues.items():
            if re.search(pattern, jql):
                return issues
        return []

    def browse_url(self, key):
        return f"{self.base_url}/browse/{key}"

    # Release actions
    project_versions = None  # [{"id", "name", "released", "releaseDate"}]
    counts = None  # regex on the JQL -> count, or an Exception to raise

    def versions(self, project):
        return [dict(v) for v in (self.project_versions or [])]

    def count(self, jql):
        self.queries.append(jql)
        for pattern, value in (self.counts or {}).items():
            if re.search(pattern, jql):
                if isinstance(value, Exception):
                    raise value
                return value
        return 0

    def filter_url(self, jql):
        return f"{self.base_url}/issues/?jql=..."


class FakeConfluence:
    def __init__(self, text=""):
        self.text = text
        self.requested = []

    def page(self, page_id):
        self.requested.append(page_id)
        return self.text, f"https://wiki.example/pages/{page_id}"


class FakeHub:
    base_url = "https://hub.example"

    def __init__(self, version=("12.2.0", "abc123")):
        self.version = version
        self.posts = {}  # channel -> [post], oldest first
        self.created, self.patched = [], []
        self.bot_id = "bot"
        self.runs = []
        self.closed = []
        self.channels = []   # channels the bot is in: {"id", "display_name"}
        self.post_reactions = {}  # post id -> [reaction]
        self.users = []  # {"username", "first_name", "last_name", "email", optional "delete_at"}
        self.user_searches = []
        self._next = 0

    def user_by_username(self, username):
        return next((u for u in self.users if u["username"] == username), None)

    def user_by_email(self, email):
        return next((u for u in self.users if u.get("email") == email), None)

    def search_users(self, term):
        self.user_searches.append(term)
        words = term.casefold().split()
        return [u for u in self.users if all(w in f"{u['first_name']} {u['last_name']} {u['username']}".casefold() for w in words)]

    def me(self):
        return {"id": self.bot_id}

    def channels_named(self, display_name):
        wanted = " ".join(display_name.split()).casefold()
        return [c for c in self.channels if " ".join(c["display_name"].split()).casefold() == wanted]

    def reactions(self, post_id):
        return self.post_reactions.get(post_id, [])

    def user(self, user_id):
        return next((u for u in self.users if u.get("id") == user_id), None)

    def thread(self, post_id):
        everything = [p for posts in self.posts.values() for p in posts]
        return sorted((p for p in everything if p["id"] == post_id or p.get("root_id") == post_id),
                      key=lambda p: p["create_at"])

    def reply(self, root_id, message, user_id, create_at):
        root = next(p for posts in self.posts.values() for p in posts if p["id"] == root_id)
        post = self.add_post(root["channel_id"], message, user_id, create_at=create_at)
        post["root_id"] = root_id
        return post

    def replies(self, root_id):
        return [p for p in self.thread(root_id) if p["id"] != root_id]

    def react(self, post_id, emoji, user_id="manager", create_at=None):
        self.post_reactions.setdefault(post_id, []).append(
            {"post_id": post_id, "emoji_name": emoji, "user_id": user_id, "create_at": create_at or 10**14})

    def server_version(self):
        return self.version

    def add_post(self, channel, message, user_id="someone", props=None, create_at=0, post_id=None):
        self._next += 1
        post = {"id": post_id or f"p{self._next}", "channel_id": channel, "message": message, "root_id": "",
                "user_id": user_id, "props": props or {}, "create_at": create_at or self._next, "delete_at": 0}
        self.posts.setdefault(channel, []).append(post)
        return post

    def channel_posts(self, channel_id, page=0, per_page=200):
        newest_first = list(reversed(self.posts.get(channel_id, [])))
        return newest_first[page * per_page:(page + 1) * per_page]

    def posts_since(self, channel_id, since_ms):
        return [p for p in self.posts.get(channel_id, []) if p["create_at"] >= since_ms]

    clock = None  # () -> ms, for posts the bot makes; the release action tests set it

    def create_post(self, channel_id, message, props=None, root_id=""):
        at = self.clock() + self._next if self.clock else 10**13 + self._next
        post = self.add_post(channel_id, message, self.bot_id, copy.deepcopy(props), create_at=at)
        post["root_id"] = root_id
        self.created.append(post)
        return post

    def patch_post(self, post_id, message, props):
        for posts in self.posts.values():
            for post in posts:
                if post["id"] == post_id:
                    post.update(message=message, props=copy.deepcopy(props))
                    self.patched.append(post)
                    return post
        raise KeyError(post_id)

    # Playbooks
    def in_progress_runs(self, search_term="", playbook_id="", channel_id=""):
        return [copy.deepcopy(r) for r in self.runs
                if search_term.lower() in r["name"].lower() and channel_id in ("", r["channel_id"])]

    def run(self, run_id):
        return copy.deepcopy(next(r for r in self.runs if r["id"] == run_id))

    def close_item(self, run_id, checklist, item):
        run = next(r for r in self.runs if r["id"] == run_id)
        target = run["checklists"][checklist]["items"][item]
        target["state"], target["state_modified"] = "closed", 1
        self.closed.append((run_id, target["title"]))


def checklist_run(run_id, name, channel_id, items):
    """A playbook run with one checklist of ``items``: [(title, state, state_modified)]."""
    return {
        "id": run_id, "name": name, "channel_id": channel_id, "current_status": "InProgress",
        "checklists": [{"title": "Checklist", "items": [
            {"title": title, "state": state, "state_modified": modified} for title, state, modified in items
        ]}],
    }


# RELEASE_AGENT_DEV_LEADS as the tests set it: a repository variable, not part of rules.yml.
DEV_LEADS_ROUTES = [
    {"teams": ["Reliability", "Calls", "Sustained Engineering"], "username": "jesse.hallam", "name": "Jesse Hallam"},
    {"teams": ["Information Control"], "username": "maria.nunez", "name": "Maria Nunez"},
    {"teams": ["Agents"], "username": "christopher", "name": "Christopher Speller"},
    {"teams": ["Platform Integration", "Integrations"], "username": "doug.lauder", "name": "Doug Lauder"},
]


class FakeDispatcher:
    """delivery-platform's Actions API: dispatches and their runs."""

    def __init__(self):
        self.dispatched = []  # (repo, workflow, ref, inputs)
        self.runs = {}  # run id -> run
        self.fail_dispatch = False

    def dispatch(self, repo, workflow, ref, inputs):
        if self.fail_dispatch:
            raise RuntimeError("dispatch refused")
        self.dispatched.append((repo, workflow, ref, dict(inputs)))
        run_id = 1000 + len(self.dispatched)
        self.runs[run_id] = {"id": run_id, "status": "in_progress", "conclusion": None,
                             "html_url": f"https://github.com/{repo}/actions/runs/{run_id}"}
        return {"workflow_run_id": run_id, "html_url": self.runs[run_id]["html_url"]}

    def finish(self, conclusion="success"):
        for run in self.runs.values():
            run.update(status="completed", conclusion=conclusion)

    def workflow_run(self, repo, run_id):
        return dict(self.runs[run_id])

    def workflow_runs(self, repo, workflow, created_since):
        return []


class FakeMilestoneWriter:
    def __init__(self, github):
        self.github, self.created = github, []

    def create_milestone(self, repo, title, due_on=""):
        self.created.append((repo, title))
        self.github.milestone_titles.setdefault(repo, []).append(title)
        return {"title": title}


class FakeJiraWriter:
    def __init__(self, jira):
        self.jira, self.created_versions, self.released, self.issues, self.updates = jira, [], [], [], []

    def project_id(self, project):
        return "10000"

    def create_version(self, project_id, name, release_date=""):
        self.created_versions.append((name, release_date))
        self.jira.project_versions.append({"id": str(len(self.jira.project_versions) + 1), "name": name,
                                           "released": False, "releaseDate": release_date})
        return {"name": name}

    def release_version(self, version_id, release_date):
        self.released.append((version_id, release_date))
        for version in self.jira.project_versions:
            if version["id"] == version_id:
                version.update(released=True, releaseDate=release_date)

    def create_issue(self, fields):
        key = f"MM-{90000 + len(self.issues)}"
        self.issues.append((key, fields))
        return {"key": key}

    def update_issue(self, key, fields):
        self.updates.append((key, fields))


class FakeSheets:
    """Tabs of cell grids; FORMULA rendering is just the stored value."""

    WRITES = ("update", "append", "clear", "batch_update")

    def __init__(self, tabs):
        self.tabs_data = tabs  # [{"title", "sheetId", "rows": [[...]]}], in tab order
        self.calls = []

    def _tab(self, a1):
        title = a1.split("!")[0].strip("'").replace("''", "'")
        return next(t for t in self.tabs_data if t["title"] == title)

    def tabs(self, sheet_id):
        return [{"title": t["title"], "sheetId": t["sheetId"], "index": i} for i, t in enumerate(self.tabs_data)]

    def values(self, sheet_id, a1):
        rows = self._tab(a1)["rows"]
        return [list(r) for r in (rows[:1] if a1.endswith("!1:1") else rows)]

    def update(self, sheet_id, a1, rows):
        self.calls.append(("update", a1, rows))
        tab, cell = self._tab(a1), a1.split("!")[1]
        col = ord(cell[0]) - 65
        row = int(cell[1:]) - 1
        while len(tab["rows"]) <= row:
            tab["rows"].append([])
        while len(tab["rows"][row]) <= col:
            tab["rows"][row].append("")
        tab["rows"][row][col] = rows[0][0]

    def append(self, sheet_id, a1, rows):
        self.calls.append(("append", a1, rows))
        self._tab(a1)["rows"].extend(list(r) for r in rows)

    def clear(self, sheet_id, a1):
        self.calls.append(("clear", a1))
        tab = self._tab(a1)
        tab["rows"] = tab["rows"][:1]

    def batch_update(self, sheet_id, requests):
        self.calls.append(("batch_update", requests))
        replies = []
        for request in requests:
            if "duplicateSheet" in request:
                spec = request["duplicateSheet"]
                source = next(t for t in self.tabs_data if t["sheetId"] == spec["sourceSheetId"])
                new = {"title": spec["newSheetName"], "sheetId": 777, "rows": copy.deepcopy(source["rows"])}
                self.tabs_data.insert(spec["insertSheetIndex"], new)
                replies.append({"duplicateSheet": {"properties": {"sheetId": 777}}})
            elif "insertDimension" in request:
                spec = request["insertDimension"]["range"]
                tab = next(t for t in self.tabs_data if t["sheetId"] == spec["sheetId"])
                for row in tab["rows"]:
                    row.insert(spec["startIndex"], "")
                replies.append({})
        return {"replies": replies}

    @property
    def writes(self):
        return [c for c in self.calls if c[0] in self.WRITES]

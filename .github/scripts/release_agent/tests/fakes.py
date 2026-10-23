"""In-memory stand-ins for the GitHub, Jira, Hub and Playbooks clients."""

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


class FakeJira:
    base_url = "https://jira.example"

    def __init__(self, issues=None):
        self.issues = issues or {}  # regex on the JQL -> issues
        self.queries = []

    def search(self, jql, limit=1000):
        self.queries.append(jql)
        for pattern, issues in self.issues.items():
            if re.search(pattern, jql):
                return issues
        return []

    def browse_url(self, key):
        return f"{self.base_url}/browse/{key}"

    def filter_url(self, jql):
        return f"{self.base_url}/issues/?jql=..."


class FakeHub:
    base_url = "https://hub.example"

    def __init__(self, version=("12.2.0", "abc123")):
        self.version = version
        self.posts = {}  # channel -> [post], oldest first
        self.created, self.patched = [], []
        self.bot_id = "bot"
        self.runs = []
        self.closed = []
        self._next = 0

    def me(self):
        return {"id": self.bot_id}

    def server_version(self):
        return self.version

    def add_post(self, channel, message, user_id="someone", props=None, create_at=0, post_id=None):
        self._next += 1
        post = {"id": post_id or f"p{self._next}", "channel_id": channel, "message": message,
                "user_id": user_id, "props": props or {}, "create_at": create_at or self._next, "delete_at": 0}
        self.posts.setdefault(channel, []).append(post)
        return post

    def channel_posts(self, channel_id, page=0, per_page=200):
        newest_first = list(reversed(self.posts.get(channel_id, [])))
        return newest_first[page * per_page:(page + 1) * per_page]

    def posts_since(self, channel_id, since_ms):
        return [p for p in self.posts.get(channel_id, []) if p["create_at"] >= since_ms]

    def create_post(self, channel_id, message, props=None, root_id=""):
        post = self.add_post(channel_id, message, self.bot_id, props, create_at=10**13 + self._next)
        post["root_id"] = root_id
        self.created.append(post)
        return post

    def patch_post(self, post_id, message, props):
        for posts in self.posts.values():
            for post in posts:
                if post["id"] == post_id:
                    post.update(message=message, props=props)
                    self.patched.append(post)
                    return post
        raise KeyError(post_id)

    # Playbooks
    def in_progress_runs(self, search_term, playbook_id=""):
        return [copy.deepcopy(r) for r in self.runs if search_term.lower() in r["name"].lower()]

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

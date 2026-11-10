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
        self.milestone_list = {}  # repo -> [milestone]
        self.branches = set()   # (repo, branch)
        self.repos = []         # the org's repos, as GitHub lists them
        self.month_commits = {}  # repo -> [commit] in the month asked for
        self.rate_limited = 0   # calls to fail with HTTP 403 (a rate limit) before answering

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
            commits = [c for c in commits
                       if any(f == path or f.startswith(path.rstrip("/") + "/") for f in c.get("files", [path]))]
        return commits[:limit]

    def milestones(self, repo):
        return list(self.milestone_list.get(repo, []))

    def branch_exists(self, repo, branch):
        return (repo, branch) in self.branches

    def commit_files(self, repo, sha):
        return next(c.get("files", []) for commits in self.branch_commits.values() for c in commits if c["sha"] == sha)

    def org_repos(self, org):
        self._maybe_limited()
        return list(self.repos)

    def commits_in_range(self, repo, since, until):
        self._maybe_limited()
        self.queries.append(f"commits {repo} {since} {until}")
        return list(self.month_commits.get(repo, []))

    def _maybe_limited(self):
        if self.rate_limited:
            self.rate_limited -= 1
            from release_agent.clients import ServiceError
            raise ServiceError("GitHub", 403, "API rate limit exceeded")

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
        self.clock_ms = None  # create_at of the bot's next posts; a fixed far-future time when None

    def user(self, user_id):
        return next((u for u in self.users if u.get("id", u["username"]) == user_id), None)

    def thread(self, post_id):
        posts = [p for ps in self.posts.values() for p in ps if p["id"] == post_id or p.get("root_id") == post_id]
        return sorted(posts, key=lambda p: p["create_at"])

    def post_link(self, post_id):
        return f"{self.base_url}/_redirect/pl/{post_id}"

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

    def react(self, post_id, emoji, user_id="manager", create_at=None):
        self.post_reactions.setdefault(post_id, []).append(
            {"post_id": post_id, "emoji_name": emoji, "user_id": user_id, "create_at": create_at or 10**14})

    def server_version(self):
        return self.version

    def add_post(self, channel, message, user_id="someone", props=None, create_at=0, post_id=None, root_id=""):
        self._next += 1
        post = {"id": post_id or f"p{self._next}", "channel_id": channel, "message": message, "root_id": root_id,
                "user_id": user_id, "props": props or {}, "create_at": create_at or self._next, "delete_at": 0}
        self.posts.setdefault(channel, []).append(post)
        return post

    def channel_posts(self, channel_id, page=0, per_page=200):
        newest_first = list(reversed(self.posts.get(channel_id, [])))
        return newest_first[page * per_page:(page + 1) * per_page]

    def posts_since(self, channel_id, since_ms):
        return [p for p in self.posts.get(channel_id, []) if p["create_at"] >= since_ms]

    def create_post(self, channel_id, message, props=None, root_id=""):
        when = self.clock_ms + self._next if self.clock_ms else 10**13 + self._next
        post = self.add_post(channel_id, message, self.bot_id, props, create_at=when, root_id=root_id)
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


class FakeCommunity:
    """The read-only Community client: posts by channel, users by username. It has no write
    methods, as the real one hasn't; ``reads`` records every call."""

    base_url = "https://community.example"

    def __init__(self):
        self.posts = {}  # channel -> [post]
        self.users = {}  # username -> user
        self.reads = []
        self.broken = False  # every read raises, as when the bot isn't in the channel

    def add_post(self, channel, message, user_id="someone", create_at=0, post_id=None, root_id=""):
        post = {"id": post_id or f"c{sum(len(p) for p in self.posts.values()) + 1}", "channel_id": channel,
                "message": message, "user_id": user_id, "create_at": create_at, "root_id": root_id, "delete_at": 0}
        self.posts.setdefault(channel, []).append(post)
        return post

    def _read(self, what):
        self.reads.append(what)
        if self.broken:
            from release_agent.clients import ServiceError
            raise ServiceError("Community", 403)

    def posts_since(self, channel_id, since_ms):
        self._read(("posts_since", channel_id))
        return [p for p in self.posts.get(channel_id, []) if p["create_at"] >= since_ms]

    def user_by_username(self, username):
        self._read(("user_by_username", username))
        return self.users.get(username)

    def user(self, user_id):
        self._read(("user", user_id))
        return next((u for u in self.users.values() if u.get("id") == user_id), None)

    def post_link(self, post_id):
        return f"{self.base_url}/_redirect/pl/{post_id}"


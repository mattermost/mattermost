import copy

from release_cherrypick.clients import ServiceError

VERSIONS = [
    {"id": "100", "name": "v12.1 (November 2026)", "released": True},
    {"id": "200", "name": "v12.2 (December 2026)", "released": False},
    {"id": "300", "name": "v12.3 (January 2027)", "released": False},
    {"id": "400", "name": "v11.7.14", "released": False},
    {"id": "500", "name": "v2.46 Mobile (December 2026)", "released": False},
]


def ticket(key, fix_versions=("v12.2 (December 2026)",), status="Submitted"):
    return {"key": key, "fields": {"summary": f"{key} summary", "status": {"name": status},
                                   "fixVersions": [{"name": name} for name in fix_versions]}}


class FakeJira:
    def __init__(self, tickets=(), links=None, versions=VERSIONS):
        self.tickets = {t["key"]: t for t in tickets}
        self.links = links or {}  # key -> [url]
        self._versions = versions
        self.queries = []

    def versions(self, project):
        return copy.deepcopy(self._versions)

    def search(self, jql, fields, limit=1000):
        self.queries.append(jql)
        version_id = jql.split("fixVersion = ")[1].split()[0]
        names = {v["name"] for v in self._versions if v["id"] == version_id}
        return [t for t in self.tickets.values() if t["fields"]["status"]["name"] == "Submitted"
                and names & {v["name"] for v in t["fields"]["fixVersions"]}]

    def issue(self, key, fields):
        if key not in self.tickets:
            raise ServiceError("Jira", 404)
        return self.tickets[key]

    def remote_links(self, key):
        return [{"id": n, "object": {"url": url}} for n, url in enumerate(self.links.get(key, []))]


def pull(number, repo="mattermost/mattermost", title="A fix", labels=(), milestone=None, base="master",
         state="closed", merged=True, head="fix-branch"):
    return {"number": number, "title": title, "html_url": f"https://github.com/{repo}/pull/{number}",
            "labels": [{"name": name} for name in labels], "milestone": {"title": milestone} if milestone else None,
            "base": {"ref": base}, "head": {"ref": head}, "state": state,
            "merged_at": "2026-11-01T00:00:00Z" if merged else None}


class FakeGitHub:
    def __init__(self, pulls=(), branches=("release-12.2",), public=("mattermost/mattermost-mobile",)):
        self.pulls = {}
        for repo, p in pulls:
            self.pulls[(repo, p["number"])] = p
        self.branches = set(branches)
        self.public = set(public)
        self.milestone_titles = {"mattermost/mattermost": {"v12.1.0": 11, "v12.2.0": 12, "v12.3.0": 13},
                                 "mattermost/enterprise": {"v12.2.0": 52}}
        self.writes = []
        self.searches = []

    def pull(self, repo, number):
        return copy.deepcopy(self.pulls[(repo, number)])

    def search_prs(self, query, limit=20):
        self.searches.append(query)
        repo = query.split()[0].removeprefix("repo:")
        key = query.split('"')[1]
        return [{"number": n, "html_url": p["html_url"]} for (r, n), p in self.pulls.items()
                if r == repo and (key in p["title"] or key in p.get("body", ""))]

    def milestones(self, repo):
        return [{"title": t, "number": n} for t, n in self.milestone_titles.get(repo, {}).items()]

    def branch_exists(self, repo, branch):
        return branch in self.branches

    def is_public(self, repo):
        return repo in self.public

    def add_label(self, repo, number, label):
        self.writes.append(("label", repo, number, label))
        self.pulls[(repo, number)]["labels"].append({"name": label})

    def set_milestone(self, repo, number, milestone_number):
        self.writes.append(("milestone", repo, number, milestone_number))
        title = next(t for t, n in self.milestone_titles[repo].items() if n == milestone_number)
        self.pulls[(repo, number)]["milestone"] = {"title": title}


class FakeHub:
    def __init__(self, channels=(), posts=None):
        self.channels = list(channels)
        self.posts = posts or {}  # channel -> [post], newest first
        self.created = []

    def me(self):
        return {"id": "bot"}

    def my_channels(self):
        return self.channels

    def channel_posts(self, channel_id, page=0, per_page=200):
        return self.posts.get(channel_id, [])[page * per_page:(page + 1) * per_page]

    def create_post(self, channel_id, message, root_id=""):
        post = {"id": f"new{len(self.created)}", "channel_id": channel_id, "message": message, "root_id": root_id}
        self.created.append(post)
        return post

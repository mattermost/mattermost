"""The Release Highlights slide: versions, epics, exclusions, docs links and output."""

import json
import os
import tempfile
import unittest

from changelog_release import DocsSite
from release_docs import __main__ as cli
from release_docs import highlights
from release_docs.highlights import DocsIndex, Epic
from release_docs.result import TODO_MARKER
from release_docs.versions import Version

from .fakes import FakeClaude, FakeGitHub
from .test_replay import V12_HIGHLIGHTS

SERVER = {"id": "200", "name": "v12.2 (December 2026)", "released": False, "releaseDate": "2026-12-16"}
MOBILE = {"id": "500", "name": "v2.47 Mobile (December 2026)", "released": False, "releaseDate": "2026-12-16"}
VERSIONS = [
    {"id": "100", "name": "v12.1 (November 2026)", "released": True, "releaseDate": "2026-11-16"},
    SERVER,
    {"id": "300", "name": "v12.3 (January 2027)", "released": False, "releaseDate": "2027-01-16"},
    {"id": "400", "name": "v2.46 Mobile (November 2026)", "released": True, "releaseDate": "2026-11-16"},
    MOBILE,
    {"id": "600", "name": "v12.2.1", "released": False},
]
DOCS = {
    "docs/main/end-user-guide/collaborate/manage-channel-bookmarks.mdx": "---\ntitle: Channel bookmarks\n---\n# Channel bookmarks\n",
    "docs/main/administration-guide/manage/admin/attribute-management.mdx": "# Attribute management\n\n## Sync attributes\n",
    "docs/main/end-user-guide/collaborate/search.mdx": "# Search for messages\n",
    "docs/main/end-user-guide/collaborate/search-tips.mdx": "# Search for messages and files\n",
    "docs/main/product-overview/mattermost-v12-changelog.mdx": "# Scheduled posts\n",
    "docs/develop/integrate/customization/index.md": "# Scheduled posts\n",
}


def docs(files=DOCS) -> DocsIndex:
    return DocsIndex(DocsSite(list(files), files.get))


def adf(*paragraphs):
    """An ADF description: each paragraph a string, or (text, link) for a linked text node."""
    content = []
    for paragraph in paragraphs:
        text, href = paragraph if isinstance(paragraph, tuple) else (paragraph, None)
        node = {"type": "text", "text": text, **({"marks": [{"type": "link", "attrs": {"href": href}}]} if href else {})}
        content.append({"type": "paragraph", "content": [node]})
    return {"type": "doc", "version": 1, "content": content}


def epic(key, summary, description=None, labels=(), components=()):
    return {"key": key, "fields": {"summary": summary, "description": description, "labels": list(labels),
                                   "components": [{"name": c} for c in components]}}


class FakeJira:
    base_url = "https://jira.example"

    def __init__(self, epics_by_version=None, versions=VERSIONS):
        self._versions = versions
        self.epics = epics_by_version or {}
        self.queries = []

    def versions(self, project="MM"):
        return json.loads(json.dumps(self._versions))

    def search(self, jql, fields):
        self.queries.append(jql)
        return self.epics.get(jql.rsplit("= ", 1)[1], [])

    def browse_url(self, key):
        return f"{self.base_url}/browse/{key}"

    def filter_url(self, jql):
        return f"{self.base_url}/issues/?jql={jql.replace(' ', '+')}"


def answer(*items):
    return {"epics": [dict(zip(("key", "include", "reason", "name", "description"), item)) for item in items]}


def build(jira, claude=None, version="v12.2.0", files=DOCS):
    return highlights.build(Version.parse(version), jira, claude, docs(files), highlights.load_config())


class VersionTest(unittest.TestCase):
    def test_server_version_is_the_canonical_name(self):
        self.assertEqual(highlights.server_version(VERSIONS, Version(12, 2)), SERVER)
        self.assertIsNone(highlights.server_version(VERSIONS, Version(12, 9)))

    def test_mobile_version_released_the_same_month(self):
        self.assertEqual(highlights.mobile_version(VERSIONS, (2026, 12)), (MOBILE, ""))
        self.assertEqual(highlights.mobile_version(VERSIONS, (2027, 1)), (None, "no mobile fix version is released that month"))
        two = VERSIONS + [{"id": "501", "name": "v2.48 Mobile (December 2026)", "releaseDate": "2026-12-30"}]
        self.assertIsNone(highlights.mobile_version(two, (2026, 12))[0])

    def test_mobile_version_without_a_release_date_goes_by_its_name(self):
        undated = [{"id": "7", "name": "v2.47 Mobile (December 2026)"}]
        self.assertEqual(highlights.mobile_version(undated, (2026, 12))[0]["id"], "7")

    def test_queries_epics_by_version_id_separately(self):
        jira = FakeJira()
        build(jira)
        self.assertEqual(jira.queries, ["project = MM AND issuetype = Epic AND fixVersion = 200",
                                        "project = MM AND issuetype = Epic AND fixVersion = 500"])

    def test_without_a_mobile_version_only_server_epics_are_read(self):
        jira = FakeJira({"300": [epic("MM-1", "Scheduled posts")]})
        result = build(jira, FakeClaude(answer(("MM-1", True, "feature", "Scheduled Posts", "Schedule a post."))), "v12.3.0")
        self.assertEqual(jira.queries, ["project = MM AND issuetype = Epic AND fixVersion = 300"])
        self.assertIn("Mobile: no mobile fix version is released that month.", result.notes)
        self.assertTrue(result.text.startswith("# January 2027 v12.3\n"))


class EpicTest(unittest.TestCase):
    def test_an_epic_in_both_versions_is_kept_once_as_server(self):
        server = [Epic("MM-1", "A"), Epic("MM-2", "B")]
        mobile = [Epic("MM-2", "B", kind="mobile"), Epic("MM-3", "C", kind="mobile")]
        merged = highlights.merge_epics(server, mobile)
        self.assertEqual([(e.key, e.kind) for e in merged], [("MM-1", "server"), ("MM-2", "server"), ("MM-3", "mobile")])

    def test_rules_leave_out_internal_epics(self):
        rules = highlights.load_config()["exclude"]
        cases = [
            (Epic("MM-1", "Q4 loadtest improvements"), "title mentions “loadtest”"),
            (Epic("MM-2", "Faster CI pipeline"), "title mentions “CI”"),
            (Epic("MM-3", "E2E coverage for channels"), "title mentions “E2E”"),
            (Epic("MM-4", "Upgrade build hosts", labels=["Infrastructure"]), "label Infrastructure"),
            (Epic("MM-5", "Cleanup", components=["Load Testing"]), "component Load Testing"),
            (Epic("MM-6", "Circle avatars in a specific theme"), ""),
            (Epic("MM-7", "Channel bookmarks"), ""),
        ]
        self.assertEqual([highlights.excluded_by_rules(e, rules) for e, _ in cases], [r for _, r in cases])

    def test_description_text_and_links_come_from_adf(self):
        e = Epic.from_issue(epic("MM-1", " Bookmarks ", adf("Pin links.", ("Docs", "https://docs.mattermost.com/x"))), "server")
        self.assertEqual((e.summary, e.description, e.links), ("Bookmarks", "Pin links. Docs", ["https://docs.mattermost.com/x"]))


class DocLinkTest(unittest.TestCase):
    def link(self, description=None, name="Channel Bookmarks"):
        notes = []
        e = Epic.from_issue(epic("MM-1", "Bookmarks", description), "server")
        return highlights.doc_link(e, name, docs(), notes), notes

    def test_a_docs_url_in_the_description_comes_first(self):
        url = "https://docs.mattermost.com/administration-guide/manage/admin/attribute-management#sync-attributes"
        self.assertEqual(self.link(adf(("see docs", url)))[0], (url, "the epic description"))
        self.assertEqual(self.link(adf(f"Docs: {url}."))[0], (url, "the epic description"))

    def test_a_broken_description_link_falls_back_to_the_page_title(self):
        (url, basis), notes = self.link(adf(("docs", "https://docs.mattermost.com/nope")))
        self.assertEqual(url, "https://docs.mattermost.com/end-user-guide/collaborate/manage-channel-bookmarks")
        self.assertEqual(basis, "the page title of docs/main/end-user-guide/collaborate/manage-channel-bookmarks.mdx")
        self.assertIn("fails the link check (no docs page is served at /nope)", notes[0])

    def test_no_link_unless_the_match_is_clear(self):
        self.assertEqual(self.link(name="Search")[0], ("", "no docs page found"))  # two pages
        self.assertEqual(self.link(name="Search for Messages")[0][0],
                         "https://docs.mattermost.com/end-user-guide/collaborate/search")
        self.assertEqual(self.link(name="Scheduled Posts")[0][0], "")  # only release notes and developer docs
        self.assertEqual(self.link(name="Playbooks")[0][0], "")

    def test_other_sites_in_the_description_are_ignored(self):
        self.assertEqual(self.link(adf(("spec", "https://example.com/spec")), name="Nothing")[0], ("", "no docs page found"))

    def test_the_real_docs_tree(self):
        index = DocsIndex.from_checkout()
        self.assertEqual(index.page_for("Attribute Management")[0],
                         "https://docs.mattermost.com/administration-guide/manage/admin/attribute-management")
        self.assertIsNone(index.check("https://docs.mattermost.com/administration-guide/manage/admin/attribute-management"))

    def test_v12_published_highlights_never_get_a_wrong_page(self):
        index = DocsIndex.from_checkout()
        found = {h.name: (index.page_for(h.name) or ("",))[0] for h in V12_HIGHLIGHTS}
        for h in V12_HIGHLIGHTS:
            self.assertIn(found[h.name], ("", h.url.split("#")[0]), h.name)
        self.assertEqual(found["Session Attributes"],
                         "https://docs.mattermost.com/administration-guide/manage/admin/session-attributes")


class OutputTest(unittest.TestCase):
    def setUp(self):
        self.jira = FakeJira({
            "200": [epic("MM-1", "Channel bookmarks", adf("Pin links to the top of a channel.")),
                    epic("MM-2", "Loadtest for 50k users"),
                    epic("MM-3", "Refactor the websocket hub"),
                    epic("MM-4", "Message <reminders> & snooze")],
            "500": [epic("MM-4", "Message <reminders> & snooze"),
                    epic("MM-5", "Offline drafts on mobile")],
        })
        self.claude = FakeClaude(answer(
            ("MM-1", True, "Feature", "Channel Bookmarks", "Pin important links and files to the top of a channel."),
            ("MM-3", False, "internal refactor", "", ""),
            ("MM-4", True, "Feature", "Message Reminders & Snooze", "Get reminded about a message <later>."),
            ("MM-5", True, "Feature", "Offline Drafts", "Write drafts on mobile without a connection."),
        ))
        self.result = build(self.jira, self.claude)

    def test_slide_text(self):
        text = self.result.text
        slide = text.split("\n\nJira:")[0]
        self.assertEqual(slide, "\n".join([
            "# December 2026 v12.2",
            "",
            "Release date: December 16, 2026",
            "",
            "- [Channel Bookmarks](https://docs.mattermost.com/end-user-guide/collaborate/manage-channel-bookmarks)"
            " — Pin important links and files to the top of a channel.",
            "- Message Reminders & Snooze [doc link TBD] — Get reminded about a message <later>.",
            "- Offline Drafts [doc link TBD] — Write drafts on mobile without a connection.",
        ]))
        self.assertNotIn("**", slide)
        self.assertNotIn("jira.example", slide)
        self.assertIn("Jira: [server epics, v12.2 (December 2026)](https://jira.example/issues/?jql=project+=+MM+AND"
                      "+issuetype+=+Epic+AND+fixVersion+=+200) · [mobile epics, v2.47 Mobile (December 2026)]", text)
        self.assertFalse(self.result.todos)

    def test_summary_lists_sources_and_left_out_epics_with_reasons(self):
        text = self.result.text
        self.assertIn("- Offline Drafts: mobile epic [MM-5](https://jira.example/browse/MM-5); link from no docs page found", text)
        self.assertIn("- Message Reminders & Snooze: server epic [MM-4]", text)
        self.assertIn("- [MM-2](https://jira.example/browse/MM-2) Loadtest for 50k users (server): rule: title mentions “loadtest”", text)
        self.assertIn("- [MM-3](https://jira.example/browse/MM-3) Refactor the websocket hub (server): Claude: internal refactor", text)
        self.assertNotIn("MM-2", self.claude.prompts[0])

    def test_html_artifact(self):
        page = self.result.artifacts["release-highlights-December-2026.html"]
        style = "font-family: Arial, sans-serif; font-size: 13.5pt;"
        self.assertIn(f'<ul style="{style}">', page)
        self.assertEqual(page.count(f'<li style="{style}">'), 3)
        self.assertIn('<a href="https://docs.mattermost.com/end-user-guide/collaborate/manage-channel-bookmarks">Channel Bookmarks</a>'
                      " — Pin important links and files to the top of a channel.<!-- MM-1 --></li>", page)
        self.assertIn("Message Reminders &amp; Snooze [doc link TBD] — Get reminded about a message &lt;later&gt;.<!-- MM-4 -->", page)
        self.assertIn("<title>December 2026 v12.2</title>", page)
        self.assertNotIn("<h", page.split("<body")[1])

    def test_json_artifact_records_each_lines_epic(self):
        record = json.loads(self.result.artifacts["release-highlights-December-2026.json"])
        self.assertEqual([(line["epic"], line["kind"]) for line in record["lines"]], [("MM-1", "server"), ("MM-4", "server"), ("MM-5", "mobile")])
        self.assertEqual([e["epic"] for e in record["left_out"]], ["MM-2", "MM-3"])


class MissingInputTest(unittest.TestCase):
    def test_without_claude_the_lines_keep_a_todo(self):
        result = build(FakeJira({"200": [epic("MM-1", "Channel bookmarks")]}))
        self.assertIn("ANTHROPIC_API_KEY is not set, so no descriptions were written", result.todos)
        self.assertIn(f"- [Channel bookmarks](https://docs.mattermost.com/end-user-guide/collaborate/manage-channel-bookmarks) — "
                      f"{TODO_MARKER}: no description for MM-1", result.text)

    def test_no_server_version(self):
        self.assertEqual(build(FakeJira(), version="v12.9.0").todos, ["Jira has no single v12.9 (Month Year) fix version"])

    def test_no_epics(self):
        self.assertIn("no feature epics for v12.2", build(FakeJira()).todos)

    def test_dot_releases_are_skipped(self):
        self.assertTrue(build(FakeJira(), version="v12.2.1").skipped)


class RunTaskTest(unittest.TestCase):
    def env(self, **extra):
        return {"JIRA_EMAIL": "e", "JIRA_TOKEN": "t", "MODE": "dry_run", **extra}

    def test_released_but_not_latest_is_skipped(self):
        gh = FakeGitHub()
        gh.latest["mattermost/mattermost"] = "v12.3.0"
        gh.releases[("mattermost/mattermost", "v12.3.0")] = {"tag_name": "v12.3.0"}
        run = cli.run_task("release-highlights", "v12.2.0", self.env(EVENT_NAME="release"), gh, gh, None, docs=docs())
        self.assertEqual(run.result.skipped, "v12.2.0 is not the latest release")

    def test_needs_jira_credentials(self):
        run = cli.run_task("release-highlights", "v12.2.0", {"MODE": "dry_run"}, FakeGitHub(), FakeGitHub(), None, docs=docs())
        self.assertTrue(run.result.failed)

    def test_release_event_resolves_and_artifacts_are_written(self):
        self.assertEqual(cli.resolve("release-highlights", {"EVENT_NAME": "release"},
                                     {"action": "released", "release": {"tag_name": "v12.2.0"}})["version"], "v12.2.0")
        result = build(FakeJira({"200": [epic("MM-1", "Channel bookmarks")]}),
                       FakeClaude(answer(("MM-1", True, "f", "Channel Bookmarks", "Pin links."))))
        with tempfile.TemporaryDirectory() as out:
            cli.write_outputs(out, result, "summary", {})
            self.assertTrue(os.path.exists(os.path.join(out, "release-highlights-December-2026.html")))
            self.assertTrue(os.path.exists(os.path.join(out, "release-highlights-December-2026.json")))


if __name__ == "__main__":
    unittest.main()

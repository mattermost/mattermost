"""Each task's transform: ESR and regular, feature and dot releases, and missing inputs."""

import json
import os
import unittest
from datetime import date

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)

from release_docs import docker_env, drafts, github_release, notice, posts, release_docs_pr, version_archive
from release_docs.changelog import Highlight
from release_docs.result import TODO_MARKER
from release_docs.versions import Version

from .fakes import FakeClaude, fixture, release_server

ESR = "v10.11,v11.7,v12.4"
HIGHLIGHTS = [Highlight("Shared Drafts", "https://docs.mattermost.com/drafts", "b0"), Highlight("Audit Exports", "", "b1")]


class VersionArchiveTest(unittest.TestCase):
    def test_missing_sha256_is_a_todo_never_a_hash(self):
        version = Version.parse("v12.2.0")
        facts = version_archive.published_facts(version, release_server({}, missing=("mattermost-team",)))
        result = version_archive.build(version, fixture("version-archive-before-v12.0.0.mdx"), ESR, facts)
        self.assertTrue(result.failed)
        text = result.files[version_archive.ARCHIVE_PATH]
        self.assertIn(f"SHA-256 Checksum: `{TODO_MARKER}: no SHA-256 for mattermost-12.2.0-linux-amd64.tar.gz", text)
        self.assertIn("mattermost-team-12.2.0-linux-amd64.tar.gz is not on releases.mattermost.com", result.todos)
        self.assertNotRegex(text.split("v12.2.0")[1][:600], r"`[0-9a-f]{64}`")

    def test_sha256_file_must_name_the_tarball(self):
        self.assertIsNone(version_archive.parse_sha256_file("a" * 64 + "  other.tar.gz", "mattermost-1.tar.gz"))
        self.assertEqual(version_archive.parse_sha256_file("A" * 0 + "b" * 64 + " *mattermost-1.tar.gz\n", "mattermost-1.tar.gz"), "b" * 64)

    def test_waits_and_retries_until_published(self):
        calls = {"n": 0}
        ready = release_server({"mattermost-12.2.0-linux-amd64.tar.gz": "1" * 64, "mattermost-team-12.2.0-linux-amd64.tar.gz": "2" * 64})

        def fetch(url, method="GET"):
            calls["n"] += 1
            return ready(url, method) if calls["n"] > 8 else (404, "")

        slept = []
        facts = version_archive.wait_for_facts(Version.parse("v12.2.0"), fetch, 5, 60, sleep=slept.append, log=lambda _: None)
        self.assertEqual(version_archive.missing(facts), [])
        self.assertEqual(slept, [60])

    def test_gives_up_after_the_last_attempt(self):
        slept = []
        facts = version_archive.wait_for_facts(Version.parse("v12.2.0"), lambda u, m="GET": (404, ""), 3, 1,
                                               sleep=slept.append, log=lambda _: None)
        self.assertEqual(len(slept), 2)
        self.assertIn("enterprise sha256", version_archive.missing(facts))

    def test_never_replaces_a_later_dot_release(self):
        content = fixture("version-archive-after-dots.mdx")
        facts = version_archive.published_facts(Version.parse("v11.7.13"), release_server({
            "mattermost-11.7.13-linux-amd64.tar.gz": "1" * 64, "mattermost-team-11.7.13-linux-amd64.tar.gz": "2" * 64}))
        result = version_archive.build(Version.parse("v11.7.13"), content, ESR, facts)
        self.assertEqual(result.files, {})
        self.assertIn("already lists v11.7.14", result.notes[0])

    def test_rerun_on_its_own_output_changes_nothing(self):
        version = Version.parse("v12.0.1")
        facts = version_archive.published_facts(version, release_server({
            "mattermost-12.0.1-linux-amd64.tar.gz": "1" * 64, "mattermost-team-12.0.1-linux-amd64.tar.gz": "2" * 64}))
        once = version_archive.build(version, fixture("version-archive-before-dots.mdx"), ESR, facts).files[version_archive.ARCHIVE_PATH]
        self.assertEqual(version_archive.build(version, once, ESR, facts).files, {})


class DockerEnvTest(unittest.TestCase):
    BEFORE = "A=1\nMATTERMOST_IMAGE_TAG=11.7.0\nB=2\n"

    def test_esr_dot_release_raises_the_version(self):
        result = docker_env.build(Version.parse("v11.7.15"), self.BEFORE, ESR)
        self.assertEqual(result.files[docker_env.PATH], "A=1\nMATTERMOST_IMAGE_TAG=11.7.15\nB=2\n")

    def test_regular_release_is_skipped(self):
        self.assertIn("not an ESR", docker_env.build(Version.parse("v12.2.0"), self.BEFORE, ESR).skipped)

    def test_never_lowers(self):
        self.assertIn("never lowered", docker_env.build(Version.parse("v10.11.26"), self.BEFORE, ESR).skipped)
        self.assertIn("never lowered", docker_env.build(Version.parse("v11.7.0"), self.BEFORE, ESR).skipped)

    def test_unknown_esr_lines_or_file_shape_are_todos(self):
        self.assertTrue(docker_env.build(Version.parse("v11.7.15"), self.BEFORE, "").failed)
        self.assertTrue(docker_env.build(Version.parse("v11.7.15"), "A=1\n", ESR).failed)


class NoticeTest(unittest.TestCase):
    def test_feature_release_replaces_the_latest_upgrade_notice(self):
        before = fixture("notices-after-v12.0.json")
        result = notice.build(Version.parse("v12.2.0"), before, date(2026, 12, 16), HIGHLIGHTS)
        entries = {n["id"]: n for n in json.loads(result.files[notice.PATH])}
        self.assertNotIn("server_upgrade_v12.0", entries)
        new = entries["server_upgrade_v12.2"]
        self.assertEqual(new["conditions"]["serverVersion"], ["<12.2"])
        self.assertEqual(new["conditions"]["displayDate"], ">= 2026-12-16T00:00:00Z")
        self.assertIn("including [Shared Drafts](https://docs.mattermost.com/drafts) and Audit Exports.", new["localizedMessages"]["en"]["description"])
        self.assertEqual(len(entries), len(json.loads(before)))

    def test_dot_release_is_skipped(self):
        self.assertIn("security severity", notice.build(Version.parse("v12.0.1"), "[]", date(2026, 10, 22), []).skipped)

    def test_no_highlights_is_a_todo(self):
        result = notice.build(Version.parse("v12.2.0"), fixture("notices-after-v12.0.json"), date(2026, 12, 16), [])
        self.assertTrue(result.failed)
        self.assertIn(TODO_MARKER, result.files[notice.PATH])

    def test_an_older_release_never_replaces_a_newer_notice(self):
        result = notice.build(Version.parse("v11.11.0"), fixture("notices-after-v12.0.json"), date(2026, 9, 16), HIGHLIGHTS)
        self.assertEqual(result.files, {})
        self.assertIn("already has the notice for v12.0", result.skipped)


class GitHubReleaseTest(unittest.TestCase):
    def test_one_plain_line(self):
        text = github_release.build(Version.parse("v12.2.0"), ESR, [Highlight("**Bold** [link]", "", ""), Highlight("B", "", "")]).text
        self.assertEqual(text, "Mattermost Platform Release 12.2.0 contains multiple new quality of life improvements, including Bold link and B.")

    def test_dot_release_skipped_and_missing_highlights_fail(self):
        self.assertTrue(github_release.build(Version.parse("v12.0.1"), ESR, []).skipped)
        self.assertTrue(github_release.build(Version.parse("v12.2.0"), ESR, []).failed)


def real_docs():
    """The docs pages the release docs PR edits, as they are in this checkout."""
    root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    files = {}
    for path in release_docs_pr.FILES:
        with open(os.path.join(root, path), encoding="utf-8") as f:
            files[path] = f.read()
    return files


SERVER_TABLE = """## Latest releases

| **Release** | **Released on** | **Support ends** |
|:---|:---|:---|
| v12.1 [Download](x) | 2026-11-16 | 2027-02-15 |
| v12.0 [Download](x) | 2026-10-16 | 2027-01-15 |
|  |  |  |
"""

CHART = """```mermaid
gantt
    section Releases
    v11.7 & Desktop App v6.2 Extended Support :crit, :active, 2026-05-15, 2027-05-15
    v11.11                 :active, 2026-09-16, 2026-12-15
    v12.1                  :active, 2026-11-16, 2027-02-15
    v12.4 & Desktop App v6.5 Extended Support (planned) :crit, 2027-02-16, 2028-02-15
```

- 🔴 **Red bars**: Extended Support Releases (ESRs), released every 9 months with 12 months of support
  - v12.4 & Desktop App v6.5 (planned): Expected February 2027. Version number and dates are subject to change until the release is announced.
  - v11.7 & Desktop App v6.2: Supported until May 15, 2027
  - v10.11 & Desktop App v5.13: Support ended August 15, 2026
"""

DESKTOP = """| **Release** | **Support** | **Compatible with** |
|:---|:---|:---|
| v6.4 [Download](x) | Released: 2026-11-16<br/>Support Ends: 2027-02-15 | [v12.1](./mattermost-v12-changelog#release-v12-1-feature-release), [v11.7](./x) |
| v6.3 [Download](x) | Released: 2026-08-14<br/>Support Ends: 2026-11-15 | [v12.0](./x) |
"""

POSTGRES = """future PostgreSQL minimum version increases as follows:

<table>
<tbody>
<tr>
<td><a href={useBaseUrl('/product-overview/mattermost-v11-changelog#release-v11-7-extended-support-release')}>v11.7 ESR</a></td>
<td>2026-5-15</td>
<td>14.x (EOL 2026-11-12)</td>
</tr>
<tr>
<td><a href={useBaseUrl('/product-overview/mattermost-v12-changelog#release-v12-0-major-release')}>v12.0</a></td>
<td>2026-10-16</td>
<td>15.x (EOL 2027-11-11)</td>
</tr>
</tbody>
</table>
"""


class ReleaseDocsTest(unittest.TestCase):
    def setUp(self):
        self.result = release_docs_pr.Result("release-docs", "v12.2.0")

    def test_server_release_rows_regular_and_esr(self):
        text = release_docs_pr.add_server_release(SERVER_TABLE, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), self.result)
        row = text.splitlines()[4]
        self.assertTrue(row.startswith("| v12.2 [Download](https://releases.mattermost.com/12.2.0/mattermost-12.2.0-linux-amd64.tar.gz)"))
        self.assertTrue(row.endswith("| 2026-12-16 | 2027-03-15 |"))
        text = release_docs_pr.add_server_release(SERVER_TABLE, Version.parse("v12.4.0"), ESR, date(2027, 2, 16), self.result)
        self.assertTrue(text.splitlines()[4].endswith("| 2027-02-16 | 2028-02-15 [EXTENDED](./release-policy#release-types) |"))
        self.assertIn("#release-v12-4-extended-support-release", text)

    def test_server_release_without_release_day_is_a_todo(self):
        text = release_docs_pr.add_server_release(SERVER_TABLE, Version.parse("v12.2.0"), ESR, None, self.result)
        self.assertIn(TODO_MARKER, text.splitlines()[4])
        self.assertTrue(self.result.failed)

    def test_chart_adds_a_regular_release_and_marks_ended_ones_done(self):
        text = release_docs_pr.update_esr_chart(CHART, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), self.result)
        self.assertIn("    v11.11                 :done, 2026-09-16, 2026-12-15\n", text)
        self.assertIn("    v12.1                  :active, 2026-11-16, 2027-02-15\n    v12.2                  :active, 2026-12-16, 2027-03-15\n    v12.4", text)
        self.assertEqual(self.result.todos, [])

    def test_chart_turns_the_planned_esr_real_and_plans_the_next(self):
        text = release_docs_pr.update_esr_chart(CHART, Version.parse("v12.4.0"), ESR + ",v13.1", date(2027, 2, 16), self.result)
        self.assertIn("    v12.4 & Desktop App v6.5 Extended Support :crit, :active, 2027-02-16, 2028-02-15\n", text)
        self.assertIn(f"    v13.1 & Desktop App {TODO_MARKER} Extended Support (planned) :crit, 2027-11-16, 2028-11-15\n", text)
        self.assertIn("  - v12.4 & Desktop App v6.5: Supported until February 15, 2028\n", text)
        self.assertIn("  - v13.1 & Desktop App", text)
        self.assertNotIn("v12.4 & Desktop App v6.5 (planned)", text)
        self.assertEqual(self.result.todos, ["the Desktop App ESR paired with the next ESR, v13.1"])
        for line in text.split("```")[1].splitlines():
            self.assertLessEqual(line.count(":"), 3, f"a Mermaid task name can't hold a colon: {line}")

    def test_chart_flags_a_planned_esr_the_variable_does_not_list(self):
        release_docs_pr.update_esr_chart(CHART, Version.parse("v12.4.0"), "v11.7", date(2027, 2, 16), self.result)
        self.assertIn("CHANGELOG_ESR_VERSIONS does not list it", self.result.todos[0])

    def test_desktop_compatibility(self):
        text = release_docs_pr.add_desktop_compatibility(DESKTOP, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), self.result)
        self.assertIn("| [v12.2](./mattermost-v12-changelog#release-v12-2-feature-release), [v12.1]", text)
        self.assertEqual(release_docs_pr.add_desktop_compatibility(text, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), self.result), text)
        release_docs_pr.add_desktop_compatibility(DESKTOP, Version.parse("v12.3.0"), ESR, date(2027, 3, 16), self.result)
        self.assertIn("no longer supported", self.result.todos[0])

    def test_postgres_rows(self):
        regular = release_docs_pr.add_postgres_row(POSTGRES, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), 15, self.result)
        self.assertEqual(regular, POSTGRES)
        esr = release_docs_pr.add_postgres_row(POSTGRES, Version.parse("v12.4.0"), ESR, date(2027, 2, 16), 15, self.result)
        self.assertIn(">v12.4 ESR</a></td>\n<td>2027-2-16</td>\n<td>15.x (EOL 2027-11-11)</td>\n</tr>\n</tbody>", esr)
        raised = release_docs_pr.add_postgres_row(POSTGRES, Version.parse("v12.2.0"), ESR, date(2026, 12, 16), 16, self.result)
        self.assertIn(">v12.2</a></td>\n<td>2026-12-16</td>\n<td>16.x</td>", raised)
        self.assertEqual(release_docs_pr.add_postgres_row(esr, Version.parse("v12.4.0"), ESR, date(2027, 2, 16), 15, self.result), esr)
        release_docs_pr.add_postgres_row(POSTGRES, Version.parse("v12.4.0"), ESR, date(2027, 2, 16), None, self.result)
        self.assertIn("MinimumPostgresMajorVersion not found", self.result.todos[0])

    def test_postgres_minimum_from_config_go(self):
        self.assertEqual(release_docs_pr.postgres_minimum("const (\n\tMinimumPostgresMajorVersion = 15\n)"), 15)
        self.assertIsNone(release_docs_pr.postgres_minimum("nothing"))

    def test_deploy_pages_latest_and_esr_never_lowered(self):
        page = ('<TabItem value="latest" label="Latest release" default>\n'
                "wget https://releases.mattermost.com/12.0.1/mattermost-12.0.1-linux-amd64.tar.gz\n</TabItem>\n"
                '<TabItem value="esr" label="Current ESR">\n'
                "wget https://releases.mattermost.com/11.7.14/mattermost-11.7.14-linux-amd64.tar.gz\n</TabItem>\n")
        regular = release_docs_pr.update_deploy_page(page, Version.parse("v12.2.0"), ESR)
        self.assertIn("12.2.0/mattermost-12.2.0", regular)
        self.assertIn("11.7.14/mattermost-11.7.14", regular)
        esr = release_docs_pr.update_deploy_page(page, Version.parse("v12.4.0"), ESR)
        self.assertEqual(esr.count("12.4.0/mattermost-12.4.0"), 2)
        self.assertEqual(release_docs_pr.update_deploy_page(page, Version.parse("v11.11.0"), ESR), page)

    def test_full_pr_on_this_checkouts_docs_is_idempotent(self):
        files = real_docs()
        first = release_docs_pr.build(Version.parse("v12.2.0"), files, ESR, date(2026, 12, 16), 15)
        self.assertEqual(sorted(first.files), sorted(set(release_docs_pr.FILES) - {release_docs_pr.REQUIREMENTS, release_docs_pr.DESKTOP_RELEASES}))
        self.assertIn("the newest Desktop App release (v6.3) is no longer supported", first.todos[0])
        for path in (release_docs_pr.UI_ADA_CHANGELOG, release_docs_pr.UPGRADE_NOTES, release_docs_pr.DEPRECATED_FEATURES):
            self.assertIn(f"{{/* {release_docs_pr.PLACEHOLDER_MARKER}: v12.2", first.files[path])
        again = release_docs_pr.build(Version.parse("v12.2.0"), {**files, **first.files}, ESR, date(2026, 12, 16), 15)
        self.assertEqual(again.files, {})


SERVER_RELEASES_TABLE = """| **Release** | **Released on** | **Support ends** |
|:---|:---|:---|
| v11.7 [Download](x) \\| [Changelog](y) | 2026-05-15 | 2027-05-15 [EXTENDED](./release-policy#release-types) |
| v10.11 [Download](x) \\| [Changelog](y) | 2025-08-15 | 2026-08-15 [EXTENDED](./release-policy#release-types) |
"""


class PostsTest(unittest.TestCase):
    def setUp(self):
        from release_docs import calendar
        self.events = calendar.parse_ics(fixture("release-dates.ics"))

    def test_all_three_posts(self):
        result = posts.build(Version.parse("v12.1.0"), ESR, self.events, HIGHLIGHTS, "https://blog", SERVER_RELEASES_TABLE)
        self.assertEqual(result.todos, [])
        self.assertIn("**Mattermost v12.2**\n- Release Branch Cut: Mon, Oct 19, 2026", result.text)
        self.assertIn("- Code Freeze: Wed, Oct 28, 2026 at 09:00 America/Toronto", result.text)
        self.assertIn("**Mattermost v12.3**", result.text)
        self.assertIn("- [Shared Drafts](https://docs.mattermost.com/drafts)\n- Audit Exports", result.text)
        self.assertIn("Mattermost v10.11 ESR support ends August 15, 2026", result.text)
        self.assertIn("send on 2026-05-15, three months before", result.text)
        self.assertIn("supported until May 15, 2027", result.text)

    def test_missing_calendar_and_highlights_are_todos(self):
        result = posts.build(Version.parse("v12.1.0"), ESR, None, [], "https://blog", SERVER_RELEASES_TABLE)
        self.assertEqual(len(result.todos), 2)
        self.assertIn(TODO_MARKER, result.text)

    def test_esr_comms_for_a_new_esr_uses_its_release_day(self):
        result = posts.Result("posts", "v12.4.0")
        text = posts.esr_comms(Version.parse("v12.4.0"), ESR, SERVER_RELEASES_TABLE, date(2027, 2, 16), result)
        self.assertIn("Mattermost v11.7 ESR support ends May 15, 2027", text)
        self.assertIn("send on 2027-02-15", text)
        self.assertIn("v12.4 is the current Extended Support Release, supported until February 15, 2028", text)


PR_ITEM = {"repository_url": "https://api.github.com/repos/mattermost/mattermost", "number": 7, "title": "Remove X",
           "html_url": "https://github.com/mattermost/mattermost/pull/7",
           "body": "#### Upgrade notes\nRun the migration first.\n\n#### Release Note\n```release-note\nRemoved the X setting.\n```"}


class DraftsTest(unittest.TestCase):
    def test_breaking_notices_cite_their_pr(self):
        prs = [drafts.pr_source(PR_ITEM)]
        self.assertEqual(prs[0]["note"], "Removed the X setting.")
        self.assertEqual(prs[0]["upgrade_notes"], "Run the migration first.")
        result = drafts.breaking_notices("v12.2.0", prs, FakeClaude({"notices": [
            {"source": "mattermost/mattermost#7", "notice": "The X setting was removed. Unset it before upgrading."}]}))
        self.assertEqual(result.todos, [])
        self.assertIn("Unset it before upgrading.\n\nSource: [mattermost/mattermost#7](https://github.com/mattermost/mattermost/pull/7)", result.text)

    def test_breaking_notices_missing_draft_is_a_todo(self):
        result = drafts.breaking_notices("v12.2.0", [drafts.pr_source(PR_ITEM)], None)
        self.assertTrue(result.failed)
        self.assertIn("no notice drafted for mattermost/mattermost#7", result.todos)

    def test_blog_and_email_points_need_a_given_source(self):
        prs = [drafts.pr_source(PR_ITEM)]
        epics = [{"key": "MM-1", "summary": "Shared Drafts", "url": "https://jira/MM-1"}]
        claude = FakeClaude({
            "blog_outline": [{"heading": "Drafts", "points": [{"text": "Co-write messages.", "sources": ["MM-1"]},
                                                              {"text": "Made up.", "sources": ["MM-999"]}]}],
            "email": {"subject": "v12.2 is here", "points": [{"text": "X was removed (mattermost/mattermost#7).", "sources": []}]},
        })
        result = drafts.blog_and_email(Version.parse("v12.2.0"), ["b"], prs, epics, claude, [])
        self.assertIn("- Co-write messages. ([MM-1](https://jira/MM-1))", result.text)
        self.assertIn("([mattermost/mattermost#7](https://github.com/mattermost/mattermost/pull/7))", result.text)
        self.assertEqual(result.todos, ["no valid source for: Made up."])

    def test_missing_jira_or_claude_fails(self):
        result = drafts.blog_and_email(Version.parse("v12.2.0"), [], [], [], None, ["Jira not configured"])
        self.assertEqual(len(result.todos), 2)


if __name__ == "__main__":
    unittest.main()

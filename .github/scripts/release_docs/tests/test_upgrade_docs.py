"""The upgrade pages: the confirmed breaking changes from the PR description's marker, worded from
their changelog bullets, and the PR check that fails from T-2."""

import io
import json
import os
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from datetime import date
from unittest import mock

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)  # generate_changelog, whose release-note parser drafting uses, reads them

from release_docs import __main__ as cli  # noqa: E402
from release_docs import changelog_run, markers, publish, release_docs_pr, upgrade_docs  # noqa: E402
from release_docs.result import TODO_MARKER, Result  # noqa: E402
from release_docs.versions import Version  # noqa: E402

from .fakes import FakeClaude, FakeGitHub  # noqa: E402
from .test_tasks import real_docs  # noqa: E402

SERVER = "mattermost/mattermost"
ENT = "mattermost/enterprise"


def note(text: str) -> str:
    return f"#### Summary\nA change.\n\n#### Release Note\n```release-note\n{text}\n```\n"


# ── The marker ──────────────────────────────────────────────────────────────────────

class MarkerTest(unittest.TestCase):
    def test_the_marker_names_mattermost_mattermost_prs(self):
        body = "Release docs for v12.2.\n\n<!-- release-automation:confirmed-breaking: 39012,39088 -->\n"
        self.assertEqual(upgrade_docs.parse_marker(body), ([f"{SERVER}#39012", f"{SERVER}#39088"], None))

    def test_whitespace_and_the_other_ways_to_write_a_pr_number(self):
        body = "<!--release-automation:confirmed-breaking:\n  #39012 ,  mattermost/mattermost#39088 39012\n-->"
        self.assertEqual(upgrade_docs.parse_marker(body), ([f"{SERVER}#39012", f"{SERVER}#39088"], None))

    def test_no_marker_and_none_confirmed_are_different(self):
        self.assertEqual(upgrade_docs.parse_marker("Release docs for v12.2."), (None, None))
        self.assertEqual(upgrade_docs.parse_marker(None), (None, None))
        self.assertEqual(upgrade_docs.parse_marker("<!-- release-automation:confirmed-breaking: -->"), ([], None))
        self.assertEqual(upgrade_docs.parse_marker("<!-- release-automation:confirmed-breaking: none -->"), ([], None))

    def test_a_malformed_marker_confirms_nothing_and_never_repeats_its_entries(self):
        confirmed, problem = upgrade_docs.parse_marker(
            "<!-- release-automation:confirmed-breaking: 39012, mattermost/enterprise#7, MM-1234 -->")
        self.assertIsNone(confirmed)
        self.assertEqual(problem, "the `release-automation:confirmed-breaking` marker has 2 entries that are not a "
                                  "mattermost/mattermost PR number")
        self.assertNotIn("enterprise", problem)
        two = ("<!-- release-automation:confirmed-breaking: 1 -->\n<!-- release-automation:confirmed-breaking: 2 -->")
        self.assertEqual(upgrade_docs.parse_marker(two)[0], None)
        self.assertIn("2 `release-automation:confirmed-breaking` markers that disagree", upgrade_docs.parse_marker(two)[1])

    def test_a_malformed_marker_is_a_problem_not_absent_and_fixing_it_is_a_change(self):
        malformed = "<!-- release-automation:confirmed-breaking 39012,39088 -->"
        self.assertEqual(upgrade_docs.parse_marker(malformed), (None, "the description has 1 malformed "
                         "`release-automation:confirmed-breaking` marker (written "
                         "`<!-- release-automation:confirmed-breaking: 1, 2 -->`)"))
        self.assertNotIn("39012", upgrade_docs.parse_marker(malformed)[1])
        valid = "<!-- release-automation:confirmed-breaking: 39012,39088 -->"
        self.assertTrue(markers.changed(malformed, valid, upgrade_docs.MARKER_NAME))
        self.assertTrue(markers.changed(valid, malformed, upgrade_docs.MARKER_NAME))
        self.assertFalse(markers.changed("No marker.", None, upgrade_docs.MARKER_NAME))

    def test_rewriting_the_pr_body_keeps_the_marker(self):
        marker = "<!-- release-automation:confirmed-breaking: 39012 -->"
        kept = publish.kept_markers(f"Old text.\n\n{marker}\n", "New text.\n")
        self.assertEqual(kept, f"New text.\n\n{marker}\n")
        self.assertEqual(publish.kept_markers("Old text.", "New text.\n"), "New text.\n")
        self.assertEqual(publish.kept_markers(marker, f"New.\n{marker}\n").count(marker), 1)


# ── Reading the changelog runs ──────────────────────────────────────────────────────

REPORTS = [
    {"version": "v12.2.0", "sections": [{"section": "API Changes", "subsection": None, "items": [
        {"text": "Removed ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.", "sources": [f"{SERVER}#202"]}]}]},
    {"version": "v12.2.0", "sections": [{"section": "Upgrade Impact", "subsection": "Compatibility", "items": [
        {"text": "Plugin signatures using SHA-1 are now rejected.", "sources": [f"{SERVER}#201"]},
        {"text": "Removed  ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.", "sources": [f"{SERVER}#202"]}]}]},
]
ENTRY = ("## Release v12.2 - Feature Release\n\n### Upgrade Impact\n\n#### Compatibility\n"
         " - Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256.\n\n### API Changes\n"
         " - Added ``GET /api/v4/things`` API endpoint.\n")


class ChangelogRunTest(unittest.TestCase):
    def test_every_run_for_the_release_is_read_and_each_bullet_once(self):
        found = changelog_run.items(REPORTS)
        self.assertEqual([(i["section"], i["sources"]) for i in found],
                         [("API Changes", [f"{SERVER}#202"]), ("Upgrade Impact", [f"{SERVER}#201"])])

    def test_a_bullet_takes_the_entrys_current_wording_and_a_deleted_one_is_left_out(self):
        found = changelog_run.items(REPORTS)
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#201", found, ENTRY), [{
            "section": "Upgrade Impact", "subsection": "Compatibility", "sources": [f"{SERVER}#201"],
            "text": "Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256."}])
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#202", found, ENTRY), [])  # a reviewer deleted it

    def test_the_same_text_from_two_runs_keeps_both_runs_sources(self):
        reports = [{"sections": [{"section": "API Changes", "items": [{"text": "Removed ``X``.", "sources": [f"{SERVER}#2"]}]}]},
                   {"sections": [{"section": "API Changes", "items": [{"text": "Removed  ``X``.",
                                                                       "sources": [f"{SERVER}#1", f"{SERVER}#2"]}]}]}]
        [item] = changelog_run.items(reports)
        self.assertEqual(item["sources"], [f"{SERVER}#2", f"{SERVER}#1"])
        self.assertEqual(len(changelog_run.bullets_for(f"{SERVER}#1", [item], " - Removed ``X``.\n")), 1)

    def test_a_removal_never_matches_an_addition_and_two_close_bullets_are_unresolved(self):
        removal = [{"section": "API Changes", "subsection": None, "sources": [f"{SERVER}#1"],
                    "text": "Removed ``GET /api/v4/things`` API endpoint."}]
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#1", removal, ENTRY), [])  # ENTRY has "Added" it
        edited = "### API Changes\n - The ``GET /api/v4/things`` API endpoint was removed.\n"
        self.assertEqual([b["text"] for b in changelog_run.bullets_for(f"{SERVER}#1", removal, edited)],
                         ["The ``GET /api/v4/things`` API endpoint was removed."])
        two = ("### API Changes\n - Removed the ``GET /api/v4/things`` API endpoint.\n"
               " - Removed ``GET /api/v4/things`` API endpoints.\n")
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#1", removal, two), [])

    def test_reports_come_from_the_changelog_workflows_artifacts(self):
        calls = []

        def run(args, capture_output, text, env):
            calls.append(args)
            if args[1:3] == ["run", "list"]:
                return types.SimpleNamespace(returncode=0, stdout=json.dumps([{"databaseId": 2}, {"databaseId": 1}]))
            target = args[args.index("-D") + 1]
            os.makedirs(target)
            with open(os.path.join(target, "sections.json"), "w") as f:
                json.dump({"version": "v12.2.0" if args[3] == "2" else "v12.1.0", "sections": []}, f)
            return types.SimpleNamespace(returncode=0, stdout="")
        reports, problem = changelog_run.fetch_reports("v12.2.0", "actions-token", run=run)
        self.assertEqual((len(reports), problem), (1, None))
        self.assertIn("generate-changelog.yml", calls[0])
        self.assertEqual(changelog_run.fetch_reports("v12.2.0", "")[1], "no token that can read Actions (ACTIONS_TOKEN)")

    def fake_runs(self, reports, failing=()):
        """A gh CLI whose runs (newest first) uploaded ``reports``; the runs in ``failing`` have no artifact."""
        def run(args, capture_output, text, env):
            if args[1:3] == ["run", "list"]:
                return types.SimpleNamespace(returncode=0, stdout=json.dumps([{"databaseId": i} for i in range(len(reports))]))
            number = int(args[3])
            if number in failing:
                return types.SimpleNamespace(returncode=1, stdout="")
            target = args[args.index("-D") + 1]
            os.makedirs(target)
            with open(os.path.join(target, "sections.json"), "w") as f:
                json.dump(reports[number], f)
            return types.SimpleNamespace(returncode=0, stdout="")
        return run

    def test_update_reports_without_the_creating_run_are_reported_incomplete(self):
        update = {"version": "v12.2.0", "mode": "update", "sections": []}
        create = {"version": "v12.2.0", "mode": "create", "sections": []}
        reports, problem = changelog_run.fetch_reports("v12.2.0", "t", run=self.fake_runs([update, create], failing={1}))
        self.assertEqual(len(reports), 1)
        self.assertEqual(problem, "the changelog run that created the v12.2.0 entry was not found (1 changelog run's "
                                  "report could not be read), so its bullets may be incomplete")
        _, problem = changelog_run.fetch_reports("v12.2.0", "t", limit=2, run=self.fake_runs([update, update]))
        self.assertIn("only the newest 2 changelog runs were checked", problem)
        self.assertEqual(changelog_run.fetch_reports("v12.2.0", "t", run=self.fake_runs([update, create]))[1], None)


# ── 3. The upgrade pages ────────────────────────────────────────────────────────────

BULLETS = {
    f"{SERVER}#201": [{"section": "Upgrade Impact", "subsection": "Compatibility",
                       "text": "Plugin signatures using SHA-1 are now rejected. See [the guide](https://docs.mattermost.com/x)."}],
    f"{SERVER}#202": [{"section": "API Changes", "subsection": None,
                       "text": "Removed ``GET /api/v4/usage/{kind}`` (``getUsage``) API endpoint."}],
    f"{ENT}#7": [{"section": "Upgrade Impact", "subsection": "config.json",
                  "text": "Removed ``ServiceSettings.EnableLegacy`` configuration setting."}],
    f"{SERVER}#204": [{"section": "Improvements", "subsection": "User Interface", "text": "Refreshed the sidebar."}],
}


class UpgradeDocsTest(unittest.TestCase):
    def test_confirmed_items_take_their_changelog_wording(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"], BULLETS, {})
        self.assertTrue(docs.complete)
        self.assertEqual([e.source for e in docs.notes], [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"])
        self.assertEqual([e.source for e in docs.removed], [f"{SERVER}#202", f"{ENT}#7"])  # removals only
        self.assertEqual(docs.drafted(), [])

    def test_none_confirmed_is_complete_and_a_problem_is_not(self):
        self.assertTrue(upgrade_docs.plan([], {}, {}).complete)
        self.assertFalse(upgrade_docs.plan([], {}, {}, "the marker is malformed").complete)

    def test_claude_drafts_only_for_a_public_pr_with_no_bullet_and_it_is_marked_for_review(self):
        docs = upgrade_docs.plan([f"{SERVER}#204", f"{ENT}#8"],
                                 BULLETS, {f"{SERVER}#204": "The sidebar was removed; pin channels again after upgrading.",
                                           f"{ENT}#8": "never used"})
        self.assertEqual([(e.source, e.drafted) for e in docs.notes], [(f"{SERVER}#204", True)])
        self.assertEqual(docs.todos, ["1 confirmed breaking change(s) from a private repo have no changelog bullet in "
                                      "Upgrade Impact or API Changes: write their upgrade notes by hand"])
        self.assertNotIn("enterprise", " ".join(docs.todos))
        missing = upgrade_docs.plan([f"{SERVER}#204"], BULLETS, {})
        self.assertIn(f"{SERVER}#204 is a confirmed breaking change with no changelog bullet", missing.todos[0])

    def test_the_row_and_entry_templates(self):
        entries = [upgrade_docs.Entry("a", "Removed ``GET /x/{id}`` & <b>. See [the guide](https://d/x)."),
                   upgrade_docs.Entry("b", "Upgrade **before** you start.")]
        self.assertEqual(upgrade_docs.note_rows("v12.2", entries),
                         '<tr>\n<td rowspan="2">v12.2</td>\n<td><p>Removed <code>GET /x/&#123;id&#125;</code> &amp; &lt;b&gt;. '
                         'See <a href="https://d/x">the guide</a>.</p></td>\n</tr>\n'
                         '<tr>\n<td><p>Upgrade <strong>before</strong> you start.</p></td>\n</tr>\n')
        self.assertTrue(upgrade_docs.note_rows("v12.2", entries[1:]).startswith("<tr>\n<td>v12.2</td>\n"))
        # MDX-safe: literal braces and angle brackets escaped outside inline code; code and links kept.
        entries.append(upgrade_docs.Entry("c", "Removed the {legacy} <Setting> flag; see \\{already\\}. `a{b}<c>`"))
        self.assertEqual(upgrade_docs.removed_section("v12.2", date(2026, 12, 16), [entries[0], entries[2]]),
                         "### Mattermost Server v12.2 (December 2026)\n\n- Removed ``GET /x/{id}`` & \\<b\\>. See "
                         "[the guide](https://d/x).\n- Removed the \\{legacy\\} \\<Setting\\> flag; see "
                         "\\{already\\}. `a{b}<c>`\n\n")
        self.assertIn("<p>Removed the &#123;legacy&#125; &lt;Setting&gt; flag; see &#123;already&#125;. "
                      "<code>a&#123;b&#125;&lt;c&gt;</code></p>", upgrade_docs.note_rows("v12.2", entries[2:]))

    def build(self, docs, today=None):
        files = {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"}
        return release_docs_pr.build(Version.parse("v12.2.0"), files, "v10.11,v11.7,v12.4", date(2026, 12, 16), 15,
                                     {}, docs, today)

    def test_the_release_docs_pr_writes_only_confirmed_items(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{ENT}#7"], BULLETS, {})
        result = self.build(docs)
        notes, removed = result.files[release_docs_pr.UPGRADE_NOTES], result.files[release_docs_pr.DEPRECATED_FEATURES]
        self.assertIn('<tbody>\n<tr>\n<td rowspan="2">v12.2</td>\n<td><p>Plugin signatures using SHA-1 are now rejected.',
                      notes)
        self.assertIn("### Mattermost Server v12.2 (December 2026)\n\n- Removed ``ServiceSettings.EnableLegacy`` "
                      "configuration setting.\n\n### Mattermost Server v12.0", removed)
        self.assertNotIn("getUsage", notes + removed)  # #202 has a bullet but wasn't confirmed
        self.assertNotIn(release_docs_pr.PLACEHOLDER_MARKER + ": v12.2 Important", notes)
        self.assertFalse([t for t in result.todos if "breaking" in t or "upgrade note" in t])  # (no milestones given)
        self.assertIn("- [x] Important Upgrade Notes: 2 row(s) from confirmed breaking changes", result.body)
        self.assertNotIn(ENT, result.body)
        self.assertEqual(cli.release_docs_problems(result.files), [])

    def test_a_confirmed_pr_with_no_wording_keeps_the_placeholders_and_fails(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{SERVER}#204"], BULLETS, {})
        result = self.build(docs)
        notes = result.files[release_docs_pr.UPGRADE_NOTES]
        self.assertIn("Plugin signatures using SHA-1", notes)  # the worded one is written...
        self.assertIn(f"{release_docs_pr.PLACEHOLDER_MARKER}: v12.2 Important Upgrade Notes", notes)  # ...the rest waits
        self.assertTrue(result.failed)
        self.assertEqual(len(cli.release_docs_problems(result.files)), 2)
        self.assertIn("- [ ] Important Upgrade Notes: 1 row(s)", result.body)

    def test_no_marker_keeps_the_placeholders_and_is_a_missing_input_only_from_t_minus_2(self):
        before = self.build(None, today=date(2026, 12, 11))  # Friday; T-2 is Monday 2026-12-14
        for path, what in ((release_docs_pr.UPGRADE_NOTES, "Important Upgrade Notes"),
                           (release_docs_pr.DEPRECATED_FEATURES, "Deprecated Features")):
            self.assertIn(f"{release_docs_pr.PLACEHOLDER_MARKER}: v12.2 {what}", before.files[path])
        self.assertFalse([t for t in before.todos if "confirmed breaking" in t])
        self.assertIn("waiting for the confirmed breaking changes (the `release-automation:confirmed-breaking` marker in "
                      "this description). The PR check fails from T-2 (2026-12-14)", before.body)
        on = self.build(None, today=date(2026, 12, 14))
        self.assertIn("no confirmed breaking changes yet (no `release-automation:confirmed-breaking` marker in the PR "
                      "description) on or after T-2, so Important Upgrade Notes and Deprecated Features keep their "
                      "placeholders", on.todos)

    def test_a_drafted_row_is_listed_for_review_in_the_pr_body(self):
        docs = upgrade_docs.plan([f"{SERVER}#204"], BULLETS, {f"{SERVER}#204": "The sidebar was removed."})
        body = self.build(docs).body
        self.assertIn("Drafted by Claude, because the PR has no changelog bullet in Upgrade Impact or API Changes.", body)
        self.assertIn(f"- [ ] {SERVER}#204", body)

    def test_a_rerun_gives_the_same_pages(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{SERVER}#204"], BULLETS, {})
        first = self.build(docs).files[release_docs_pr.UPGRADE_NOTES]
        placeholder = release_docs_pr.placeholder(Version.parse("v12.2.0"), "Important Upgrade Notes")
        self.assertEqual(upgrade_docs.fill(first.replace("Plugin signatures using SHA-1 are now rejected. See "
                                                         '<a href="https://docs.mattermost.com/x">the guide</a>.', "x"),
                                           upgrade_docs.NOTES_ANCHOR, "", placeholder, True).count(placeholder), 1)

    def test_a_rerun_on_the_pr_branch_replaces_the_release_rows_and_section(self):
        def build_on(files, docs):
            return release_docs_pr.build(Version.parse("v12.2.0"), files, "v10.11,v11.7,v12.4", date(2026, 12, 16), 15,
                                         {}, docs)

        base = {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"}
        both = upgrade_docs.plan([f"{SERVER}#201", f"{ENT}#7"], BULLETS, {})
        first = build_on(base, both).files
        branch = {**base, **first}
        self.assertEqual(build_on(branch, both).files, {})

        later = upgrade_docs.plan([f"{SERVER}#202"], BULLETS, {})
        again = build_on(branch, later).files
        notes, removed = again[release_docs_pr.UPGRADE_NOTES], again[release_docs_pr.DEPRECATED_FEATURES]
        self.assertEqual(notes, build_on(base, later).files[release_docs_pr.UPGRADE_NOTES])
        self.assertEqual(removed, build_on(base, later).files[release_docs_pr.DEPRECATED_FEATURES])
        self.assertEqual(notes.count("<td>v12.2</td>"), 1)
        self.assertNotIn("Plugin signatures using SHA-1", notes)
        self.assertEqual(removed.count("### Mattermost Server v12.2 "), 1)
        self.assertNotIn("ServiceSettings.EnableLegacy", removed)
        self.assertIn('<td rowspan="27">v12.0</td>', notes)
        self.assertIn("### Mattermost Server v12.0 (October 2026)", removed)

    def test_a_page_without_its_anchor_is_left_unchanged_and_reported(self):
        docs = upgrade_docs.plan([f"{SERVER}#201"], BULLETS, {})
        notes = real_docs()[release_docs_pr.UPGRADE_NOTES]
        broken = notes.replace("<tbody>", "<tbody >")
        result = self.build_with({release_docs_pr.UPGRADE_NOTES: broken}, docs)
        self.assertNotIn(release_docs_pr.UPGRADE_NOTES, result.files)
        self.assertIn(f"{release_docs_pr.UPGRADE_NOTES} has no `<tbody>` to add v12.2's Important Upgrade Notes after, "
                      "so it is unchanged", result.todos)
        spaced = notes.replace("<tbody>\n", "<tbody>  \n", 1)  # trailing spaces after <tbody> are fine
        result = self.build_with({release_docs_pr.UPGRADE_NOTES: spaced}, docs)
        self.assertIn("<tbody>  \n<tr>\n<td>v12.2</td>", result.files[release_docs_pr.UPGRADE_NOTES])

    def build_with(self, pages, docs):
        files = {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "", **pages}
        return release_docs_pr.build(Version.parse("v12.2.0"), files, "v10.11,v11.7,v12.4", date(2026, 12, 16), 15, {}, docs)

    def test_the_check_ignores_the_ui_accessibility_placeholder(self):
        page = "<tbody>\n{/* release-agent placeholder: v12.2 UI & Accessibility changelog rows, filled in a later PR. */}\n"
        self.assertEqual(cli.release_docs_problems({release_docs_pr.UPGRADE_NOTES: page}), [])
        self.assertEqual(cli.release_docs_problems({release_docs_pr.DEPRECATED_FEATURES: f"- {TODO_MARKER}: x\n"}),
                         [f"{release_docs_pr.DEPRECATED_FEATURES} has a {TODO_MARKER} marker"])


# ── The task: the marker in the open PR, the changelog's bullets, Claude only when there are none ──

class NoticeClaude(FakeClaude):
    def __init__(self):
        super().__init__(None)

    def ask_json(self, system, prompt, max_tokens=4000):
        self.prompts.append(prompt)
        return {"notices": [{"source": item["source"], "notice": f"Drafted for {item['title']}."}
                            for item in json.loads(prompt)]}


class FromMarkerTest(unittest.TestCase):
    def setUp(self):
        self.gh = FakeGitHub()
        self.gh.add_repo(SERVER, {})
        self.gh.pulls[SERVER] = [
            {"number": 204, "title": "Remove the old sidebar", "body": note("Removed the old sidebar."), "head": "x"},
            {"number": 205, "title": "Drop legacy exports", "body": note("NONE"), "head": "y"}]
        self.claude = NoticeClaude()

    def upgrade(self, body, reports=REPORTS, problem=None):
        target = types.SimpleNamespace(pr={"number": 300, "body": body} if body is not None else None)
        result = Result(release_docs_pr.TASK, "v12.2.0")
        with mock.patch.object(changelog_run, "fetch_reports", return_value=(reports, problem)), \
                mock.patch.object(cli, "changelog_entry", return_value=(ENTRY, "")), \
                mock.patch.object(self.gh, "pull", create=True,
                                  side_effect=lambda repo, n: next((p for p in self.gh.pulls[repo] if p["number"] == n), None)):
            return cli.upgrade_from_marker({}, self.gh, self.claude, Version.parse("v12.2.0"), target, result), result

    def test_no_pr_or_no_marker_leaves_the_placeholders_with_a_note(self):
        for body in (None, "No marker here."):
            docs, result = self.upgrade(body)
            self.assertIsNone(docs)
            self.assertIn("No confirmed breaking changes yet", result.notes[0])
        self.assertEqual(self.claude.prompts, [])

    def test_marker_prs_take_their_changelog_bullets_and_claude_drafts_only_the_rest(self):
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: 201, 204 -->")
        self.assertTrue(docs.complete)
        self.assertEqual([(e.source, e.text, e.drafted) for e in docs.notes], [
            (f"{SERVER}#201", "Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256.", False),
            (f"{SERVER}#204", "Drafted for Remove the old sidebar.", True)])
        [prompt] = self.claude.prompts
        self.assertEqual([item["source"] for item in json.loads(prompt)], [f"{SERVER}#204"])  # never #201: it has a bullet
        self.assertEqual(json.loads(prompt)[0]["release_note"], "Removed the old sidebar.")

    def test_every_marker_pr_with_a_bullet_means_no_claude_call(self):
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: 201 -->")
        self.assertEqual(self.claude.prompts, [])
        self.assertTrue(docs.complete)

    def test_a_notice_that_is_not_a_nonempty_string_is_no_notice(self):
        for notice in (None, 7, "  "):
            self.claude = FakeClaude({"notices": [{"source": f"{SERVER}#204", "notice": notice}]})
            docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: 204 -->")
            self.assertEqual(docs.notes, [], notice)
            self.assertIn(f"{SERVER}#204 is a confirmed breaking change with no changelog bullet", docs.todos[0])

    def test_without_claude_a_pr_with_no_bullet_is_a_missing_input(self):
        self.claude = None
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: 204 -->")
        self.assertFalse(docs.complete)
        self.assertIn("ANTHROPIC_API_KEY is not set", docs.todos[0])

    def test_a_malformed_marker_or_unreadable_bullets_keep_the_placeholders(self):
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: soon -->")
        self.assertEqual((docs.notes, docs.complete), ([], False))
        self.assertIn("so the confirmed breaking changes are unknown", docs.todos[0])
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: 201 -->", reports=[], problem="no run")
        self.assertIn("the changelog run's bullets could not be read (no run)", docs.todos[0])
        self.assertEqual(self.claude.prompts, [])

    def test_an_empty_marker_confirms_no_breaking_changes(self):
        docs, _ = self.upgrade("<!-- release-automation:confirmed-breaking: none -->")
        self.assertEqual((docs.notes, docs.complete), ([], True))


# ── The PR check: fails from T-2 ────────────────────────────────────────────────────

PLACEHOLDER_PAGE = "<tbody>\n{/* release-agent placeholder: v12.2 Important Upgrade Notes, filled in a later PR. */}\n"


class CheckFromTMinus2Test(unittest.TestCase):
    def test_before_t_minus_2_the_check_passes_with_a_note(self):
        problems = cli.release_docs_problems({release_docs_pr.UPGRADE_NOTES: PLACEHOLDER_PAGE})
        errors, notes = cli.release_docs_verdict(problems, date(2026, 12, 16), date(2026, 12, 11))
        self.assertEqual(errors, [])
        self.assertIn("Not failing yet: this check fails from T-2 (2026-12-14, Release Day 2026-12-16).", notes[0])

    def test_from_t_minus_2_it_fails(self):
        problems = cli.release_docs_problems({release_docs_pr.UPGRADE_NOTES: PLACEHOLDER_PAGE})
        for today in (date(2026, 12, 14), date(2026, 12, 16), date(2026, 12, 20)):
            errors, notes = cli.release_docs_verdict(problems, date(2026, 12, 16), today)
            self.assertEqual((len(errors), notes), (1, []), today)

    def test_no_release_day_fails_and_no_placeholder_passes(self):
        problems = cli.release_docs_problems({release_docs_pr.UPGRADE_NOTES: PLACEHOLDER_PAGE})
        self.assertEqual(cli.release_docs_verdict(problems, None, date(2026, 11, 1), "no due date")[0][-1], "no due date")
        self.assertEqual(cli.release_docs_verdict([], None, date(2026, 11, 1)), ([], []))

    def check(self, now, due="2026-12-16T00:00:00Z", head="release-agent/v12.2.0/release-docs"):
        gh = FakeGitHub()
        gh.milestone_list[SERVER] = [{"title": "v12.2.0", "due_on": due}]
        with tempfile.TemporaryDirectory() as root:
            for path in cli.UPGRADE_PAGES:
                os.makedirs(os.path.dirname(os.path.join(root, path)), exist_ok=True)
                with open(os.path.join(root, path), "w", encoding="utf-8") as f:
                    f.write(PLACEHOLDER_PAGE if path == release_docs_pr.UPGRADE_NOTES else "")
            out = io.StringIO()
            with redirect_stdout(out):
                code = cli.check_release_docs_pr({"REPO_ROOT": root, "HEAD_REF": head, "NOW": now}, gh)
        return code, out.getvalue()

    def test_the_check_command_reads_the_milestone_named_by_the_branch(self):
        code, out = self.check("2026-12-11")
        self.assertEqual(code, 0)
        self.assertIn("::notice title=Release docs::", out)
        code, out = self.check("2026-12-14T09:00:00+00:00")
        self.assertEqual(code, 1)
        self.assertIn("::error title=Release docs::", out)
        code, out = self.check("2026-12-11", due=None)
        self.assertEqual(code, 1)
        self.assertIn("no due date on the v12.2.0 milestone in mattermost/mattermost", out)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Regression tests for changelog merge, attribution, and bullet normalization."""

import os
import re
import sys
import unittest
from pathlib import Path

os.environ.setdefault("GITHUB_TOKEN", "test")
os.environ.setdefault("REPOS", "mattermost/mattermost")
os.environ.setdefault("MILESTONE", "v11.12.0")
os.environ.setdefault("VERSION", "v11.12.0")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_changelog as gc  # noqa: E402


V11_STYLE = """## Release v11.11 - [Feature Release](https://example.com) \\{#release-v11-11-feature-release}

### Upgrade Impact

#### config.json
New setting options were added to ``config.json``.
 - **Changes to Enterprise Advanced plan:**
   - Under ``AccessControlSettings`` in ``config.json``, added ``ExistingSetting``.
 - Removed ``LdapSettings.LoginButtonColor`` configuration setting from the database.

<Important>

If you upgrade from a release earlier than v11.10, read the upgrade notes.

</Important>

### Improvements
See [this blog post](https://example.com) on the highlights in our latest release.

#### User Interface
 - Existing interface item.

### Bug Fixes
 - Fixed an issue where the sidebar kept its old state.
"""

TWO_SPACE = """## Release v11.9 - [Feature Release](https://example.com) \\{#release-v11-9-feature-release}

### Upgrade Impact

#### config.json
New setting options were added to ``config.json``.
  - **Changes to All plans:**
    - Under ``AccessControlSettings`` in ``config.json``, added ``ExistingSetting``.
  - Removed ``LdapSettings.LoginButtonColor`` configuration setting from the database.

<Important>

If you upgrade from a release earlier than v11.8, read the upgrade notes.

</Important>

### Improvements
See [this blog post](https://example.com) on the highlights in our latest release.
"""

FRAGMENT = """### Upgrade Impact
#### config.json
 - **Changes to Enterprise Advanced plan:**
   - Under ``AccessControlSettings`` in ``config.json``, added ``BrandNewSetting``.
 - **Changes to Professional plan:**
   - Under ``ServiceSettings`` in ``config.json``, added ``AnotherSetting``.
 - Removed ``TeamSettings.OldSetting`` configuration setting from the database.

#### Important Upgrade Notes
 - Updated minimum Firefox version to 140.

### Bug Fixes
 - Fixed an issue where the sidebar failed to refresh.
"""


def _between(text: str, start: str, end: str) -> str:
    return text[text.find(start):text.find(end)]


class MergePlacementTest(unittest.TestCase):
    def test_new_config_bullets_stay_above_important(self):
        merged = gc.merge_into_entry(V11_STYLE, "v11.11", FRAGMENT)
        config = _between(merged, "#### config.json", "### Improvements")

        self.assertLess(config.find("BrandNewSetting"), config.find("<Important>"))
        self.assertLess(config.find("AnotherSetting"), config.find("<Important>"))
        self.assertLess(config.find("TeamSettings.OldSetting"), config.find("<Important>"))
        self.assertLess(config.find("#### Important Upgrade Notes"), config.find("<Important>"))
        self.assertLess(merged.find("</Important>"), merged.find("### Improvements"))
        self.assertEqual(config.count("**Changes to Enterprise Advanced plan:**"), 1)
        self.assertIn("ExistingSetting", config)
        self.assertIn("sidebar failed to refresh", merged)
        self.assertIn("sidebar kept its old state", merged)

    def test_upgrade_notes_merge_into_an_older_entry_s_compatibility_section(self):
        entry = V11_STYLE.replace("\n<Important>", "#### Compatibility\n - Existing note.\n\n<Important>", 1)
        merged = gc.merge_into_entry(entry, "v11.11", FRAGMENT)
        self.assertNotIn("#### Important Upgrade Notes", merged)
        self.assertIn("#### Compatibility\n - Existing note.\n - Updated minimum Firefox version to 140.", merged)
        self.assertLess(merged.find("Firefox"), merged.find("<Important>"))

    def test_two_space_plan_label_is_reused(self):
        fragment = """### Upgrade Impact
#### config.json
 - **Changes to All plans:**
   - Under ``FileSettings`` in ``config.json``, added ``NewTwoSpaceTest``.
 - Removed ``ServiceSettings.Gone`` configuration setting from the database.
"""
        merged = gc.merge_into_entry(TWO_SPACE, "v11.9", fragment)
        config = _between(merged, "#### config.json", "### Improvements")

        self.assertEqual(config.count("**Changes to All plans:**"), 1)
        label = config.find("**Changes to All plans:**")
        setting = config.find("NewTwoSpaceTest")
        removed = config.find("ServiceSettings.Gone")
        important = config.find("<Important>")
        self.assertTrue(label < setting < important)
        self.assertTrue(label < removed < important)
        # The existing label line is unchanged, including its two-space indent.
        self.assertIn("  - **Changes to All plans:**", merged)
        setting_line = next(line for line in merged.split("\n") if "NewTwoSpaceTest" in line)
        label_line = next(line for line in merged.split("\n") if "**Changes to All plans:**" in line)
        self.assertGreater(gc._bullet_indent(setting_line), gc._bullet_indent(label_line))

    def test_schema_change_nests_under_summary_and_flattens_a_flat_list(self):
        nested = """## Release v11.11 - x

### Upgrade Impact
#### Database Schema Changes
 - The following schema changes are included in the v11.11 release.
   - Added a ``Foo`` column.

### Bug Fixes
 - Kept.
"""
        fragment = """### Upgrade Impact
#### Database Schema Changes
 - The following schema changes are included in the v11.11 release. No database downtime is expected.
   - Added a ``NewTable`` table.
"""
        merged = gc.merge_into_entry(nested, "v11.11", fragment)
        self.assertEqual(merged.count("The following schema changes"), 1)
        self.assertLess(merged.find("Foo"), merged.find("NewTable"))
        self.assertLess(merged.find("NewTable"), merged.find("### Bug Fixes"))

        flat = """## Release v12.0 - x

### Upgrade Impact
#### Database Schema Changes
 - Added a ``Foo`` column.
 - Added a ``Bar`` index.
"""
        merged = gc.merge_into_entry(flat, "v12.0", fragment.replace("v11.11", "v12.0"))
        self.assertNotIn("The following schema changes", merged)
        self.assertLess(merged.find("Bar"), merged.find("NewTable"))


class FragmentMergedTest(unittest.TestCase):
    def test_schema_summary_folded_into_a_reworded_one_is_not_lost(self):
        entry = """## Release v12.1 - x

### Upgrade Impact
#### Database Schema Changes
 - A reviewer reworded this summary of the v12.1 schema changes.
   - Added a ``Foo`` column.

### Bug Fixes
 - Kept.
"""
        fragment = """### Upgrade Impact
#### Database Schema Changes
 - The following schema changes are included in the v12.1 release. No database downtime is expected.
   - Added the ``healthfindings`` table.
"""
        merged = gc.merge_into_entry(entry, "v12.1", fragment)
        self.assertNotIn("The following schema changes", merged)
        self.assertIn("healthfindings", merged)
        gc.require_fragment_merged(fragment, merged)

        with self.assertRaises(RuntimeError):
            gc.require_fragment_merged(fragment, entry)


class BulletMarkerTest(unittest.TestCase):
    def test_empty_headings_are_dropped(self):
        raw = ("### Upgrade Impact\n\n#### Database Schema Changes\n\n#### config.json\n - Added a setting.\n\n"
               "### Removed and Deprecated Features\n#### Deprecated\n\n"
               "### Improvements\nSee BLOG_POST_LINK on the highlights.\n#### User Interface\n - Added a page.\n"
               "#### Performance\n\n### Go Version\n")
        self.assertEqual(gc.normalize_formatting(raw),
                         "### Upgrade Impact\n\n#### config.json\n - Added a setting.\n\n"
                         "### Improvements\nSee BLOG_POST_LINK on the highlights.\n#### User Interface\n - Added a page.\n"
                         "### Go Version\n")

    def test_star_and_plus_bullets_become_dashes_and_are_inserted(self):
        normalized = gc.normalize_formatting("* Fixed an issue where the toast never dismissed.\n  * Nested detail.\n+ Added a setting.\n")
        self.assertNotIn("\n* ", "\n" + normalized)
        self.assertNotIn("+ ", normalized)
        self.assertIn(" - Fixed an issue where the toast never dismissed.", normalized)
        self.assertIn("   - Nested detail.", normalized)

        entry = """## Release v11.12 - x

### Bug Fixes
 - Kept.
"""
        merged = gc.merge_into_entry(entry, "v11.12", "### Bug Fixes\n" + normalized)
        self.assertIn("toast never dismissed", merged)
        self.assertIn("Nested detail", merged)
        self.assertIn("Added a setting", merged)
        self.assertNotRegex(merged, r"^\* ", "star bullets must not survive into the entry")


class AttributionTest(unittest.TestCase):
    def test_multiline_raw_note_keeps_its_marker(self):
        raw = gc._raw_bullets([{
            "id": "N1",
            "text": "Fixed deeplink routing\nfor mobile clients",
        }])
        cleaned, items, referenced = gc.extract_source_markers(
            gc.escape_mdx_unsafe(gc.normalize_formatting(raw)),
            {"N1": "mattermost/mattermost#1"},
        )
        self.assertEqual(referenced, {"N1"})
        self.assertNotIn("[[N1]]", cleaned)
        self.assertIn("for mobile clients", cleaned)
        self.assertEqual(items[0]["sources"], ["mattermost/mattermost#1"])

    def test_several_markers_on_one_bullet_attribute_it_to_each_note(self):
        sources = {"N1": "mattermost/mattermost#1", "N2": "mattermost/mattermost#2", "N3": "mattermost/mattermost#3"}
        text = "### Bug Fixes\n - Fixed two related issues. [[N1]][[N2]]\n - Fixed another. [[N3, N3]]\n"
        cleaned, items, referenced = gc.extract_source_markers(text, sources)
        self.assertEqual(referenced, {"N1", "N2", "N3"})
        self.assertNotIn("[[", cleaned)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["sources"], ["mattermost/mattermost#1", "mattermost/mattermost#2"])

    def test_dropped_note_is_listed_and_its_pr_is_not_recorded(self):
        notes = [{"id": "N1", "source": "mattermost/mattermost#1", "text": "a"},
                 {"id": "N2", "source": "mattermost/mattermost#2", "text": "b"}]
        sources = {n["id"]: n["source"] for n in notes}
        self.assertEqual([n["id"] for n in gc.dropped_notes(notes, {"N1"})], ["N2"])
        self.assertEqual(gc.unattributed_sources(sources, {"N1"}), ["mattermost/mattermost#2"])
        self.assertEqual(gc._sources_of(sources, {"N1"}), {"mattermost/mattermost#1"})

    def test_a_recorded_pr_with_no_bullet_refuses_the_run(self):
        items = [{"sources": ["mattermost/mattermost#1"]}]
        gc.require_recorded_sources_placed({"mattermost/mattermost#1"}, items)
        with self.assertRaises(RuntimeError) as caught:
            gc.require_recorded_sources_placed({"mattermost/mattermost#1", "mattermost/mattermost#2"}, items)
        self.assertIn("mattermost/mattermost#2", str(caught.exception))

    def test_not_placed_block_is_rebuilt_each_run_and_removed_when_empty(self):
        dropped = [{"source": "mattermost/mattermost#2", "text": "Fixed `x`\nlater"}]
        body = gc.render_not_placed("Body\n", dropped)
        self.assertIn("- [ ] `mattermost/mattermost#2`: Fixed 'x' later", body)
        again = gc.render_not_placed(body, dropped)
        self.assertEqual(again.count("<!-- changelog-not-placed -->"), 1)
        self.assertEqual(again.count("Fixed 'x' later"), 1)
        # PR #2 isn't recorded, so the next run sends its note again: nothing to carry over.
        self.assertNotIn("not-placed", gc.render_not_placed(body, []))

    def test_a_recorded_prs_unplaced_note_stays_listed_until_ticked(self):
        # PR #1's other note was placed, so it's recorded and never sent again: the list is the
        # only place its dropped note is remembered.
        dropped = [{"source": "mattermost/mattermost#1", "text": "Second note of PR 1."}]
        recorded = {"mattermost/mattermost#1"}
        body = gc.render_not_placed("Body\n", dropped, recorded)
        kept = gc.render_not_placed(body, [], recorded)
        self.assertIn("- [ ] `mattermost/mattermost#1`: Second note of PR 1.", kept)
        ticked = kept.replace("- [ ] `mattermost/mattermost#1`", "- [x] `mattermost/mattermost#1`")
        self.assertNotIn("not-placed", gc.render_not_placed(ticked, [], recorded))
        # PR #2's note was listed while #2 wasn't recorded; this run sent it again and placed
        # it, so #2 is now recorded: the stale item must not be carried over.
        placed_later = gc.render_not_placed("Body\n", [{"source": "mattermost/mattermost#2", "text": "Fixed x."}])
        self.assertNotIn("not-placed", gc.render_not_placed(placed_later, [], {"mattermost/mattermost#2"},
                                                            {"mattermost/mattermost#2"}))
        # A list written before the checkboxes is carried over too.
        old = body.replace("- [ ] `", "- `")
        self.assertIn("- [ ] `mattermost/mattermost#1`: Second note of PR 1.", gc.render_not_placed(old, [], recorded))


NOTE_BODY = "#### Summary\nx\n\n#### Release Note\n```release-note\nAdded a thing.\n```\n"
NONE_BODY = "#### Summary\nx\n\n#### Release Note\n<!-- Write NONE if not needed -->\n```release-note\nNONE\n```\n"
EMPTY_TEMPLATE_BODY = "#### Summary\nx\n\n#### Release Note\n<!-- Write NONE if no release note is needed -->\n```release-note\n\n```\n"


class ReleaseNoteFlagTest(unittest.TestCase):
    def test_status(self):
        self.assertEqual(gc.release_note_status(NOTE_BODY), "notes")
        self.assertEqual(gc.release_note_status(NONE_BODY), "none")
        self.assertEqual(gc.release_note_status(EMPTY_TEMPLATE_BODY), "missing")
        self.assertEqual(gc.release_note_status("Just a summary."), "missing")
        self.assertEqual(gc.release_note_status(""), "missing")

    def test_flags(self):
        self.assertIsNone(gc.flag_reason("notes", {"release-note"}))
        self.assertIsNone(gc.flag_reason("none", set()))
        self.assertIsNone(gc.flag_reason("missing", {"release-note-none"}))
        self.assertIn("no release-note-none label", gc.flag_reason("missing", set()))
        self.assertIn("labelled release-note", gc.flag_reason("none", {"release-note"}))
        self.assertIsNone(gc.flag_reason("missing", {"release-note", "Changelog/Not Needed"}))

    def test_extraction_rules(self):
        template = (
            "#### Release Note\n<!--\n```release-note\nNONE\n```\n```release-note\n"
            "Example note.\n```\n-->\n"
        )
        self.assertIsNone(gc.extract_release_notes(template))
        self.assertEqual(gc.release_note_status(template), "missing")
        spinwick = NOTE_BODY + "\nSpinwick creation command:\n```\n/spinwick create\n```\n"
        self.assertEqual(gc.extract_release_notes(spinwick), ["Added a thing."])
        self.assertIsNone(gc.extract_release_notes("#### Release Note\n```\nATTACHMENTS_OMITTED.txt\n```\n"))
        self.assertEqual(gc.extract_release_notes("Summary.\n\n```release-note\nAdded a thing.\n```"), ["Added a thing."])
        self.assertEqual(gc.extract_release_notes("## Release Notes\n```release-note\nAdded a thing.\n```"), ["Added a thing."])
        for empty in ("NONE", "N/A", "---", ""):
            self.assertIsNone(gc.extract_release_notes(f"```release-note\n{empty}\n```"))
        self.assertEqual(gc.release_note_status("```release-note\nN/A\n```"), "none")
        self.assertEqual(gc.release_note_status("#### Release Note\nNONE\n"), "none")

    def test_note_quality(self):
        self.assertEqual(
            gc.note_quality_issue("Added ``AuditEventPostDelivered`` audit log event.\n🆕 New API file: `x_test.go`"),
            "machine-generated content",
        )
        self.assertEqual(
            gc.note_quality_issue("Added `DELETE /` (`deletePropertyFieldOptions`) API endpoint.\nAdded `GET /` (`getFoo`) API endpoint."),
            "an API endpoint with no path",
        )
        self.assertEqual(gc.note_quality_issue("Removed `` ``(`getFoo`) API endpoint."), "an API endpoint with no path")
        self.assertIsNone(gc.note_quality_issue("Added `DELETE /properties/groups/{group_name}/fields` (`deleteFields`) API endpoint."))
        self.assertEqual(gc.note_quality_issue("MM-12345"), "a bare ticket reference")
        self.assertEqual(gc.note_quality_issue("Fixes #38201."), "a bare ticket reference")
        self.assertEqual(gc.note_quality_issue("Enable Concurrent React features"), "under 6 words")
        self.assertIsNone(gc.note_quality_issue("Pre-packaged Jira plugin version [v5.0.0](https://example.com)."))
        self.assertIsNone(gc.note_quality_issue("Added ``fflate``."))
        self.assertIsNone(gc.note_quality_issue("Fixed an issue where the sidebar kept its old state."))

    def test_owner_of_a_bot_pr_is_its_assignee(self):
        self.assertEqual(gc.pr_owner({"user": {"login": "dev", "type": "User"}}), "dev")
        bot = {"user": {"login": "cursor[bot]", "type": "Bot"}, "assignees": [{"login": "hanzei"}]}
        self.assertEqual(gc.pr_owner(bot), "hanzei")
        self.assertIsNone(gc.pr_owner({"user": {"login": "unified-ci-app[bot]", "type": "Bot"}, "assignees": []}))
        self.assertEqual(
            gc.missing_by_owner([{"source": "a#1", "owner": None}, {"source": "a#2", "owner": "x"},
                                 {"source": "a#3", "owner": "y"}, {"source": "a#4", "owner": "y"}]),
            [{"owner": "y", "sources": ["a#3", "a#4"]}, {"owner": "x", "sources": ["a#2"]},
             {"owner": None, "sources": ["a#1"]}],
        )

    def test_gap_status_tells_unchecked_from_unchanged(self):
        derived = [{"source": "websocket:x@added"}, {"source": "websocket:y@removed"}, {"source": "migration:000230_x"}]
        gaps = {g["section"]: g for g in gc.gap_status(derived, True, "go1.26.10", "branch", "v1.26.10")}
        self.assertEqual(gaps["WebSocket events"]["detail"], "1 added, 1 removed")
        self.assertEqual(gaps["Database schema changes"]["status"], "ready")
        self.assertEqual(gaps["Pre-packaged plugins"]["status"], "no_changes_this_release")
        self.assertIn("unchanged from the previous entry", gaps["Go version"]["detail"])
        self.assertTrue(gaps["Benchmarking"]["blocks_publish"])
        unchecked = {g["section"]: g["status"] for g in gc.gap_status([], False, "", None, None)}
        self.assertEqual(set(unchecked.values()), {"not_yet_checked"})

    def test_docs_line_is_split_from_the_note(self):
        site = "https://docs.mattermost.com"
        self.assertEqual(gc.split_docs_line("Added a thing.\nDocs: https://docs.mattermost.com/a/b#c"),
                         ("Added a thing.", f"{site}/a/b#c"))
        self.assertEqual(gc.split_docs_line("Added a thing.\n  docs: /a/b  "), ("Added a thing.", f"{site}/a/b"))
        self.assertEqual(gc.split_docs_line("Added a thing.\nDocs: [page](https://docs.mattermost.com/a)"),
                         ("Added a thing.", f"{site}/a"))
        self.assertEqual(gc.split_docs_line("Added a thing.\nDocs: N/A"), ("Added a thing.", None))
        self.assertEqual(gc.split_docs_line("Added a thing."), ("Added a thing.", None))

    def test_private_repo_links_say_so(self):
        private = ["mattermost/enterprise"]
        self.assertEqual(gc._pr_link("mattermost/enterprise#7", private),
                         "[mattermost/enterprise#7](https://github.com/mattermost/enterprise/pull/7) (private repo)")
        self.assertEqual(gc._pr_link("mattermost/mattermost#7", private),
                         "[mattermost/mattermost#7](https://github.com/mattermost/mattermost/pull/7)")
        self.assertEqual(gc._pr_link("plugin:mattermost-plugin-calls@v1.12.6", private), "`plugin:mattermost-plugin-calls@v1.12.6`")

    def test_cherry_pick_origin(self):
        self.assertEqual(gc.cherry_picked_from("Automated cherry pick of #39121"), 39121)
        self.assertEqual(gc.cherry_picked_from("Cherry pick #38833 to release-12.1"), 38833)
        self.assertEqual(gc.cherry_picked_from("Bumping prepackaged Dataminr plugin version to v3.0.0 (#39291)"), 39291)
        self.assertIsNone(gc.cherry_picked_from("Fix #123 in the sidebar"))


class SeedTest(unittest.TestCase):
    def test_seed_includes_prs_merged_before_the_pr_was_opened_and_derived_notes(self):
        notes = [
            {"source": "mattermost/mattermost#1", "merged_at": "2026-10-19T10:00:00Z"},
            {"source": "mattermost/mattermost#2", "merged_at": "2026-10-21T10:00:00Z"},
            {"source": "mattermost/mattermost#3", "merged_at": None},
            {"source": "plugin:mattermost-plugin-calls@v1.12.6", "derived": True},
        ]
        self.assertEqual(
            gc.seed_sources(notes, "2026-10-20T05:50:50Z"),
            {"mattermost/mattermost#1", "plugin:mattermost-plugin-calls@v1.12.6"},
        )


ENTRY_V12_1 = """## Release v12.1 - [Feature Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types) \\{#release-v12-1-feature-release}

**Release day: 2026-11-13**

### Upgrade Impact

<Important>

If you upgrade from a release earlier than v12.0, please read the other [Important Upgrade Notes](https://docs.mattermost.com/administration-guide/upgrade/important-upgrade-notes.html). In case of an upgrade failure, please check the [Downgrade Guide](https://docs.mattermost.com/administration-guide/upgrade/downgrading-mattermost-server.html) and the [Recovery Guide](https://docs.mattermost.com/deployment-guide/backup-disaster-recovery.html) for rollback steps and interim mitigation strategy.

</Important>

### Improvements
See [this blog post](https://example.com) on the highlights in our latest release.

#### User Interface
 - A reviewer rewrote this bullet completely.

#### Performance
 - Benchmarking test results: TBD. Added by the changelog workflow once the v12.1 performance comparison is published.

### Bug Fixes
 - Fixed an issue that was already here.

### Go Version
 - v12.1 is built with Go ``v1.27.1``.
"""


class MainTest(unittest.TestCase):
    """main() end to end, with the GitHub API and git stubbed."""

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.changelog = self.tmp / "mattermost-v12-changelog.mdx"
        self.out = self.tmp / "out"
        self.saved = {
            name: getattr(gc, name)
            for name in ("get_milestone_number", "repo_is_private", "docs_site", "get_merged_prs", "get_pr_details", "polish_with_ai", "place_missing_with_ai", "VERSION", "MILESTONE_TITLE", "REPOS")
        }
        self.saved_derived = gc.changelog_release.derived_notes
        self.saved_show = gc.changelog_release.git_show
        self.saved_benchmark = gc.changelog_release.benchmark
        gc.changelog_release.benchmark = lambda version: {"notes": [], "gap": {
            "section": "Benchmarking", "status": "not_yet_checked", "blocks_publish": True,
            "detail": "no performance comparison published for v12.1 yet"}}
        self.saved_cut = gc.release_branch_cut
        gc.release_branch_cut = lambda ref: "2026-10-16T09:18:58Z"
        self.merged_since = {}
        self.saved_merged = gc.merged_prs_since
        gc.merged_prs_since = lambda repo, since: self.merged_since
        self.saved_env = dict(os.environ)
        gc.VERSION = gc.MILESTONE_TITLE = "v12.1.0"
        gc.REPOS = ["mattermost/mattermost"]
        gc.get_milestone_number = lambda repo, title: 7
        gc.repo_is_private = lambda repo: repo == "mattermost/enterprise"
        self.site_pages = {"docs/main/product-overview/release-policy.mdx": "## Release types\n"}
        gc.docs_site = lambda ref: gc.changelog_release.DocsSite(list(self.site_pages), self.site_pages.get)
        gc.get_merged_prs = lambda repo, number: self.prs
        self.details = {}
        gc.get_pr_details = lambda repo, number: self.details.get(number, {"head_ref": f"branch-{number}", "files": []})
        gc.changelog_release.derived_notes = lambda base, head: [
            {"source": "plugin:mattermost-plugin-calls@v1.12.6", "derived": True,
             "text": "Pre-packaged Calls plugin version [v1.12.6](https://example.com).",
             "fallback": "Pre-packaged Calls plugin version [v1.12.6](https://example.com)."},
        ] if base else []
        gc.changelog_release.git_show = lambda ref, path: "FROM golang:1.27.1-bookworm\n"
        os.environ.pop("ANTHROPIC_API_KEY", None)
        os.environ.update({
            "CHANGELOG_PATH": str(self.changelog), "OUTPUT_DIR": str(self.out),
            "RELEASE_DATE": "2026-11-13", "RELEASE_HEAD_REF": "origin/release-12.1",
            "RELEASE_BASE_REF": "v12.0.0", "GITHUB_OUTPUT": str(self.tmp / "gh_output"),
        })
        self.prs = [
            self._pr(1, NOTE_BODY.replace("Added a thing.", "Added the first thing."), "2026-10-19T10:00:00Z"),
            self._pr(2, NOTE_BODY.replace("Added a thing.", "Fixed an issue found later."), "2026-10-21T10:00:00Z"),
            self._pr(3, NONE_BODY, "2026-10-19T11:00:00Z", ["release-note-none"]),
            self._pr(4, EMPTY_TEMPLATE_BODY, "2026-10-19T12:00:00Z"),
            self._pr(5, EMPTY_TEMPLATE_BODY, "2026-10-19T13:00:00Z", ["release-note"]),
        ]
        self.prs[-1]["title"] = "Automated cherry pick of #1"

    def tearDown(self):
        for name, value in self.saved.items():
            setattr(gc, name, value)
        gc.changelog_release.derived_notes = self.saved_derived
        gc.changelog_release.git_show = self.saved_show
        gc.changelog_release.benchmark = self.saved_benchmark
        gc.release_branch_cut = self.saved_cut
        gc.merged_prs_since = self.saved_merged
        os.environ.clear()
        os.environ.update(self.saved_env)

    @staticmethod
    def _pr(number, body, merged_at, labels=()):
        return {
            "number": number, "title": f"PR {number}", "body": body,
            "user": {"login": f"dev{number}", "type": "User"}, "assignees": [],
            "labels": [{"name": label} for label in labels],
            "pull_request": {"merged_at": merged_at},
        }

    def _payload(self):
        import json
        return json.loads((self.out / "sections.json").read_text())

    def test_create_reads_go_version_derived_notes_and_flags(self):
        gc.main()
        content = self.changelog.read_text()
        payload = self._payload()
        self.assertIn("v12.1 is built with Go ``v1.27.1``.", content)
        self.assertIn("Pre-packaged Calls plugin version", content)
        self.assertNotIn("[[N", content)
        self.assertEqual(payload["schema_version"], 2)
        self.assertEqual(payload["derived_sources"], ["plugin:mattermost-plugin-calls@v1.12.6"])
        self.assertEqual([pr["source"] for pr in payload["prs_flagged"]], ["mattermost/mattermost#4"])
        self.assertEqual(payload["metrics"]["prs_merged"], 5)
        self.assertEqual(payload["metrics"]["prs_flagged"], 1)
        self.assertIn("plugin:mattermost-plugin-calls@v1.12.6", (self.out / "pr_body.md").read_text())
        summary = (self.out / "summary.md").read_text()
        self.assertIn("### Release notes: 2 of 5 merged PRs have one (40%)", summary)
        self.assertIn("⏳ Missing: 1, by owner", summary)
        self.assertIn("@dev4 (1): [mattermost/mattermost#4](https://github.com/mattermost/mattermost/pull/4)", summary)
        self.assertIn("2 PR(s) intentionally have no note.", summary)
        self.assertIn("✅ **Go version** (ready): v1.27.1 from origin/release-12.1", summary)
        self.assertIn("✅ **Pre-packaged plugins** (ready): 1 plugin(s) bumped or removed", summary)
        self.assertIn("➖ **WebSocket events** (no changes this release): none in the release diff", summary)
        self.assertIn("⏳ **Benchmarking** (not yet checked)", summary)
        self.assertIn("Generator status: ready to run", summary)
        self.assertIn("✅ **1 link(s)** (pass): every page and heading exists", summary)
        self.assertEqual(payload["readiness"]["missing_by_owner"], [{"owner": "dev4", "sources": ["mattermost/mattermost#4"]}])

        with self.assertRaises(RuntimeError) as caught:
            gc.main()
        self.assertIn("already has a v12.1 entry", str(caught.exception))
        os.environ["DRY_RUN"] = "true"
        gc.main()

    def test_release_day_is_tbd_on_a_scheduled_run_without_a_date(self):
        del os.environ["RELEASE_DATE"]
        os.environ["EVENT_NAME"] = "schedule"
        gc.main()
        self.assertIn("**Release day: TBD**", self.changelog.read_text())
        check = next(c for c in self._payload()["readiness"]["preflight"] if c["check"] == "Release day")
        self.assertEqual((check["status"], check["blocking"]), ("unknown", False))
        self.assertIn("Set the Release day line on the changelog PR before it merges.", (self.out / "summary.md").read_text())

        os.environ["EVENT_NAME"] = "workflow_dispatch"
        self.changelog.unlink()
        gc.main()
        self.assertIn(f"**Release day: {gc.date.today():%Y-%m-%d}**", self.changelog.read_text())
        self.assertNotIn("Release day", [c["check"] for c in self._payload()["readiness"]["preflight"]])

    def test_docs_link_is_sent_with_the_note_and_reported(self):
        self.details[1] = {"head_ref": "MM-123-feature", "files": [{
            "filename": "docs/main/administration-guide/manage/admin/feature.mdx", "status": "added",
            "patch": "+# Feature\n+\n+Use the feature.\n",
        }]}
        pages = {"docs/main/administration-guide/manage/admin/feature.mdx": "---\ntitle: Feature\n---\n# Feature\n"}
        gc.changelog_release.git_show = lambda ref, path: pages.get(path, "FROM golang:1.27.1-bookworm\n")
        self.site_pages.update(pages)
        sent = []

        def polish(notes):
            sent.extend(notes)
            url = next(n["docs_url"] for n in notes if n.get("docs_url"))
            return (f"### Improvements\n\n#### Administration\n - Added the [feature]({url}). [[N1]]\n"
                    " - Fixed an issue found later. [[N2]]\n - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3]]\n"), True
        gc.polish_with_ai = polish
        gc.main()
        url = "https://docs.mattermost.com/administration-guide/manage/admin/feature"
        self.assertEqual([n.get("docs_url") for n in sent], [url, None, None])
        self.assertIn(f"[feature]({url})", self.changelog.read_text())
        link = self._payload()["readiness"]["doc_links"][0]
        self.assertEqual(link["used_in"], ["Administration"])
        self.assertIn("changed in the same PR, which added the page", link["basis"])
        self.assertIn(f"is documented in [Feature]({url}) (linked in Administration)", (self.out / "summary.md").read_text())

    def test_docs_link_on_another_prs_bullet_moves_to_the_prs_own_bullet(self):
        self.details[1] = {"head_ref": "MM-123-feature", "files": [{
            "filename": "docs/main/administration-guide/manage/admin/feature.mdx", "status": "added",
            "patch": "+# Feature\n+\n+Use the feature.\n",
        }]}
        pages = {"docs/main/administration-guide/manage/admin/feature.mdx": "---\ntitle: Feature\n---\n# Feature\n"}
        gc.changelog_release.git_show = lambda ref, path: pages.get(path, "FROM golang:1.27.1-bookworm\n")
        self.site_pages.update(pages)

        def polish(notes):
            url = next(n["docs_url"] for n in notes if n.get("docs_url"))
            return (f"### Improvements\n\n#### Administration\n - Added the feature. [[N1]]\n"
                    f" - Extended the [feature]({url}). [[N2]]\n - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3]]\n"), True
        gc.polish_with_ai = polish
        gc.main()
        url = "https://docs.mattermost.com/administration-guide/manage/admin/feature"
        content = self.changelog.read_text()
        self.assertIn(f" - Added the feature. See the [Feature]({url}) documentation for details.\n", content)
        self.assertIn(" - Extended the feature.\n", content)
        self.assertEqual(content.count(url), 1)
        link = self._payload()["readiness"]["doc_links"][0]
        self.assertEqual((link["used_in"], link["linked_elsewhere"]), (["Administration"], []))
        self.assertNotIn("(no bullet links it)", (self.out / "summary.md").read_text())

    def test_a_docs_pr_outside_the_milestone_that_links_the_pr_gives_its_page(self):
        # Docs that land after the code: #900 is in no milestone and links #1.
        self.merged_since = {
            "mattermost/mattermost#900": {"title": "Docs for the feature", "body": "Documents https://github.com/mattermost/mattermost/pull/1."},
            "mattermost/mattermost#901": {"title": "MM-123 other docs", "body": "Unrelated."},  # a Jira key alone is not enough
        }
        self.details[900] = {"head_ref": "docs-feature", "files": [{
            "filename": "docs/main/administration-guide/manage/admin/feature.mdx", "status": "added",
            "patch": "+# Feature\n+\n+Use the feature.\n"}]}
        self.details[901] = {"head_ref": "MM-123-docs", "files": [{
            "filename": "docs/main/administration-guide/manage/admin/other.mdx", "status": "added", "patch": "+# Other\n"}]}
        self.prs[0]["head_ref"] = "MM-123-feature"
        pages = {"docs/main/administration-guide/manage/admin/feature.mdx": "---\ntitle: Feature\n---\n# Feature\n",
                 "docs/main/administration-guide/manage/admin/other.mdx": "---\ntitle: Other\n---\n# Other\n"}
        gc.changelog_release.git_show = lambda ref, path: pages.get(path, "FROM golang:1.27.1-bookworm\n")
        self.site_pages.update(pages)
        gc.main()
        link, = self._payload()["readiness"]["doc_links"]
        self.assertEqual((link["source"], link["url"]),
                         ("mattermost/mattermost#1", "https://docs.mattermost.com/administration-guide/manage/admin/feature"))
        self.assertIn("docs PR mattermost/mattermost#900, which links the PR (outside the milestone)", link["basis"])

    def test_docs_line_outranks_the_followed_page_and_is_checked(self):
        self.details[1] = {"head_ref": "MM-123-feature", "files": [{
            "filename": "docs/main/administration-guide/manage/admin/feature.mdx", "status": "added",
            "patch": "+# Feature\n+\n+Use the feature.\n",
        }]}
        pages = {
            "docs/main/administration-guide/manage/admin/feature.mdx": "---\ntitle: Feature\n---\n# Feature\n",
            "docs/main/end-user-guide/named.mdx": "---\ntitle: Named page\n---\n## Turn it on\n",
        }
        gc.changelog_release.git_show = lambda ref, path: pages.get(path, "FROM golang:1.27.1-bookworm\n")
        self.site_pages.update(pages)
        self.prs[0]["body"] = NOTE_BODY.replace("Added a thing.", "Added the first thing.\nDocs: /end-user-guide/named#turn-it-on")
        self.prs[1]["body"] = NOTE_BODY.replace("Added a thing.", "Fixed an issue found later.\nDocs: /end-user-guide/named#gone")
        sent = []

        def polish(notes):
            sent.extend(notes)
            return "### Improvements\n\n#### Administration\n" + "".join(f" - {n['text']} [[{n['id']}]]\n" for n in notes), True
        gc.polish_with_ai = polish
        gc.main()
        named = "https://docs.mattermost.com/end-user-guide/named#turn-it-on"
        self.assertEqual([n["text"] for n in sent][:2], ["Added the first thing.", "Fixed an issue found later."])
        self.assertEqual([n.get("docs_url") for n in sent][:2], [named, None])
        readiness = self._payload()["readiness"]
        self.assertEqual(readiness["doc_links"], [{
            "source": "mattermost/mattermost#1", "url": named, "title": "Named page",
            "basis": "named on the Docs: line of the PR's release note", "used_in": ["Administration"], "linked_elsewhere": [],
        }])
        self.assertEqual(readiness["doc_links_named_broken"][0]["source"], "mattermost/mattermost#2")
        self.assertNotIn("Docs:", self.changelog.read_text())
        summary = (self.out / "summary.md").read_text()
        self.assertIn("❌ **Docs: line of [mattermost/mattermost#2](https://github.com/mattermost/mattermost/pull/2)** (fail)", summary)

    def test_broken_docs_link_in_the_generated_text_is_reported(self):
        gc.polish_with_ai = lambda notes: ((
            "### Improvements\n\n#### Administration\n"
            " - Added [a thing](https://docs.mattermost.com/product-overview/release-policy#no-such-heading). [[N1]]\n"
            " - Fixed an issue found later. [[N2]]\n - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3]]\n"
        ), True)
        gc.main()
        broken = self._payload()["readiness"]["broken_links"]
        self.assertEqual([b["url"] for b in broken],
                         ["https://docs.mattermost.com/product-overview/release-policy#no-such-heading"])
        self.assertIn("❌ **https://docs.mattermost.com/product-overview/release-policy#no-such-heading** (fail): "
                      "docs/main/product-overview/release-policy.mdx has no heading or id that gives #no-such-heading",
                      (self.out / "summary.md").read_text())

    def test_unreadable_repo_is_reported_as_unknown_not_missing(self):
        import requests
        gc.REPOS = ["mattermost/mattermost", "mattermost/enterprise"]
        real_lookup = gc.get_milestone_number

        def lookup(repo, title):
            if repo == "mattermost/enterprise":
                response = requests.Response()
                response.status_code = 404
                raise requests.HTTPError(response=response)
            return real_lookup(repo, title)
        gc.get_milestone_number = lookup
        gc.main()
        payload = self._payload()
        self.assertEqual(payload["readiness"]["repos_unaudited"],
                         [{"repo": "mattermost/enterprise", "reason": "HTTP 404 for the workflow token"}])
        summary = (self.out / "summary.md").read_text()
        self.assertIn("❔ **milestone in mattermost/enterprise** (unknown)", summary)
        self.assertIn("❔ Not audited: `mattermost/enterprise`", summary)

        gc.REPOS = ["mattermost/enterprise"]
        with self.assertRaises(RuntimeError):
            gc.main()

    def test_rate_limit_fails_the_run_instead_of_skipping_the_repo(self):
        import requests
        gc.REPOS = ["mattermost/mattermost", "mattermost/enterprise"]
        for headers in ({"X-RateLimit-Remaining": "0"}, {"Retry-After": "60"}):
            def lookup(repo, title, headers=headers):
                response = requests.Response()
                response.status_code = 403
                response.headers.update(headers)
                raise requests.HTTPError(response=response)
            gc.get_milestone_number = lookup
            with self.assertRaises(requests.HTTPError):
                gc.main()

    def test_blocking_preflight_still_writes_the_status(self):
        self.changelog.write_text("---\ntitle: v12\n---\nSome text but no header marker and no entries.\n")
        gc.get_milestone_number = lambda repo, title: None
        with self.assertRaises(RuntimeError) as caught:
            gc.main()
        self.assertIn("Preflight failed", str(caught.exception))
        summary = (self.out / "summary.md").read_text()
        self.assertIn("❌ **mattermost-v12-changelog.mdx** (fail): neither the header marker", summary)
        self.assertIn("❌ **milestone in mattermost/mattermost** (fail): no v12.1.0 milestone", summary)
        self.assertIn("Generator status: NOT READY (preflight failing)", summary)
        self.assertFalse((self.out / "sections.json").exists())

    def test_empty_proposal_still_asks_for_the_list(self):
        self.changelog.write_text(gc.CHANGELOG_HEADER_TEMPLATE.format(major=12) + "\n\n" + ENTRY_V12_1)
        body = self.tmp / "body.md"
        body.write_text("Auto-generated changelog.")
        os.environ.update({
            "MODE": "update", "PR_BODY_FILE": str(body), "RELEASE_BASE_REF": "",
            "SOURCES_SEED_BEFORE": "2026-01-01T00:00:00Z",
        })
        gc.main()
        payload = self._payload()
        self.assertEqual(payload["proposed_sources"], [])
        self.assertEqual((self.out / "pr_body.md").read_text(), "Auto-generated changelog.")
        summary = (self.out / "summary.md").read_text()
        self.assertIn("Action needed: confirm the changelog sources", summary)
        self.assertIn("<!-- changelog-sources:  -->", summary)
        self.assertNotIn("No new release notes", summary)
        self.assertEqual(gc.parse_sources_comment("<!-- changelog-sources:  -->"), set())

    def test_update_proposes_sources_for_a_pr_opened_before_source_tracking(self):
        self.changelog.write_text(gc.CHANGELOG_HEADER_TEMPLATE.format(major=12) + "\n\n" + ENTRY_V12_1)
        body = self.tmp / "body.md"
        original_body = "Auto-generated changelog for milestone `v12.1.0`."
        body.write_text(original_body)
        os.environ.update({"MODE": "update", "PR_BODY_FILE": str(body)})

        with self.assertRaises(RuntimeError):
            gc.main()
        self.assertIn("A reviewer rewrote this bullet completely.", self.changelog.read_text())

        # The inferred list is only proposed: nothing is written and the body is unchanged.
        os.environ["SOURCES_SEED_BEFORE"] = "2026-10-20T05:50:50Z"
        before = self.changelog.read_text()
        gc.main()
        payload = self._payload()
        self.assertEqual(self.changelog.read_text(), before)
        self.assertEqual((self.out / "pr_body.md").read_text(), original_body)
        self.assertFalse(payload["changed"])
        self.assertEqual(payload["sources_added"], [])
        self.assertEqual(payload["proposed_before"], "2026-10-20T05:50:50Z")
        self.assertEqual(payload["proposed_sources"], [
            "mattermost/mattermost#1", "plugin:mattermost-plugin-calls@v1.12.6",
        ])
        summary = (self.out / "summary.md").read_text()
        self.assertIn("Action needed: confirm the changelog sources", summary)
        proposal = gc.render_pr_body("", set(payload["proposed_sources"])).strip()
        self.assertIn(proposal, summary)

        # A reviewer confirms the list and adds it to the body.
        body.write_text(original_body + "\n\n" + proposal + "\n")
        with self.assertRaises(RuntimeError) as caught:
            gc.main()
        self.assertIn("no section to be merged into", str(caught.exception))
        self.assertEqual(self.changelog.read_text(), before)

        gc.polish_with_ai = lambda notes: (
            "### Bug Fixes\n" + "\n".join(f" - {n['text']} [[{n['id']}]]" for n in notes), True
        )
        gc.main()
        after = self.changelog.read_text()
        payload = self._payload()

        self.assertEqual(payload["sources_added"], ["mattermost/mattermost#2"])
        self.assertEqual(payload["derived_sources"], ["plugin:mattermost-plugin-calls@v1.12.6"])
        self.assertEqual(payload["metrics"]["derived_changes"], 0)
        self.assertEqual(payload["proposed_sources"], [])
        self.assertIn("Fixed an issue found later.", after)
        self.assertNotIn("Added the first thing.", after)
        self.assertEqual(after.count("Pre-packaged Calls plugin"), 0)
        before_lines = before.split("\n")
        self.assertTrue(all(line in after.split("\n") for line in before_lines), "update must only insert")
        recorded = gc.parse_sources_comment((self.out / "pr_body.md").read_text())
        self.assertEqual(recorded, {
            "mattermost/mattermost#1", "mattermost/mattermost#2",
            "plugin:mattermost-plugin-calls@v1.12.6",
        })

        body.write_text((self.out / "pr_body.md").read_text())
        gc.main()
        self.assertEqual(self.changelog.read_text(), after)
        self.assertFalse(self._payload()["changed"])

    def _update_with(self, entry, sources):
        self.changelog.write_text(gc.CHANGELOG_HEADER_TEMPLATE.format(major=12) + "\n" + entry)
        body = self.tmp / "body.md"
        body.write_text(gc.render_pr_body("Changelog.", set(sources)))
        os.environ.update({"MODE": "update", "PR_BODY_FILE": str(body)})
        gc.main()
        return self.changelog.read_text(), self._payload()

    def test_update_follows_a_go_bump_on_the_release_branch(self):
        prs = ["mattermost/mattermost#1", "mattermost/mattermost#2", "plugin:mattermost-plugin-calls@v1.12.6"]
        content, payload = self._update_with(ENTRY_V12_1.replace("v1.27.1", "v1.26.10"), prs)
        self.assertIn("v12.1 is built with Go ``v1.27.1``.", content)
        self.assertNotIn("v1.26.10", content)
        self.assertTrue(payload["changed"])
        self.assertEqual(payload["sections"], [{"section": "Go Version", "subsection": None, "items": [
            {"text": "v12.1 is built with Go ``v1.27.1``.", "sources": []}]}])
        gap = next(g for g in payload["readiness"]["gaps"] if g["section"] == "Go version")
        self.assertEqual(gap["status"], "ready")
        self.assertIn("the entry said v1.26.10; updated", gap["detail"])

        content, payload = self._update_with(ENTRY_V12_1.replace(" - v12.1 is built with Go ``v1.27.1``.\n", ""), prs)
        self.assertFalse(payload["changed"])
        gap = next(g for g in payload["readiness"]["gaps"] if g["section"] == "Go version")
        self.assertEqual(gap["status"], "needs_review")
        self.assertIn("⚠️ **Go version** (needs a reviewer)", (self.out / "summary.md").read_text())

    def test_update_replaces_a_plugin_version_bumped_again_since_the_last_run(self):
        old = "[v1.12.5](https://github.com/mattermost/mattermost-plugin-calls/releases/tag/v1.12.5)"
        new = "[v1.12.6](https://github.com/mattermost/mattermost-plugin-calls/releases/tag/v1.12.6)"
        entry = ENTRY_V12_1.replace(
            "### Go Version", f"### Open Source Components\n - Reviewer wording for Calls {old}, kept.\n\n### Go Version")
        prs = ["mattermost/mattermost#1", "mattermost/mattermost#2", "plugin:mattermost-plugin-calls@v1.12.5"]
        content, payload = self._update_with(entry, prs)
        self.assertIn(f" - Reviewer wording for Calls {new}, kept.", content)
        self.assertNotIn("v1.12.5", content)
        self.assertEqual(content.count("mattermost-plugin-calls"), 1)
        recorded = gc.parse_sources_comment((self.out / "pr_body.md").read_text())
        self.assertIn("plugin:mattermost-plugin-calls@v1.12.6", recorded)
        self.assertNotIn("plugin:mattermost-plugin-calls@v1.12.5", recorded)
        self.assertEqual(payload["sections"][0]["section"], "Open Source Components")
        self.assertEqual(payload["metrics"]["bullets_corrected"], 1)
        self.assertEqual(payload["readiness"]["reconciled"][0]["status"], "replaced")

    def test_update_leaves_an_ambiguous_plugin_bullet_for_a_reviewer(self):
        entry = ENTRY_V12_1.replace(
            "### Go Version", "### Open Source Components\n - Calls was rewritten without its link.\n\n### Go Version")
        prs = ["mattermost/mattermost#1", "mattermost/mattermost#2",
               "plugin:mattermost-plugin-calls@v1.12.5", "websocket:gone@added"]
        content, payload = self._update_with(entry, prs)
        self.assertNotIn("v1.12.6", content)
        self.assertFalse(payload["changed"])
        recorded = gc.parse_sources_comment((self.out / "pr_body.md").read_text())
        self.assertEqual(recorded, set(prs))
        results = {item["source"]: item for item in payload["readiness"]["reconciled"]}
        self.assertEqual({item["status"] for item in results.values()}, {"needs_review"})
        self.assertIn("replace `plugin:mattermost-plugin-calls@v1.12.5` with `plugin:mattermost-plugin-calls@v1.12.6`",
                      results["plugin:mattermost-plugin-calls@v1.12.5"]["remedy"])
        self.assertIn("no longer in the release diff", results["websocket:gone@added"]["detail"])
        self.assertEqual(payload["metrics"]["bullets_needing_review"], 2)

    def test_update_adds_the_benchmarking_sentence_once_the_report_appears(self):
        sentence = ("Benchmarking test results showed no significant difference: a 0.18% decrease in the number of "
                    "supported users for the new release.")
        gc.changelog_release.benchmark = lambda version: {
            "notes": [{"source": "benchmark:v12.1", "text": sentence, "fallback": sentence, "derived": True}],
            "gap": {"section": "Benchmarking", "status": "ready", "detail": "-0.18%", "blocks_publish": False}}
        prs = ["mattermost/mattermost#1", "mattermost/mattermost#2", "plugin:mattermost-plugin-calls@v1.12.6"]
        content, payload = self._update_with(ENTRY_V12_1, prs)
        self.assertIn(f"#### Performance\n - {sentence}\n", content)
        self.assertNotRegex(content, gc.BENCHMARK_PENDING_RE)
        self.assertTrue(payload["changed"])
        self.assertIn({"section": "Improvements", "subsection": "Performance",
                       "items": [{"text": sentence, "sources": ["benchmark:v12.1"]}]}, payload["sections"])

    def test_update_marks_benchmarking_pending_in_an_entry_without_the_line(self):
        entry = ENTRY_V12_1.replace("#### Performance\n - Benchmarking test results: TBD. Added by the changelog workflow "
                                    "once the v12.1 performance comparison is published.\n\n", "")
        prs = ["mattermost/mattermost#1", "mattermost/mattermost#2", "plugin:mattermost-plugin-calls@v1.12.6"]
        content, payload = self._update_with(entry, prs)
        self.assertRegex(content, gc.BENCHMARK_PENDING_RE)
        gap = next(g for g in payload["readiness"]["gaps"] if g["section"] == "Benchmarking")
        self.assertIn("the entry says “Benchmarking test results: TBD”", gap["detail"])
        self.assertIn("#### Release Note\n```release-note\nNONE\n```", (self.out / "pr_body.md").read_text())

    def test_create_ends_upgrade_impact_with_the_important_block(self):
        gc.main()
        content = self.changelog.read_text()
        entry = content[content.index("## Release v12.1"):]
        self.assertEqual(entry.count("<Important>"), 1)
        self.assertIn("### Upgrade Impact\n\n<Important>\n\nIf you upgrade from a release earlier than v12.0, please read the "
                      "other [Important Upgrade Notes]", entry)
        self.assertLess(entry.index("</Important>"), entry.index("### Improvements"))

    def test_create_reports_the_go_bullet_in_sections(self):
        gc.main()
        go = [group for group in self._payload()["sections"] if group["section"] == "Go Version"]
        self.assertEqual(go, [{"section": "Go Version", "subsection": None, "items": [
            {"text": "v12.1 is built with Go ``v1.27.1``.", "sources": []}]}])


    # Notes in these tests: N1 is PR 1, N2 is PR 2, N3 is the derived Calls plugin note.
    FIRST_ANSWER = ("### Improvements\n\n#### User Interface\n - Added the first thing. [[N1]]\n"
                    " - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3]]\n")
    RETRY_ANSWER = "### Bug Fixes\n - Fixed an issue found later. [[N2]]\n"

    def _polish_dropping_n2(self):
        self.asked = []
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)

        def place(notes):
            self.asked.append([note["id"] for note in notes])
            return self.RETRY_ANSWER, True
        gc.place_missing_with_ai = place

    def _recorded(self):
        return gc.parse_sources_comment((self.out / "pr_body.md").read_text())

    def test_a_note_the_model_drops_is_placed_by_the_retry(self):
        self._polish_dropping_n2()
        gc.main()
        self.assertEqual(self.asked, [["N2"]], "only the dropped note is sent back")
        content = self.changelog.read_text()
        self.assertIn("### Bug Fixes\n - Fixed an issue found later.", content)
        self.assertNotIn("[[N", content)
        payload = self._payload()
        self.assertEqual(payload["readiness"]["not_placed"], [])
        self.assertEqual(payload["sources_unattributed"], [])
        self.assertIn("mattermost/mattermost#2", self._recorded())
        self.assertNotIn("Not placed by the model", (self.out / "summary.md").read_text())
        self.assertNotIn("did not place", (self.out / "pr_body.md").read_text())

    def test_a_note_the_retry_also_drops_is_listed_and_not_recorded(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)
        gc.place_missing_with_ai = lambda notes: ("### Bug Fixes\n - Something unrelated. [[N9]]\n", True)
        gc.main()
        content = self.changelog.read_text()
        self.assertIn("Added the first thing.", content)
        self.assertNotIn("Fixed an issue found later", content)
        payload = self._payload()
        self.assertEqual(payload["sources_unattributed"], ["mattermost/mattermost#2"])
        self.assertEqual([(n["source"], n["recorded"]) for n in payload["readiness"]["not_placed"]],
                         [("mattermost/mattermost#2", False)])
        self.assertEqual(payload["metrics"]["notes_not_placed"], 1)
        self.assertEqual(self._recorded(), {"mattermost/mattermost#1", "plugin:mattermost-plugin-calls@v1.12.6"})
        body = (self.out / "pr_body.md").read_text()
        self.assertIn("did not place", body)
        self.assertIn("- [ ] `mattermost/mattermost#2`: Fixed an issue found later.", body)
        self.assertIn("### Not placed by the model: 1 note(s)", (self.out / "summary.md").read_text())

    def test_a_dry_run_reports_the_dropped_note_and_still_writes_the_preview(self):
        os.environ["DRY_RUN"] = "true"
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)
        gc.place_missing_with_ai = lambda notes: ("", True)
        gc.main()
        self.assertIn("Added the first thing.", (self.out / "entry.mdx").read_text())
        self.assertIn("### Not placed by the model: 1 note(s)", (self.out / "summary.md").read_text())
        self.assertNotIn("did not place", (self.out / "pr_body.md").read_text())
        self.assertNotIn("mattermost/mattermost#2", self._recorded())

    def test_a_retry_answer_with_no_section_is_discarded(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)
        gc.place_missing_with_ai = lambda notes: (" - Fixed an issue found later. [[N2]]\n", True)
        gc.main()
        self.assertNotIn("Fixed an issue found later", self.changelog.read_text())
        self.assertNotIn("mattermost/mattermost#2", self._recorded())
        self.assertEqual(len(self._payload()["readiness"]["not_placed"]), 1)

    def test_one_bullet_can_carry_several_markers_without_a_retry(self):
        self.asked = []
        gc.polish_with_ai = lambda notes: (
            "### Improvements\n\n#### User Interface\n - Added the first thing and fixed a later issue. [[N1]][[N2]]\n"
            " - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3,N3]]\n", True)
        gc.place_missing_with_ai = lambda notes: self.asked.append(notes) or ("", True)
        gc.main()
        self.assertEqual(self.asked, [])
        self.assertEqual(self._payload()["readiness"]["not_placed"], [])
        self.assertTrue({"mattermost/mattermost#1", "mattermost/mattermost#2"} <= self._recorded())
        item = next(i for group in self._payload()["sections"] for i in group["items"] if "first thing" in i["text"])
        self.assertEqual(item["sources"], ["mattermost/mattermost#1", "mattermost/mattermost#2"])

    def test_an_opt_out_label_wins_over_a_release_note_block(self):
        self.prs.append(self._pr(6, NOTE_BODY.replace("Added a thing.", "Should not be in the changelog."),
                                 "2026-10-19T14:00:00Z", ["release-note", "Changelog/Not Needed"]))
        sent = []

        def polish(notes):
            sent.extend(notes)
            return gc._raw_bullets(notes), False
        gc.polish_with_ai = polish
        gc.main()
        self.assertEqual(len(sent), 3)
        self.assertNotIn("Should not be in the changelog.", self.changelog.read_text())
        payload = self._payload()
        self.assertIn("mattermost/mattermost#6", [pr["source"] for pr in payload["prs_without_notes"]])
        self.assertNotIn("mattermost/mattermost#6", [pr["source"] for pr in payload["prs_flagged"]])
        self.assertNotIn("mattermost/mattermost#6", self._recorded())

    def test_a_repeated_bullet_in_the_retry_answer_is_not_inserted_twice(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)
        gc.place_missing_with_ai = lambda notes: (
            "### Improvements\n\n#### User Interface\n - Added the first thing. [[N1]]\n"
            "### Bug Fixes\n - Fixed an issue found later. [[N2]]\n", True)
        gc.main()
        content = self.changelog.read_text()
        self.assertEqual(content.count("Added the first thing."), 1)
        self.assertEqual(content.count("Fixed an issue found later."), 1)
        self.assertEqual(len(self._payload()["sections"]), 4)  # with Performance's benchmarking line

    def test_a_note_placed_only_under_go_version_is_not_recorded(self):
        gc.polish_with_ai = lambda notes: (
            self.FIRST_ANSWER + "\n### Go Version\n - Built with a newer Go. [[N2]]\n", True)
        gc.place_missing_with_ai = lambda notes: ("", True)
        gc.main()
        self.assertNotIn("Built with a newer Go.", self.changelog.read_text())
        self.assertNotIn("mattermost/mattermost#2", self._recorded())
        self.assertEqual([n["source"] for n in self._payload()["readiness"]["not_placed"]], ["mattermost/mattermost#2"])

    def test_update_reports_a_body_change_when_only_the_not_placed_list_is_new(self):
        entry = ENTRY_V12_1
        self.changelog.write_text(entry)
        body = self.tmp / "body.md"
        body.write_text(gc.render_pr_body("Body\n", {"mattermost/mattermost#1", "plugin:mattermost-plugin-calls@v1.12.6"}))
        os.environ.update({"MODE": "update", "PR_BODY_FILE": str(body)})
        gc.polish_with_ai = lambda notes: ("### Bug Fixes\n", True)
        gc.place_missing_with_ai = lambda notes: ("", True)
        gc.main()
        self.assertEqual(self.changelog.read_text(), entry)
        self.assertIn("did not place", (self.out / "pr_body.md").read_text())
        self.assertIn("body_changed=true", (self.tmp / "gh_output").read_text())


    def test_update_keeps_a_recorded_prs_unplaced_note_on_the_list_until_it_is_ticked(self):
        self.changelog.write_text(ENTRY_V12_1)
        sources = {"mattermost/mattermost#1", "mattermost/mattermost#2", "plugin:mattermost-plugin-calls@v1.12.6"}
        listed = gc.render_not_placed(gc.render_pr_body("Body\n", sources),
                                      [{"source": "mattermost/mattermost#1", "text": "Second note of PR 1."}], sources)
        body = self.tmp / "body.md"
        body.write_text(listed)
        os.environ.update({"MODE": "update", "PR_BODY_FILE": str(body)})
        gc.polish_with_ai = lambda notes: ("### Bug Fixes\n", True)
        gc.place_missing_with_ai = lambda notes: ("", True)
        gc.main()  # PR #1 is recorded, so it isn't sent again: the list must still name its note
        self.assertIn("- [ ] `mattermost/mattermost#1`: Second note of PR 1.", (self.out / "pr_body.md").read_text())
        self.assertEqual([(n["source"], n["excerpt"], n["recorded"]) for n in self._payload()["readiness"]["not_placed"]],
                         [("mattermost/mattermost#1", "Second note of PR 1.", True)])
        body.write_text((self.out / "pr_body.md").read_text().replace("- [ ] `mattermost", "- [x] `mattermost"))
        gc.main()  # a reviewer added it by hand and ticked it
        self.assertNotIn("Second note of PR 1", (self.out / "pr_body.md").read_text())
        self.assertIn("body_changed=true", (self.tmp / "gh_output").read_text())
        self.assertEqual(self._payload()["readiness"]["not_placed"], [])

    def test_update_drops_a_listed_note_once_a_later_run_places_it(self):
        self.changelog.write_text(ENTRY_V12_1)
        sources = {"mattermost/mattermost#1", "plugin:mattermost-plugin-calls@v1.12.6"}
        listed = gc.render_not_placed(gc.render_pr_body("Body\n", sources),
                                      [{"source": "mattermost/mattermost#2", "text": "Fixed an issue found later."}])
        body = self.tmp / "body.md"
        body.write_text(listed)
        os.environ.update({"MODE": "update", "PR_BODY_FILE": str(body)})
        gc.polish_with_ai = lambda notes: ("### Bug Fixes\n" + "".join(
            f" - {' '.join(n['text'].split())} [[{n['id']}]]\n" for n in notes), True)
        gc.place_missing_with_ai = lambda notes: ("", True)
        gc.main()  # PR #2 is sent again and placed this time
        out = (self.out / "pr_body.md").read_text()
        self.assertIn("mattermost/mattermost#2", gc.parse_sources_comment(out))
        self.assertNotIn("did not place", out)

    def test_a_note_only_under_go_version_is_retried(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER + "\n### Go Version\n - Go bump. [[N2]]\n", True)
        asked = []
        gc.place_missing_with_ai = lambda notes: asked.append([n["id"] for n in notes]) or (self.RETRY_ANSWER, True)
        gc.main()
        self.assertEqual(asked, [["N2"]])
        self.assertIn("Fixed an issue found later.", self.changelog.read_text())
        self.assertIn("mattermost/mattermost#2", self._recorded())

    def test_a_failed_retry_request_does_not_stop_the_run(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)

        def fail(notes):
            raise ConnectionError("down")
        gc.place_missing_with_ai = fail
        gc.main()
        self.assertIn("Added the first thing.", self.changelog.read_text())
        self.assertEqual(len(self._payload()["readiness"]["not_placed"]), 1)

    def test_a_retry_answer_keeps_valid_bullets_next_to_a_bullet_with_no_section(self):
        gc.polish_with_ai = lambda notes: (self.FIRST_ANSWER, True)
        gc.place_missing_with_ai = lambda notes: (" - Orphan before any heading. [[N2]]\n" + self.RETRY_ANSWER, True)
        gc.main()
        content = self.changelog.read_text()
        self.assertIn("Fixed an issue found later.", content)
        self.assertNotIn("Orphan before any heading", content)

    def test_a_retry_that_repeats_only_improvements_adds_no_empty_section(self):
        text = gc.drop_bulletless_sections(gc.keep_requested_bullets(gc.normalize_formatting(
            "### Improvements\nSee BLOG_POST_LINK on the highlights.\n#### User Interface\n - Repeated. [[N1]]\n"
            "### Bug Fixes\n - Wanted. [[N2]]\n"), {"N2"}))
        self.assertNotIn("Improvements", text)
        self.assertIn("### Bug Fixes\n - Wanted. [[N2]]", text)

    def test_a_note_placed_in_two_sections_is_kept_in_the_first(self):
        gc.polish_with_ai = lambda notes: (
            "### Improvements\n\n#### User Interface\n - Added the first thing. [[N1]]\n"
            " - Pre-packaged Calls plugin version [v1.12.6](https://example.com). [[N3]]\n"
            "#### Administration\n - Added the first thing again. [[N1]]\n - Combined with a new note. [[N1,N2]]\n"
            "### Bug Fixes\n - Added the first thing, once more. [[N1]]\n", True)
        gc.main()
        content = self.changelog.read_text()
        self.assertEqual(content.count("Added the first thing"), 1)
        self.assertIn("Combined with a new note.", content)
        self.assertEqual(self._payload()["readiness"]["not_placed"], [])

    def test_a_note_that_only_restates_a_listed_migration_gets_no_bullet(self):
        migration = {"source": "migration:000238_add_number_to_property_field_type", "derived": True,
                     "text": "Database schema migration 000238.",
                     "fallback": "Added database migration ``000238_add_number_to_property_field_type``."}
        saved = gc.changelog_release.derived_notes
        gc.changelog_release.derived_notes = lambda base, head: saved(base, head) + [migration]
        self.prs[1] = self._pr(2, NOTE_BODY.replace("Added a thing.", "Added migration 000238."),
                               "2026-10-21T10:00:00Z")
        sent = []

        def polish(notes):
            sent.extend(note["source"] for note in notes)
            return gc._raw_bullets(notes), False
        gc.polish_with_ai = polish
        gc.main()
        self.assertNotIn("mattermost/mattermost#2", sent)
        self.assertNotIn("Added migration 000238", self.changelog.read_text())
        self.assertIn("mattermost/mattermost#2", self._recorded())
        self.assertEqual(self._payload()["readiness"]["restated"],
                         [{"source": "mattermost/mattermost#2", "migration": "000238_add_number_to_property_field_type"}])
        self.assertIn("### Notes that only restate a migration: 1", (self.out / "summary.md").read_text())

    def test_a_note_whose_pr_added_a_listed_migration_tells_the_model_so(self):
        migration = {"source": "migration:000241_move_access_control_group_to_v3", "derived": True,
                     "text": "Database schema migration 000241.", "fallback": "Added database migration ``000241``."}
        saved = gc.changelog_release.derived_notes
        gc.changelog_release.derived_notes = lambda base, head: saved(base, head) + [migration]
        self.details[1] = {"head_ref": "dk-pfp-5-cutover", "files": [],
                           "migrations": ["000241_move_access_control_group_to_v3", "000099_not_in_this_release"]}
        sent = []

        def polish(notes):
            sent.extend(notes)
            return gc._raw_bullets(notes), False
        gc.polish_with_ai = polish
        gc.main()
        note = next(n for n in sent if n["source"] == "mattermost/mattermost#1")
        self.assertEqual(note["context"], "This PR added the migration ``000241_move_access_control_group_to_v3``, "
                                          "listed under Database Schema Changes.")
        self.assertIn(note["context"], gc._notes_text([note]))
        self.assertNotIn("listed under Database Schema Changes", self.changelog.read_text())  # model context only

    def test_an_endpoint_line_the_router_lacks_is_flagged_not_printed(self):
        self.prs[0] = self._pr(1, NOTE_BODY.replace("Added a thing.", "Removed the unused usage API.\n"
                                                    "Removed `GET /posts` (`getPostsUsage`) API endpoint."),
                               "2026-10-19T10:00:00Z")
        saved = gc.endpoints_at
        gc.endpoints_at = lambda ref: set()  # neither release's router has the route
        self.addCleanup(setattr, gc, "endpoints_at", saved)
        gc.main()
        content = self.changelog.read_text()
        self.assertIn("Removed the unused usage API.", content)
        self.assertNotIn("GET /posts", content)
        flagged = [q for q in self._payload()["readiness"]["note_quality"] if q["reason"] == gc.UNRESOLVED_ENDPOINT]
        self.assertEqual(flagged, [{"source": "mattermost/mattermost#1", "title": self.prs[0]["title"],
                                    "reason": gc.UNRESOLVED_ENDPOINT, "excerpt": "Removed GET /posts (getPostsUsage)"}])


# The router as v12.1.0 had it, for the endpoints #39519, #39523, #39527 and #39528 removed.
API_GO = (
    "\tapi.BaseRoutes.APIRoot = srv.Router.PathPrefix(model.APIURLSuffix).Subrouter()\n"
    "\tapi.BaseRoutes.Cloud = api.BaseRoutes.APIRoot.PathPrefix(\"/cloud\").Subrouter()\n"
    "\tapi.BaseRoutes.Usage = api.BaseRoutes.APIRoot.PathPrefix(\"/usage\").Subrouter()\n"
    "\tapi.BaseRoutes.HostedCustomer = api.BaseRoutes.APIRoot.PathPrefix(\"/hosted_customer\").Subrouter()\n"
)
ROUTER_V12_1 = {
    "server/channels/api4/api.go": API_GO,
    "server/channels/api4/usage.go": (
        "\tapi.BaseRoutes.Usage.Handle(\"/posts\", api.APISessionRequired(getPostsUsage)).Methods(http.MethodGet)\n"
        "\tapi.BaseRoutes.Usage.Handle(\"/storage\", api.APISessionRequired(getStorageUsage)).Methods(http.MethodGet)\n"
        "\tapi.BaseRoutes.Usage.Handle(\"/teams\", api.APISessionRequired(getTeamsUsage)).Methods(http.MethodGet)\n"),
    "server/channels/api4/hosted_customer.go": (
        "\tapi.BaseRoutes.HostedCustomer.Handle(\"/signup_available\", "
        "api.APISessionRequired(handleSignupAvailable)).Methods(http.MethodGet)\n"),
    "server/channels/api4/cloud.go": (
        "\tapi.BaseRoutes.Cloud.Handle(\"/customer\", api.APISessionRequired(getCloudCustomer)).Methods(http.MethodGet)\n"
        "\tapi.BaseRoutes.Cloud.Handle(\"/customer\", api.APISessionRequired(updateCloudCustomer)).Methods(http.MethodPut)\n"
        "\tapi.BaseRoutes.Cloud.Handle(\"/subscription/invoices\", "
        "api.APISessionRequired(getInvoicesForSubscription)).Methods(http.MethodGet)\n"
        "\tapi.BaseRoutes.Cloud.Handle(\"/subscription/invoices/{invoice_id:[_A-Za-z0-9]+}/pdf\", "
        "api.APISessionRequired(getSubscriptionInvoicePDF)).Methods(http.MethodGet)\n"),
    "server/channels/api4/cloud_test.go": "\tapi.BaseRoutes.Cloud.Handle(\"/x\", api.APISessionRequired(ignored)).Methods(http.MethodGet)\n",
}


class EndpointPathTest(unittest.TestCase):
    def setUp(self):
        gc._ENDPOINTS_AT.clear()
        self.addCleanup(gc._ENDPOINTS_AT.clear)
        self.refs = []

        def ls(ref, path):
            self.refs.append(ref)
            return sorted(p for p in ROUTER_V12_1 if p.startswith(path)) if ref == "v12.1.0" else ["server/channels/api4/api.go"]
        self.lookup = gc.endpoint_lookup("v12.1.0", "origin/release-12.2", lambda ref: gc.endpoints_at(
            ref, lambda r, path: ROUTER_V12_1.get(path) if r == "v12.1.0" else API_GO, ls))

    def test_39527s_removed_usage_endpoints_get_their_full_paths(self):
        note = ("Removed the unused /api/v4/usage/posts, /api/v4/usage/storage and /api/v4/usage/teams endpoints.\n"
                "Removed `GET /posts` (`getPostsUsage`) API endpoint.\n"
                "Removed `GET /storage` (`getStorageUsage`) API endpoint.\n"
                "Removed `GET /teams` (`getTeamsUsage`) API endpoint.")
        text, unresolved = gc.resolve_endpoint_lines(note, self.lookup)
        self.assertEqual(text.split("\n")[1:], [
            "Removed ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.",
            "Removed ``GET /api/v4/usage/storage`` (``getStorageUsage``) API endpoint.",
            "Removed ``GET /api/v4/usage/teams`` (``getTeamsUsage``) API endpoint.",
        ])
        self.assertEqual(unresolved, [])
        self.assertEqual(self.refs, ["v12.1.0"])  # a removed route is looked up where it last was

    def test_39528s_signup_endpoint_and_the_cloud_ones_get_their_full_paths(self):
        note = ("Removed the unused /api/v4/hosted_customer/signup_available endpoint.\n"
                "Removed `GET /signup_available` (`handleSignupAvailable`) API endpoint.\n"
                "Removed `PUT /customer` (`updateCloudCustomer`) API endpoint.\n"
                "Removed `GET /subscription/invoices/{invoice_id:[_A-Za-z0-9]+}/pdf` (`getSubscriptionInvoicePDF`) API endpoint.")
        text, unresolved = gc.resolve_endpoint_lines(note, self.lookup)
        self.assertEqual(text.split("\n")[1:], [
            "Removed ``GET /api/v4/hosted_customer/signup_available`` (``handleSignupAvailable``) API endpoint.",
            "Removed ``PUT /api/v4/cloud/customer`` (``updateCloudCustomer``) API endpoint.",
            "Removed ``GET /api/v4/cloud/subscription/invoices/{invoice_id}/pdf`` (``getSubscriptionInvoicePDF``) API endpoint.",
        ])
        self.assertEqual(unresolved, [])

    def test_an_endpoint_neither_router_has_is_taken_out_and_returned(self):
        note = ("Removed the address endpoint.\n"
                "Removed `PUT /customer/address` (`updateCloudCustomerAddress`) API endpoint.")
        text, unresolved = gc.resolve_endpoint_lines(note, self.lookup)
        self.assertEqual(text, "Removed the address endpoint.")
        self.assertEqual(unresolved, ["Removed PUT /customer/address (updateCloudCustomerAddress)"])
        self.assertEqual(self.refs, ["v12.1.0", "origin/release-12.2"])  # both releases were searched

    def test_a_pathless_line_is_resolved_by_its_handler(self):
        text, _ = gc.resolve_endpoint_lines("Removed `GET /` (`getTeamsUsage`) API endpoint.", self.lookup)
        self.assertEqual(text, "Removed ``GET /api/v4/usage/teams`` (``getTeamsUsage``) API endpoint.")

    def test_without_release_refs_nothing_partial_is_printed(self):
        text, unresolved = gc.resolve_endpoint_lines("Removed `GET /posts` (`getPostsUsage`) API endpoint.",
                                                     gc.endpoint_lookup("", ""))
        self.assertEqual((text, unresolved), ("", ["Removed GET /posts (getPostsUsage)"]))


class OutsideDocsPrsTest(unittest.TestCase):
    MERGED = {
        "mattermost/mattermost#900": {"title": "Docs", "body": "Docs for #39344."},
        "mattermost/mattermost#901": {"title": "Docs", "body": "Docs for https://github.com/mattermost/mattermost/pull/39474"},
        "mattermost/mattermost#902": {"title": "MM-71000 docs", "body": "No link."},
        "mattermost/mattermost#39433": {"title": "In the milestone", "body": "See #39344."},
    }

    def test_only_merged_prs_outside_the_milestone_that_link_a_pr_count(self):
        prs = {"mattermost/mattermost#39344": {}, "mattermost/mattermost#39474": {}, "mattermost/mattermost#39433": {}}
        found = gc.outside_docs_prs(prs, {"mattermost/mattermost#39344", "mattermost/mattermost#39474"}, "2026-10-16T00:00:00Z",
                                    lambda repo, since: self.MERGED)
        self.assertEqual(sorted(found), ["mattermost/mattermost#900", "mattermost/mattermost#901"])
        self.assertTrue(all(info["outside"] for info in found.values()))
        self.assertEqual(gc.outside_docs_prs(prs, {"mattermost/mattermost#39344"}, None, lambda repo, since: self.MERGED), {})

    def test_the_listing_stops_at_prs_updated_before_the_previous_release(self):
        def pr(number, merged, updated):
            return {"number": number, "title": "t", "body": "b", "merged_at": merged, "updated_at": updated}
        pages = {1: [pr(1, "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")] + [pr(2, None, "2026-11-01T00:00:00Z")] * 99,
                 2: [pr(3, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"), pr(4, "2026-10-20T00:00:00Z", "2026-10-21T00:00:00Z")]
                    + [pr(5, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z")] * 98,
                 3: [pr(6, "2026-11-05T00:00:00Z", "2026-11-05T00:00:00Z")]}
        asked = []

        class Response:
            def __init__(self, items):
                self.items = items

            def raise_for_status(self):
                pass

            def json(self):
                return self.items

        def get(url, params, timeout):
            asked.append(params["page"])
            return Response(pages[params["page"]])
        saved = gc.SESSION.get
        gc.SESSION.get = get
        try:
            found = gc.merged_prs_since("mattermost/mattermost", "2026-10-16T00:00:00+00:00")
        finally:
            gc.SESSION.get = saved
        self.assertEqual(sorted(found), ["mattermost/mattermost#1", "mattermost/mattermost#4"])  # #3 merged before
        self.assertEqual(asked, [1, 2])  # page 2 ends before the previous release: page 3 isn't read

    def test_the_search_starts_at_the_previous_release_branchs_cut(self):
        asked = []

        class Response:
            def __init__(self, status, data):
                self.status, self.data = status, data

            def raise_for_status(self):
                if self.status >= 400:
                    raise gc.requests.HTTPError(f"HTTP {self.status}")

            def json(self):
                return self.data

        def get(url, params, timeout):
            asked.append(url)
            if url.endswith("master...release-12.1"):
                return Response(200, {"merge_base_commit": {"commit": {"committer": {"date": "2026-10-16T09:18:58Z"}}}})
            return Response(404, {})
        saved = gc.SESSION.get
        gc.SESSION.get = get
        try:
            # The tag and the branch name the same release; v12.1's cut is when v12.2's work began.
            self.assertEqual(gc.release_branch_cut("v12.1.0"), "2026-10-16T09:18:58Z")
            self.assertEqual(gc.release_branch_cut("origin/release-12.1"), "2026-10-16T09:18:58Z")
            self.assertIsNone(gc.release_branch_cut("v12.0.0"))  # no such branch here: not checked
            self.assertIsNone(gc.release_branch_cut(""))
        finally:
            gc.SESSION.get = saved
        self.assertEqual(asked, ["https://api.github.com/repos/mattermost/mattermost/compare/master...release-12.1"] * 2
                         + ["https://api.github.com/repos/mattermost/mattermost/compare/master...release-12.0"])

    def test_a_docs_pr_outside_the_milestone_counts_only_by_its_link(self):
        prs = {"mattermost/mattermost#1": {"title": "MM-5 feature", "head_ref": "MM-5-feature", "body": ""},
               "mattermost/mattermost#900": {"title": "MM-5 docs", "head_ref": "MM-5-docs", "body": "", "outside": True}}
        files = {"mattermost/mattermost#900": [{"filename": "docs/main/a.mdx", "status": "added", "patch": "+# A\n"}]}
        read = {"docs/main/a.mdx": "---\ntitle: A\n---\n# A\n"}.get
        self.assertEqual(gc.changelog_release.docs_link("mattermost/mattermost#1", prs, lambda s: files.get(s, []), read), {})
        prs["mattermost/mattermost#900"]["body"] = "Docs for #1."
        found = gc.changelog_release.docs_link("mattermost/mattermost#1", prs, lambda s: files.get(s, []), read)
        self.assertEqual(found["url"], "https://docs.mattermost.com/a")
        self.assertIn("(outside the milestone)", found["basis"])


class TidyGeneratedTest(unittest.TestCase):
    def test_the_schema_summary_names_the_release(self):
        text = " - The following schema changes are included in the VERSION release. No database downtime is expected.\n"
        self.assertEqual(gc.fill_version(text, "v12.2"),
                         " - The following schema changes are included in the v12.2 release. No database downtime is expected.\n")

    def test_added_is_not_put_in_front_of_a_note_with_its_own_verb(self):
        text = (" - Added ``GET /api/v4/posts/{post_id}/thread`` with ``updatesOnly=true`` and ``direction=down`` now includes "
                "replies deleted since ``fromUpdateAt``. [[N4]]\n"
                " - Added a setting, which now defaults to on. [[N5]]\n")
        self.assertEqual(gc.drop_added_before_verb(text).split("\n")[:2], [
            " - ``GET /api/v4/posts/{post_id}/thread`` with ``updatesOnly=true`` and ``direction=down`` now includes "
            "replies deleted since ``fromUpdateAt``. [[N4]]",
            " - Added a setting, which now defaults to on. [[N5]]",
        ])

    def test_migration_numbers_stay_in_database_schema_changes(self):
        text = ("### Upgrade Impact\n\n#### Database Schema Changes\n"
                " - The following schema changes are included in the v12.2 release.\n"
                "   - Added ``number`` to the ``property_field_type`` enum (migration 000238). [[N1]]\n\n"
                "### Improvements\n\n#### Administration\n"
                " - Added the number property field type (migration 000238). [[N2]]\n"
                " - Added the checkbox property field type in migration ``000239_add_checkbox_to_property_field_type``. [[N3]]\n")
        out = gc.strip_migration_numbers(text)
        self.assertIn("enum (migration 000238). [[N1]]", out)
        self.assertIn(" - Added the number property field type. [[N2]]\n", out)
        self.assertIn(" - Added the checkbox property field type. [[N3]]\n", out)

    def test_a_docs_page_is_linked_from_its_bullet_in_any_section(self):
        # v12.2 dry run: #39344, #39433 and #39474 had pages, but "no bullet links it".
        redis = "https://docs.mattermost.com/deployment-guide/scale/redis#secure-redis-connections-with-tls"
        preauth = "https://docs.mattermost.com/developers/integrate/plugins/components/webapp#loading-before-login-with-pre_auth"
        text = ("#### config.json\n - **Changes to All plans:**\n   - Added ``CacheSettings.RedisTLS``. [[N1]]\n"
                "#### Important Upgrade Notes\n - Unauthenticated users now get only pre-auth plugin manifests. [[N2]]\n"
                "### Improvements\n#### Administration\n - Added TLS for [Redis]("
                + redis + ") on the cluster. [[N3]]\n - Added Redis TLS again. [[N1]]\n")
        docs = {"N1": (redis, "Redis"), "N2": (preauth, "Webapp components"), "N3": (redis, "Redis")}
        out = gc.link_docs_pages(text, docs)
        self.assertIn(f"   - Added ``CacheSettings.RedisTLS``. [[N1]]\n", out)  # the page is linked already, once
        self.assertIn(f" - Unauthenticated users now get only pre-auth plugin manifests. See the [Webapp components]({preauth}) "
                      "documentation for details. [[N2]]\n", out)
        self.assertEqual(out.count(preauth), 1)
        linked = gc.link_docs_pages("#### config.json\n - **Changes to All plans:**\n   - Added ``RedisTLS``. [[N1]]\n",
                                    {"N1": (redis, "Redis")})
        self.assertIn(f"   - Added ``RedisTLS``. See the [Redis]({redis}) documentation for details. [[N1]]", linked)

    def test_added_stays_on_a_sentence_whose_now_belongs_to_another_clause(self):
        text = (" - Added TLS so the cluster now uses encryption. [[N1]]\n"
                " - Added ``RedisTLS``, so Redis now uses TLS. [[N2]]\n"
                " - Added a setting the cluster now reads. [[N3]]\n")
        self.assertEqual(gc.drop_added_before_verb(text), text)

    def test_a_bullet_whose_subject_is_the_migration_keeps_it(self):
        text = "### Improvements\n#### Administration\n - Reverted migration 000238. [[N1]]\n"
        self.assertEqual(gc.strip_migration_numbers(text), text)

    def test_a_page_whose_url_is_a_prefix_of_a_linked_one_is_still_linked(self):
        tls = "https://docs.mattermost.com/deployment-guide/scale/redis-tls"
        redis = "https://docs.mattermost.com/deployment-guide/scale/redis"
        text = f" - Added [TLS]({tls}). [[N1]]\n - Added Redis caching. [[N2]]\n"
        out = gc.link_docs_pages(text, {"N2": (redis, "Redis")})
        self.assertIn(f" - Added Redis caching. See the [Redis]({redis}) documentation for details. [[N2]]", out)
        self.assertEqual(gc.link_docs_pages(text, {"N2": (redis, "Redis")}, already=f"[Redis]({redis}#setup)"), text)

    def test_the_inserted_page_title_is_mdx_safe(self):
        url = "https://docs.mattermost.com/x"
        out = gc.link_docs_pages(" - Added it. [[N1]]\n", {"N1": (url, "Use {feature} with <Tag> [beta]")})
        self.assertIn(f"See the [Use \\{{feature}} with \\<Tag> \\[beta\\]]({url}) documentation", out)

    def test_the_prompt_places_behaviour_changing_dependency_swaps_and_keeps_verbs(self):
        # Model-level rules: the v12.2 dry run put the go-crypto swap outside Compatibility and
        # wrote "Added ``GET .../thread`` ... now includes".
        self.assertIn("A note that replaces or upgrades a library and also says what now behaves differently", gc.SYSTEM_PROMPT)
        self.assertIn("goes under `#### Important Upgrade Notes`", gc.SYSTEM_PROMPT)
        self.assertIn('never put "Added" in front of it', gc.SYSTEM_PROMPT)
        self.assertIn("Never write a migration number", gc.SYSTEM_PROMPT)


class RetryFilterTest(unittest.TestCase):
    def test_star_and_plus_bullets_for_other_notes_are_dropped(self):
        text = "### Bug Fixes\n* Repeated star bullet. [[N1]]\n + Repeated plus bullet. [[N1]]\n - Wanted. [[N2]]\n"
        kept = gc.keep_requested_bullets(gc.normalize_formatting(text), {"N2"})
        self.assertNotIn("Repeated", kept)
        self.assertIn("Wanted.", kept)


class GeneratedTextCleanupTest(unittest.TestCase):
    def test_a_link_is_kept_only_on_a_bullet_that_names_its_pr(self):
        sources = {"N1": "r#1", "N2": "r#2"}
        urls = {"https://docs.mattermost.com/a#x": {"r#1"}}
        text = " - Added [a](https://docs.mattermost.com/a#x). [[N1]]\n - Extended [a](https://docs.mattermost.com/a). [[N2]]\n" \
               " - See [other](https://example.com). [[N2]]\n"
        cleaned = gc.drop_misplaced_doc_links(text, urls, sources)
        self.assertEqual(cleaned.split("\n")[0], " - Added [a](https://docs.mattermost.com/a#x). [[N1]]")
        self.assertEqual(cleaned.split("\n")[1], " - Extended a. [[N2]]")
        self.assertIn("[other](https://example.com)", cleaned)

    def test_the_first_placement_of_a_note_wins(self):
        text = "### A\n - One. [[N1]]\n### B\n - One again. [[N1]]\n - Two. [[N2]]\n### Go Version\n - Go. [[N3]]\n"
        cleaned = gc.drop_repeated_notes(text)
        self.assertNotIn("One again", cleaned)
        self.assertIn("Two.", cleaned)
        self.assertEqual(cleaned.count("[[N1]]"), 1)


class MigrationRestatedTest(unittest.TestCase):
    MIGRATIONS = ["000238_add_number_to_property_field_type"]

    def test_a_note_that_only_names_the_migration_is_restating_it(self):
        self.assertEqual(gc.migration_restated("Added migration 000238.", self.MIGRATIONS), self.MIGRATIONS[0])
        self.assertEqual(gc.migration_restated("Added the 000238_add_number_to_property_field_type migration.", self.MIGRATIONS),
                         self.MIGRATIONS[0])

    def test_a_note_saying_no_more_than_the_migration_name_is_restating_it(self):
        # v12.2 dry run: #39459 and #39460 repeated their Database Schema Changes bullets under Administration.
        self.assertEqual(gc.migration_restated("Added the number property field type (migration 000238).", self.MIGRATIONS),
                         self.MIGRATIONS[0])
        self.assertEqual(gc.migration_restated("Added the checkbox property field type (migration 000239).",
                                               ["000239_add_checkbox_to_property_field_type"]),
                         "000239_add_checkbox_to_property_field_type")

    def test_a_note_that_says_what_the_change_is_for_is_kept(self):
        self.assertIsNone(gc.migration_restated(
            "Added the number property field type, so boards can sort cards by estimate (migration 000238).", self.MIGRATIONS))
        self.assertIsNone(gc.migration_restated("Added migration 000239.", self.MIGRATIONS))


class GoVersionPruneTest(unittest.TestCase):
    def test_a_note_only_under_go_version_is_dropped_even_when_its_pr_has_another_bullet(self):
        notes = [{"id": "N1", "source": "mattermost/mattermost#1", "text": "a"},
                 {"id": "N2", "source": "mattermost/mattermost#1", "text": "b"}]
        sources = {n["id"]: n["source"] for n in notes}
        gc.polish_with_ai, saved = (lambda n: ("### Bug Fixes\n - Fixed it. [[N1]]\n### Go Version\n - Go bump. [[N2]]\n", True)), gc.polish_with_ai
        try:
            _, items, referenced, _ = gc.render_fragment(notes, sources)
        finally:
            gc.polish_with_ai = saved
        self.assertEqual(referenced, {"N1"})
        self.assertEqual([item["section"] for item in items], ["Bug Fixes"])
        self.assertEqual([n["id"] for n in gc.dropped_notes(notes, referenced)], ["N2"])


# The v12.2 auto run (mattermost/mattermost#40345), as the model wrote it.
REDIS_PAGE = ("https://docs.mattermost.com/deployment-guide/scale/redis#secure-redis-connections-with-tls",
              "Redis: Secure Redis connections with TLS")
PREAUTH_PAGE = ("https://docs.mattermost.com/developers/integrate/plugins/components/webapp#loading-before-login-with-pre_auth",
                "Web app plugins: Loading before login with preauth")
CONFIG_BULLETS = (
    "#### config.json\n"
    " - **Changes to All plans:**\n"
    "   - Under ``CacheSettings`` in ``config.json``, added ``RedisEnableTLS`` configuration setting to enable TLS for Redis connections. [[N1,N3]]\n"
    "   - Under ``CacheSettings`` in ``config.json``, added ``RedisTLSCA`` configuration setting. [[N4]]\n"
    "   - Under ``PluginSettings`` in ``config.json``, added ``RestrictUnauthenticatedWebappPlugins`` configuration setting to control "
    "whether unauthenticated requests only return plugins that set ``webapp.pre_auth``. [[N2,N5]]\n"
)


class V122FixesTest(unittest.TestCase):
    """The fixes for the first auto run's changelog PR, mattermost/mattermost#40345."""

    # 1. The PR body's Release Note section
    def test_a_new_pr_body_has_the_release_note_section(self):
        body = gc.default_pr_body()
        self.assertIn("#### Release Note\n```release-note\nNONE\n```", body)
        self.assertNotIn("Contributor", body)

    def test_an_existing_body_gets_the_section_above_the_sources_list(self):
        body = gc.render_pr_body("Auto-generated changelog.\n", {"mattermost/mattermost#1"})
        updated = gc.with_release_note_section(body)
        self.assertLess(updated.index("#### Release Note"), updated.index("<!-- changelog-sources:"))
        self.assertEqual(gc.with_release_note_section(updated), updated)  # once
        self.assertEqual(gc.parse_sources_comment(updated), {"mattermost/mattermost#1"})

    def test_a_release_note_block_only_inside_a_comment_does_not_count(self):
        body = ("Changelog.\n\n<!--\n```release-note\nAdded new API endpoints.\n```\n-->\n\n"
                + gc.render_pr_body("", {"mattermost/mattermost#1"}).strip() + "\n")
        updated = gc.with_release_note_section(body)
        self.assertIn(gc.RELEASE_NOTE_SECTION, updated)
        self.assertLess(updated.index(gc.RELEASE_NOTE_SECTION), updated.index("<!-- changelog-sources:"))

    def test_update_mode_writes_the_blog_line_when_it_creates_improvements(self):
        entry = ("## Release v12.2 - x\n\n**Release day: TBD**\n\n### Bug Fixes\n - Fixed.\n\n"
                 "### Go Version\n - Go.\n\n## Release v12.1 - y\n")
        out, action = gc.apply_benchmark(entry, "v12.2", {"notes": [], "gap": {}}, "See [this blog post](https://x) on the highlights.")
        self.assertEqual(action, "marked")
        self.assertIn("### Improvements\nSee [this blog post](https://x) on the highlights.\n\n#### Performance\n", out)
        with open(gc.__file__, encoding="utf-8") as f:
            source = f.read()
        update_call = source[source.index("    benchmark_action = \"\"\n"):source.index("if benchmark_action in")]
        self.assertIn("blog_post_link()", update_call, "update mode passes the blog line, as create mode does")

    # 2. Docs links: a page only on its own PR's bullet, one "See the" per bullet
    def test_each_pr_s_page_goes_on_its_own_bullet(self):
        # N1: #39474's note (Redis TLS). #39433's notes: N2 (pre-auth plugins), and its config-checker
        # lines N3 (RedisEnableTLS, from a branch based on #39474), N4 (RedisTLSCA), N5 (Restrict...).
        sources = {"N1": "mattermost/mattermost#39474", "N2": "mattermost/mattermost#39433",
                   "N3": "mattermost/mattermost#39433", "N4": "mattermost/mattermost#39433",
                   "N5": "mattermost/mattermost#39433"}
        docs = {"N1": REDIS_PAGE, "N2": PREAUTH_PAGE, "N3": PREAUTH_PAGE, "N4": PREAUTH_PAGE, "N5": PREAUTH_PAGE}
        lines = gc.link_docs_pages(CONFIG_BULLETS, docs, sources_by_id=sources).split("\n")
        redis, ca, restrict = lines[2], lines[3], lines[4]
        self.assertIn(REDIS_PAGE[0], redis)
        self.assertNotIn(PREAUTH_PAGE[0], redis)
        self.assertEqual(redis.count("See the"), 1)
        self.assertIn(PREAUTH_PAGE[0], restrict)  # it names webapp.pre_auth, so it is #39433's bullet for the page
        self.assertNotIn("See the", ca)

    def test_a_bullet_never_gets_a_second_see_the_sentence(self):
        text = (" - Added X. See the [X documentation](https://docs.mattermost.com/x) for details. [[N1]]\n")
        out = gc.link_docs_pages(text, {"N1": ("https://docs.mattermost.com/y", "Y page")},
                                 sources_by_id={"N1": "mattermost/mattermost#1"})
        self.assertEqual(out, text)

    def test_another_pr_s_page_never_goes_on_a_shared_bullet_that_doesn_t_name_it(self):
        text = " - Added ``RedisEnableTLS`` to enable TLS for Redis connections. [[N1,N3]]\n"
        out = gc.link_docs_pages(text, {"N3": PREAUTH_PAGE}, sources_by_id={
            "N1": "mattermost/mattermost#39474", "N3": "mattermost/mattermost#39433"})
        self.assertEqual(out, text)

    # 3. Benchmarking line kept in step
    NOTE = {"source": "benchmark:v12.2", "text": "Benchmarking test results showed no significant difference: a 0.18% decrease.",
            "fallback": "", "derived": True}
    PENDING = {"notes": [], "gap": {"section": "Benchmarking", "status": "not_yet_checked"}}
    ENTRY = ("## Release v12.2 - Feature Release\n\n**Release day: TBD**\n\n### Improvements\nSee [this blog post](x) on the highlights.\n\n"
             "#### User Interface\n - Added a page.\n\n#### Performance\n - Improved loading.\n\n### Bug Fixes\n - Fixed a thing.\n\n"
             "## Release v12.1 - Feature Release\n\n - Old.\n")

    def test_a_pending_marker_until_the_report_is_published(self):
        content, action = gc.apply_benchmark(self.ENTRY, "v12.2", self.PENDING)
        self.assertEqual(action, "marked")
        self.assertIn("#### Performance\n - Benchmarking test results: TBD. Added by the changelog workflow once the v12.2 "
                      "performance comparison is published.\n - Improved loading.", content)
        self.assertEqual(gc.apply_benchmark(content, "v12.2", self.PENDING), (content, "pending"))  # once

    def test_the_sentence_replaces_the_marker_when_the_report_appears(self):
        pending, _ = gc.apply_benchmark(self.ENTRY, "v12.2", self.PENDING)
        content, action = gc.apply_benchmark(pending, "v12.2", {"notes": [self.NOTE], "gap": {"status": "ready"}})
        self.assertEqual(action, "added")
        self.assertIn("#### Performance\n - Benchmarking test results showed no significant difference: a 0.18% decrease.\n"
                      " - Improved loading.", content)
        self.assertNotRegex(content, gc.BENCHMARK_PENDING_RE)
        self.assertIn(" - Old.", content)  # the next release untouched

    def test_a_sentence_a_reviewer_edited_is_kept(self):
        edited = self.ENTRY.replace(" - Improved loading.", " - Benchmarking test results showed a reviewer's wording.")
        self.assertEqual(gc.apply_benchmark(edited, "v12.2", {"notes": [self.NOTE], "gap": {}}), (edited, "kept"))

    def test_a_flagged_comparison_says_a_person_writes_the_line(self):
        content, _ = gc.apply_benchmark(self.ENTRY.replace("#### Performance\n - Improved loading.\n\n", ""), "v12.2",
                                        {"notes": [], "gap": {"status": "needs_review"}})
        self.assertIn("\n#### Performance\n - Benchmarking test results: TBD. The v12.2 performance comparison needs a "
                      "person: replace this line with the Performance bullet.\n\n### Bug Fixes", content)

    # 4. mmctl placement
    def test_bullets_mainly_about_mmctl_move_from_administration(self):
        for text in ("Added [``mmctl logs``](https://docs.mattermost.com/x) flags ``--follow`` and ``--level``.",
                     "Added the ``--plugin`` flag to [``mmctl logs``](https://docs.mattermost.com/x), which filters by plugin.",
                     "Added ``mmctl plugin keys`` and ``mmctl plugin keys add`` commands (local mode only)."):
            self.assertTrue(gc.is_mmctl_bullet(f" - {text} [[N1]]"), text)
        for text in ('Added a "Re-run checks" button to the System Console Site health page and an ``mmctl health run`` command.',
                     "Support Packets now record ``audit_logging_active``, and ``mmctl health check --packet`` uses it.",
                     "Added scoped migration reporting. After the import, ``mmctl import job show`` displays the count."):
            self.assertFalse(gc.is_mmctl_bullet(f" - {text} [[N1]]"), text)
        text = ("### Improvements\n\n#### Administration\n - Added ``mmctl plugin keys`` commands. [[N1]]\n"
                " - Added a System Console page. [[N2]]\n\n#### Performance\n - Faster. [[N3]]\n")
        moved = gc.move_mmctl_bullets(text)
        self.assertEqual(moved, "### Improvements\n\n#### Administration\n - Added a System Console page. [[N2]]\n\n"
                                "#### mmctl\n - Added ``mmctl plugin keys`` commands. [[N1]]\n\n#### Performance\n - Faster. [[N3]]\n")

    def test_a_whole_entry_keeps_its_heading_when_mmctl_bullets_move(self):
        entry = ("## Release v12.2 - Feature Release\n\n**Release day: TBD**\n\n### Improvements\n\n#### Administration\n"
                 " - Added ``mmctl plugin keys`` commands.\n - Added a page.\n")
        moved = gc.move_mmctl_bullets(entry)
        self.assertTrue(moved.startswith("## Release v12.2 - Feature Release\n\n**Release day: TBD**\n\n### Improvements"))
        self.assertIn("#### mmctl\n - Added ``mmctl plugin keys`` commands.", moved)

    # 5. One Important Upgrade Notes bullet per dependency change
    def test_compatibility_bullets_for_one_ticket_are_merged(self):
        text = ("#### Important Upgrade Notes\n"
                " - Plugin signatures that use the SHA-1 hash algorithm are now rejected. [[N1]]\n"
                " - Replaced ``golang.org/x/crypto/openpgp`` with ``github.com/ProtonMail/go-crypto`` for plugin signature verification. [[N2]]\n"
                " - Reserved the plugin ID ``com.mattermost.server``. [[N3]]\n")
        notes = [{"id": "N1", "source": "mattermost/mattermost#39840", "tickets": ["MM-70987"]},
                 {"id": "N2", "source": "mattermost/mattermost#39738", "tickets": ["MM-70987"]},
                 {"id": "N3", "source": "mattermost/mattermost#39000", "tickets": ["MM-1"]}]
        self.assertEqual(gc.merge_related_compatibility(text, notes), (
            "#### Important Upgrade Notes\n"
            " - Plugin signatures that use the SHA-1 hash algorithm are now rejected. Replaced ``golang.org/x/crypto/openpgp`` "
            "with ``github.com/ProtonMail/go-crypto`` for plugin signature verification. [[N1,N2]]\n"
            " - Reserved the plugin ID ``com.mattermost.server``. [[N3]]\n"))
        self.assertIn("Ticket: MM-70987", gc._notes_text([{"id": "N1", "text": "x", "tickets": ["MM-70987"]}]))

    # 6. Formatting
    def test_plain_words_lose_their_code_formatting(self):
        self.assertEqual(gc.unformat_plain_words(" - Updated ``AI``-generated recaps."), " - Updated AI-generated recaps.")
        self.assertEqual(gc.unformat_plain_words("Uses ``SAML`` and ``AI`` now."), "Uses SAML and AI now.")
        kept = "Set ``GOMAXPROCS``, ``ProductRail``, ``--follow``, ``config.json`` and ``post``-type fields."
        self.assertEqual(gc.unformat_plain_words(kept), kept)

    def test_one_blank_line_before_the_entry_and_before_the_next_release(self):
        content = ("</Note>\n\n\n## Release v12.2 - Feature Release\n\n**Release day: TBD**\n\n\n### Go Version\n - Go.\n\n\n"
                   "## Release v12.1 - Feature Release\n\n - Old.\n")
        self.assertEqual(gc.normalize_entry_spacing(content, "v12.2"),
                         "</Note>\n\n## Release v12.2 - Feature Release\n\n**Release day: TBD**\n\n### Go Version\n - Go.\n\n"
                         "## Release v12.1 - Feature Release\n\n - Old.\n")

    def test_a_new_entry_is_inserted_with_one_blank_line_each_side(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "c.mdx")
            with open(path, "w") as f:
                f.write("---\ntitle: x\n---\n\n<Note>\n" + gc.HEADER_END_MARKER + "\n\n## Release v12.1 - Feature Release\n\n - Old.\n")
            gc.insert_changelog_entry("## Release v12.2 - Feature Release\n\n - New.\n\n", path)
            with open(path) as f:
                text = f.read()
        self.assertIn("</Note>\n\n## Release v12.2 - Feature Release\n\n - New.\n\n## Release v12.1", text)


FIXTURES = Path(__file__).resolve().parent / "fixtures" / "changelog"
REPO_ROOT = Path(__file__).resolve().parents[2]
# The v12.2 entry as the first auto run wrote it plus the earlier review edits (5d6de28), and as
# reviewed on mattermost/mattermost#40345 (76f66438): settings by plan with headings that name every
# plan, Important Upgrade Notes, the <Important> block, the audit events and endpoints added, and
# the two settings that shipped in v12.1 taken out.
V122_BEFORE = (FIXTURES / "v12.2-entry-5d6de28299.mdx").read_text()
V122_REVIEWED = (FIXTURES / "v12.2-entry-76f66438ba.mdx").read_text()
# config-change-checker wrote these into #38637's note, but both shipped in v12.1. The release-diff
# check that drops such lines comes with mattermost/mattermost#40396; here they are taken out first.
V122_SHIPPED_IN_V12_1 = ("``EnableFileIndexing``", "``AdditionalScopes``")


def _upgrade_impact(entry: str) -> str:
    return entry[entry.index("### Upgrade Impact"):entry.index("### Improvements")]


def _config_json(entry: str) -> str:
    section = entry[entry.index("#### config.json"):]
    return section[:re.search(r"\n#{2,4} |\n<Important>", section).start()]


def _v122_generated(resolver, report) -> str:
    before = "\n".join(line for line in V122_BEFORE.split("\n") if not any(s in line for s in V122_SHIPPED_IN_V12_1))
    out = gc.group_config_plans(gc.rename_upgrade_notes(before), resolver, report)
    return gc.apply_upgrade_important(out, "v12.2", gc.previous_feature_release("v12.2.0", "v12.1.0"))[0]


class V122ReviewTest(unittest.TestCase):
    """Amy's review of the v12.2 changelog (mattermost/mattermost#40345, commit 494e7ad)."""

    def setUp(self):
        self.resolver = gc.changelog_release.PlanResolver(root=str(REPO_ROOT))

    def test_the_generator_writes_the_reviewed_config_json(self):
        out = _v122_generated(self.resolver, [])
        self.assertEqual(_config_json(out), _config_json(V122_REVIEWED))
        self.assertIn("<Important>", _upgrade_impact(out))
        self.assertIn("#### Important Upgrade Notes", _upgrade_impact(out))

    # 1. config.json by plan
    def test_v12_2_settings_by_plan(self):
        report = []
        _v122_generated(self.resolver, report)
        plans = {item["setting"].split(".")[-1]: (item["plan"], item["confirmed"]) for item in report}
        self.assertEqual(plans, {
            "RedisEnableTLS": ("Enterprise Advanced", True), "RedisTLSCA": ("Enterprise Advanced", True),
            "RedisTLSClientCert": ("Enterprise Advanced", True), "RedisTLSClientKey": ("Enterprise Advanced", True),
            "RedisTLSSkipVerify": ("Enterprise Advanced", True), "RestrictUnauthenticatedWebappPlugins": ("All", True),
            "PreviewLandingPath": ("All", False)})
        self.assertIn("the ent-adv badge", next(i["basis"] for i in report if i["setting"].endswith("RedisEnableTLS")))

    def test_headings_only_when_non_empty_and_removed_settings_last(self):
        text = ("#### config.json\nNew setting options were added.\n - **Changes to All plans:**\n"
                "   - Under ``CacheSettings`` in ``config.json``, added ``RedisEnableTLS`` configuration setting. [[N1]]\n"
                " - Removed ``LdapSettings.LoginButtonColor`` configuration setting from the database. [[N2]]\n")
        out = gc.group_config_plans(text, self.resolver, [])
        self.assertEqual(out, "#### config.json\nNew setting options were added.\n - **Changes to Enterprise Advanced plan:**\n"
                              "   - Under ``CacheSettings`` in ``config.json``, added ``RedisEnableTLS`` configuration setting. [[N1]]\n"
                              " - Removed ``LdapSettings.LoginButtonColor`` configuration setting from the database. [[N2]]\n")

    def test_a_console_plan_gate_wins_and_an_unknown_setting_is_not_confirmed(self):
        admin = ("  page: {\n    url: 'site/x',\n    isHidden: it.not(it.minLicenseTier(LicenseSkus.Professional)),\n"
                 "    schema: {\n      settings: [\n        {\n          key: 'XSettings.Gated',\n        },\n      ],\n    },\n  },\n")
        files = {gc.changelog_release.ADMIN_DEFINITION: admin}
        resolver = gc.changelog_release.PlanResolver(read=files.get, docs=[])
        self.assertEqual(resolver.plan("XSettings", "Gated")["plan"], "Professional")
        unknown = resolver.plan("XSettings", "Nowhere")
        self.assertEqual((unknown["plan"], unknown["confirmed"]), ("All", False))
        text = "#### config.json\n - **Changes to All plans:**\n   - Under ``XSettings`` in ``config.json``, added ``Gated``. [[N1]]\n"
        self.assertIn(" - **Changes to Professional, Enterprise, and Enterprise Advanced plans:**\n", gc.group_config_plans(text, resolver, []))

    def test_a_license_feature_gate_gives_that_feature_s_plan(self):
        admin = ("  page: {\n    url: 'environment/cache',\n    isHidden: it.any(\n      it.not(it.licensedForFeature('Cluster')),\n    ),\n"
                 "    schema: {\n      settings: [\n        {\n          key: 'CacheSettings.RedisEnableTLS',\n        },\n      ],\n    },\n  },\n"
                 "  other: {\n    url: 'site/y',\n    isHidden: it.not(it.licensedForFeature('OpenId')),\n"
                 "    schema: {settings: [{key: 'OpenIdSettings.Scope'}]},\n  },\n")
        resolver = gc.changelog_release.PlanResolver(read={gc.changelog_release.ADMIN_DEFINITION: admin}.get, docs=[])
        result = resolver.plan("CacheSettings", "RedisEnableTLS")
        self.assertEqual((result["plan"], result["confirmed"]), ("Enterprise", True))
        self.assertIn("Cluster license feature, which comes with Enterprise", result["basis"])
        self.assertEqual(resolver.plan("OpenIdSettings", "Scope")["plan"], "Professional")
        unknown = gc.changelog_release.PlanResolver(read={gc.changelog_release.ADMIN_DEFINITION: admin.replace("'Cluster'", "'Cloud'")}.get,
                                                    docs=[]).plan("CacheSettings", "RedisEnableTLS")
        self.assertEqual((unknown["plan"], unknown["confirmed"]), ("All", False))

    def test_the_last_setting_on_a_page_doesn_t_take_the_next_page_s_gate(self):
        admin = ("  first: {\n    url: 'site/a',\n    schema: {\n      settings: [\n        {\n          key: 'ASettings.Last',\n"
                 "        },\n      ],\n    },\n  },\n  second: {\n    url: 'site/b',\n"
                 "    isHidden: it.not(it.minLicenseTier(LicenseSkus.EnterpriseAdvanced)),\n    schema: {settings: [{key: 'BSettings.X'}]},\n  },\n")
        resolver = gc.changelog_release.PlanResolver(read={gc.changelog_release.ADMIN_DEFINITION: admin}.get, docs=[])
        self.assertEqual(resolver.console_gates("ASettings", "Last"), ([], []))
        self.assertEqual(resolver.console_gates("BSettings", "X")[0], ["Enterprise Advanced"])

    def test_the_docs_badge_comes_from_the_exact_section_on_any_page(self):
        pages = {
            "a.mdx": "## X settings\n<PlanAvailability slug=\"ent-adv\" />\n\n#### Enable\n<code>XSettings</code> <code>Enable</code>\n",
            "b.mdx": "## Y settings\n<PlanAvailability slug=\"pro-plus\" />\n\n#### Enable\n<code>YSettings</code> <code>Enable</code>\n",
        }
        resolver = gc.changelog_release.PlanResolver(read=pages.get, docs=["a.mdx", "b.mdx"])
        self.assertEqual(resolver.docs_badge("YSettings", "Enable")[:2], ("pro-plus", True))
        self.assertEqual(resolver.plan("YSettings", "Enable")["plan"], "Professional")
        self.assertEqual(resolver.docs_badge("ZSettings", "Enable")[0], "ent-adv")  # no exact match: the name alone

    def test_older_heading_wordings_name_the_same_plan(self):
        self.assertEqual([gc.changelog_release.heading_plan(f" - {h}") for h in gc.changelog_release.PLAN_HEADINGS.values()],
                         list(gc.changelog_release.PLAN_ORDER))
        for old, plan in ((" - **Changes to Enterprise Advanced Plans:**", "Enterprise Advanced"),
                          (" - **Changes to Enterprise Plans:**", "Enterprise"), (" - **Changes to all plans:**", "All")):
            self.assertEqual(gc.changelog_release.heading_plan(old), plan)

    def test_a_later_run_adds_to_an_existing_heading_worded_the_old_way(self):
        entry = ("## Release v12.2 - x\n\n### Upgrade Impact\n\n#### config.json\nNew setting options.\n"
                 " - **Changes to Enterprise Plans:**\n   - Existing setting.\n - **Changes to All Plans:**\n   - Another.\n"
                 " - Removed ``A.B`` configuration setting.\n\n### Bug Fixes\n - Fixed.\n")
        fragment = ("### Upgrade Impact\n#### config.json\n - **Changes to Enterprise Advanced plan:**\n   - New advanced.\n"
                    " - **Changes to Enterprise and Enterprise Advanced plans:**\n   - New enterprise.\n")
        config = gc.merge_into_entry(entry, "v12.2", fragment).split("#### config.json\n", 1)[1].split("\n\n", 1)[0]
        self.assertEqual(config.splitlines()[1:], [
            " - **Changes to Enterprise Advanced plan:**", "   - New advanced.",
            " - **Changes to Enterprise Plans:**", "   - Existing setting.", "   - New enterprise.",
            " - **Changes to All Plans:**", "   - Another.", " - Removed ``A.B`` configuration setting."])

    def test_the_report_lists_settings_whose_plan_isn_t_confirmed(self):
        status = "\n".join(gc.render_status({"preflight": [], "notes": {"prs_merged": 0, "with_notes": 0, "intentional": 0, "missing": 0},
                                              "missing_by_owner": [], "note_quality": [], "doc_links": [], "doc_links_unclear": [],
                                              "repos_unaudited": [], "not_placed": [], "restated": [], "links_checked": 0,
                                              "broken_links": [], "gaps": [], "config_plans": [
                                                  {"setting": "CloudSettings.PreviewLandingPath", "plan": "All", "confirmed": False,
                                                   "basis": "no configuration docs entry or System Console license check found"},
                                                  {"setting": "CacheSettings.RedisEnableTLS", "plan": "Enterprise Advanced",
                                                   "confirmed": True, "basis": "the ent-adv badge"}]}))
        self.assertIn("1 of 2 new setting(s) grouped by a plan", status)
        self.assertIn("`CloudSettings.PreviewLandingPath`", status)
        self.assertIn("plan not confirmed: no configuration docs entry or System Console license check found. "
                      "Listed under All plans", status)

    # 2. Important Upgrade Notes
    def test_generated_text_uses_the_new_name(self):
        self.assertEqual(gc.rename_upgrade_notes("### Upgrade Impact\n#### Compatibility\n - x.\n"),
                         "### Upgrade Impact\n#### Important Upgrade Notes\n - x.\n")
        self.assertIn("`#### Important Upgrade Notes`", gc.SYSTEM_PROMPT)
        self.assertNotIn("`#### Compatibility`", gc.SYSTEM_PROMPT)
        self.assertIn("Important Upgrade Notes", gc.H4_ORDER["Upgrade Impact"])

    def test_the_reviewer_routing_reads_either_name(self):
        sections = [{"section": "Upgrade Impact", "subsection": "Compatibility", "items": [{"text": "x"}]}]
        self.assertEqual(gc.changelog_release.reviewers_for(sections, {"Upgrade Impact/Important Upgrade Notes": ["amy"]}), ["amy"])
        sections[0]["subsection"] = "Important Upgrade Notes"
        self.assertEqual(gc.changelog_release.reviewers_for(sections, {"Upgrade Impact/Compatibility": ["amy"]}), ["amy"])

    # 3. The <Important> block
    def test_the_previous_release_is_the_diff_base(self):
        self.assertEqual(gc.previous_feature_release("v12.2.0", "v12.1.0"), "v12.1")
        self.assertEqual(gc.previous_feature_release("v12.0.0", "v11.11.0"), "v11.11")
        self.assertEqual(gc.previous_feature_release("v12.2.0", "origin/release-12.1"), "v12.1")
        self.assertEqual(gc.previous_feature_release("v12.3.0", ""), "v12.2")
        self.assertIsNone(gc.previous_feature_release("v13.0.0", ""))

    def test_the_block_is_added_once_and_never_edited(self):
        self.assertEqual(gc.apply_upgrade_important(V122_REVIEWED, "v12.2", "v12.1"), (V122_REVIEWED, "kept"))
        edited = V122_REVIEWED.replace("for rollback steps", "for the rollback steps")
        self.assertEqual(gc.apply_upgrade_important(edited, "v12.2", "v11.11"), (edited, "kept"))

    def test_the_block_is_there_even_with_no_upgrade_notes(self):
        entry = ("## Release v12.3 - Feature Release\n\n**Release day: TBD**\n\n### Improvements\nSee x.\n\n"
                 "#### User Interface\n - Added a page.\n")
        out, action = gc.apply_upgrade_important(entry, "v12.3", "v12.2")
        self.assertEqual(action, "added")
        self.assertIn("**Release day: TBD**\n\n### Upgrade Impact\n\n<Important>\n\nIf you upgrade from a release earlier than "
                      "v12.2, please read", out)
        self.assertIn("mitigation strategy.\n\n</Important>\n\n### Improvements", out)

    def test_new_upgrade_notes_merge_above_the_block(self):
        fragment = "### Upgrade Impact\n#### Important Upgrade Notes\n - A new upgrade note.\n"
        merged = gc.merge_into_entry(V122_REVIEWED, "v12.2", fragment)
        self.assertLess(merged.index("A new upgrade note."), merged.index("<Important>"))
        self.assertEqual(merged.count("<Important>"), 1)

    def test_the_block_s_pages_are_in_the_docs(self):
        for url in re.findall(r"\]\((https://docs\.mattermost\.com/[^)]+)\)", gc.UPGRADE_IMPORTANT):
            path = url.removeprefix("https://docs.mattermost.com/").removesuffix(".html")
            self.assertTrue((REPO_ROOT / "docs" / "main" / f"{path}.mdx").exists(), url)


if __name__ == "__main__":
    unittest.main()

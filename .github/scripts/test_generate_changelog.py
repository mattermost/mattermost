#!/usr/bin/env python3
"""Regression tests for changelog merge, attribution, and bullet normalization."""

import os
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

#### Compatibility
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
        self.assertLess(config.find("#### Compatibility"), config.find("<Important>"))
        self.assertLess(merged.find("</Important>"), merged.find("### Improvements"))
        self.assertEqual(config.count("**Changes to Enterprise Advanced plan:**"), 1)
        self.assertIn("ExistingSetting", config)
        self.assertIn("sidebar failed to refresh", merged)
        self.assertIn("sidebar kept its old state", merged)

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

    def test_unattributed_note_refuses_the_run_and_is_not_included(self):
        sources = {
            "N1": "mattermost/mattermost#1",
            "N2": "mattermost/mattermost#2",
        }
        with self.assertRaises(RuntimeError) as caught:
            gc.require_sources_attributed(sources, {"N1"})
        self.assertIn("mattermost/mattermost#2", str(caught.exception))

        included = {sources[note_id] for note_id in {"N1"} if note_id in sources}
        self.assertEqual(included, {"mattermost/mattermost#1"})
        self.assertEqual(gc.unattributed_sources(sources, {"N1"}), ["mattermost/mattermost#2"])

        # A second note from a PR that was only partly marked still fails the run.
        shared = {"N1": "mattermost/mattermost#1", "N2": "mattermost/mattermost#1"}
        with self.assertRaises(RuntimeError):
            gc.require_sources_attributed(shared, {"N1"})

        gc.require_sources_attributed(sources, {"N1", "N2"})


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

### Improvements
See [this blog post](https://example.com) on the highlights in our latest release.

#### User Interface
 - A reviewer rewrote this bullet completely.

### Bug Fixes
 - Fixed an issue that was already here.

### Go Version
 - v12.1 is built with Go ``v1.26.10``.
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
            for name in ("get_milestone_number", "get_merged_prs", "polish_with_ai", "VERSION", "MILESTONE_TITLE", "REPOS")
        }
        self.saved_derived = gc.changelog_release.derived_notes
        self.saved_show = gc.changelog_release.git_show
        self.saved_env = dict(os.environ)
        gc.VERSION = gc.MILESTONE_TITLE = "v12.1.0"
        gc.REPOS = ["mattermost/mattermost"]
        gc.get_milestone_number = lambda repo, title: 7
        gc.get_merged_prs = lambda repo, number: self.prs
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
        os.environ.clear()
        os.environ.update(self.saved_env)

    @staticmethod
    def _pr(number, body, merged_at, labels=()):
        return {
            "number": number, "title": f"PR {number}", "body": body,
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
        self.assertIn("1 merged PR(s) need a release-note decision", summary)
        self.assertIn("[mattermost/mattermost#4](https://github.com/mattermost/mattermost/pull/4)", summary)

        with self.assertRaises(RuntimeError) as caught:
            gc.main()
        self.assertIn("already has a v12.1 entry", str(caught.exception))
        os.environ["DRY_RUN"] = "true"
        gc.main()

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


if __name__ == "__main__":
    unittest.main()

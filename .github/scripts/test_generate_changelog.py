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


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Tests for release resolution, release-diff notes and reviewer routing."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import changelog_release as cr  # noqa: E402

LS_REMOTE = "\n".join(
    f"{'0' * 40}\t{ref}"
    for ref in [
        "refs/heads/release-11.7",
        "refs/heads/release-11.12",
        "refs/heads/release-12.0",
        "refs/heads/release-12.1",
        "refs/tags/v11.7.0",
        "refs/tags/v11.12.0",
        "refs/tags/v12.0.0",
        "refs/tags/v12.0.1",
        "refs/tags/v12.1.0-rc1",
    ]
)

V12_ENTRY = "## Release v12.0 - [Major Release](https://example.com) \\{#release-v12-0-major-release}\n"


def files(mapping):
    return lambda path: mapping.get(path)


class ResolveTest(unittest.TestCase):
    def test_schedule_picks_the_cut_but_unreleased_branch(self):
        out = cr.resolve({"EVENT_NAME": "schedule"}, LS_REMOTE, files({}))
        self.assertEqual(out["run"], "true")
        self.assertEqual(out["version"], "v12.1.0")
        self.assertEqual(out["milestone"], "v12.1.0")
        self.assertEqual(out["release_type"], "feature")
        self.assertEqual(out["mode"], "dry_run")
        self.assertEqual(out["head_ref"], "origin/release-12.1")
        self.assertEqual(out["head_fetch"], "+refs/heads/release-12.1:refs/remotes/origin/release-12.1")
        self.assertEqual(out["base_ref"], "v12.0.0")
        self.assertEqual(out["changelog"], "docs/main/product-overview/mattermost-v12-changelog.mdx")

    def test_schedule_mode_variable_enables_auto(self):
        out = cr.resolve({"EVENT_NAME": "schedule", "SCHEDULE_MODE": "auto"}, LS_REMOTE, files({}))
        self.assertEqual(out["mode"], "auto")

    def test_schedule_stops_once_the_entry_is_on_master(self):
        published = files({cr.changelog_path("v12.1.0"): "## Release v12.1 - [Feature Release](x)\n"})
        out = cr.resolve({"EVENT_NAME": "schedule", "SCHEDULE_MODE": "auto"}, LS_REMOTE, published)
        self.assertEqual(out["run"], "false")
        self.assertIn("already has the v12.1 entry", out["reason"])

    def test_schedule_skips_when_nothing_is_pending(self):
        shipped = LS_REMOTE + f"\n{'0' * 40}\trefs/tags/v12.1.0"
        out = cr.resolve({"EVENT_NAME": "schedule"}, shipped, files({}))
        self.assertEqual(out["run"], "false")

    def test_stale_branch_older_than_the_newest_release_is_ignored(self):
        branches, tags = cr.parse_ls_remote(LS_REMOTE + f"\n{'0' * 40}\trefs/heads/release-11.11")
        self.assertEqual(cr.pending_release(branches, tags), (12, 1))

    def test_dispatch_defaults_and_validation(self):
        out = cr.resolve({"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": "v12.2.0"}, LS_REMOTE, files({}))
        self.assertEqual(out["milestone"], "v12.2.0")
        self.assertEqual(out["mode"], "auto")
        self.assertEqual(out["head_ref"], "origin/master")
        self.assertEqual(out["base_ref"], "v12.0.0")

        with self.assertRaises(ValueError):
            cr.resolve({"INPUT_VERSION": "v12.1.0", "INPUT_MILESTONE": "v11.12.0"}, LS_REMOTE, files({}))

        published = files({cr.changelog_path("v12.0.0"): V12_ENTRY})
        with self.assertRaises(ValueError):
            cr.resolve({"INPUT_VERSION": "v12.0.0"}, LS_REMOTE, published)
        preview = cr.resolve({"INPUT_VERSION": "v12.0.0", "INPUT_MODE": "dry_run"}, LS_REMOTE, published)
        self.assertEqual(preview["release_type"], "major")
        self.assertEqual(preview["base_ref"], "v11.12.0")

    def test_release_type(self):
        self.assertEqual(cr.release_type_for("v13.0.0", "auto", ""), "major")
        self.assertEqual(cr.release_type_for("v12.4.0", "", "v11.7, v12.4"), "esr")
        self.assertEqual(cr.release_type_for("v12.4.0", "auto", "v11.7"), "feature")
        self.assertEqual(cr.release_type_for("v12.4.0", "feature", "v12.4"), "feature")
        with self.assertRaises(ValueError):
            cr.release_type_for("v12.4.0", "minor", "")


MAKEFILE_12_0 = """# Plugins Packages
PLUGIN_PACKAGES ?= $(PLUGIN_PACKAGES:)
PLUGIN_PACKAGES += mattermost-plugin-calls-v1.12.5
PLUGIN_PACKAGES += mattermost-plugin-servicenow-v2.4.0
PLUGIN_PACKAGES += mattermost-plugin-msteams-meetings-v3.0.0
PLUGIN_PACKAGES += mattermost-plugin-dataminr-v2.0.0

ifeq ($(FIPS_ENABLED),true)
\tPLUGIN_PACKAGES  = mattermost-plugin-playbooks-v2.12.1%2Bf370c05-fips
\tPLUGIN_PACKAGES += mattermost-plugin-agents-v2.9.0%2Bc234d17-fips
endif
"""

MAKEFILE_12_1 = (
    MAKEFILE_12_0.replace("calls-v1.12.5", "calls-v1.12.6")
    .replace("dataminr-v2.0.0", "dataminr-v3.0.0")
    .replace("PLUGIN_PACKAGES += mattermost-plugin-servicenow-v2.4.0\n", "")
)

WEBSOCKET_OLD = """const (
\tWebsocketEventTyping WebsocketEventType = "typing"
\tWebsocketEventPosted WebsocketEventType = "posted"
\tWebsocketEventOld    WebsocketEventType = "old_event"
)"""
WEBSOCKET_NEW = WEBSOCKET_OLD.replace('"old_event"', '"health_finding_updated"')


class DerivedNotesTest(unittest.TestCase):
    def test_go_version_from_buildenv(self):
        dockerfile = "FROM golang:1.26.10-bookworm@sha256:fe3da92a\nARG NODE_VERSION=24.11.1\n"
        self.assertEqual(cr.go_version_from_buildenv(dockerfile), "go1.26.10")
        self.assertIsNone(cr.go_version_from_buildenv("FROM ubuntu:24.04\n"))
        self.assertIsNone(cr.go_version_from_buildenv(None))

    def test_plugin_packages_ignore_fips_overrides(self):
        packages = cr.plugin_packages(MAKEFILE_12_0)
        self.assertEqual(packages["mattermost-plugin-calls"], "v1.12.5")
        self.assertEqual(packages["mattermost-plugin-msteams-meetings"], "v3.0.0")
        self.assertNotIn("mattermost-plugin-playbooks", packages)

    def test_plugin_notes_match_the_changelog_convention(self):
        notes = cr.plugin_notes(cr.plugin_packages(MAKEFILE_12_0), cr.plugin_packages(MAKEFILE_12_1))
        texts = [note["text"] for note in notes]
        self.assertEqual(texts, [
            "Pre-packaged Calls plugin version [v1.12.6](https://github.com/mattermost/mattermost-plugin-calls/releases/tag/v1.12.6).",
            "Pre-packaged Dataminr plugin version [v3.0.0](https://github.com/mattermost/mattermost-plugin-dataminr/releases/tag/v3.0.0).",
            "Removed the pre-packaged ServiceNow plugin; it is no longer included with the server.",
        ])
        self.assertEqual(
            [note["source"] for note in notes],
            ["plugin:mattermost-plugin-calls@v1.12.6", "plugin:mattermost-plugin-dataminr@v3.0.0",
             "plugin:mattermost-plugin-servicenow@removed"],
        )

    def test_derived_notes_from_a_release_diff(self):
        trees = {
            "v12.0.0": {cr.PLUGIN_MAKEFILE: MAKEFILE_12_0, cr.WEBSOCKET_EVENTS_FILE: WEBSOCKET_OLD},
            "origin/release-12.1": {
                cr.PLUGIN_MAKEFILE: MAKEFILE_12_1,
                cr.WEBSOCKET_EVENTS_FILE: WEBSOCKET_NEW,
                f"{cr.MIGRATIONS_DIR}/000231_create_health_findings.up.sql": "CREATE TABLE IF NOT EXISTS healthfindings (id varchar(26));",
            },
        }
        added = [
            f"{cr.MIGRATIONS_DIR}/000231_create_health_findings.down.sql",
            f"{cr.MIGRATIONS_DIR}/000231_create_health_findings.up.sql",
        ]
        notes = cr.derived_notes(
            "v12.0.0", "origin/release-12.1",
            show=lambda ref, path: trees[ref].get(path),
            added=lambda base, head, path: added,
        )
        sources = [note["source"] for note in notes]
        self.assertIn("websocket:health_finding_updated@added", sources)
        self.assertIn("websocket:old_event@removed", sources)
        self.assertEqual(sources[-1], "migration:000231_create_health_findings")
        self.assertEqual(len([s for s in sources if s.startswith("migration:")]), 1)
        migration = notes[-1]
        self.assertIn("CREATE TABLE IF NOT EXISTS healthfindings", migration["text"])
        self.assertEqual(migration["fallback"], "Added database migration ``000231_create_health_findings``.")
        self.assertTrue(all(note["derived"] for note in notes))
        self.assertTrue(all(" " not in source for source in sources), "sources are space-separated in the PR body")

    def test_git_helpers_separate_absent_paths_from_failures(self):
        import os
        import subprocess
        import tempfile
        repo = tempfile.mkdtemp()
        git = ["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@t"]
        subprocess.run(git + ["init", "-q"], check=True)
        Path(repo, "a.txt").write_text("one\n")
        subprocess.run(git + ["add", "."], check=True)
        subprocess.run(git + ["commit", "-q", "-m", "a"], check=True)
        subprocess.run(git + ["tag", "base"], check=True)
        Path(repo, "b.up.sql").write_text("CREATE TABLE b ();\n")
        subprocess.run(git + ["add", "."], check=True)
        subprocess.run(git + ["commit", "-q", "-m", "b"], check=True)

        cwd = os.getcwd()
        os.chdir(repo)
        try:
            self.assertEqual(cr.git_show("base", "a.txt"), "one\n")
            self.assertIsNone(cr.git_show("base", "b.up.sql"))
            self.assertEqual(cr.git_added_files("base", "HEAD", "."), ["b.up.sql"])
            with self.assertRaises(RuntimeError):
                cr.git_show("origin/release-99.0", "a.txt")
            with self.assertRaises(RuntimeError):
                cr.git_added_files("v99.0.0", "HEAD", ".")
        finally:
            os.chdir(cwd)

    def test_no_refs_no_notes(self):
        self.assertEqual(cr.derived_notes("", "origin/release-12.1"), [])


class ReviewersTest(unittest.TestCase):
    SECTIONS = [
        {"section": "Upgrade Impact", "subsection": "Database Schema Changes", "items": [{"text": "x"}]},
        {"section": "Bug Fixes", "subsection": None, "items": [{"text": "y"}]},
        {"section": "API Changes", "subsection": None, "items": []},
    ]

    def test_reviewers_follow_the_sections_touched(self):
        mapping = {
            "Upgrade Impact/*": ["mattermost/server-platform"],
            "API Changes": "api-owner",
            "Bug Fixes": ["qa-lead", "mattermost/server-platform"],
        }
        self.assertEqual(cr.reviewers_for(self.SECTIONS, mapping), ["mattermost/server-platform", "qa-lead"])

    def test_wildcard_only_when_something_changed(self):
        self.assertEqual(cr.reviewers_for(self.SECTIONS, {"*": ["docs-editor"]}), ["docs-editor"])
        self.assertEqual(cr.reviewers_for([], {"*": ["docs-editor"]}), [])


if __name__ == "__main__":
    unittest.main()

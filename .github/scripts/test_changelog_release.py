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


V12_PUBLISHED = files({"docs/main/product-overview/mattermost-v12-changelog.mdx": V12_ENTRY})


class ResolveTest(unittest.TestCase):
    def test_schedule_picks_the_cut_but_unreleased_branch(self):
        out = cr.resolve({"EVENT_NAME": "schedule"}, LS_REMOTE, V12_PUBLISHED)
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
        out = cr.resolve({"EVENT_NAME": "schedule", "SCHEDULE_MODE": "auto"}, LS_REMOTE, V12_PUBLISHED)
        self.assertEqual(out["mode"], "auto")

    def test_schedule_stops_once_the_entry_is_on_master(self):
        published = files({cr.changelog_path("v12.1.0"): "## Release v12.1 - [Feature Release](x)\n" + V12_ENTRY})
        out = cr.resolve({"EVENT_NAME": "schedule", "SCHEDULE_MODE": "auto"}, LS_REMOTE, published)
        self.assertEqual(out["run"], "false")
        self.assertIn("already has the v12.1 entry", out["reason"])

    def test_schedule_stays_on_a_tagged_release_until_its_entry_is_merged(self):
        tagged = LS_REMOTE + f"\n{'0' * 40}\trefs/tags/v12.1.0\n{'0' * 40}\trefs/heads/release-12.2"
        path = cr.changelog_path("v12.1.0")
        out = cr.resolve({"EVENT_NAME": "schedule"}, tagged, files({path: V12_ENTRY}))
        self.assertEqual((out["run"], out["version"], out["base_ref"]), ("true", "v12.1.0", "v12.0.0"))

        merged = files({path: V12_ENTRY + "\n## Release v12.1 - [Feature Release](x)\n"})
        self.assertEqual(cr.resolve({"EVENT_NAME": "schedule"}, tagged, merged)["version"], "v12.2.0")

        shipped = LS_REMOTE + f"\n{'0' * 40}\trefs/tags/v12.1.0"
        self.assertEqual(cr.resolve({"EVENT_NAME": "schedule"}, shipped, merged)["run"], "false")

    def test_stale_branch_older_than_the_newest_release_is_ignored(self):
        branches, tags = cr.parse_ls_remote(LS_REMOTE + f"\n{'0' * 40}\trefs/heads/release-11.11")
        self.assertEqual(cr.pending_release(branches, tags, lambda release: True), (12, 1))
        self.assertEqual(cr.pending_release(branches, tags), (12, 0))

    def test_dispatched_shorthand_version_is_normalized(self):
        out = cr.resolve({"INPUT_VERSION": "v13.0", "INPUT_MODE": "dry_run"}, LS_REMOTE, files({}))
        self.assertEqual((out["version"], out["milestone"]), ("v13.0.0", "v13.0.0"))
        published = files({cr.changelog_path("v12.0.0"): V12_ENTRY})
        with self.assertRaises(ValueError):
            cr.resolve({"INPUT_VERSION": "12.0"}, LS_REMOTE, published)
        with self.assertRaises(ValueError):
            cr.resolve({"INPUT_VERSION": ""}, LS_REMOTE, files({}))

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


BENCHMARK_REPORT = """# v12.0 Performance Comparison

### Supported users in unbounded test

| v11.7.0 | v12.0.0 | Change |
|---|---|---|
| 16533 | 15820 | \\-4.31% |

### Other results
| 1 | 2 | 100% |
"""


class BenchmarkTest(unittest.TestCase):
    def test_delta_from_the_unbounded_table(self):
        self.assertEqual(cr.benchmark_delta(BENCHMARK_REPORT), -4.31)

    def test_delta_computed_when_the_change_column_is_missing(self):
        self.assertEqual(cr.benchmark_delta(BENCHMARK_REPORT.replace("| \\-4.31% |", "| |")), -4.31)

    def test_no_table_no_delta(self):
        self.assertIsNone(cr.benchmark_delta("# Report\n\nNo results yet."))

    def test_text_within_and_outside_the_interval(self):
        within = cr.benchmark_text("v12.0.0", -4.31)
        self.assertIn("no significant difference: a 4.31% decrease", within)
        self.assertIn("lies within the ``[-5%, +5%]``", within)
        self.assertIn("performance-comparisons/v12.0)", within)
        outside = cr.benchmark_text("v12.0.0", 7.5)
        self.assertIn("showed a 7.50% increase", outside)
        self.assertIn("outside the ``[-5%, +5%]``", outside)

    def test_notes_once_published(self):
        urls = []
        notes = cr.benchmark_notes("v12.0.0", fetch=lambda url: urls.append(url) or BENCHMARK_REPORT)
        self.assertEqual(urls, [cr.BENCHMARK_REPORT_URL.format(version="v12.0")])
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["source"], "benchmark:v12.0")
        self.assertEqual(notes[0]["text"], notes[0]["fallback"])
        self.assertTrue(notes[0]["derived"])

    def test_no_notes_when_unpublished_or_unreachable(self):
        self.assertEqual(cr.benchmark_notes("v12.1.0", fetch=lambda url: None), [])

        def fail(url):
            raise OSError("network down")
        self.assertEqual(cr.benchmark_notes("v12.1.0", fetch=fail), [])


def docs_file(path, status="modified", added=(), removed=0):
    patch = "".join(f"+{line}\n" for line in added) + "-old line\n" * removed
    return {"filename": path, "status": status, "patch": patch}


class DocsLinkTest(unittest.TestCase):
    PAGES = {
        "docs/main/administration-guide/manage/admin/channel-attributes.mdx": "---\ntitle: x\n---\n## Apply an attribute to channels\n",
        "docs/main/administration-guide/configure/site-configuration-settings.mdx": "## Enable file search\n",
        "docs/main/end-user-guide/collaborate/format-messages.mdx": "## Phone links\n",
        "docs/main/for/sre.mdx": "---\nslug: /for/sre\n---\n",
        "docs/develop/integrate/plugins/interactive-dialogs/index.md": "# Dialogs\n",
        "docs/main/product-overview/mattermost-v12-changelog.mdx": "## Release v12.0\n",
    }

    def link(self, files, prs=None, source="mattermost/mattermost#1"):
        prs = prs or {source: {"title": "Feature", "body": "", "head_ref": "feature"}}
        return cr.docs_link(source, prs, lambda s: files.get(s, []), self.PAGES.get)

    def test_page_urls(self):
        self.assertEqual(cr.docs_page_url("docs/main/end-user-guide/collaborate/format-messages.mdx"),
                         "https://docs.mattermost.com/end-user-guide/collaborate/format-messages")
        self.assertEqual(cr.docs_page_url("docs/main/for/sre.mdx", self.PAGES["docs/main/for/sre.mdx"]),
                         "https://docs.mattermost.com/for/sre")
        self.assertEqual(cr.docs_page_url("docs/develop/integrate/plugins/interactive-dialogs/index.md"),
                         "https://docs.mattermost.com/developers/integrate/plugins/interactive-dialogs")
        self.assertEqual(cr.docs_page_url("docs/main/index.mdx", "---\nslug: /\n---\n"), "https://docs.mattermost.com/")
        self.assertIsNone(cr.docs_page_url("docs/site/docusaurus.config.ts"))
        self.assertIsNone(cr.docs_page_url("docs/api/v4/source/posts.yaml"))

    def test_anchors(self):
        self.assertEqual(cr.heading_anchor("How should plugins handle request cancellation?"),
                         "how-should-plugins-handle-request-cancellation")
        self.assertEqual(cr.heading_anchor("Enable channel viewed WebSocket messages"), "enable-channel-viewed-websocket-messages")
        self.assertEqual(cr.heading_anchor("Release v6.3 \\{#release-v6-3}"), "release-v6-3")
        self.assertEqual(cr.heading_anchor("Use ``mmctl`` [import](x.md)"), "use-mmctl-import")

    def test_own_docs_with_an_added_heading_get_an_anchor(self):
        files = {"mattermost/mattermost#1": [
            docs_file("docs/main/administration-guide/configure/site-configuration-settings.mdx",
                      added=["### Enable file search", "", "Turns file search on.", "Default: true."]),
            docs_file("docs/main/product-overview/mattermost-v12-changelog.mdx", added=["a", "b", "c", "d", "e"]),
        ]}
        self.assertEqual(self.link(files), {
            "url": "https://docs.mattermost.com/administration-guide/configure/site-configuration-settings#enable-file-search",
            "basis": "docs/main/administration-guide/configure/site-configuration-settings.mdx changed in the same PR, "
                     "which added the heading \"Enable file search\"",
        })

    def test_feature_page_beats_reference_page_and_trims_do_not_count(self):
        files = {"mattermost/mattermost#1": [
            docs_file("docs/main/administration-guide/configure/site-configuration-settings.mdx", added=["a", "b", "c", "d"]),
            docs_file("docs/main/end-user-guide/collaborate/format-messages.mdx", added=["Phone numbers.", "More.", "Even more."]),
            docs_file("docs/main/administration-guide/manage/admin/channel-attributes.mdx", added=["x"], removed=6),
        ]}
        self.assertEqual(self.link(files)["url"], "https://docs.mattermost.com/end-user-guide/collaborate/format-messages")

    def test_several_comparable_pages_are_left_for_a_reviewer(self):
        files = {"mattermost/mattermost#1": [
            docs_file("docs/main/end-user-guide/collaborate/format-messages.mdx", added=["a", "b", "c", "d"]),
            docs_file("docs/main/administration-guide/manage/admin/channel-attributes.mdx", added=["a", "b", "c"]),
        ]}
        self.assertEqual(self.link(files), {"candidates": [
            "https://docs.mattermost.com/administration-guide/manage/admin/channel-attributes",
            "https://docs.mattermost.com/end-user-guide/collaborate/format-messages",
        ]})

    def test_docs_pr_found_by_jira_key_or_link(self):
        page = "docs/main/administration-guide/manage/admin/channel-attributes.mdx"
        prs = {
            "mattermost/enterprise#7": {"title": "Channel attributes backend", "body": "", "head_ref": "MM-70120-attrs"},
            "mattermost/mattermost#2": {"title": "MM-70120 docs", "body": "", "head_ref": "docs"},
            "mattermost/mattermost#3": {"title": "Unrelated docs", "body": "", "head_ref": "docs2"},
        }
        files = {"mattermost/mattermost#2": [docs_file(page, status="added", added=["## Apply an attribute to channels"])],
                 "mattermost/mattermost#3": [docs_file("docs/main/end-user-guide/collaborate/format-messages.mdx", status="added")]}
        link = self.link(files, prs, "mattermost/enterprise#7")
        self.assertEqual(link["url"], "https://docs.mattermost.com/administration-guide/manage/admin/channel-attributes")
        self.assertIn("docs PR mattermost/mattermost#2, which names MM-70120", link["basis"])

        prs["mattermost/mattermost#2"] = {"title": "Docs", "head_ref": "docs",
                                          "body": "Documents https://github.com/mattermost/enterprise/pull/7."}
        self.assertIn("which links the PR", self.link(files, prs, "mattermost/enterprise#7")["basis"])

        prs["mattermost/mattermost#2"]["body"] = ""
        self.assertEqual(self.link(files, prs, "mattermost/enterprise#7"), {})

    def test_jira_keys_and_references(self):
        body = "#### Summary\nSee MM-1.\n\n#### Ticket Link\nhttps://mattermost.atlassian.net/browse/MM-71075\n\n#### Release Note\nx"
        self.assertEqual(cr.jira_keys("[MM-2] Fix", "mm-3-branch", body), {"MM-2", "MM-3", "MM-71075"})
        self.assertEqual(cr.pr_references("Cherry pick of #38634, see https://github.com/mattermost/enterprise/pull/9 &#123;",
                                          "mattermost/mattermost"),
                         {"mattermost/mattermost#38634", "mattermost/enterprise#9"})

    def test_deleted_page_is_not_linked(self):
        files = {"mattermost/mattermost#1": [docs_file("docs/main/gone.mdx", added=["a", "b", "c", "d"])]}
        self.assertEqual(self.link(files), {})


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

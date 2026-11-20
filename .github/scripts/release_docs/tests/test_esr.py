"""ESR comms in public repos: the ESR docs PR and the mobile ESR PR (mattermost-mobile#9954)."""

import json
import os
import unittest
from datetime import date

from release_docs import __main__ as cli
from release_docs import esr, schedule
from release_docs.result import Result
from release_docs.versions import Version

from .fakes import FakeGitHub
from .test_tasks import real_docs as release_docs_pages

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
ESR = "v10.11,v11.7,v12.4"
DESKTOP = json.dumps({"v10.11": "v5.13", "v11.7": "v6.2", "v12.4": "v6.5"})
SERVER_RELEASES = """| **Release** | **Released on** | **Support ends** |
|:---|:---|:---|
| v12.4 [Download](x) \\| [Changelog](y) | 2027-02-16 | 2028-02-15 [EXTENDED](./release-policy#release-types) |
| v11.7 [Download](x) \\| [Changelog](y) | 2026-05-15 | 2027-05-15 [EXTENDED](./release-policy#release-types) |
| v10.11 [Download](x) \\| [Changelog](y) | 2025-08-15 | 2026-08-15 [EXTENDED](./release-policy#release-types) |
"""
V10_11 = esr.Esr(Version(10, 11), date(2025, 8, 15), Version(11, 7), date(2026, 5, 15))  # #9954's ESRs


def real_docs():
    """The release docs pages, and the ESR docs pages as they are in this checkout."""
    files = release_docs_pages()
    for path in esr.DOCS_FILES:
        with open(os.path.join(ROOT, path), encoding="utf-8") as f:
            files[path] = f.read()
    return files


def esr_list():
    return esr.esrs(ESR, SERVER_RELEASES)


def mobile_files(side: str) -> dict:
    """The four files #9954 changed, before (v10.11) or after (v11.7) it."""
    files = {}
    for path in esr.MOBILE_FILES:
        with open(os.path.join(os.path.dirname(__file__), "fixtures", "mobile-esr-9954", side, path), encoding="utf-8") as f:
            files[path] = f.read()
    return files


def esr_github(mobile_side: str = "before") -> FakeGitHub:
    gh = FakeGitHub()
    docs = real_docs()
    gh.add_repo(cli.SERVER_REPO, {**{p: docs[p] for p in esr.DOCS_FILES},
                                  cli.release_docs_pr.SERVER_RELEASES: SERVER_RELEASES})
    gh.add_repo(esr.MOBILE_REPO, mobile_files(mobile_side), default="main")
    return gh


class EsrTest(unittest.TestCase):
    def test_two_dates_per_esr_and_the_next_working_day(self):
        v11_7 = esr_list()[1]
        self.assertEqual(v11_7.dates, {esr.BEFORE: date(2027, 2, 15), esr.ENDED: date(2027, 5, 15)})
        # Feb 15, 2027 is a Monday; May 15, 2027 is a Saturday, so it runs on Monday May 17.
        self.assertEqual(esr.due(date(2027, 2, 15), esr_list(), schedule.due_on), [(v11_7, esr.BEFORE)])
        self.assertEqual(esr.due(date(2027, 5, 15), esr_list(), schedule.due_on), [])
        self.assertEqual(esr.due(date(2027, 5, 17), esr_list(), schedule.due_on), [(v11_7, esr.ENDED)])

    def test_docs_paths_mapped_and_edited(self):
        docs = real_docs()
        files = {p: docs[p] for p in esr.DOCS_FILES}
        result = Result(esr.DOCS_TASK, "v11.7.0-before")
        changed = esr.docs_changes(esr_list()[1], esr.BEFORE, files, {}, result)
        self.assertEqual(sorted(changed), sorted(esr.SNIPPETS))
        self.assertIn("Support for Mattermost Server v11.7 [Extended Support Release](/product-overview/release-policy#"
                      "extended-support-releases) will come to the end of its life cycle on May 15, 2027. Upgrading to "
                      "[Mattermost Server v12.4 or later](/product-overview/mattermost-server-releases) is required.",
                      changed["docs/main/product-overview/common-esr-support-rst.mdx"])
        self.assertEqual(result.todos, [])
        ended = Result(esr.DOCS_TASK, "v11.7.0-ended")
        changed = esr.docs_changes(esr_list()[1], esr.ENDED, files, {}, ended)
        policy = changed[esr.RELEASE_POLICY]
        self.assertIn("  - v11.7 & Desktop App v6.2: Support ended May 15, 2027", policy)
        self.assertIn("v11.7 & Desktop App v6.2 Extended Support :crit, :done, 2026-05-15, 2027-05-15", policy)
        self.assertEqual(len(ended.todos), 1)  # the chart, flagged for a person to check
        self.assertIn("has come to the end of its life cycle on May 15, 2027",
                      changed["docs/main/administration-guide/upgrade/prepare-to-upgrade-mattermost.mdx"])

    def test_weekday_run_opens_the_docs_and_mobile_prs_once(self):
        gh = esr_github(mobile_side="after")  # mattermost-mobile as #9954 left it: v11.7
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "REVIEWERS": "release-lead"}
        # Three months before v11.7's support ends, twice.
        first = cli.run_esr_comms(cli.SCHEDULED, env, gh, date(2027, 2, 15), True, gh)
        self.assertIn("mobile ESR PR: Opened draft PR mattermost/mattermost-mobile#", first.text)
        self.assertIn("Review requested from release-lead.", first.text)
        result = cli.run_esr_comms(cli.SCHEDULED, env, gh, date(2027, 2, 15), True, gh)
        self.assertIn("mobile ESR PR: PR #101 is already up to date.", result.text)
        self.assertEqual(len(gh.pulls[cli.SERVER_REPO]), 1)
        self.assertIn("release-agent/v11.7.0-before/esr-docs", gh.repos[cli.SERVER_REPO]["branches"])
        self.assertEqual([p["head"] for p in gh.pulls[esr.MOBILE_REPO]], ["release-agent/v12.4.0-before/mobile-esr"])
        self.assertEqual(gh.pulls[esr.MOBILE_REPO][0]["base"], "main")
        # When support ends: the docs PR only, no mobile PR and no ticket.
        ended = cli.run_esr_comms(cli.SCHEDULED, env, gh, date(2027, 5, 17), True, gh)
        self.assertIn("v11.7 ESR, end of support (May 15, 2027): docs PR: Opened draft PR", ended.text)
        self.assertEqual(len(gh.pulls[esr.MOBILE_REPO]), 1)
        self.assertEqual(cli.run_esr_comms(cli.SCHEDULED, env, gh, date(2027, 3, 1), True, gh).text,
                         "Not due: no ESR goes out of support in three months or today.")

    def test_dry_run_writes_nothing(self):
        gh = esr_github()
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "ESR_STAGE": "before"}
        result = cli.run_esr_comms("v10.11", env, gh, date(2026, 5, 15), False, gh)
        self.assertIn("Dry run: would have opened a draft PR from `release-agent/v11.7.0-before/mobile-esr` in "
                      "mattermost/mattermost-mobile", result.text)
        self.assertEqual(gh.writes, [])


class MobileEsrPrTest(unittest.TestCase):
    def test_v11_7_edits_match_9954(self):
        # With v9.11 listed, the ESR two before v11.7 is v9.11: '9.11.0', which #9954's file already has.
        result = esr.mobile_result(V10_11, mobile_files("before"), "v9.11," + ESR)
        self.assertEqual(result.files, mobile_files("after"))  # the four files, byte for byte
        self.assertEqual(result.branch, "release-agent/v11.7.0-before/mobile-esr")
        self.assertEqual(result.body, (
            "QA Test Steps:\n"
            "1. Connect to a server with a version lower than ESR (e.g. v11.6). Expected: Prompt to upgrade the server is received.\n"
            "2. Connect to a server with a version equal to ESR (v11.7). Expected: Prompt to upgrade the server is not received.\n"
            "3. Connect to a server with a version greater than ESR (e.g. v11.8). Expected: Prompt to upgrade the server is not "
            "received.\n\n"
            "Merge on August 15, 2026, when v10.11 goes out of support.\n\n"
            "```release-note\nUpdated minimum supported version to v11.7.0.\n```\n"))
        self.assertEqual(result.todos, [])  # no TODO: '9.11.0' is the ESR two before, and it is left as it is
        self.assertIn("MIN_REQUIRED_VERSION is already 9.11.0.", result.notes)

    def test_min_required_version_is_the_esr_two_before_the_new_one(self):
        # v12.4.0 (a February ESR): the ESRs before it are v9.11, v10.11, v11.7 -> '10.11.0', whatever the list's order.
        v12_4 = esr.mobile_result(esr_list()[1], mobile_files("after"), "v12.4, v10.11, v13.1, v9.11, v11.7")
        self.assertEqual(v12_4.todos, [])
        self.assertIn("export const MIN_REQUIRED_VERSION = '10.11.0';", v12_4.files[esr.MOBILE_CONSTANTS])
        self.assertIn("export const FULL_VERSION = '12.4.0';\nexport const MAJOR_VERSION = 12;\n"
                      "export const MIN_VERSION = 4;\nexport const PATCH_VERSION = 0;", v12_4.files[esr.MOBILE_CONSTANTS])

    def test_fewer_than_two_esrs_before_the_new_one_is_a_todo(self):
        result = esr.mobile_result(V10_11, mobile_files("before"), ESR)
        self.assertEqual(len(result.todos), 1)
        self.assertIn("CHANGELOG_ESR_VERSIONS lists 1 ESR(s) before v11.7, but MIN_REQUIRED_VERSION is the ESR two "
                      "before it, so it wasn't set", result.todos[0])
        self.assertEqual(result.files, mobile_files("after"))  # the value is left as it was

    def test_a_rerun_updates_the_same_pr_and_a_persons_commit_stops_it(self):
        gh = esr_github()
        env = {"ESR_VERSIONS": "v8.1," + ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "ESR_STAGE": "before"}
        cli.run_esr_comms("v10.11", env, gh, date(2026, 5, 15), True, gh)
        branch = "release-agent/v11.7.0-before/mobile-esr"
        self.assertIn("MIN_REQUIRED_VERSION = '8.1.0'", gh.head_files(esr.MOBILE_REPO, branch)[esr.MOBILE_CONSTANTS])
        result = cli.run_esr_comms("v10.11", {**env, "ESR_VERSIONS": "v9.11," + ESR}, gh, date(2026, 5, 15), True, gh)
        self.assertEqual(len(gh.pulls[esr.MOBILE_REPO]), 1)
        self.assertIn("mobile ESR PR: Updated PR mattermost/mattermost-mobile#", result.text)
        self.assertEqual(gh.head_files(esr.MOBILE_REPO, branch), mobile_files("after"))
        gh.push(esr.MOBILE_REPO, branch, {"README.md": "edited"})
        result = cli.run_esr_comms("v10.11", env, gh, date(2026, 5, 15), True, gh)
        self.assertIn("mobile ESR PR: Nothing written:", result.text)

    def test_without_a_mobile_token_the_run_fails_and_its_summary_has_the_changes(self):
        gh = esr_github()
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "ESR_STAGE": "before"}
        result = cli.run_esr_comms("v10.11", env, gh, date(2026, 5, 15), True, None)
        self.assertEqual(gh.pulls[esr.MOBILE_REPO], [])  # nothing written there
        self.assertFalse([w for w in gh.writes if w[1] == esr.MOBILE_REPO])
        self.assertTrue(result.failed)
        self.assertIn("no changelog write app token for mattermost/mattermost-mobile (is the app installed there?), so "
                      "the mobile ESR PR was not opened; its changes are in this run's summary", result.todos[-1])
        self.assertIn("#### The mobile ESR PR, to open by hand in mattermost/mattermost-mobile", result.text)
        self.assertIn("-export const FULL_VERSION = '10.11.0';\n-export const MAJOR_VERSION = 10;\n"
                      "-export const MIN_VERSION = 11;\n+export const FULL_VERSION = '11.7.0';\n"
                      "+export const MAJOR_VERSION = 11;\n+export const MIN_VERSION = 7;\n", result.text)  # as in #9954
        self.assertIn("Updated minimum supported version to v11.7.0.", result.text)
        summary = cli.summary(result, "ESR comms.", "live", {}, [])
        self.assertIn("### Output", summary)
        self.assertIn("+export const FULL_VERSION = '11.7.0';", summary)


if __name__ == "__main__":
    unittest.main()

import unittest
from datetime import date

from release_agent import checks, rules
from release_agent.agent import template_vars
from release_agent.release_calendar import Release
from release_agent.tests.fakes import FakeGitHub, FakeHub, FakeJira

MM, ENT = "mattermost/mattermost", "mattermost/enterprise"
RULES = {rule["task"]: rule for rule in rules.load_yaml(rules.RULES_PATH)["rules"]}
NAMING = rules.load_yaml(rules.RULES_PATH)["naming"]


def release():
    return Release(12, 2, {"branch_cut": date(2026, 10, 19), "code_freeze": date(2026, 10, 28),
                           "final_build": date(2026, 11, 9), "release_day": date(2026, 11, 16)})


def context(github=None, jira=None, hub=None, has_branch=True, rc_numbers=(1, 2)):
    rel = release()
    return checks.Context(release=rel, today=date(2026, 11, 4), vars=template_vars(rel, NAMING, list(rc_numbers)),
                          has_branch=has_branch, rc_numbers=list(rc_numbers), github=github or FakeGitHub(),
                          jira=jira or FakeJira(), hub=hub or FakeHub(), testing_alerts_channel="alerts")


def pr(number, title="A change", login="dev", state="closed", merged_at="2026-10-20T10:00:00Z"):
    return {"number": number, "title": title, "state": state, "html_url": f"https://github.com/x/pull/{number}",
            "user": {"login": login}, "assignees": [], "pull_request": {"merged_at": merged_at}}


def commit(message, sha="s"):
    return {"sha": sha, "commit": {"message": message}}


def issue(key, summary="Bug", labels=(), fix_versions=(), assignee=None):
    return {"key": key, "fields": {"summary": summary, "labels": list(labels),
                                   "fixVersions": [{"name": v} for v in fix_versions],
                                   "assignee": {"displayName": assignee} if assignee else None}}


class TemplateTest(unittest.TestCase):
    def test_vars(self):
        values = template_vars(release(), NAMING, [1, 3])
        self.assertEqual(values["milestone"], "v12.2.0")
        self.assertEqual(values["fix_version"], "v12.2 (November 2026)")
        self.assertEqual(values["release_channels"], ["Release: v12.2", "Release: v12.2 (ESR)"])
        self.assertEqual(values["branch"], "release-12.2")
        self.assertEqual(values["rc_tag"], "v12.2.0-rc3")
        self.assertEqual(values["branch_cut"], "2026-10-19")

    def test_fix_version_needs_a_release_day(self):
        rel = Release(12, 2, {"branch_cut": date(2026, 10, 19)})
        values = template_vars(rel, NAMING, [])
        self.assertNotIn("fix_version", values)
        self.assertEqual(values["release_channels"], ["Release: v12.2", "Release: v12.2 (ESR)"])
        ctx = checks.Context(release=rel, today=date(2026, 11, 4), vars=values, has_branch=True, rc_numbers=[],
                             github=FakeGitHub(), jira=FakeJira(), hub=FakeHub(), testing_alerts_channel="alerts")
        with self.assertRaisesRegex(checks.CheckError, r"\{fix_version\} isn't known for this release"):
            checks.open_release_items(ctx, RULES["open-release-items"])


class OpenReleaseItemsTest(unittest.TestCase):
    def test_groups_jira_and_prs_by_assignee(self):
        jira = FakeJira({r'fixVersion = "v12\.2 \(November 2026\)"': [issue("MM-1", assignee="Alice"), issue("MM-2")]})
        github = FakeGitHub()
        github.searches[r"repo:mattermost/mattermost is:pr is:open milestone:\"v12\.2\.0\""] = [pr(10, login="alice", state="open")]
        github.searches[r"repo:mattermost/enterprise is:pr is:open"] = [pr(20, title="Secret thing", state="open")]
        result = checks.open_release_items(context(github, jira), RULES["open-release-items"])
        self.assertEqual(result.status, checks.INFO)
        self.assertEqual(result.summary, "2 open Jira issues and 2 open PRs (1 in a private repo)")
        self.assertEqual([(i.label, i.owner) for i in result.items],
                         [("MM-1", "Alice"), ("MM-2", "Unassigned"), ("mattermost#10", "alice"), ("enterprise#20", "dev")])
        self.assertEqual([i.public_label for i in result.items], [None, None, "mattermost#10", "(private repo)"])
        self.assertEqual(jira.queries[0], 'project = MM AND fixVersion = "v12.2 (November 2026)" AND issuetype in '
                                          '(Bug, Story, Task, "Sub-task") AND status not in (Resolved, Closed) '
                                          'ORDER BY assignee ASC, priority ASC')


class NewRegressionsTest(unittest.TestCase):
    def test_fails_when_a_regression_has_no_fix_version(self):
        jira = FakeJira({"labels in": [
            issue("MM-1", labels=["rc2"], fix_versions=["v12.2"]),
            issue("MM-2", summary="  Regression: posts vanish"),
            issue("MM-3", summary="Not a regression of note"),
            issue("MM-4", labels=["Regression"], fix_versions=["v12.3"]),
        ]})
        result = checks.new_regressions(context(jira=jira), RULES["new-regressions"])
        self.assertEqual(result.status, checks.FAIL)
        self.assertEqual(result.summary, "1 of 3 new regressions have no fix version")
        self.assertEqual([i.label for i in result.items], ["MM-2"])
        self.assertIn('created >= "2026-10-19"', jira.queries[0])

    def test_passes_when_all_have_fix_versions(self):
        jira = FakeJira({"labels in": [issue("MM-1", labels=["rc1"], fix_versions=["v12.2"])]})
        self.assertEqual(checks.new_regressions(context(jira=jira), RULES["new-regressions"]).status, checks.PASS)


class HubReleaseBranchTest(unittest.TestCase):
    def test_passes_when_version_and_build_match(self):
        github = FakeGitHub()
        github.on_branch.add((MM, "abc123", "release-12.2"))
        result = checks.hub_release_branch(context(github, hub=FakeHub(("12.2.0", "abc123"))), RULES["hub-on-release-branch"])
        self.assertEqual(result.status, checks.PASS)
        self.assertTrue(result.proof_url.endswith("/commit/abc123"))

    def test_fails_on_another_version(self):
        result = checks.hub_release_branch(context(hub=FakeHub(("12.1.0", "abc123"))), RULES["hub-on-release-branch"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "Hub isn't running v12.2"))
        self.assertNotIn("12.1.0", result.summary)

    def test_fails_on_a_master_build(self):
        result = checks.hub_release_branch(context(hub=FakeHub(("12.2.0", "masterSha"))), RULES["hub-on-release-branch"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "Hub's build isn't from release-12.2"))

    def test_skipped_before_the_branch_exists(self):
        result = checks.hub_release_branch(context(has_branch=False), RULES["hub-on-release-branch"])
        self.assertEqual(result.status, checks.SKIPPED)


class NoticeTxtTest(unittest.TestCase):
    def github(self, merged=True, on_branch=True):
        github = FakeGitHub()
        github.searches["NOTICE"] = [pr(39103)]
        github.pulls[(MM, 39103)] = {"merged_at": "2026-10-20T10:00:00Z" if merged else None, "merge_commit_sha": "n1"}
        message = "chore: Update NOTICE.txt file with updated dependencies (#39103)" if on_branch else "Other (#1)"
        github.branch_commits[(MM, "release-12.2")] = [commit(message, "n2")]
        return github

    def test_passes_when_merged_and_on_branch(self):
        result = checks.notice_txt(context(self.github()), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "mattermost#39103 is merged and on release-12.2"))

    def test_fails_when_not_merged(self):
        result = checks.notice_txt(context(self.github(merged=False)), RULES["notice-txt"])
        self.assertEqual(result.summary, "The latest NOTICE.txt PR, mattermost#39103, isn't merged")

    def test_fails_when_not_on_branch(self):
        result = checks.notice_txt(context(self.github(on_branch=False)), RULES["notice-txt"])
        self.assertEqual(result.summary, "mattermost#39103 is merged but not on release-12.2")

    def test_search_is_for_the_bot(self):
        github = self.github()
        checks.notice_txt(context(github), RULES["notice-txt"])
        self.assertIn("author:app/unified-ci-app", github.queries[0])


class CherryPicksTest(unittest.TestCase):
    def test_reports_cherry_picks_missing_from_the_branch(self):
        github = FakeGitHub()
        github.searches[r"repo:mattermost/mattermost .*CherryPick/Approved"] = [pr(100), pr(101), pr(102)]
        github.searches[r"repo:mattermost/enterprise .*CherryPick/Approved"] = [pr(7, title="Private fix")]
        github.branch_commits[(MM, "release-12.2")] = [commit("Fix A (#100) (#150)"), commit("Fix #1010 thing")]
        github.pulls[(MM, 101)] = {"merge_commit_sha": "m101"}
        github.pulls[(MM, 102)] = {"merge_commit_sha": "m102"}
        github.on_branch.add((MM, "m102", "release-12.2"))
        github.pulls[(ENT, 7)] = {"merge_commit_sha": "e7"}
        result = checks.cherry_picks(context(github), RULES["cherry-picks"])
        self.assertEqual(result.status, checks.FAIL)
        self.assertEqual(result.summary, "2 of 4 approved cherry-picks aren't on release-12.2 (1 in a private repo)")
        self.assertEqual([i.public_label for i in result.items], ["mattermost#101", "(private repo)"])
        self.assertIn('label:"CherryPick/Approved","CherryPick/Done" milestone:"v12.2.0"', github.queries[0])

    def test_passes_with_nothing_to_cherry_pick(self):
        result = checks.cherry_picks(context(), RULES["cherry-picks"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "All 0 approved cherry-picks are on release-12.2"))


class E2EResultsTest(unittest.TestCase):
    def setUp(self):
        self.github = FakeGitHub()
        self.github.dates[(MM, "v12.2.0-rc2")] = "2026-11-02T12:00:00Z"
        self.since = 1793620800000  # 2026-11-02T12:00:00Z
        self.hub = FakeHub()

    def test_found_in_an_attachment_after_the_rc(self):
        self.hub.add_post("alerts", "", props={"attachments": [{"title": "E2E for v12.2.0-rc2: 98% passed"}]},
                          create_at=self.since + 1000, post_id="e2e")
        result = checks.e2e_results(context(self.github, hub=self.hub), RULES["e2e-results"])
        self.assertEqual(result.status, checks.PASS)
        self.assertEqual(result.proof_url, "https://hub.example/_redirect/pl/e2e")

    def test_results_from_before_the_rc_do_not_count(self):
        self.hub.add_post("alerts", "E2E release-12.2 rc1 results", create_at=self.since - 1000)
        result = checks.e2e_results(context(self.github, hub=self.hub), RULES["e2e-results"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "No E2E results posted for v12.2.0-rc2 yet"))

    def test_skipped_before_any_rc(self):
        result = checks.e2e_results(context(rc_numbers=()), RULES["e2e-results"])
        self.assertEqual(result.status, checks.SKIPPED)


class ReleaseTagsTest(unittest.TestCase):
    def test_rc_tags_present(self):
        github = FakeGitHub()
        github.tags = {MM: ["v12.2.0-rc1"], ENT: ["v12.2.0-rc1"]}
        result = checks.release_tags(context(github), RULES["rc-tags"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "v12.2.0-rc* is tagged in 2 repos"))

    def test_final_tag_missing_in_enterprise(self):
        github = FakeGitHub()
        github.tags = {MM: ["v12.2.0", "v12.2.0-rc1"], ENT: ["v12.2.0-rc1"]}
        result = checks.release_tags(context(github), RULES["final-tags"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "v12.2.0 isn't tagged in (private repo)"))

    def test_rc_tag_does_not_count_as_final(self):
        github = FakeGitHub()
        github.tags = {MM: ["v12.2.0-rc1"], ENT: ["v12.2.0-rc1"]}
        self.assertEqual(checks.release_tags(context(github), RULES["final-tags"]).status, checks.FAIL)


class VersionGoPrsTest(unittest.TestCase):
    def test_merged(self):
        github = FakeGitHub()
        github.searches["Update latest"] = [pr(1, "Update latest minor version to 12.2.0"),
                                              pr(2, "Update latest minor version to 12.20.0", state="open")]
        result = checks.version_go_prs(context(github), RULES["version-go-prs"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "1 version.go PR merged"))
        self.assertIn('in:title "Update latest" created:>=2026-09-04', github.queries[0])

    def test_open_pr_fails(self):
        github = FakeGitHub()
        github.searches["Update latest"] = [pr(1, "Update latest minor version to 12.2.0", state="open")]
        result = checks.version_go_prs(context(github), RULES["version-go-prs"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "1 version.go PR not merged: mattermost#1"))

    def test_none_found_fails(self):
        self.assertEqual(checks.version_go_prs(context(), RULES["version-go-prs"]).status, checks.FAIL)


class ChangelogLabelsTest(unittest.TestCase):
    def test_missing_labels(self):
        github = FakeGitHub()
        github.searches["repo:mattermost/enterprise"] = [pr(5)]
        result = checks.changelog_labels(context(github), RULES["changelog-labels"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "1 merged PR without a changelog label (1 in a private repo)"))
        self.assertIn('-label:"Changelog/Done" -label:"Changelog/Not Needed"', github.queries[0])

    def test_none_missing(self):
        self.assertEqual(checks.changelog_labels(context(), RULES["changelog-labels"]).status, checks.PASS)


if __name__ == "__main__":
    unittest.main()

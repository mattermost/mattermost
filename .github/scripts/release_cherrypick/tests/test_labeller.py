import unittest

from release_cherrypick import labeller, output
from release_cherrypick.__main__ import resolve_mode, run
from release_cherrypick.labeller import LabelError, Labeller
from release_cherrypick.tests.fakes import VERSIONS, FakeGitHub, FakeHub, FakeJira, pull, ticket

MM, ENT = "mattermost/mattermost", "mattermost/enterprise"
V122 = labeller.find_fix_version(VERSIONS, 12, 2)


def link(repo, number):
    return f"https://github.com/{repo}/pull/{number}"


def label_run(jira, github, live=True):
    return Labeller(jira, github, live).run_version(V122)


class FixVersionTest(unittest.TestCase):
    def test_finds_the_canonical_name_and_id(self):
        self.assertEqual((V122.id, V122.name, V122.milestone), ("200", "v12.2 (December 2026)", "v12.2.0"))

    def test_mobile_and_dot_versions_are_not_feature_versions(self):
        self.assertIsNone(labeller.feature_version({"name": "v2.46 Mobile (December 2026)"}))
        self.assertIsNone(labeller.feature_version({"name": "v11.7.14"}))

    def test_missing_or_ambiguous_versions_are_errors(self):
        with self.assertRaisesRegex(LabelError, "Jira has no v12.9"):
            labeller.find_fix_version(VERSIONS, 12, 9)
        twice = VERSIONS + [{"id": "201", "name": "v12.2 (January 2027)", "released": False}]
        with self.assertRaisesRegex(LabelError, "2 v12.2 fix versions"):
            labeller.find_fix_version(twice, 12, 2)

    def test_queries_submitted_tickets_by_version_id(self):
        jira = FakeJira()
        label_run(jira, FakeGitHub())
        self.assertEqual(jira.queries, ["project = MM AND fixVersion = 200 AND status = Submitted"])

    def test_active_versions_are_unreleased_with_a_release_branch(self):
        github = FakeGitHub(branches=("release-12.1", "release-12.2"))
        self.assertEqual([v.short for v in labeller.active_versions(VERSIONS, github)], ["v12.2"])

    def test_parse_short_version(self):
        self.assertEqual(labeller.parse_short_version("v12.2"), (12, 2))
        self.assertEqual(labeller.parse_short_version("12.2.0"), (12, 2))
        with self.assertRaises(LabelError):
            labeller.parse_short_version("v12")


class LabelTest(unittest.TestCase):
    def test_labels_and_sets_the_milestone_once(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = label_run(jira, github)
        self.assertEqual(github.writes, [("label", MM, 10, "CherryPick/Approved"), ("milestone", MM, 10, 12)])
        self.assertEqual([(c.label, c.milestone) for c in report.labelled], [("added", "set")])

        rerun = label_run(jira, github)
        self.assertEqual(len(github.writes), 2)
        self.assertEqual((len(rerun.labelled), len(rerun.already_done)), (0, 1))

    def test_existing_approved_or_done_label_is_kept(self):
        jira = FakeJira([ticket("MM-1"), ticket("MM-2")], {"MM-1": [link(MM, 10)], "MM-2": [link(MM, 11)]})
        github = FakeGitHub([(MM, pull(10, labels=["CherryPick/Done"], milestone="v12.2.0")),
                             (MM, pull(11, labels=["CherryPick/Approved"]))])
        report = label_run(jira, github)
        self.assertEqual(github.writes, [("milestone", MM, 11, 12)])
        self.assertEqual([c.number for c in report.already_done], [10])
        self.assertEqual([(c.number, c.label) for c in report.labelled], [(11, "present")])

    def test_another_milestone_is_reported_and_kept(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10, milestone="v12.3.0"))])
        report = label_run(jira, github)
        self.assertEqual(github.writes, [("label", MM, 10, "CherryPick/Approved")])
        self.assertEqual([(c.number, c.current_milestone) for c in report.conflicts], [(10, "v12.3.0")])
        self.assertIn("mattermost#10](https://github.com/mattermost/mattermost/pull/10) A fix has milestone v12.3.0, "
                      "not v12.2.0", output.summary([report], True))

    def test_repos_outside_the_allowlist_are_reported_not_changed(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link("mattermost/mattermost-mobile", 5),
                                                    link("mattermost/secret-repo", 6)]})
        github = FakeGitHub()
        report = label_run(jira, github)
        self.assertEqual(github.writes, [])
        self.assertEqual([p.repo for p in report.outside], ["mattermost/mattermost-mobile", "mattermost/secret-repo"])
        text = output.summary([report], True)
        self.assertIn("MM-1: [mattermost/mattermost-mobile#5](https://github.com/mattermost/mattermost-mobile/pull/5)", text)
        self.assertIn("MM-1: (private repo) #6", text)
        self.assertNotIn("secret-repo", text)
        self.assertEqual(report.no_pr, [])

    def test_several_fix_versions_get_the_feature_milestone_and_list_the_rest(self):
        jira = FakeJira([ticket("MM-1", ("v12.2 (December 2026)", "v11.7.14"))], {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = label_run(jira, github)
        self.assertEqual(github.writes[-1], ("milestone", MM, 10, 12))
        self.assertEqual(report.other_versions, {"MM-1": ["v11.7.14"]})
        self.assertIn("**Other fix versions, to handle by hand** (1)\n- MM-1: v11.7.14", output.summary([report], True))

    def test_tickets_without_a_linked_pr(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": ["https://example.com/doc", link(MM, 10).replace("/pull/", "/issues/")]})
        report = label_run(jira, FakeGitHub())
        self.assertEqual(report.no_pr, ["MM-1"])

    def test_falls_back_to_prs_naming_the_ticket_in_their_title_or_branch(self):
        jira = FakeJira([ticket("MM-12")])
        github = FakeGitHub([(MM, pull(10, title="[MM-12] Fix it")),
                             (MM, pull(11, title="Fix MM-123")),
                             (ENT, pull(20, repo=ENT, title="Private", head="mm-12-fix")),
                             (ENT, pull(21, repo=ENT, title="Other"))])
        github.pulls[(ENT, 20)]["body"] = "MM-12"
        github.pulls[(ENT, 21)]["body"] = "See MM-12"
        report = label_run(jira, github)
        self.assertEqual([(c.repo, c.number) for c in report.labelled], [(ENT, 20), (MM, 10)])

    def test_a_pr_found_by_title_with_another_milestone_is_not_labelled(self):
        jira = FakeJira([ticket("MM-1")])
        github = FakeGitHub([(MM, pull(10, title="MM-1: first part", milestone="v12.1.0")),
                             (MM, pull(11, title="MM-1: second part"))])
        report = label_run(jira, github)
        self.assertEqual(github.writes, [("label", MM, 11, "CherryPick/Approved"), ("milestone", MM, 11, 12)])
        self.assertEqual([(c.number, c.by_title) for c in report.conflicts], [(10, True)])
        self.assertIn("has milestone v12.1.0, not v12.2.0 (found by its title, so not labelled either)",
                      output.summary([report], True))

    def test_only_merged_or_open_prs_against_master_are_changed(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link(MM, 10), link(MM, 11), link(MM, 12)]})
        github = FakeGitHub([(MM, pull(10, base="release-12.1")), (MM, pull(11, merged=False)),
                             (MM, pull(12, state="open", merged=False))])
        report = label_run(jira, github)
        self.assertEqual([(c.number, c.skipped) for c in report.skipped],
                         [(10, "is against release-12.1, not master"), (11, "was closed without merging")])
        self.assertEqual([c.number for c in report.labelled], [12])

    def test_dry_run_changes_nothing(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = label_run(jira, github, live=False)
        self.assertEqual(github.writes, [])
        self.assertEqual([(c.label, c.milestone) for c in report.labelled], [("would_add", "would_set")])
        self.assertIn("**Would label** (1)", output.summary([report], False))

    def test_a_repo_without_the_milestone_is_noted(self):
        jira = FakeJira([ticket("MM-1")], {"MM-1": [link(ENT, 3)]})
        github = FakeGitHub([(ENT, pull(3, repo=ENT))])
        github.milestone_titles[ENT] = {}
        report = label_run(jira, github)
        self.assertEqual(github.writes, [("label", ENT, 3, "CherryPick/Approved")])
        self.assertEqual(report.notes, ["(private repo) has no v12.2.0 milestone, so it wasn't set."])

    def test_a_pr_linked_from_two_tickets_is_handled_once(self):
        jira = FakeJira([ticket("MM-1"), ticket("MM-2")], {"MM-1": [link(MM, 10)], "MM-2": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = label_run(jira, github)
        self.assertEqual(len(report.changes), 1)
        self.assertEqual(len(github.writes), 2)


class TicketDispatchTest(unittest.TestCase):
    def test_labels_the_ticket_for_its_earliest_unreleased_feature_version(self):
        jira = FakeJira([ticket("MM-1", ("v12.3 (January 2027)", "v12.2 (December 2026)", "v12.1 (November 2026)"))],
                        {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = Labeller(jira, github, True).run_ticket("MM-1", VERSIONS)
        self.assertEqual(report.version.short, "v12.2")
        self.assertEqual(github.writes[-1], ("milestone", MM, 10, 12))
        self.assertEqual(report.other_versions, {"MM-1": ["v12.3 (January 2027)", "v12.1 (November 2026)"]})

    def test_a_ticket_that_is_not_submitted_is_left_alone(self):
        jira = FakeJira([ticket("MM-1", status="In Progress")], {"MM-1": [link(MM, 10)]})
        github = FakeGitHub([(MM, pull(10))])
        report = Labeller(jira, github, True).run_ticket("MM-1", VERSIONS)
        self.assertEqual(github.writes, [])
        self.assertEqual(report.notes, ["MM-1 isn't Submitted (it's In Progress), so nothing was changed."])

    def test_a_dot_release_only_ticket_is_listed(self):
        jira = FakeJira([ticket("MM-1", ("v11.7.14",))], {"MM-1": [link(MM, 10)]})
        report = Labeller(jira, FakeGitHub([(MM, pull(10))]), True).run_ticket("MM-1", VERSIONS)
        self.assertEqual(report.other_versions, {"MM-1": ["v11.7.14"]})
        self.assertIn("no unreleased vX.Y (Month Year) fix version", report.notes[0])

    def test_rejects_keys_from_other_projects(self):
        with self.assertRaises(LabelError):
            Labeller(FakeJira(), FakeGitHub(), True).run_ticket("SEC-1; rm", VERSIONS)


class RunTest(unittest.TestCase):
    def setUp(self):
        self.jira = FakeJira([ticket("MM-1"), ticket("MM-2")],
                             {"MM-1": [link(MM, 10)], "MM-2": [link(ENT, 20)]})
        self.github = FakeGitHub([(MM, pull(10, title="Public fix")), (ENT, pull(20, repo=ENT, title="Top secret fix"))])
        self.hub = FakeHub([{"id": "c122", "display_name": "Release: v12.2 (ESR)"}],
                           {"c122": [{"id": "status", "user_id": "bot",
                                      "props": {"release_agent_marker": "release-agent:status:v12.2:live"}}]})

    def test_mode_defaults_to_dry_run(self):
        self.assertEqual(resolve_mode("", ""), "dry_run")
        self.assertEqual(resolve_mode("", "live"), "live")
        self.assertEqual(resolve_mode("dry_run", "live"), "dry_run")
        with self.assertRaises(LabelError):
            resolve_mode("", "loud")

    def test_scheduled_dry_run_reports_without_writing_or_posting(self):
        text, line, code = run({"RUN_URL": "https://run"}, self.jira, self.github, self.hub)
        self.assertEqual((code, self.github.writes, self.hub.created), (0, [], []))
        self.assertIn("## Cherry-pick labels · dry run (nothing changed)", text)
        self.assertIn("- MM-1: [mattermost#10](https://github.com/mattermost/mattermost/pull/10) Public fix (label and milestone)", text)
        self.assertIn("- MM-2: (private repo) #20 (label and milestone)", text)
        self.assertNotIn("Top secret", text)
        self.assertEqual(line, ":white_check_mark: Cherry-pick labels (dry run) · v12.2: 2 to label, 0 already done, "
                               "0 without a PR, 0 outside the allowlist, 0 milestone conflicts · [run](https://run)")

    def test_live_run_replies_under_the_status_post(self):
        text, _, code = run({"CHERRYPICK_LABEL_MODE": "live"}, self.jira, self.github, self.hub)
        self.assertEqual(code, 0)
        self.assertEqual(len(self.github.writes), 4)
        [reply] = self.hub.created
        self.assertEqual((reply["channel_id"], reply["root_id"]), ("c122", "status"))
        self.assertIn("[enterprise#20](https://github.com/mattermost/enterprise/pull/20) Top secret fix", reply["message"])
        self.assertIn("Hub: replied to the status post.", text)
        self.assertNotIn("Top secret", text)

        run({"CHERRYPICK_LABEL_MODE": "live"}, self.jira, self.github, self.hub)
        self.assertEqual((len(self.github.writes), len(self.hub.created)), (4, 1))

    def test_live_run_posts_in_the_channel_without_a_status_post(self):
        self.hub.posts = {}
        run({"CHERRYPICK_LABEL_MODE": "live"}, self.jira, self.github, self.hub)
        self.assertEqual(self.hub.created[0]["root_id"], "")

    def test_one_version_or_one_ticket(self):
        text, _, _ = run({"VERSION_INPUT": "v12.3"}, self.jira, self.github)
        self.assertIn("0 Submitted tickets with v12.3 (January 2027).", text)
        text, _, _ = run({"ISSUE_KEY": "mm-2"}, self.jira, self.github)
        self.assertIn("1 Submitted ticket with v12.2 (December 2026).", text)
        self.assertNotIn("MM-1", text)

    def test_problems_fail_the_run(self):
        text, line, code = run({"VERSION_INPUT": "v12.9"}, self.jira, self.github)
        self.assertEqual(code, 1)
        self.assertIn(":warning: Jira has no v12.9 (Month Year) fix version", text)
        self.assertTrue(line.startswith(":warning:"))

    def test_no_active_release(self):
        text, _, code = run({}, self.jira, FakeGitHub(branches=()))
        self.assertEqual(code, 0)
        self.assertIn("No active release", text)


if __name__ == "__main__":
    unittest.main()

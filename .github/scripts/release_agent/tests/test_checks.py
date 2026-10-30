import json
import re
import unittest
from datetime import date
from pathlib import Path

from release_agent import checks, rules
from release_agent.agent import template_vars
from release_agent.clients import Confluence
from release_agent.release_calendar import Release
from release_agent.tests.fakes import FakeConfluence, FakeGitHub, FakeHub, FakeJira

MM, ENT = "mattermost/mattermost", "mattermost/enterprise"
RULES = {rule["task"]: rule for rule in rules.load_yaml(rules.RULES_PATH)["rules"]}
NAMING = rules.load_yaml(rules.RULES_PATH)["naming"]
TEAM_FIELD = "customfield_10800"
# The resolutions on mattermost.atlassian.net (Oct 30, 2026). "Won't Fix" isn't one.
JIRA_RESOLUTIONS = frozenset({"Done", "Duplicate", "Won't Do", "Cannot Reproduce", "Invalid"})
FIXTURES = Path(__file__).parent / "fixtures"


def release():
    return Release(12, 2, {"branch_cut": date(2026, 10, 19), "code_freeze": date(2026, 10, 28),
                           "final_build": date(2026, 11, 9), "release_day": date(2026, 11, 16)})


def context(github=None, jira=None, hub=None, has_branch=True, rc_numbers=(1, 2), today=date(2026, 11, 4),
            confluence=None, primary=True, page_id="123", rel=None):
    rel = rel or release()
    values = {**template_vars(rel, NAMING, list(rc_numbers)), "holidays_page_id": page_id, "next_year": today.year + 1}
    return checks.Context(release=rel, today=today, vars=values,
                          has_branch=has_branch, rc_numbers=list(rc_numbers), github=github or FakeGitHub(),
                          jira=jira or FakeJira(), hub=hub or FakeHub(), testing_alerts_channel="alerts",
                          confluence=confluence or FakeConfluence(), primary=primary)


def pr(number, title="A change", login="dev", state="closed", merged_at="2026-10-20T10:00:00Z",
       created_at="2026-11-09T14:00:00Z"):
    return {"number": number, "title": title, "state": state, "html_url": f"https://github.com/x/pull/{number}",
            "user": {"login": login}, "assignees": [], "pull_request": {"merged_at": merged_at},
            "created_at": created_at}


def commit(message, sha="s"):
    return {"sha": sha, "commit": {"message": message}}


def issue(key, summary="Bug", labels=(), fix_versions=(), assignee=None, resolution=None, description="",
          components=(), status="Open", email=None, team=None):
    person = {"displayName": assignee, **({"emailAddress": email} if email else {})} if assignee else None
    return {"key": key, "fields": {"summary": summary, "labels": list(labels),
                                   "fixVersions": [{"name": v} for v in fix_versions],
                                   "assignee": person, "status": {"name": status},
                                   "components": [{"name": c} for c in components],
                                   "resolution": {"name": resolution} if resolution else None,
                                   "description": description,
                                   TEAM_FIELD: {"id": f"team-{team}", "name": team, "title": team} if team else None}}


class TemplateTest(unittest.TestCase):
    def test_vars(self):
        values = template_vars(release(), NAMING, [1, 3])
        self.assertEqual(values["milestone"], "v12.2.0")
        self.assertEqual(values["fix_version"], "v12.2 (November 2026)")
        self.assertEqual(values["release_channels"], ["Release: v12.2", "Release: v12.2 (ESR)", "Release: v12.2 ESR"])
        self.assertEqual(values["branch"], "release-12.2")
        self.assertEqual(values["rc_tag"], "v12.2.0-rc3")
        self.assertEqual(values["branch_cut"], "2026-10-19")
        self.assertEqual(values["final_build"], "2026-11-09")

    def test_fix_version_needs_a_release_day(self):
        rel = Release(12, 2, {"branch_cut": date(2026, 10, 19)})
        values = template_vars(rel, NAMING, [])
        self.assertNotIn("fix_version", values)
        self.assertEqual(values["release_channels"], ["Release: v12.2", "Release: v12.2 (ESR)", "Release: v12.2 ESR"])
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
                         [("MM-1", "Alice (no Hub user found)"), ("MM-2", ""), ("mattermost#10", "alice"), ("enterprise#20", "dev")])
        self.assertEqual([i.public_label for i in result.items], [None, None, "mattermost#10", "(private repo)"])
        self.assertEqual(jira.queries[0], 'project = MM AND fixVersion = "v12.2 (November 2026)" AND issuetype in '
                                          '(Bug, Story, Task, "Sub-task") AND status not in (Resolved, Closed) '
                                          'ORDER BY assignee ASC, priority ASC')

    def test_the_changelog_pr_is_left_out(self):
        class AuthorAwareGitHub(FakeGitHub):
            def search_issues(self, query, limit=1000, sort=None):
                self.queries.append(query)
                prs = [pr(39286, "v12.1.0 Changelogs", login="changelog-automation-docs[bot]", state="open"),
                       pr(10, login="alice", state="open")]
                return [p for p in prs if f"-author:app/{p['user']['login'].removesuffix('[bot]')}" not in query]
        github = AuthorAwareGitHub()
        result = checks.open_release_items(context(github), RULES["open-release-items"])
        self.assertEqual([i.label for i in result.items], ["mattermost#10", "enterprise#10"])
        self.assertTrue(all(q.endswith(' milestone:"v12.2.0" -author:app/changelog-automation-docs') for q in github.queries))


class NewRegressionsTest(unittest.TestCase):
    def test_fails_when_a_regression_has_no_fix_version(self):
        jira = FakeJira({"labels in": [
            issue("MM-1", labels=["rc2"], fix_versions=["v12.2"]),
            issue("MM-2", summary="  Regression: posts vanish"),
            issue("MM-4", labels=["Regression"], fix_versions=["v12.3"]),
        ]})
        result = checks.new_regressions(context(jira=jira), RULES["new-regressions"])
        self.assertEqual(result.status, checks.FAIL)
        self.assertEqual(result.summary, "1 of 3 new regressions have no fix version")
        self.assertEqual([i.label for i in result.items], ["MM-2"])
        self.assertIn('created >= "2026-10-19"', jira.queries[0])

    def test_query(self):
        jira = FakeJira()
        checks.new_regressions(context(jira=jira), RULES["new-regressions"])
        self.assertEqual(" ".join(jira.queries[0].split()), 'project = MM AND issuetype = Bug AND created >= "2026-10-19" AND ( '
                         'labels in (rc1, rc2, rc3, rc4, rc5, regression) OR summary ~ "Regression" '
                         'OR text ~ "\\"v12.2\\"" OR text ~ "\\"12.2\\"" OR text ~ "\\"release-12.2\\"" ) '
                         'AND (resolution is EMPTY OR resolution not in (Duplicate, "Won\'t Do", "Cannot Reproduce", Invalid))')

    def test_rules_name_only_resolutions_that_exist(self):
        # Jira rejects a whole JQL (HTTP 400) that names an unknown resolution.
        for task, rule in RULES.items():
            query = context().query(rule)
            named = set(query.get("excluded_resolutions", []))
            for clause in re.findall(r"resolution\s+(?:not\s+)?in\s*\(([^)]*)\)", query.get("jql", ""), re.IGNORECASE):
                named |= {name.strip().strip('"') for name in clause.split(",")}
            for value in re.findall(r'resolution\s*!?=\s*("[^"]*"|\w+)', query.get("jql", ""), re.IGNORECASE):
                named.add(value.strip('"'))
            with self.subTest(task=task):
                self.assertLessEqual(named, JIRA_RESOLUTIONS)
        self.assertEqual(set(RULES["new-regressions"]["query"]["excluded_resolutions"]),
                         {"Duplicate", "Won't Do", "Cannot Reproduce", "Invalid"})

    def test_a_bug_mentioning_only_the_release_branch_is_picked_up(self):
        v121 = Release(12, 1, {"branch_cut": date(2026, 9, 16), "release_day": date(2026, 10, 16)})
        bug = issue("MM-7", summary="Login fails after upgrade", description="Seen on release-12.1 since Tuesday.")
        jira = FakeJira({r'text ~ "\\"release-12\.1\\""': [bug]})
        result = checks.new_regressions(context(jira=jira, rel=v121), RULES["new-regressions"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "1 of 1 new regression have no fix version"))
        self.assertEqual([i.label for i in result.items], ["MM-7"])
        self.assertIn('created >= "2026-09-16"', jira.queries[0])

    def test_duplicate_wont_do_and_invalid_bugs_are_not_flagged(self):
        jira = FakeJira({"labels in": [
            issue("MM-1", labels=["regression"], fix_versions=["v12.2"]),
            issue("MM-2", summary="Regression: duplicate report", resolution="Duplicate"),
            issue("MM-3", labels=["rc1"], resolution="Won't Do"),
            issue("MM-4", labels=["rc1"], resolution="Cannot Reproduce"),
            issue("MM-5", labels=["rc1"], resolution="Invalid"),
        ]})
        result = checks.new_regressions(context(jira=jira), RULES["new-regressions"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "All 1 new regression have a fix version"))

    def test_an_unresolved_or_fixed_bug_without_a_fix_version_is_flagged(self):
        jira = FakeJira({"labels in": [issue("MM-1", labels=["rc1"]), issue("MM-2", labels=["rc1"], resolution="Done")]})
        result = checks.new_regressions(context(jira=jira), RULES["new-regressions"])
        self.assertEqual([i.label for i in result.items], ["MM-1", "MM-2"])

    def test_passes_when_all_have_fix_versions(self):
        jira = FakeJira({"labels in": [issue("MM-1", labels=["rc1"], fix_versions=["v12.2"])]})
        self.assertEqual(checks.new_regressions(context(jira=jira), RULES["new-regressions"]).status, checks.PASS)


    def routed(self, *issues, users=()):
        jira = FakeJira({"fixVersion": list(issues)})
        hub = FakeHub()
        hub.users = [{"username": u, "first_name": f, "last_name": l, "email": f"{u}@example.com"} for u, f, l in users]
        return checks.open_release_items(context(jira=jira, hub=hub), RULES["open-release-items"]), jira, hub

    def test_routes_unassigned_and_bot_tickets_to_the_dev_lead_of_their_jira_team(self):
        result, jira, _ = self.routed(
            issue("MM-1", team="Calls"),
            issue("MM-2", assignee="Matty Code", team="Agents", components=["Calls"]),
            issue("MM-3", team="Integrations"),
            issue("MM-4", components=["Calls"]),  # components aren't teams
            issue("MM-5", team="Mobile"),
            issue("MM-6", assignee="Matty Code"),
            users=[("jesse.hallam", "Jesse", "Hallam"), ("christopher", "Christopher", "Speller"),
                   ("doug.lauder", "Doug", "Lauder")])
        self.assertEqual([(i.label, i.owner, i.reason) for i in result.items], [
            ("MM-1", "@jesse.hallam", "unassigned"),
            ("MM-2", "@christopher", "Matty Code"),
            ("MM-3", "@doug.lauder", "unassigned"),
            ("MM-4", "", "unassigned"),
            ("MM-5", "", "unassigned"),
            ("MM-6", "", "Matty Code"),
        ])
        self.assertEqual(jira.extra_fields, [TEAM_FIELD])

    def test_component_routes_are_a_fallback_when_no_team_route_matches(self):
        leads = checks.DevLeads({"match_field": "team", "team_field": TEAM_FIELD, "routes": [
            {"teams": ["Calls"], "username": "jesse.hallam"}, {"components": ["Bookmarks Bar"], "username": "lead"}]})

        def lead_for(**fields):
            return (leads.lead_for(issue("MM-1", **fields)["fields"]) or {}).get("username")

        self.assertEqual(lead_for(components=["Webapp", "Bookmarks Bar"]), "lead")
        self.assertEqual(lead_for(team="Calls", components=["Bookmarks Bar"]), "jesse.hallam")
        self.assertEqual(lead_for(team="Workflows", components=["Bookmarks Bar"]), "lead")
        self.assertIsNone(lead_for(team="Workflows"))

    def test_real_tickets_team_field(self):
        issues = json.loads((FIXTURES / "jira-search-team-field.json").read_text())["issues"]
        self.assertEqual([checks.team_names(i["fields"][TEAM_FIELD]) for i in issues], [["Reliability"], ["Workflows"]])
        jira = FakeJira({"fixVersion": issues})
        hub = FakeHub()
        hub.users = [{"username": "jesse.hallam", "first_name": "Jesse", "last_name": "Hallam"}]
        result = checks.open_release_items(context(jira=jira, hub=hub), RULES["open-release-items"])
        self.assertEqual([(i.label, i.owner, i.reason) for i in result.items], [
            ("MM-71364", "@jesse.hallam", "unassigned"),  # Team = Reliability
            ("MM-70317", "", "unassigned"),  # Team = Workflows, which has no route; component Bookmarks Bar
        ])

    def test_team_field_values(self):
        self.assertEqual(checks.team_names({"id": "u1", "name": "Calls", "title": "Calls"}), ["Calls"])
        self.assertEqual(checks.team_names({"id": "u1", "title": " Agents "}), ["Agents"])
        self.assertEqual(checks.team_names({"id": "1", "value": "Reliability"}), ["Reliability"])
        self.assertEqual(checks.team_names([{"value": "Calls"}, "Agents"]), ["Calls", "Agents"])
        self.assertEqual(checks.team_names(None), [])
        self.assertEqual(checks.team_names({"id": "u1"}), [])

    def test_components_only_when_match_field_is_components(self):
        leads = checks.DevLeads({"match_field": "components", "team_field": TEAM_FIELD,
                                 "routes": [{"teams": ["Calls"], "username": "a"}, {"components": ["Calls"], "username": "b"}]})
        self.assertEqual(leads.fields, [])
        self.assertEqual(leads.lead_for(issue("MM-1", team="Calls", components=["Calls"])["fields"])["username"], "b")

    def test_a_dev_lead_missing_on_hub_is_named_and_marked(self):
        result, _, _ = self.routed(issue("MM-1", team="Information Control"))
        self.assertEqual(result.items[0].owner, "Maria Nunez (no Hub user found)")

    def test_a_deactivated_hub_user_is_not_mentioned(self):
        jira = FakeJira({"fixVersion": [issue("MM-1", team="Calls"), issue("MM-2", assignee="Ann Lee", email="ann@example.com")]})
        hub = FakeHub()
        hub.users = [{"username": "jesse.hallam", "first_name": "Jesse", "last_name": "Hallam", "delete_at": 1761800000000},
                     {"username": "ann", "first_name": "Ann", "last_name": "Lee", "email": "ann@example.com", "delete_at": 1}]
        result = checks.open_release_items(context(jira=jira, hub=hub), RULES["open-release-items"])
        self.assertEqual([i.owner for i in result.items], ["Jesse Hallam (no Hub user found)", "Ann Lee (no Hub user found)"])

    def test_mentions_assignees_found_on_hub_by_email_or_unique_full_name(self):
        result, _, hub = self.routed(
            issue("MM-1", assignee="Ann Lee", email="ann@example.com"),
            issue("MM-2", assignee="Bo  Chen"),
            issue("MM-3", assignee="Sam Park"),
            issue("MM-4", assignee="Bo Chen"),
            users=[("ann", "Annie", "Lee"), ("bo.chen", "Bo", "Chen"), ("sam1", "Sam", "Park"), ("sam2", "Sam", "Park")])
        self.assertEqual([i.owner for i in result.items],
                         ["@ann", "@bo.chen", "Sam Park (no Hub user found)", "@bo.chen"])
        self.assertEqual(hub.user_searches, ["Bo Chen", "Sam Park"])

    def test_submitted_tickets_show_their_linked_prs(self):
        jira = FakeJira({"fixVersion": [issue("MM-1", status="Submitted"), issue("MM-2", status="In Progress")]})
        jira.links = {
            "MM-1": ["https://github.com/mattermost/mattermost/pull/36558", "https://example.com/doc",
                     "https://github.com/mattermost/enterprise/pull/912", "https://github.com/mattermost/mattermost/issues/5"],
            "MM-2": ["https://github.com/mattermost/mattermost/pull/1"],
        }
        result = checks.open_release_items(context(jira=jira), RULES["open-release-items"])
        self.assertEqual(result.items[0].links, [
            ("pr-mattermost-36558", "https://github.com/mattermost/mattermost/pull/36558"),
            ("pr-enterprise-912", "https://github.com/mattermost/enterprise/pull/912"),
        ])
        self.assertEqual(result.items[1].links, [])

    def test_dev_lead_table(self):
        config = RULES["open-release-items"]["query"]["dev_leads"]
        self.assertEqual((config["match_field"], config["team_field"]), ("team", TEAM_FIELD))
        leads = checks.DevLeads(config)
        self.assertEqual({team: lead["username"] for team, lead in leads.by_team.items()}, {
            "reliability": "jesse.hallam", "calls": "jesse.hallam", "sustained engineering": "jesse.hallam",
            "information control": "maria.nunez",
            "agents": "christopher",
            "platform integration": "doug.lauder", "integrations": "doug.lauder",
        })
        self.assertEqual(leads.by_component, {})
        self.assertEqual([route["username"] for route in leads.routes],
                         ["jesse.hallam", "maria.nunez", "christopher", "doug.lauder"])
        self.assertIsNone(leads.lead_for(issue("MM-1", team="Workflows", components=["Bookmarks Bar"])["fields"]))


class DevLeadFlagsTest(unittest.TestCase):
    RULES_DOC = {"rules": [{"query": {"dev_leads": {"routes": [
        {"teams": ["Calls"], "username": "jesse.hallam", "name": "Jesse Hallam"},
        {"teams": ["Agents"], "username": "christopher", "name": "Christopher Speller"},
        {"teams": ["Integrations"], "username": "gone.person", "name": "Gone Person"},
        {"components": ["Bookmarks Bar"], "username": "jesse.hallam", "name": "Jesse Hallam"},
    ]}}}, {"query": {}}]}

    def test_flags_leads_missing_or_deactivated_on_hub(self):
        hub = FakeHub()
        hub.users = [{"username": "jesse.hallam", "first_name": "Jesse", "last_name": "Hallam", "delete_at": 0},
                     {"username": "christopher", "first_name": "Christopher", "last_name": "Speller", "delete_at": 1761800000000}]
        self.assertEqual(checks.dev_lead_flags(self.RULES_DOC, hub), [
            "Dev lead Christopher Speller (`christopher`) in rules.yml is deactivated on Hub, so their tickets name them without a mention.",
            "Dev lead Gone Person (`gone.person`) in rules.yml has no Hub account, so their tickets name them without a mention.",
        ])

    def test_no_flags_when_every_lead_is_active(self):
        hub = FakeHub()
        hub.users = [{"username": u, "first_name": "", "last_name": ""} for u in ("jesse.hallam", "christopher", "gone.person")]
        self.assertEqual(checks.dev_lead_flags(self.RULES_DOC, hub), [])

    def test_a_hub_error_is_reported_not_raised(self):
        class BrokenHub(FakeHub):
            def user_by_username(self, username):
                raise RuntimeError("Hub is down")
        flags = checks.dev_lead_flags({"rules": [{"query": {"dev_leads": {"routes": [{"teams": ["X"], "username": "a"}]}}}]}, BrokenHub())
        self.assertEqual(flags, ["Couldn't check that dev lead a (`a`) is on Hub."])


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
    NOTICE = "chore: Update NOTICE.txt file with updated dependencies"

    def github(self, prs=((39103, True, True),), next_release=()):
        """``prs`` are this release's (number, merged, on the branch); ``next_release`` the
        numbers of merged NOTICE PRs with the next milestone, which aren't on the branch."""
        github = FakeGitHub()
        github.searches[r'NOTICE.* milestone:"v12\.2\.0"'] = [
            pr(n, self.NOTICE, state="closed" if merged else "open") for n, merged, _ in prs]
        github.searches[r'NOTICE.* milestone:"v12\.3\.0"'] = [pr(n, self.NOTICE) for n in next_release]
        for n, merged, _ in prs:
            github.pulls[(MM, n)] = {"merged_at": "2026-10-20T10:00:00Z" if merged else None, "merge_commit_sha": f"m{n}"}
        github.branch_commits[(MM, "release-12.2")] = [
            commit(f"{self.NOTICE} (#{n})", f"b{n}") for n, _, on_branch in prs if on_branch] + [commit("Other (#1)")]
        return github

    def test_passes_when_merged_and_on_branch(self):
        result = checks.notice_txt(context(self.github()), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "mattermost#39103 is merged and on release-12.2"))

    def test_the_next_releases_newer_pr_is_ignored(self):
        github = self.github(next_release=[39417])
        result = checks.notice_txt(context(github), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "mattermost#39103 is merged and on release-12.2"))
        self.assertEqual(len(github.queries), 1)
        self.assertIn('milestone:"v12.2.0"', github.queries[0])

    def test_no_pr_with_the_milestone_is_skipped(self):
        github = self.github(prs=(), next_release=[39417])
        result = checks.notice_txt(context(github), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.SKIPPED, "No NOTICE.txt PR has the v12.2.0 milestone"))

    def test_every_pr_with_the_milestone_must_be_on_the_branch(self):
        result = checks.notice_txt(context(self.github(prs=((39103, True, True), (38997, True, False)))), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "mattermost#38997 is merged but not on release-12.2"))
        self.assertEqual([i.label for i in result.items], ["mattermost#38997"])
        both = checks.notice_txt(context(self.github(prs=((39103, True, True), (38676, True, True)))), RULES["notice-txt"])
        self.assertEqual((both.status, both.summary),
                         (checks.PASS, "All 2 NOTICE.txt PRs with the v12.2.0 milestone are merged and on release-12.2"))

    def test_an_open_pr_fails(self):
        result = checks.notice_txt(context(self.github(prs=((39103, False, False),))), RULES["notice-txt"])
        self.assertEqual((result.status, result.summary), (checks.FAIL, "mattermost#39103 isn't merged"))

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


def ent_pull(number, title="Private fix", labels=(), milestone=None, base="master", state="closed", merged=True,
             head="fix-branch"):
    return {"number": number, "title": title, "html_url": f"https://github.com/{ENT}/pull/{number}",
            "labels": [{"name": name} for name in labels], "milestone": {"title": milestone} if milestone else None,
            "base": {"ref": base}, "head": {"ref": head}, "state": state,
            "merged_at": "2026-10-20T10:00:00Z" if merged else None}


class CherryPicksToLabelTest(unittest.TestCase):
    SUBMITTED = r'fixVersion = "v12\.2 \(November 2026\)" AND status = Submitted'

    def check(self, links, pulls, tickets=("MM-1",)):
        jira = FakeJira({self.SUBMITTED: [issue(key, status="Submitted") for key in tickets]})
        jira.links = links
        github = FakeGitHub()
        github.pulls = {(ENT, p["number"]): p for p in pulls}
        return checks.cherry_picks_to_label(context(github, jira), RULES["cherry-picks-to-label"]), jira, github

    def test_lists_enterprise_prs_missing_the_label_or_the_milestone(self):
        url = "https://github.com/mattermost/enterprise/pull/{}".format
        result, jira, _ = self.check(
            {"MM-1": [url(1), url(2), url(3), url(4), "https://github.com/mattermost/mattermost/pull/5"]},
            [ent_pull(1), ent_pull(2, labels=["CherryPick/Approved"]),
             ent_pull(3, labels=["CherryPick/Done"], milestone="v12.2.0"), ent_pull(4, milestone="v12.1.0")])
        self.assertEqual(jira.queries, ['project = MM AND fixVersion = "v12.2 (November 2026)" AND status = Submitted'])
        self.assertEqual(result.status, checks.FAIL)
        self.assertEqual(result.summary, "3 cherry-pick PRs to label by hand (3 in a private repo)")
        self.assertEqual([(i.label, i.url, i.note) for i in result.items], [
            ("enterprise#1", url(1), "MM-1: add `CherryPick/Approved` and milestone v12.2.0"),
            ("enterprise#2", url(2), "MM-1: add milestone v12.2.0"),
            ("enterprise#4", url(4), "MM-1: add `CherryPick/Approved` and milestone v12.2.0 (it has v12.1.0)"),
        ])
        self.assertEqual({i.public_label for i in result.items}, {"(private repo)"})
        self.assertNotIn("Private fix", result.summary)

    def test_passes_when_every_enterprise_pr_is_labelled(self):
        result, _, _ = self.check({"MM-1": ["https://github.com/mattermost/enterprise/pull/3"],
                                   "MM-2": ["https://github.com/mattermost/enterprise/pull/3"]},
                                  [ent_pull(3, labels=["CherryPick/Approved"], milestone="v12.2.0")], ("MM-1", "MM-2"))
        self.assertEqual((result.status, result.summary), (checks.PASS, "No cherry-pick PRs to label by hand (1 PR checked)"))

    def test_skips_prs_not_against_master_or_closed_unmerged(self):
        result, _, _ = self.check({"MM-1": ["https://github.com/mattermost/enterprise/pull/1",
                                            "https://github.com/mattermost/enterprise/pull/2"]},
                                  [ent_pull(1, base="release-12.1"), ent_pull(2, merged=False)])
        self.assertEqual(result.status, checks.PASS)

    def test_falls_back_to_prs_naming_the_ticket(self):
        jira = FakeJira({self.SUBMITTED: [issue("MM-1", status="Submitted")]})
        github = FakeGitHub()
        github.searches[r'repo:mattermost/enterprise is:pr "MM-1"'] = [{"number": 7}, {"number": 8}, {"number": 9}]
        github.pulls = {(ENT, 7): ent_pull(7, title="[MM-1] Fix"), (ENT, 8): ent_pull(8, title="MM-12 other"),
                        (ENT, 9): ent_pull(9, title="MM-1 earlier fix", milestone="v12.1.0")}
        result = checks.cherry_picks_to_label(context(github, jira), RULES["cherry-picks-to-label"])
        self.assertEqual([i.label for i in result.items], ["enterprise#7"])
        self.assertEqual(github.queries, ['repo:mattermost/enterprise is:pr "MM-1"'])


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
    AFTER_FINAL_BUILD = date(2026, 11, 10)

    def check(self, github, today=AFTER_FINAL_BUILD):
        return checks.version_go_prs(context(github, today=today), RULES["version-go-prs"])

    def test_the_whole_batch_is_merged(self):
        github = FakeGitHub()
        github.searches["Update latest"] = [pr(1, "Update latest minor version to 12.2.0"),
                                              pr(2, "Update latest patch version to 12.1.1", created_at="2026-11-09T14:01:00Z"),
                                              pr(3, "Update latest minor version to 12.20.0", state="open",
                                                 created_at="2026-12-20T10:00:00Z")]
        result = self.check(github)
        self.assertEqual((result.status, result.summary), (checks.PASS, "All 2 version.go PRs merged"))
        self.assertIn('in:title "Update latest" created:>=2026-11-02', github.queries[0])

    def test_an_open_pr_in_the_batch_fails(self):
        github = FakeGitHub()
        github.searches["Update latest"] = [pr(1, "Update latest minor version to 12.2.0"),
                                              pr(2, "Update latest patch version to 12.1.1", state="open",
                                                 created_at="2026-11-09T23:50:00Z")]
        result = self.check(github)
        self.assertEqual((result.status, result.summary), (checks.FAIL, "1 of 2 version.go PRs not merged: mattermost#2"))

    def test_patch_prs_alone_do_not_count(self):
        github = FakeGitHub()
        github.searches["Update latest"] = [pr(2, "Update latest patch version to 12.2.1")]
        result = self.check(github)
        self.assertEqual((result.status, result.summary),
                         (checks.FAIL, "No “Update latest … version to 12.2.0” PR since 2026-11-02"))

    def test_skipped_before_the_final_build(self):
        github = FakeGitHub()
        result = self.check(github, today=date(2026, 11, 4))
        self.assertEqual(result.status, checks.SKIPPED)
        self.assertEqual(github.queries, [])


def holidays_page(year, dates):
    """Page text as the Confluence client returns it: one row per location and holiday."""
    rows = " ".join(f"Location {n} Holiday {n} ({n % 12 + 1}/{n % 28 + 1:02d}/{year})" for n in range(dates))
    return f"Entity and EOR locations holidays for {year} Location Holiday Date {rows}"


class HolidaysPageTest(unittest.TestCase):
    OCTOBER = date(2026, 10, 26)

    def check(self, text="", today=OCTOBER, **kwargs):
        confluence = FakeConfluence(text)
        return checks.holidays_page(context(today=today, confluence=confluence, **kwargs), RULES["holidays-page"]), confluence

    def test_passes_with_the_heading_and_a_list_of_dates(self):
        result, confluence = self.check(holidays_page(2026, 20) + " " + holidays_page(2027, 20))
        self.assertEqual((result.status, result.summary), (checks.PASS, "The holidays page lists 20 holidays in 2027"))
        self.assertEqual(result.proof_url, "https://wiki.example/pages/123")
        self.assertEqual(confluence.requested, ["123"])

    def test_the_heading_is_matched_ignoring_case_and_spacing(self):
        result, _ = self.check("ENTITY and  EOR locations Holidays for 2027 " + holidays_page(2027, 8).split(" 2027 ", 1)[1])
        self.assertEqual(result.status, checks.PASS)

    def test_mentioning_the_year_is_not_enough(self):
        result, _ = self.check(holidays_page(2026, 20) + " 2027 dates to follow (1/01/2027)")
        self.assertEqual((result.status, result.summary),
                         (checks.FAIL, "The holidays page has no “Entity and EOR locations holidays for 2027” heading yet"))
        self.assertEqual([item.public_label for item in result.items], [None])

    def test_the_heading_needs_enough_dates_after_it(self):
        result, _ = self.check(holidays_page(2027, 7))
        self.assertEqual((result.status, result.summary),
                         (checks.FAIL, "The holidays page lists 7 of at least 8 holidays in 2027"))
        result, _ = self.check("(1/01/2027) " * 10 + "Entity and EOR locations holidays for 2027 to follow")
        self.assertEqual(result.summary, "The holidays page lists 0 of at least 8 holidays in 2027")

    def test_only_dates_in_next_year_count(self):
        result, _ = self.check(holidays_page(2027, 3) + " " + "(1/01/2026) (12/25/20271) " * 10)
        self.assertEqual(result.summary, "The holidays page lists 3 of at least 8 holidays in 2027")

    def test_only_checked_in_october(self):
        result, confluence = self.check(today=date(2026, 11, 4))
        self.assertEqual((result.status, result.hidden), (checks.SKIPPED, True))
        self.assertEqual(confluence.requested, [])

    def test_only_the_first_active_release_checks_it(self):
        result, confluence = self.check(primary=False)
        self.assertEqual((result.status, result.hidden), (checks.SKIPPED, True))
        self.assertEqual(confluence.requested, [])

    def test_needs_the_page_id(self):
        with self.assertRaisesRegex(checks.CheckError, "RELEASE_AGENT_HOLIDAYS_PAGE_ID isn't set"):
            self.check(page_id="")


def holidays_page_text():
    """The holidays page fixture as the Confluence client returns it."""
    page = json.loads((FIXTURES / "confluence-holidays-page.json").read_text())

    class PageHttp:
        def get(self, path, **params):
            return page
    return Confluence("https://mattermost.atlassian.net", "a@b.c", "t", PageHttp()).page("2928869382")[0]


class PageHolidaysTest(unittest.TestCase):
    HEADING = rules.load_yaml(rules.RULES_PATH)["holidays_page_heading"]

    def test_each_years_section_up_to_the_next_heading(self):
        days = checks.page_holidays(holidays_page_text(), self.HEADING, (2026, 2027))
        self.assertEqual(len({d for d in days if d.year == 2026}), 20)  # 25 rows: US and Canada share 5 days
        self.assertEqual(len({d for d in days if d.year == 2027}), 20)
        self.assertEqual(len(days), 40)
        self.assertIn(date(2026, 11, 11), days)  # Canada only (Remembrance Day, regional)
        self.assertIn(date(2026, 11, 26), days)  # US only
        self.assertNotIn(date(2025, 12, 25), days)  # 2025's section isn't asked for

    def test_only_the_years_asked_for(self):
        days = checks.page_holidays(holidays_page_text(), self.HEADING, (2027,))
        self.assertEqual({d.year for d in days}, {2027})
        self.assertEqual(checks.page_holidays("No headings here (1/01/2026)", self.HEADING, (2026,)), set())

    def test_a_section_stops_at_the_next_heading_and_skips_bad_dates(self):
        text = ("entity and EOR  locations holidays for 2026 (1/01/2026) (2/30/2026) (13/01/2026) "
                "Entity and EOR locations holidays for 2025 (12/25/2025) (7/04/2026)")
        self.assertEqual(checks.page_holidays(text, self.HEADING, (2026,)), {date(2026, 1, 1)})


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

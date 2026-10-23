import json
import unittest
from datetime import date

from release_agent import agent, rules
from release_agent.__main__ import log_line, step_summary
from release_agent.clients import ServiceError
from release_agent.tests.fakes import FakeGitHub, FakeHub, FakeJira, checklist_run, fixture

MM, ENT = "mattermost/mattermost", "mattermost/enterprise"
TODAY = date(2026, 11, 4)
LS_REMOTE = "\n".join(f"0\t{ref}" for ref in [
    "refs/heads/release-12.1", "refs/heads/release-12.2", "refs/heads/release-12.3",
    "refs/tags/v12.1.0", "refs/tags/v12.2.0-rc1", "refs/tags/v12.2.0-rc2",
])
SECRET = "Top secret enterprise fix"


def template_items():
    return [(title, "", 0) for title in sorted(rules.template_items(rules.load_yaml(rules.TEMPLATE_PATH)))]


def services(jira=None):
    github = FakeGitHub()
    github.searches[r"repo:mattermost/enterprise is:pr is:open milestone:\"v12\.2\.0\""] = [
        {"number": 9, "title": SECRET, "state": "open", "html_url": "https://github.com/mattermost/enterprise/pull/9",
         "user": {"login": "dev"}, "assignees": []}]
    github.searches["NOTICE"] = [{"number": 39103, "title": "chore: Update NOTICE.txt", "state": "closed",
                                  "html_url": "https://github.com/mattermost/mattermost/pull/39103",
                                  "user": {"login": "unified-ci-app[bot]"}, "assignees": []}]
    github.pulls[(MM, 39103)] = {"merged_at": "2026-10-20T00:00:00Z", "merge_commit_sha": "n1"}
    github.branch_commits[(MM, "release-12.2")] = [{"sha": "n1", "commit": {"message": "chore: NOTICE (#39103)"}}]
    github.on_branch.add((MM, "abc", "release-12.2"))
    github.tags = {MM: ["v12.2.0-rc1", "v12.2.0-rc2"], ENT: ["v12.2.0-rc1", "v12.2.0-rc2"]}
    github.dates[(MM, "v12.2.0-rc2")] = "2026-11-02T12:00:00Z"
    hub = FakeHub(("12.2.0", "abc"))
    hub.runs = [checklist_run("run122", "Self-Hosted Release v12.2", "c122", template_items()),
                checklist_run("run123", "Self-Hosted Release v12.3", "c123", template_items())]
    return agent.Services(github=github, jira=jira or FakeJira(), hub=hub, playbooks=hub,
                          fetch_calendar=lambda: fixture("release-dates.ics"), ls_remote=lambda: LS_REMOTE)


def settings(mode="live", release=""):
    return agent.Settings(mode=mode, release_override=release, testing_alerts_channel="alerts", test_channel="test-chan")


def run(svc, mode="live", release=""):
    return agent.run(rules.load_rules(), settings(mode, release), svc, TODAY)


def by_task(release_body):
    return {check["task"]: check for check in release_body["checks"]}


class LiveRunTest(unittest.TestCase):
    def setUp(self):
        self.svc = services()
        self.body, self.details = run(self.svc)
        self.releases = {r["version"]: r for r in self.body["releases"]}

    def test_both_active_releases_are_checked(self):
        self.assertEqual(list(self.releases), ["v12.2", "v12.3"])
        self.assertEqual(self.releases["v12.2"]["t_day"], "T-7")  # Nov 11 is a holiday
        self.assertEqual(self.releases["v12.3"]["t_day"], "T-27")

    def test_states(self):
        checks = by_task(self.releases["v12.2"])
        self.assertEqual({task: c["state"] for task, c in checks.items()}, {
            "open-release-items": "report",
            "new-regressions": "ok",
            "hub-on-release-branch": "ok",
            "notice-txt": "ok",
            "cherry-picks": "ok",
            "e2e-results": "needs_attention",
            "rc-tags": "ok",
            "final-tags": "not_due",
            "version-go-prs": "needs_attention",
            "changelog-labels": "ok",
        })
        self.assertEqual(by_task(self.releases["v12.3"])["e2e-results"]["state"], "skipped")

    def test_ticks_passing_due_items_only(self):
        ticked = {(run_id, title) for run_id, title in self.svc.hub.closed}
        self.assertEqual(ticked, {
            ("run122", "Triage new regressions"),
            ("run122", "Update Hub to the release branch"),
            ("run122", "Update NOTICE.txt on the release branch"),
            ("run122", "Confirm RC tags exist in mattermost and enterprise"),
            ("run122", "Confirm every merged PR has a changelog label"),
            ("run123", "Triage new regressions"),
        })
        self.assertNotIn("cherry-picks", [t["task"] for t in self.releases["v12.2"]["ticked"]])  # passing, not due

    def test_posts_in_release_channels_with_proof_replies(self):
        status = [p for p in self.svc.hub.created if not p["root_id"]]
        self.assertEqual(sorted(p["channel_id"] for p in status), ["c122", "c123"])
        replies = [p for p in self.svc.hub.created if p["root_id"]]
        self.assertEqual(len(replies), 6)
        self.assertTrue(all(r["root_id"] in {p["id"] for p in status} for r in replies))
        self.assertIn("Ticked **Update NOTICE.txt on the release branch**", "\n".join(r["message"] for r in replies))

    def test_private_details_stay_on_hub(self):
        public = json.dumps(self.body) + step_summary(self.body)
        self.assertNotIn(SECRET, public)
        self.assertNotIn("enterprise#9", public)
        self.assertIn("(private repo)", json.dumps(by_task(self.releases["v12.2"])["open-release-items"]))
        post = next(p for p in self.svc.hub.created if p["channel_id"] == "c122" and not p["root_id"])
        self.assertIn(SECRET, post["message"])

    def test_second_run_ticks_nothing_and_does_not_repost(self):
        closed, created = len(self.svc.hub.closed), len(self.svc.hub.created)
        body, _ = run(self.svc)
        self.assertEqual(len(self.svc.hub.closed), closed)
        self.assertEqual(len(self.svc.hub.created), created)
        self.assertEqual([r["post"] for r in body["releases"]], ["unchanged", "unchanged"])

    def test_totals(self):
        self.assertEqual(self.body["totals"]["releases"], 2)
        self.assertEqual(self.body["totals"]["checks_run"], 20)
        self.assertEqual(self.body["totals"]["ticked"], 6)


class TestModeTest(unittest.TestCase):
    def test_posts_only_to_test_channel_and_ticks_nothing(self):
        svc = services()
        body, _ = run(svc, mode="test")
        self.assertEqual(svc.hub.closed, [])
        self.assertEqual({p["channel_id"] for p in svc.hub.created}, {"test-chan"})
        self.assertEqual(len(svc.hub.created), 2)
        self.assertIn("notice-txt", body["releases"][0]["would_tick"])
        self.assertEqual(body["releases"][0]["ticked"], [])


class OverrideAndFailureTest(unittest.TestCase):
    def test_release_override(self):
        body, _ = run(services(), release="v12.3")
        self.assertEqual([r["version"] for r in body["releases"]], ["v12.3"])

    def test_override_not_on_calendar(self):
        body, _ = run(services(), release="v13.0")
        self.assertEqual(body["releases"], [])
        self.assertIn("v13.0 was requested, but the calendar has no milestones for it.", body["flags"])

    def test_a_failing_service_is_an_error_not_a_crash(self):
        class DownJira(FakeJira):
            def search(self, jql, limit=1000):
                raise ServiceError("Jira", 401, "token for someone@example.com rejected")
        body, details = run(services(DownJira()))
        check = by_task(body["releases"][0])["new-regressions"]
        self.assertEqual((check["state"], check["error"]), ("error", "Jira request failed (HTTP 401)"))
        self.assertNotIn("someone@example.com", json.dumps(body))
        self.assertTrue(any("someone@example.com" in d for d in details))

    def test_error_text(self):
        self.assertEqual(agent.private_error(ServiceError("Jira", 404)), "Jira request failed (HTTP 404)")
        self.assertEqual(agent.private_error(ServiceError("Jira", 401, "bad token")), "Jira request failed (HTTP 401): bad token")
        self.assertEqual(agent.public_error(KeyError("MM-123 secret")), "unexpected KeyError")
        self.assertEqual(agent.private_error(KeyError("x")), "unexpected KeyError: 'x'")

    def test_mode(self):
        self.assertEqual(agent.resolve_mode("repository-variable", ""), "test")
        self.assertEqual(agent.resolve_mode("repository-variable", "live"), "live")
        self.assertEqual(agent.resolve_mode("test", "live"), "test")
        with self.assertRaises(ValueError):
            agent.resolve_mode("", "production")


class LogLineTest(unittest.TestCase):
    def test_success(self):
        body, _ = run(services())
        line = log_line(body, [], "success", "https://run", "live")
        self.assertTrue(line.startswith(":warning: release-agent [live] 2026-11-04: v12.2 T-7 needs attention (post created, ticked 5)"))
        self.assertTrue(line.endswith("· [run](https://run)"))

    def test_failure_without_run_json(self):
        line = log_line(None, [], "failure", "https://run", "test")
        self.assertEqual(line, ":rotating_light: release-agent [test] failed before it wrote run.json (failure) · [run](https://run)")

    def test_failure_with_error(self):
        body = {"mode": "test", "date": "2026-11-04", "error": "Release Dates calendar request failed (HTTP 404)"}
        line = log_line(body, ["run: detail"], "failure", "", "test")
        self.assertEqual(line, ":rotating_light: release-agent [test] 2026-11-04 failed: "
                               "Release Dates calendar request failed (HTTP 404) — run: detail")


if __name__ == "__main__":
    unittest.main()

import json
import unittest
from datetime import date

from release_agent import agent, rules
from release_agent.__main__ import log_line, step_summary
from release_agent.clients import ServiceError
from release_agent.tests.test_checks import holidays_page, holidays_page_text
from release_agent.tests.fakes import FakeConfluence, FakeGitHub, FakeHub, FakeJira, checklist_run, fixture

MM, ENT = "mattermost/mattermost", "mattermost/enterprise"
TODAY = date(2026, 11, 4)
LS_REMOTE = "\n".join(f"0\t{ref}" for ref in [
    "refs/heads/release-12.1", "refs/heads/release-12.2", "refs/heads/release-12.3",
    "refs/tags/v12.1.0", "refs/tags/v12.2.0-rc1", "refs/tags/v12.2.0-rc2",
])
SECRET = "Top secret enterprise fix"
DEV_LEADS = next(r for r in rules.load_rules()["rules"] if r["task"] == "open-release-items")["query"]["dev_leads"]


def template_items():
    return [(title, "", 0) for title in sorted(rules.template_items(rules.load_yaml(rules.TEMPLATE_PATH)))]


def services(jira=None, confluence=None):
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
    hub.users = [{"username": route["username"], "first_name": "", "last_name": ""} for route in DEV_LEADS["routes"]]
    hub.channels = [{"id": "c122", "display_name": "Release: v12.2"}, {"id": "c123", "display_name": "Release: v12.3"}]
    hub.runs = [checklist_run("run122", "Release: v12.2", "c122", template_items()),
                checklist_run("run123", "Release: v12.3", "c123", template_items())]
    return agent.Services(github=github, jira=jira or FakeJira(), hub=hub, playbooks=hub,
                          fetch_calendar=lambda: fixture("release-dates.ics"), ls_remote=lambda: LS_REMOTE,
                          confluence=confluence or FakeConfluence())


def settings(mode="live", release=""):
    return agent.Settings(mode=mode, release_override=release, testing_alerts_channel="alerts", test_channel="test-chan",
                          holidays_page_id="page9")


def run(svc, mode="live", release="", today=TODAY):
    return agent.run(rules.load_rules(), settings(mode, release), svc, today)


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
            "cherry-picks-to-label": "ok",
            "e2e-results": "needs_attention",
            "rc-tags": "ok",
            "final-tags": "not_due",
            "version-go-prs": "skipped",
            "changelog-labels": "ok",
            "holidays-page": "skipped",
        })
        self.assertEqual(by_task(self.releases["v12.3"])["e2e-results"]["state"], "skipped")

    def test_ticks_passing_due_items_only(self):
        ticked = {(run_id, title) for run_id, title in self.svc.hub.closed}
        self.assertEqual(ticked, {
            ("run122", "Post a list of outstanding release bugs and PRs to the release playbook channel. Label approved cherry-pick PRs."),
            ("run122", "Check that Hub was updated to the latest release branch."),
            ("run122", "Ensure that new NOTICE.txt for any new libraries are cherry-picked to the release branch as needed - example PR."),
        })
        self.assertNotIn("cherry-picks", [t["task"] for t in self.releases["v12.2"]["ticked"]])  # passing, not due

    def test_posts_in_release_channels_with_proof_replies(self):
        status = [p for p in self.svc.hub.created if not p["root_id"]]
        self.assertEqual(sorted(p["channel_id"] for p in status), ["c122", "c123"])
        replies = [p for p in self.svc.hub.created if p["root_id"]]
        self.assertEqual(len(replies), 3)
        self.assertTrue(all(r["root_id"] in {p["id"] for p in status} for r in replies))
        self.assertIn("Ticked **Ensure that new NOTICE.txt for any new libraries", "\n".join(r["message"] for r in replies))

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

    def test_a_dev_lead_who_left_hub_is_flagged_in_each_post(self):
        svc = services()
        svc.hub.users = [u for u in svc.hub.users if u["username"] != "maria.nunez"]
        svc.hub.users[0]["delete_at"] = 1761800000000
        body, _ = run(svc)
        left = ["Dev lead Jesse Hallam (`jesse.hallam`) in rules.yml is deactivated on Hub, so their tickets name them without a mention.",
                "Dev lead Maria Nunez (`maria.nunez`) in rules.yml has no Hub account, so their tickets name them without a mention."]
        self.assertEqual([r["flags"] for r in body["releases"]], [left, left])
        self.assertEqual(self.body["releases"][0]["flags"], [])
        post = next(p for p in svc.hub.created if p["channel_id"] == "c122" and not p["root_id"])
        self.assertIn(f":triangular_flag_on_post: {left[1]}", post["message"])
        self.assertNotIn("@maria.nunez", post["message"])

    def test_totals(self):
        self.assertEqual(self.body["totals"]["releases"], 2)
        self.assertEqual(self.body["totals"]["checks_run"], 24)
        self.assertEqual(self.body["totals"]["ticked"], 3)
        self.assertEqual(self.body["totals"]["alarms_raised"], 3)
        self.assertEqual(self.body["totals"]["false_alarms"], 0)

    def test_reaction_marks_false_alarms_on_the_next_run(self):
        post_id = self.releases["v12.2"]["post_id"]
        self.svc.hub.react(post_id, "no_entry_sign")
        self.svc.hub.react(post_id, "no_entry_sign", user_id="bot")
        body, _ = run(self.svc)
        v122 = body["releases"][0]
        self.assertEqual((v122["status"], v122["post"]), ("all_good", "updated"))
        self.assertEqual(sorted(a["what"] for a in v122["false_alarms"]), ["e2e-results"])
        self.assertEqual(body["totals"]["false_alarms"], 1)
        post = next(p for p in self.svc.hub.posts["c122"] if p["id"] == post_id)
        self.assertIn("**Marked as false alarms**", post["message"])

        again, _ = run(self.svc)
        self.assertEqual(again["releases"][0]["post"], "unchanged")


    def test_out_of_season_tasks_are_left_out_of_the_post(self):
        post = next(p for p in self.svc.hub.created if p["channel_id"] == "c122" and not p["root_id"])
        self.assertNotIn("holidays", post["message"])


class HolidaysPageTest(unittest.TestCase):
    OCTOBER = date(2026, 10, 26)

    def run_in_october(self, text):
        svc = services(confluence=FakeConfluence(text))
        body, _ = run(svc, today=self.OCTOBER)
        post = next(p for p in svc.hub.created if p["channel_id"] == "c122" and not p["root_id"])
        return by_task(body["releases"][0])["holidays-page"], body, post["message"]

    def test_missing_next_year_needs_attention_on_hub_only(self):
        check, body, post = self.run_in_october(holidays_page(2026, 20) + " 2027 dates to follow")
        missing = "The holidays page has no “Entity and EOR locations holidays for 2027” heading yet"
        self.assertEqual((check["state"], check["summary"], check["items"]), ("needs_attention", missing, []))
        self.assertNotIn("wiki.example", json.dumps(body) + step_summary(body))
        self.assertIn(f"**Next year's holidays on Confluence** — {missing}", post)
        self.assertIn("https://wiki.example/pages/page9", post)

    def test_listed_next_year_is_all_good(self):
        check, _, post = self.run_in_october(holidays_page(2027, 20))
        self.assertEqual(check["state"], "ok")
        self.assertIn(":white_check_mark: **Next year's holidays on Confluence** — The holidays page lists 20 holidays in 2027", post)


V121_NO_HOLIDAYS = "\r\n".join([
    "BEGIN:VCALENDAR",
    *(line for day, title in [("20260921", "v12.1 Release Branch Cut"), ("20261105", "v12.1 Code Freeze"),
                              ("20261116", "v12.1 Release Day")]
      for line in ("BEGIN:VEVENT", f"DTSTART;VALUE=DATE:{day}", f"SUMMARY:{title}", "END:VEVENT")),
    "END:VCALENDAR", ""])


class PageHolidaysRunTest(unittest.TestCase):
    """Holidays on the Confluence page count even when the calendar has no Holiday events."""
    OCT_30 = date(2026, 10, 30)

    def run_v121(self, confluence, page_id="page9"):
        svc = services(confluence=confluence)
        svc.fetch_calendar = lambda: V121_NO_HOLIDAYS
        config = settings(release="v12.1")
        config.holidays_page_id = page_id
        return agent.run(rules.load_rules(), config, svc, self.OCT_30)

    def test_nov_11_from_the_page_is_not_a_working_day(self):
        confluence = FakeConfluence(holidays_page_text())
        body, _ = self.run_v121(confluence)
        self.assertEqual(body["releases"][0]["t_day"], "T-10")
        self.assertEqual(body["holidays_used"], 40)
        self.assertEqual(confluence.requested, ["page9"])  # once, shared with the holidays-page check
        self.assertNotIn("holidays page", json.dumps(body["flags"]))
        holidays = frozenset(agent.checks.page_holidays(holidays_page_text(), rules.load_rules()["holidays_page_heading"], (2026,)))
        v121 = agent.release_calendar.releases_from_events(
            agent.release_calendar.parse_ics(V121_NO_HOLIDAYS), rules.load_rules()["calendar"]["milestones"])[0][(12, 1)]
        self.assertEqual(agent.release_calendar.resolve_due("T-6", v121, holidays), date(2026, 11, 5))
        self.assertEqual(agent.release_calendar.resolve_due("T-6", v121, frozenset()), date(2026, 11, 6))

    def test_without_the_page_nov_11_counts(self):
        body, _ = self.run_v121(FakeConfluence(holidays_page_text()), page_id="")
        self.assertEqual((body["releases"][0]["t_day"], body["holidays_used"]), ("T-11", 0))

    def test_an_unreadable_page_is_flagged_and_the_run_goes_on(self):
        class DownConfluence(FakeConfluence):
            def page(self, page_id):
                raise ServiceError("Confluence", 403, "Secret page title")
        body, details = self.run_v121(DownConfluence())
        self.assertEqual(body["releases"][0]["t_day"], "T-11")
        self.assertIn("Couldn't read the holidays page, so T-days may count a holiday as a working day.", body["flags"])
        self.assertEqual(body["holidays_used"], 0)
        self.assertNotIn("Secret page title", json.dumps(body))
        self.assertIn("holidays page: Confluence request failed (HTTP 403): Secret page title", details)


class ReleaseChannelTest(unittest.TestCase):
    def test_run_is_found_by_its_release_channel(self):
        svc = services()
        for r in svc.hub.runs:
            r["name"] = "Renamed run"
        body, _ = run(svc)
        self.assertEqual(len(svc.hub.closed), 3)
        self.assertEqual(body["releases"][0]["flags"], [])

    def test_without_the_channel_the_run_is_found_by_name(self):
        svc = services()
        svc.hub.channels = []
        svc.hub.runs[0]["name"] = "Self-Hosted Release v12.2"
        body, _ = run(svc)
        self.assertEqual(len(svc.hub.closed), 3)
        self.assertEqual(sorted(p["channel_id"] for p in svc.hub.created if not p["root_id"]), ["c122", "c123"])

    def test_esr_channel(self):
        for name in ("Release: v12.2 (ESR)", "Release: v12.2 ESR", "release:  v12.2 esr"):
            svc = services()
            svc.hub.channels[0]["display_name"] = name
            svc.hub.runs[0]["name"] = "Renamed run"
            body, _ = run(svc)
            self.assertEqual(body["releases"][0]["flags"], [], name)
            self.assertEqual(len(svc.hub.closed), 3, name)
            self.assertIn("c122", [p["channel_id"] for p in svc.hub.created if not p["root_id"]])

    def test_report_is_ticked_only_when_posted_in_the_run_channel(self):
        svc = services()
        cfg = settings()
        cfg.release_channels = {"v12.2": "elsewhere"}
        body, _ = agent.run(rules.load_rules(), cfg, svc, TODAY)
        ticked = [t["task"] for t in body["releases"][0]["ticked"]]
        self.assertNotIn("open-release-items", ticked)
        self.assertIn("notice-txt", ticked)

    def test_two_channels_with_the_name_are_flagged(self):
        svc = services()
        svc.hub.channels.append({"id": "dup", "display_name": "release: V12.2"})
        body, _ = run(svc)
        self.assertIn("The bot is in 2 channels named “Release: v12.2” or “Release: v12.2 (ESR)” or “Release: v12.2 ESR”, so none is used.", body["releases"][0]["flags"])


class TestModeTest(unittest.TestCase):
    def test_posts_only_to_test_channel_and_ticks_nothing(self):
        svc = services()
        body, _ = run(svc, mode="test")
        self.assertEqual(svc.hub.closed, [])
        self.assertEqual({p["channel_id"] for p in svc.hub.created}, {"test-chan"})
        self.assertEqual(len(svc.hub.created), 2)
        self.assertIn("notice-txt", body["releases"][0]["would_tick"])
        self.assertIn("open-release-items", body["releases"][0]["would_tick"])
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
            def search(self, jql, limit=1000, extra_fields=()):
                raise ServiceError("Jira", 401, "token for someone@example.com rejected")
        body, details = run(services(DownJira()))
        for task in ("new-regressions", "open-release-items", "cherry-picks-to-label"):
            check = by_task(body["releases"][0])[task]
            self.assertEqual((check["state"], check["error"]), ("error", "Jira request failed (HTTP 401)"))
        self.assertNotIn("someone@example.com", json.dumps(body))
        self.assertTrue(any("someone@example.com" in d for d in details))

    def test_jiras_reason_for_a_bad_jql_is_on_hub_only(self):
        reason = "The value 'Won't Fix' does not exist for the field 'resolution'."

        class StrictJira(FakeJira):
            def search(self, jql, limit=1000, extra_fields=()):
                if "resolution" in jql:
                    raise ServiceError("Jira", 400, json.dumps({"errorMessages": [reason]}))
                return []
        svc = services(StrictJira())
        body, details = run(svc)
        check = by_task(body["releases"][0])["new-regressions"]
        self.assertEqual((check["state"], check["error"]), ("error", "Jira request failed (HTTP 400)"))
        post = next(p for p in svc.hub.created if p["channel_id"] == "c122" and not p["root_id"])["message"]
        self.assertIn(f"couldn't check: Jira request failed (HTTP 400): “{reason}”", post)
        self.assertNotIn("does not exist", json.dumps(body) + step_summary(body))
        self.assertIn(f"v12.2 new-regressions: Jira request failed (HTTP 400): {reason}", details)

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
        self.assertTrue(line.startswith(":warning: release-agent [live] 2026-11-04: v12.2 T-7 needs attention (post created, ticked 3)"))
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

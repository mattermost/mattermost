"""Asks to other teams (asks.py): each ask sent once on its day, followed up, and its playbook
item ticked when done or not needed; plus the seven asks' own rules."""

import json
import re
import unittest
from datetime import date, datetime, timezone

from release_agent import agent, asks, checks, playbook, posting, release_calendar, rules
from release_agent.__main__ import step_summary
from release_agent.release_calendar import Release
from release_agent.tests.fakes import FakeConfluence, FakeGitHub, FakeHub, FakeJira, checklist_run, fixture

RULES = rules.load_rules()
RULE = {rule["task"]: rule for rule in RULES["rules"]}
TEMPLATE_TITLES = sorted(rules.template_items(rules.load_yaml(rules.TEMPLATE_PATH)))
MM, MOBILE, DESKTOP, HEALTHCHECK = "mattermost/mattermost", "mattermost/mattermost-mobile", "mattermost/desktop", \
    "mattermost/mattermost-healthcheck"
# Release Day Mon Nov 16: T-16 Fri Oct 23, T-15 Mon Oct 26, T-6 Fri Nov 6, T-4 Tue Nov 10, T-3 Wed Nov 11, T-2 Thu Nov 12.
V122 = Release(12, 2, {"branch_cut": date(2026, 10, 19), "feature_complete": date(2026, 10, 23),
                       "code_freeze": date(2026, 11, 6), "final_build": date(2026, 11, 9), "release_day": date(2026, 11, 16)})
PEOPLE = {"sre": ["angelos.kyratzakos", "andre.leite"], "loadtest": ["alejandro.garcia", "dylan.haussermann"],
          "qa": ["yasser.khan", "saturn.abril"], "ces": ["adit.yadav"], "ces_github": "adityadav1987",
          "docs": ["eric.sethna", "john.combs"], "mugs": ["john.combs"]}
MANAGER = {"id": "amy", "username": "amy.blais"}
CHANNELS = RULES["channels"]


def ms(day: date, hour: int = 9) -> int:
    return int(datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc).timestamp() * 1000)


def hub_with_people() -> FakeHub:
    hub = FakeHub()
    hub.users = [{"id": name, "username": name, "first_name": "", "last_name": ""}
                 for names in PEOPLE.values() if isinstance(names, list) for name in names]
    hub.users.append({**MANAGER, "first_name": "Amy", "last_name": "Blais"})
    return hub


def run_with_items() -> dict:
    return checklist_run("run122", "Release: v12.2", "c122", [(title, "", 0) for title in TEMPLATE_TITLES])


def github() -> FakeGitHub:
    gh = FakeGitHub()
    gh.milestone_list = {MOBILE: [{"title": "v2.47.0", "due_on": "2026-11-16T00:00:00Z"},
                                  {"title": "v2.46.0", "due_on": "2026-10-16T00:00:00Z"}],
                         DESKTOP: [{"title": "v6.4.0", "due_on": "2026-11-16T00:00:00Z"}]}
    return gh


class Harness:
    """One release's asks against fakes, day after day."""

    def __init__(self, release=V122, mode="live", people=None, tags=(), rc=(1,), healthcheck=None, jira=None):
        self.release, self.mode = release, mode
        self.hub, self.github = hub_with_people(), github()
        self.jira = jira or FakeJira()
        self.healthcheck = healthcheck
        self.people = PEOPLE if people is None else people
        self.run = run_with_items()
        self.tags, self.rc = set(tags), list(rc)
        self.confluence = FakeConfluence()
        self.flags, self.private_flags = [], []

    def env(self, today: date) -> asks.AskEnv:
        self.hub.clock_ms = ms(today)
        ctx = checks.Context(release=self.release, today=today,
                             vars=agent.template_vars(self.release, RULES["naming"], self.rc),
                             has_branch=True, rc_numbers=self.rc, github=self.github, jira=self.jira, hub=self.hub,
                             testing_alerts_channel="alerts", confluence=self.confluence, primary=True,
                             branches={(12, 1), self.release.key}, tags=self.tags)
        return asks.AskEnv(ctx=ctx, rules=RULES, people=self.people, mode=self.mode, holidays=frozenset(),
                           release_channel="c122", run=self.run, manager=MANAGER, healthcheck_github=self.healthcheck,
                           sleep=lambda seconds: None)

    def ask(self, task: str, today: date) -> asks.Handoff:
        env = self.env(today)
        handoff = asks.process_rule(env, RULE[task], lambda due: release_calendar.resolve_due(due, self.release, frozenset()))
        self.flags += env.flags
        self.private_flags += env.private_flags
        return handoff

    def sent(self, channel: str, root: str | None = "") -> list[dict]:
        return [p for p in self.hub.posts.get(channel, []) if p["user_id"] == "bot"
                and (root is None or p.get("root_id", "") == root)]

    def reply(self, root: dict, user: str, message: str, day: date):
        return self.hub.add_post(root["channel_id"], message, user_id=user, create_at=ms(day, 12), root_id=root["id"])

    def tick(self, title: str, state: str = "closed"):
        for item in self.run["checklists"][0]["items"]:
            if item["title"] == title:
                item["state"], item["state_modified"] = state, 5


def title_of(task: str) -> str:
    return next(t for t in TEMPLATE_TITLES if playbook.title_matches(t, RULE[task]["playbook_item"]))


# ── The lifecycle every ask shares, shown with the docs and SRE asks ────────────────

class LifecycleTest(unittest.TestCase):
    def docs_needed(self, h: Harness, server=1, mobile=0, desktop=0):
        h.github.searches = {r'mattermost/mattermost .*Docs/Needed': [{"number": n} for n in range(server)],
                             r'mattermost-mobile .*Docs/Needed': [{"number": n} for n in range(mobile)],
                             r'desktop .*Docs/Needed': [{"number": n} for n in range(desktop)]}

    def test_not_due_before_its_day(self):
        h = Harness()
        self.assertEqual(h.ask("docs-ask", date(2026, 10, 22)).state, asks.NOT_DUE)
        self.assertEqual(h.hub.created, [])

    def test_sent_once_and_a_rerun_sends_nothing(self):
        h = Harness()
        self.docs_needed(h, server=2, mobile=1)
        first = h.ask("docs-ask", date(2026, 10, 23))
        self.assertEqual((first.state, first.asked_on, first.counts), (asks.WAITING, date(2026, 10, 23),
                                                                         {"server": 2, "mobile": 1, "desktop": 0}))
        h.ask("docs-ask", date(2026, 10, 23))
        posts = h.sent("c122")
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["props"], {asks.ASK_PROP: "docs-ask:v12.2"})
        self.assertEqual(posts[0]["message"], (
            "**v12.2 / Mobile v2.47 / Desktop v6.4 Docs**\n\n"
            "@eric.sethna @john.combs A kind note that docs for v12.2 / Mobile v2.47 / Desktop v6.4 are due by November 12th:\n"
            " - [Server PRs](https://github.com/mattermost/mattermost/pulls?q=is%3Apr+is%3Aclosed+label%3ADocs%2FNeeded+milestone%3Av12.2.0)\n"
            " - [Mobile PRs](https://github.com/mattermost/mattermost-mobile/pulls?q=is%3Apr+is%3Aclosed+label%3ADocs%2FNeeded+milestone%3Av2.47.0)\n"
            " - [Desktop PRs](https://github.com/mattermost/desktop/pulls?q=is%3Apr+is%3Aclosed+label%3ADocs%2FNeeded+milestone%3Av6.4.0)"))

    def test_desktop_is_left_out_in_a_month_without_a_desktop_release(self):
        h = Harness()
        h.github.milestone_list[DESKTOP] = [{"title": "v6.5.0", "due_on": "2027-02-16T00:00:00Z"}]
        self.docs_needed(h)
        h.ask("docs-ask", date(2026, 10, 23))
        self.assertTrue(h.sent("c122")[0]["message"].startswith("**v12.2 / Mobile v2.47 Docs**"))
        self.assertNotIn("Desktop", h.sent("c122")[0]["message"])

    def test_an_ask_posted_by_hand_is_followed_not_repeated(self):
        h = Harness(tags={(12, 2)})
        by_hand = h.hub.add_post("i8rxygnihpbfjnin7s3m4py6te", "@andre.leite @angelos.kyratzakos Can you help roll out "
                                 "Mattermost v12.2.0 to the Freemium and Professional rings?", user_id="amy",
                                 create_at=ms(date(2026, 11, 9)))
        h.reply(by_hand, "andre.leite", "Beta, Freemium done. Proceeding to professional", date(2026, 11, 10))
        handoff = h.ask("sre-freemium-pro", date(2026, 11, 10))
        self.assertEqual(h.sent("i8rxygnihpbfjnin7s3m4py6te"), [])
        self.assertEqual((handoff.state, handoff.asked_on), (asks.WAITING, date(2026, 11, 9)))

    def test_one_reminder_after_remind_after_and_not_again_that_day(self):
        h = Harness(tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        ask = h.sent("i8rxygnihpbfjnin7s3m4py6te")[0]
        self.assertIsNone(h.ask("sre-freemium-pro", date(2026, 11, 10)).reminded_on)  # same day: too soon
        handoff = h.ask("sre-freemium-pro", date(2026, 11, 11))
        h.ask("sre-freemium-pro", date(2026, 11, 11))
        reminders = h.sent("i8rxygnihpbfjnin7s3m4py6te", root=ask["id"])
        self.assertEqual(len(reminders), 1)
        self.assertEqual(handoff.reminded_on, date(2026, 11, 11))
        self.assertEqual(reminders[0]["message"], "Reminder: Cloud Freemium and Professional rollout for v12.2 is still open. "
                                                  "@angelos.kyratzakos @andre.leite")
        h.ask("sre-freemium-pro", date(2026, 11, 12))  # remind_after only: one reminder in all
        self.assertEqual(len(h.sent("i8rxygnihpbfjnin7s3m4py6te", root=ask["id"])), 1)

    def test_docs_reminders_repeat_every_two_working_days_with_the_counts(self):
        h = Harness()
        self.docs_needed(h, server=3, mobile=1)
        h.ask("docs-ask", date(2026, 10, 23))  # Fri
        ask = h.sent("c122")[0]
        for day in (26, 27, 28, 29):  # Mon to Thu
            h.ask("docs-ask", date(2026, 10, day))
        reminders = h.sent("c122", root=ask["id"])
        self.assertEqual([datetime.fromtimestamp(r["create_at"] / 1000, timezone.utc).day for r in reminders], [27, 29])
        self.assertEqual(reminders[0]["message"], "Reminder: docs for v12.2 / Mobile v2.47 / Desktop v6.4 are due by "
                                                  "November 12th. PRs still labelled Docs/Needed: 3 server, 1 mobile, 0 desktop. "
                                                  "@eric.sethna @john.combs")

    def test_escalated_from_escalate_at(self):
        h = Harness(tags={(12, 2)})
        self.assertFalse(h.ask("sre-freemium-pro", date(2026, 11, 10)).escalated)
        self.assertTrue(h.ask("sre-freemium-pro", date(2026, 11, 11)).escalated)  # T-3

    def test_done_when_the_check_passes(self):
        h = Harness()
        self.docs_needed(h, server=1)
        h.ask("docs-ask", date(2026, 10, 23))
        self.docs_needed(h, server=0)
        handoff = h.ask("docs-ask", date(2026, 10, 26))
        self.assertEqual((handoff.state, handoff.summary), (asks.DONE, "no PRs left with Docs/Needed (0 server, 0 mobile, 0 desktop)"))

    def test_an_item_ticked_by_hand_is_left_alone(self):
        h = Harness()
        h.tick(title_of("docs-ask"))
        handoff = h.ask("docs-ask", date(2026, 10, 23))
        self.assertEqual((handoff.state, handoff.summary), (asks.DONE, "done in the playbook"))
        h.tick(title_of("manual-tests"), state="in_progress")
        self.assertEqual(h.ask("manual-tests", date(2026, 10, 26)).state, asks.BY_PERSON)
        self.assertEqual(h.hub.created, [])

    def test_test_mode_sends_nothing_and_shows_what_it_would(self):
        h = Harness(mode="test", tags={(12, 2)})
        handoff = h.ask("sre-freemium-pro", date(2026, 11, 10))
        self.assertEqual(h.hub.created, [])
        self.assertEqual(handoff.state, asks.WOULD_SEND)
        self.assertEqual(handoff.previews, [("platform_engineering",
                                             "@angelos.kyratzakos @andre.leite Can you help roll out Mattermost v12.2.0 to the Cloud "
                                             "Freemium and Professional rings? Release notes: [v12.2 changelog](https://docs.mattermost.com/"
                                             "product-overview/mattermost-v12-changelog.html#release-v12-2-feature-release).")])


# ── The seven asks ──────────────────────────────────────────────────────────────────

def commit(sha, title, *files):
    return {"sha": sha, "commit": {"message": title}, "files": list(files)}


class CesTest(unittest.TestCase):
    def harness(self, changed=True, issue=False):
        healthcheck = FakeGitHub()
        if issue:
            healthcheck.searches[r"Support Packet changes"] = [
                {"title": "Mattermost v12.2 Support Packet changes", "html_url": "https://github.com/mattermost/mattermost-healthcheck/issues/31"}]
        h = Harness(healthcheck=healthcheck)
        h.github.dates[(MM, "v12.1.0")] = "2026-10-16T00:00:00Z"
        shared = commit("s0", "Old change (#38000)", "server/channels/app/support_packet.go")
        new = [commit("a1", "Add plugin data to the Support Packet (#38838)", "server/channels/app/support_packet.go"),
               commit("a2", "Fix packet field (#38729)", "server/public/model/support_packet.go"),
               commit("a3", "Again (#38838)", "server/channels/app/support_packet.go"),  # the same PR twice
               commit("a4", "Cherry-pick already in v12.1 (#38500)", "server/public/model/support_packet.go")] if changed else []
        h.github.branch_commits = {(MM, "release-12.2"): [shared, *new],
                                   (MM, "v12.1.0"): [shared, commit("b1", "Cherry-pick (#38500) (#38600)", "server/public/model/support_packet.go")]}
        h.tags = {(12, 1)}
        return h

    def test_not_needed_without_support_packet_changes(self):
        h = self.harness(changed=False)
        handoff = h.ask("ces-support-packet", date(2026, 10, 23))
        self.assertEqual((handoff.state, handoff.summary), (asks.NOT_NEEDED, "not needed: no Support Packet changes since v12.1"))
        self.assertEqual(h.hub.created, [])

    def test_the_issue_text_is_posted_once_each_pr_once_in_number_order(self):
        h = self.harness()
        h.ask("ces-support-packet", date(2026, 10, 23))
        h.ask("ces-support-packet", date(2026, 10, 23))
        posts = h.sent("c122")
        self.assertEqual(len(posts), 1)
        text = posts[0]["message"]
        self.assertTrue(text.startswith("@amy.blais The Support Packet changed in v12.2 (2 PRs since v12.1)."))
        self.assertIn("cc @adit.yadav", text)
        self.assertIn("```\nMattermost v12.2 Support Packet changes\n```", text)
        self.assertIn("Mattermost v12.2 (2026-11-16 release) will have support packet changes:\n\n"
                      "[mattermost/mattermost#38729](https://github.com/mattermost/mattermost/pull/38729)\n"
                      "[mattermost/mattermost#38838](https://github.com/mattermost/mattermost/pull/38838)\n\n"
                      "Review changes to see if they are worth adding to the health check report. Verify that the health "
                      "check tool still works with updated support packet structure. cc @adityadav1987", text)
        self.assertIn("[Open a new issue in mattermost-healthcheck with this text](https://github.com/mattermost/"
                      "mattermost-healthcheck/issues/new?title=Mattermost+v12.2+Support+Packet+changes&body=", text)

    def test_done_once_the_issue_exists_read_with_the_read_app(self):
        h = self.harness()
        h.ask("ces-support-packet", date(2026, 10, 23))
        h.healthcheck.searches[r"Support Packet changes"] = [
            {"title": "Mattermost v12.2 Support Packet changes", "html_url": "https://github.com/mattermost/mattermost-healthcheck/issues/31"}]
        handoff = h.ask("ces-support-packet", date(2026, 10, 26))
        self.assertEqual(handoff.state, asks.DONE)
        self.assertEqual(handoff.proof_url, "https://github.com/mattermost/mattermost-healthcheck/issues/31")
        self.assertNotIn("healthcheck/issues", json.dumps(handoff.public))
        self.assertIn('repo:mattermost/mattermost-healthcheck is:issue in:title "Mattermost v12.2 Support Packet changes"',
                      h.healthcheck.queries)

    def test_without_the_read_app_on_healthcheck_it_says_so(self):
        h = self.harness()
        h.healthcheck = None
        handoff = h.ask("ces-support-packet", date(2026, 10, 23))
        self.assertEqual(handoff.state, asks.WAITING)
        self.assertIn("The read app can't read mattermost-healthcheck", " ".join(h.flags))


class LoadtestTest(unittest.TestCase):
    def test_waits_for_rc1_then_asks_and_is_done_once_sent(self):
        jira = FakeJira({"Loadtest 12.2": [{"key": "MM-71198", "fields": {"summary": "📈 Loadtest 12.2, December (vs 12.1, November)"}},
                                           {"key": "MM-1", "fields": {"summary": "📈 Loadtest 12.20"}}]})
        h = Harness(rc=(), jira=jira)
        self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 26)).state, asks.NOT_READY)
        h.rc = [1]
        handoff = h.ask("loadtest-ask", date(2026, 10, 27))
        self.assertEqual(handoff.state, asks.DONE)
        self.assertEqual(h.sent("c122")[0]["message"],
                         "v12.2.0-RC1 is available for loadtesting: [v12.2.0-rc1 build](https://github.com/mattermost/mattermost/"
                         "releases/tag/v12.2.0-rc1). Loadtest epic: [MM-71198](https://jira.example/browse/MM-71198). "
                         "cc @alejandro.garcia @dylan.haussermann")

    def test_results_check_needs_the_epic_closed_and_a_results_post(self):
        hub = hub_with_people()
        jira = FakeJira({"Loadtest": [{"key": "MM-71198", "fields": {"summary": "📈 Loadtest 12.2, December", "status": {"name": "Open"}}}]})
        ctx = checks.Context(release=V122, today=date(2026, 11, 6), vars=agent.template_vars(V122, RULES["naming"], [1]),
                             has_branch=True, rc_numbers=[1], jira=jira, hub=hub)
        result = checks.loadtest_results(ctx, RULE["loadtest-results"])
        self.assertEqual(result.status, checks.FAIL)
        self.assertEqual(result.summary, "Loadtests aren't finished: the loadtest epic is Open and no results post names the "
                                         "release in Developers: Performance Comparisons")
        jira.issues["Loadtest"][0]["fields"]["status"]["name"] = "Closed"
        hub.add_post("idsfx9p4y3do3bd9gyzrwuyyyr", "Loadtest results for v12.2 vs v12.1: no regressions", create_at=ms(date(2026, 11, 2)))
        result = checks.loadtest_results(ctx, RULE["loadtest-results"])
        self.assertEqual((result.status, result.summary), (checks.PASS, "The loadtest epic is done and its results are posted"))
        self.assertIsNone(result.items[0].public_label)  # the epic key stays out of public output


class ManualTestsTest(unittest.TestCase):
    def harness(self, mobile_files=(), desktop_files=()):
        h = Harness()
        h.github.branches = {(MOBILE, "release-2.47"), (DESKTOP, "release-6.4")}
        h.github.dates.update({(MOBILE, "release-2.46"): "2026-10-10T00:00:00Z", (DESKTOP, "release-6.3"): "2026-08-10T00:00:00Z"})
        h.github.branch_commits = {
            (MOBILE, "release-2.47"): [commit(f"m{n}", f"Change {n} (#{9000 + n})", path) for n, path in enumerate(mobile_files)],
            (MOBILE, "release-2.46"): [],
            (DESKTOP, "release-6.4"): [commit(f"d{n}", f"Desktop change (#{3500 + n})", path) for n, path in enumerate(desktop_files)],
            (DESKTOP, "release-6.3"): []}
        return h

    def test_not_needed_without_changes_in_the_areas(self):
        h = self.harness(mobile_files=["app/screens/home/index.tsx"])
        handoff = h.ask("manual-tests", date(2026, 10, 26))
        self.assertEqual(handoff.summary, "not needed: no changes in the manual test areas")

    def test_lists_each_area_touched_with_what_to_do_and_the_prs(self):
        h = self.harness(mobile_files=["share_extension/index.tsx", "scripts/intune-init.sh", "scripts/build.sh"],
                         desktop_files=["src/main/security/certificateStore.ts"])
        handoff = h.ask("manual-tests", date(2026, 10, 26))
        self.assertEqual(handoff.state, asks.WAITING)
        text = h.sent("c122")[0]["message"]
        self.assertTrue(text.startswith("v12.2 manual tests: cc @yasser.khan @saturn.abril for manual/automated tests. "
                                        "These manual test areas changed in Mobile v2.47 and Desktop v6.4"))
        self.assertIn("- **Mobile: Intune and MDM PIN and blur**. What you do: Enroll a real phone, then confirm the PIN and "
                      "the blur. Test IDs: MM-T3004, MM-T3358, MM-T2934 (Android), MM-T2940 (real Intune). Changed by "
                      "[mattermost-mobile#9001](https://github.com/mattermost/mattermost-mobile/pull/9001).", text)
        self.assertIn("**Mobile: Sharing into Mattermost from another app**", text)
        self.assertIn("**Desktop: Certificates**", text)
        self.assertNotIn("#9002", text)  # scripts/build.sh is in no area

    def test_done_when_qa_replies_or_reacts(self):
        h = self.harness(mobile_files=["share_extension/index.tsx"])
        h.ask("manual-tests", date(2026, 10, 26))
        ask = h.sent("c122")[0]
        h.reply(ask, "amy", "manual testing done?", date(2026, 10, 27))  # not a QA owner
        self.assertEqual(h.ask("manual-tests", date(2026, 10, 27)).state, asks.WAITING)
        h.reply(ask, "yasser.khan", "Manual testing is done for mobile.", date(2026, 10, 28))
        self.assertEqual(h.ask("manual-tests", date(2026, 10, 28)).state, asks.DONE)
        h2 = self.harness(mobile_files=["share_extension/index.tsx"])
        h2.ask("manual-tests", date(2026, 10, 26))
        h2.hub.react(h2.sent("c122")[0]["id"], asks.APPROVE_EMOJI, user_id="saturn.abril")
        self.assertEqual(h2.ask("manual-tests", date(2026, 10, 27)).summary, "QA reacted to the ask as done")

    def test_a_newer_guidelines_page_is_flagged(self):
        h = Harness()
        h.confluence.page_version = lambda page_id: 41
        env = h.env(date(2026, 10, 26))
        asks.check_guidelines(env)
        self.assertEqual(env.flags, ["The manual test guidelines changed (now version 41): update manual_test_areas in rules.yml."])


class SreTest(unittest.TestCase):
    CHANNEL = "i8rxygnihpbfjnin7s3m4py6te"

    def test_rings_from_the_real_thread_wording(self):
        self.assertEqual(asks.rings_done(["Beta, Freemium done. Proceeding to professional"]), {"beta", "freemium"})
        self.assertEqual(asks.rings_done(["Beta, Freemium done. Proceeding to professional", "professional and enterprise done"]),
                         {"beta", "freemium", "professional", "enterprise"})
        self.assertEqual(asks.rings_done(["beta-ring - Done\nprofessional-ring - Done\nenterprise-shared-ring - Done\n"
                                          "freemium-ring - Upgrading"]), {"beta", "professional", "enterprise"})
        self.assertEqual(asks.rings_done(["Enterprise not done yet"]), set())

    def test_waits_for_the_final_tag_and_code_freeze(self):
        h = Harness()
        self.assertEqual(h.ask("sre-freemium-pro", date(2026, 11, 10)).summary, "waiting for v12.2.0 to be tagged")

    def test_the_real_replies_tick_both_items_and_no_enterprise_ask_is_sent(self):
        h = Harness(tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        ask = h.sent(self.CHANNEL)[0]
        h.reply(ask, "andre.leite", "Beta, Freemium done. Proceeding to professional", date(2026, 11, 10))
        self.assertEqual(h.ask("sre-freemium-pro", date(2026, 11, 10)).state, asks.WAITING)
        h.reply(ask, "andre.leite", "professional and enterprise done", date(2026, 11, 10))
        freemium = h.ask("sre-freemium-pro", date(2026, 11, 10))
        self.assertEqual((freemium.state, freemium.summary), (asks.DONE, "SRE says freemium and professional are done"))
        enterprise = h.ask("sre-enterprise", date(2026, 11, 11))
        self.assertEqual((enterprise.state, enterprise.summary), (asks.DONE, "SRE says enterprise is done, so it wasn't asked"))
        self.assertEqual(len(h.sent(self.CHANNEL, root=None)), 1)  # only the first ask

    def test_the_enterprise_ask_replies_in_the_rollout_thread(self):
        h = Harness(tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        ask = h.sent(self.CHANNEL)[0]
        h.ask("sre-enterprise", date(2026, 11, 11))
        replies = h.sent(self.CHANNEL, root=ask["id"])
        self.assertEqual([r["props"] for r in replies], [{asks.ASK_PROP: "sre-enterprise:v12.2"}])
        self.assertIn("to the Cloud Enterprise ring?", replies[0]["message"])

    def test_the_enterprise_ask_moves_off_a_friday(self):
        # Release Day Wed Dec 16: T-3 is Fri Dec 11, so it's due Mon Dec 14.
        v = Release(12, 2, {"branch_cut": date(2026, 11, 10), "code_freeze": date(2026, 12, 8), "release_day": date(2026, 12, 16)})
        h = Harness(release=v, tags={(12, 2)})
        self.assertEqual(h.ask("sre-enterprise", date(2026, 12, 11)).due, date(2026, 12, 14))


class ContributorsTest(unittest.TestCase):
    # Amy's post in Monthly Mugs on 2026-11-02 (asfrmi3bbpycdgouyxcbtuoddy).
    POSTED = ("abhijit-singh agarciamontoro ahmdyaasiin akinakamu amyblais andrleite angeloskyratzakos asaadmahmood "
              "avasconcelos114 BenCookie95 bgardner8008 brandon1024 calebroseland carlisgg christopherturner Combs7th cpoile "
              "crspeller cursor[bot] davidkrauser dependabot[bot] devinbinnie DSchalla edgarbellot eliasthx enahum esarafianou "
              "esethna ewwollesen famjankalaelina-debug fmartingr FrancescoCastaldi gu1p hanzei harshilsharma63 isacikgoz "
              "jackbenningdev jalet jasonblais jdotc1 jgheithcock JulienTant jwilander krd311 levb lieut-data M-ZubairAhmed "
              "MangelSpec marianunez mattermost-docs-ai[bot] matthewbirtch maxteneff nang2049 NARSimoes NateSchlossberg "
              "nathantalewis nickmisasi pvev rshrj saturninoabril sbishel svelle unified-ci-app[bot] wiersgallak wiggin77 "
              "yasserfaraazkhan").split()

    def october_github(self) -> FakeGitHub:
        recorded = json.loads(fixture("contributors-2026-10.json"))["repos"]
        gh = FakeGitHub()
        gh.repos = [{"full_name": name, "private": repo["private"], "fork": repo["fork"]} for name, repo in recorded.items()]
        gh.month_commits = {name: [{"author": {"login": login} if login else None} for login in repo["authors"]]
                            for name, repo in recorded.items()}
        return gh

    def test_october_2026_matches_the_posted_list_without_its_bots(self):
        found = asks.month_contributors(self.october_github(), "mattermost", 2026, 10, RULES["contributor_bot_logins"],
                                        sleep=lambda s: None)
        # The only differences: the four bots the posted list had. No contributor committed
        # only to a private repo the read app can't see.
        self.assertEqual(sorted(set(self.POSTED) - set(found)),
                         ["cursor[bot]", "dependabot[bot]", "mattermost-docs-ai[bot]", "unified-ci-app[bot]"])
        self.assertEqual(sorted(set(found) - set(self.POSTED)), [])
        self.assertEqual(found, sorted(found, key=str.casefold))

    def test_posted_once_on_the_first_working_day_and_ticked(self):
        h = Harness()
        h.github = self.october_github()
        self.assertEqual(h.ask("contributors", date(2026, 11, 1)).state, asks.NOT_DUE)  # a Sunday
        handoff = h.ask("contributors", date(2026, 11, 2))
        h.ask("contributors", date(2026, 11, 3))
        posts = h.sent("k8cagrzpitdmjpg5k4bnber45e")
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["props"], {asks.ASK_PROP: "contributors:2026-10"})
        self.assertTrue(posts[0]["message"].startswith("Contributors from the month of October: cc @john.combs\n\n```\n"
                                                       "[abhijit-singh](https://github.com/abhijit-singh), "))
        self.assertEqual((handoff.state, handoff.counts), (asks.DONE, {"contributors": 62}))

    def test_a_long_list_is_split_into_numbered_replies(self):
        messages = asks.contributors_messages("October", "@john.combs", [f"user{n:05d}" for n in range(600)])
        self.assertEqual(messages[0], "Contributors from the month of October: cc @john.combs\n\nThe list is in 2 parts, in the replies.")
        self.assertTrue(messages[1].startswith("Part 1 of 2:\n\n```\n[user00000]"))
        self.assertTrue(all(len(m) <= asks.MAX_POST_CHARS for m in messages))

    def test_a_rate_limit_is_waited_out_and_a_partial_list_never_posted(self):
        h = Harness()
        h.github = self.october_github()
        h.github.rate_limited = 2
        waits = []
        self.assertEqual(len(asks.month_contributors(h.github, "mattermost", 2026, 10, [], sleep=waits.append)), 62)
        self.assertEqual(waits, [60, 60])
        h.github.rate_limited = 10
        handoff = h.ask("contributors", date(2026, 11, 2))
        self.assertEqual(handoff.state, asks.ERROR)
        self.assertEqual(h.hub.created, [])


# ── People, accessibility, renamed owners ───────────────────────────────────────────

class PeopleTest(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(asks.parse_people('{"sre": ["@a", "b"], "ces_github": "x"}'), ({"sre": ["a", "b"], "ces_github": "x"}, ""))
        self.assertEqual(asks.parse_people(""), ({}, ""))
        roles, problem = asks.parse_people('{"sre": [1], "qa": ["q"]}')
        self.assertEqual((roles, problem), ({"qa": ["q"]}, "RELEASE_AGENT_PEOPLE roles sre aren't a username or a list of usernames, so they were ignored."))
        self.assertNotIn("Secret", asks.parse_people('{"Secret": ')[1])

    def test_a_role_not_set_sends_with_no_mention_and_is_flagged(self):
        h = Harness(people={k: v for k, v in PEOPLE.items() if k != "sre"}, tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        self.assertTrue(h.sent("i8rxygnihpbfjnin7s3m4py6te")[0]["message"].startswith("Can you help roll out"))
        self.assertIn("Set RELEASE_AGENT_PEOPLE.sre: asks to that role go out with no mention.", h.flags)

    def test_an_inactive_username_is_named_without_a_mention_and_flagged_in_hub_only(self):
        h = Harness(tags={(12, 2)})
        h.hub.users = [u for u in h.hub.users if u["username"] != "andre.leite"]
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        self.assertTrue(h.sent("i8rxygnihpbfjnin7s3m4py6te")[0]["message"].startswith("@angelos.kyratzakos andre.leite Can you"))
        self.assertEqual(h.private_flags, ["andre.leite in RELEASE_AGENT_PEOPLE.sre isn't an active Hub user, so they're named "
                                           "without a mention."])
        self.assertEqual(h.flags, [])


BARE_URL = re.compile(r"(?<![(<])https?://")
VAGUE_LINK = re.compile(r"\[(?:here|link|this|click here)\]", re.IGNORECASE)


class AccessibilityTest(unittest.TestCase):
    def rendered(self):
        texts = []
        h = Harness(healthcheck=FakeGitHub(), tags={(12, 2)})
        values = {**asks.base_values(h.env(date(2026, 11, 10))), "manager": "@amy.blais", "ces": "@adit.yadav",
                  "issue_title": "t", "issue_body": "b", "new_issue_link": "[Open a new issue](https://x)", "changes": "2 PRs",
                  "since": "v12.1", "versions": "v12.2", "due_date": "November 12th", "links": " - [Server PRs](https://x)",
                  "docs": "@d", "left": "1 server", "rc_name": "v12.2.0-RC1", "rc_link": "[v12.2.0-rc1 build](https://x)",
                  "epic_line": "", "loadtest": "@l", "qa": "@q", "areas": "- **A**", "compared": "Mobile v2.47",
                  "guidelines_link": "[guidelines](https://x)", "sre": "@s", "title": "T", "to": "@t"}
        for name in sorted(p.name for p in asks.TEMPLATES.iterdir()):
            texts.append((name, asks.render(name, values)))
        texts += [("contributors", m) for m in asks.contributors_messages("October", "@john.combs", ["a", "b"])]
        return texts

    def test_every_message_has_descriptive_links_and_no_bare_urls(self):
        for name, text in self.rendered():
            outside_code = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
            self.assertIsNone(BARE_URL.search(outside_code), name)
            self.assertIsNone(VAGUE_LINK.search(text), name)

    def test_handoff_states_are_words_not_only_emoji(self):
        handoffs = [asks.Handoff(RULE["docs-ask"], state, "s") for state in posting.HANDOFF_WORDS]
        for line in posting.handoff_lines(handoffs)[2:]:
            self.assertRegex(line, r"^- [A-Z][a-z]")


class RenamedOwnersTest(unittest.TestCase):
    def test_each_ask_finds_its_item_after_the_owner_in_the_title_changes(self):
        renamed = {
            "ces-support-packet": "Notify CES (Bea) on any changes made to the Support Packet (file 1, file 2) - example issue.",
            "docs-ask": "Ask the Docs team (Rui) to complete release documentation by T-2 deadline for the release milestone.",
            "loadtest-ask": "Ping Ana and Ben to start running loadtests with a link to the Jira ticket (example ticket).",
            "manual-tests": "Check with Ana/Ben that manual tests get done if needed - see guidelines here.",
            "contributors": "On the first day of the month, generate a list of contributors from the previous month. "
                            "Ping Rui Costa to send out contributor mugs based on the list of contributors.",
        }
        for task, title in renamed.items():
            run = checklist_run("r", "v12.2", "c", [(t, "", 0) for t in TEMPLATE_TITLES if t != title_of(task)] + [(title, "", 0)])
            action, _ = playbook.plan_tick(run, RULE[task]["playbook_item"])
            self.assertEqual(action, playbook.TICKED, task)


# ── Through the agent: ticks, the Handoffs section, run.json ────────────────────────

class AgentTest(unittest.TestCase):
    def services(self):
        from release_agent.tests.test_agent import services
        svc = services(jira=FakeJira({"Loadtest 12.2": [{"key": "MM-71198", "fields": {"summary": "📈 Loadtest 12.2, Nov", "status": {"name": "Open"}}}]}))
        svc.hub.users += hub_with_people().users
        svc.hub.users.append({"id": "manager", "username": "amy.blais", "first_name": "Amy", "last_name": "Blais"})
        for r in svc.hub.runs:
            r["owner_user_id"] = "manager"
        svc.github.milestone_list = github().milestone_list
        svc.healthcheck_github = FakeGitHub()
        svc.github.dates[(MM, "v12.1.0")] = "2026-10-16T00:00:00Z"
        return svc

    def run_on(self, svc, today, mode="live"):
        from release_agent.tests.test_agent import settings
        config = settings(mode)
        config.people = PEOPLE
        return agent.run(RULES, config, svc, today)

    def test_asks_go_out_ticked_items_get_a_proof_reply_and_public_output_has_no_details(self):
        from release_agent.tests.test_agent import TODAY
        svc = self.services()
        svc.hub.clock_ms = ms(TODAY)
        body, _ = self.run_on(svc, TODAY)
        v122 = body["releases"][0]
        states = {h["task"]: h["state"] for h in v122["handoffs"]}
        self.assertEqual(states["loadtest-ask"], asks.DONE)  # rc1 is tagged: asked, and that's its item
        post = next(p for p in svc.hub.created if p["channel_id"] == "c122" and not p.get("root_id")
                    and posting.MARKER_PROP in p["props"])
        self.assertIn("**Handoffs**", post["message"])
        self.assertIn("- Done: **Loadtests of RC1**", post["message"])
        self.assertIn(("run122", title_of("loadtest-ask")), svc.hub.closed)
        replies = [p["message"] for p in svc.hub.created if p.get("root_id") == post["id"]]
        self.assertTrue(any(r.startswith(f"Ticked **{RULE['loadtest-ask']['playbook_item']}** in the playbook run: asked")
                            for r in replies))
        public = json.dumps(body) + step_summary(body)
        for private in ("MM-71198", "@alejandro", "loadtesting", "mattermost-healthcheck/issues"):
            self.assertNotIn(private, public)
        self.assertIn("| loadtest-ask | done |", step_summary(body))

    def test_not_needed_is_ticked_with_the_reason(self):
        from release_agent.tests.test_agent import TODAY
        svc = self.services()
        svc.github.branch_commits[(MM, "release-12.2")] = []
        svc.github.branch_commits[(MM, "v12.1.0")] = []
        svc.github.dates[(MM, "v12.1.0")] = "2026-10-16T00:00:00Z"
        body, _ = self.run_on(svc, TODAY)
        states = {h["task"]: (h["state"], h["summary"]) for h in body["releases"][0]["handoffs"]}
        self.assertEqual(states["ces-support-packet"], (asks.NOT_NEEDED, "not needed: no Support Packet changes since v12.1"))
        post = next(p for p in svc.hub.created if p["channel_id"] == "c122" and posting.MARKER_PROP in p["props"])
        replies = [p["message"] for p in svc.hub.created if p.get("root_id") == post["id"]]
        self.assertIn("Ticked **Notify CES…** in the playbook run: not needed: no Support Packet changes since v12.1", replies)

    def test_test_mode_sends_nothing_to_other_teams(self):
        from release_agent.tests.test_agent import TODAY
        svc = self.services()
        self.run_on(svc, TODAY, mode="test")
        self.assertEqual({p["channel_id"] for p in svc.hub.created}, {"test-chan"})
        status = next(p for p in svc.hub.created if not p.get("root_id"))
        self.assertIn("Would send in release:", status["message"])
        self.assertIn("`@alejandro.garcia`", status["message"])  # mentions shown as code
        self.assertEqual(svc.hub.closed, [])

    def test_an_overdue_ask_mentions_the_release_manager_under_needs_attention(self):
        report = posting.ReleaseReport(V122, -3, "live", manager={"username": "amy.blais"})
        handoff = asks.Handoff(RULE["sre-freemium-pro"], asks.WAITING, "SRE hasn't said freemium and professional are done",
                               asked_on=date(2026, 11, 10), escalated=True)
        report.handoffs = [handoff]
        text = posting.format_post(report, date(2026, 11, 11), RULES["calendar"]["milestones"])
        self.assertIn("**Needs attention**\n- Overdue: @amy.blais **Cloud Freemium and Professional rollout** is still open", text)
        self.assertIn("ask:sre-freemium-pro", posting.alarm_ids(report))


if __name__ == "__main__":
    unittest.main()

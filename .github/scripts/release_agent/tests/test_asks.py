"""Asks to other teams (asks.py): each ask sent once on its day, followed up, and its playbook
item ticked when done or not needed; plus the seven asks' own rules."""

import copy
import json
import re
import unittest
from datetime import date, datetime, timezone

from release_agent import agent, asks, checks, playbook, posting, release_calendar, rules
from release_agent.__main__ import step_summary
from release_agent.release_calendar import Release
from release_agent.tests.fakes import FakeCommunity, FakeConfluence, FakeGitHub, FakeHub, FakeJira, checklist_run, fixture

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
        self.community, self.rc_announce_channel, self.rc_announce_author = FakeCommunity(), "", ""
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
                           sleep=lambda seconds: None, community=self.community,
                           rc_announce_channel=self.rc_announce_channel, rc_announce_author=self.rc_announce_author)

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

    def test_docs_reminders_repeat_every_two_working_days_listing_the_prs_left(self):
        h = Harness()
        server = [{"number": 39001, "title": "Add shared drafts", "html_url": "https://github.com/mattermost/mattermost/pull/39001"}]
        h.github.searches = {r"mattermost/mattermost .*Docs/Needed": server,
                             r"mattermost-mobile .*Docs/Needed": [{"number": 9100, "title": "Offline  mode"}]}
        h.ask("docs-ask", date(2026, 10, 23))  # Fri, T-16
        ask = h.sent("c122")[0]
        # Labelled Docs/Needed after the ask went out: the next reminder lists it too.
        server.append({"number": 39050, "title": "Audit exports", "html_url": "https://github.com/mattermost/mattermost/pull/39050"})
        for day in (26, 27, 28, 29):  # Mon to Thu
            h.ask("docs-ask", date(2026, 10, day))
        reminders = h.sent("c122", root=ask["id"])
        self.assertEqual([datetime.fromtimestamp(r["create_at"] / 1000, timezone.utc).day for r in reminders], [27, 29])
        self.assertEqual(reminders[0]["message"], (
            "Reminder: docs for v12.2 / Mobile v2.47 / Desktop v6.4 are due by November 12th. PRs still labelled Docs/Needed:\n"
            "- Server: [mattermost#39001](https://github.com/mattermost/mattermost/pull/39001) Add shared drafts; "
            "[mattermost#39050](https://github.com/mattermost/mattermost/pull/39050) Audit exports\n"
            "- Mobile: [mattermost-mobile#9100](https://github.com/mattermost/mattermost-mobile/pull/9100) Offline mode\n"
            "- Desktop: none\n\n"
            "@eric.sethna @john.combs"))
        server.clear()
        h.github.searches[r"mattermost-mobile .*Docs/Needed"] = []
        self.assertEqual(h.ask("docs-ask", date(2026, 10, 30)).state, asks.DONE)  # none left: no more reminders
        self.assertEqual(len(h.sent("c122", root=ask["id"])), 2)

    def test_overdue_a_working_day_after_the_sre_ask_was_sent(self):
        h = Harness(tags={(12, 2)})
        self.assertFalse(h.ask("sre-freemium-pro", date(2026, 11, 10)).escalated)  # sent today
        self.assertTrue(h.ask("sre-freemium-pro", date(2026, 11, 11)).escalated)  # a working day later

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


LOADTEST_EPIC = {"Loadtest 12.2": [{"key": "MM-71198", "fields": {"summary": "📈 Loadtest 12.2, December (vs 12.1, November)"}},
                                   {"key": "MM-1", "fields": {"summary": "📈 Loadtest 12.20"}}]}
RELEASES_BUILD = "[v12.2.0-rc1 build](https://releases.mattermost.com/12.2.0-rc1/mattermost-12.2.0-rc1-linux-amd64.tar.gz)"


def download_links(version: str, rc: str) -> str:
    """An RC build announcement as the Mattermost Release bot posts it in Release: Self-Hosted & Cloud."""
    return (f"#### Release {version} Download Links\n"
            f"- [Enterprise](https://releases.mattermost.com/{version}-{rc}/mattermost-{version}-{rc}-linux-amd64.tar.gz)\n"
            f"- [Team](https://releases.mattermost.com/{version}-{rc}/mattermost-team-{version}-{rc}-linux-amd64.tar.gz)")


class LoadtestTest(unittest.TestCase):
    def harness(self, author=""):
        h = Harness(jira=FakeJira(copy.deepcopy(LOADTEST_EPIC)))
        h.rc_announce_channel, h.rc_announce_author = "rc-announce", author
        h.github.dates[(MM, "v12.2.0-rc1")] = "2026-10-26T08:00:00Z"  # tagged on T-15, Mon Oct 26
        h.community.users = {"release-bot": {"id": "u-bot", "username": "release-bot", "first_name": "Mattermost Release bot",
                                             "is_bot": True},
                             "someone": {"id": "u-someone", "username": "someone", "first_name": "Some", "last_name": "One"}}
        return h

    def test_waits_for_rc1_and_without_an_announcement_channel_links_the_build(self):
        h = Harness(rc=(), jira=FakeJira(copy.deepcopy(LOADTEST_EPIC)))
        self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 26)).state, asks.NOT_READY)
        h.rc = [1]
        handoff = h.ask("loadtest-ask", date(2026, 10, 27))
        self.assertEqual(handoff.state, asks.DONE)
        self.assertEqual(h.sent("c122")[0]["message"],
                         f"v12.2.0-RC1 is available for loadtesting: {RELEASES_BUILD}. Loadtest epic: "
                         "[MM-71198](https://jira.example/browse/MM-71198). cc @alejandro.garcia @dylan.haussermann")

    def test_links_the_newest_exact_download_links_post_on_community(self):
        h = self.harness()
        tagged = ms(date(2026, 10, 26), 8)
        h.community.add_post("rc-announce", download_links("12.2.0", "rc1"), create_at=tagged - 1)  # before the tag
        h.community.add_post("rc-announce", download_links("12.20.0", "rc1"), create_at=tagged + 1)  # another release
        h.community.add_post("rc-announce", download_links("12.2.0", "rc10"), create_at=tagged + 2)  # another RC
        h.community.add_post("other", download_links("12.2.0", "rc1"), create_at=tagged + 3)  # another channel
        h.community.add_post("rc-announce", "Is 12.2.0-rc1 out yet? Release 12.2.0 Download Links please",
                             create_at=tagged + 4)  # names the RC, but isn't a Download Links post
        h.community.add_post("rc-announce", download_links("12.2.0", "rc1"), create_at=tagged + 5)
        newest = h.community.add_post("rc-announce", download_links("12.2.0", "rc1").replace("Release 12.2.0",
                                      "Release 12.2.0-rc1"), create_at=tagged + 6)
        posts_before = copy.deepcopy(h.community.posts)
        self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 26)).state, asks.DONE)
        self.assertIn(f"[v12.2.0-RC1 build announcement](https://community.example/_redirect/pl/{newest['id']})",
                      h.sent("c122")[0]["message"])
        # Only the announcements channel is read, and nothing is written to Community.
        self.assertEqual({what for what in h.community.reads}, {("posts_since", "rc-announce")})
        self.assertEqual(h.community.posts, posts_before)
        self.assertFalse(any(hasattr(h.community, name) for name in ("create_post", "patch_post", "add_reaction")))

    def test_only_the_release_bots_post_counts_when_the_author_is_set(self):
        for author in ("Mattermost Release bot", "release-bot", "mattermost release BOT"):
            h = self.harness(author=author)
            tagged = ms(date(2026, 10, 26), 8)
            h.community.add_post("rc-announce", download_links("12.2.0", "rc1"), user_id="u-someone", create_at=tagged + 1)
            self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 26)).summary,
                             "waiting for the v12.2.0-RC1 build announcement on Community", author)
            bots = h.community.add_post("rc-announce", download_links("12.2.0", "rc1"), user_id="u-bot", create_at=tagged + 2)
            h.ask("loadtest-ask", date(2026, 10, 26))
            self.assertIn(f"build announcement](https://community.example/_redirect/pl/{bots['id']})",
                          h.sent("c122")[0]["message"], author)
            self.assertTrue(all(method in ("posts_since", "user") for method, _ in h.community.reads))

    def test_without_an_announcement_it_waits_a_working_day_then_links_the_build(self):
        h = self.harness()
        first = h.ask("loadtest-ask", date(2026, 10, 26))  # T-15, the day RC-1 was tagged
        self.assertEqual((first.state, first.summary),
                         (asks.NOT_READY, "waiting for the v12.2.0-RC1 build announcement on Community"))
        self.assertEqual(h.hub.created, [])
        self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 27)).state, asks.DONE)  # a working day later
        self.assertIn(RELEASES_BUILD, h.sent("c122")[0]["message"])

    def test_an_unreadable_announcement_channel_is_flagged_and_falls_back(self):
        h = self.harness()
        h.community.broken = True
        self.assertEqual(h.ask("loadtest-ask", date(2026, 10, 26)).state, asks.NOT_READY)
        self.assertIn("Couldn't read the RC build announcements on Community: check the Community bot is in that channel.",
                      h.flags)


class LoadtestResultsTest(unittest.TestCase):
    def context(self, community=None, perf_channel="perf", rc=(1,), status="Closed"):
        jira = FakeJira({"Loadtest": [
            {"key": "MM-71198", "fields": {"summary": "📈 Loadtest 12.2, December", "status": {"name": status}}}]})
        gh = FakeGitHub()
        gh.dates[(MM, "v12.2.0-rc1")] = "2026-10-26T08:00:00Z"
        return checks.Context(release=V122, today=date(2026, 11, 6), vars=agent.template_vars(V122, RULES["naming"], list(rc)),
                              has_branch=True, rc_numbers=list(rc), github=gh, jira=jira, hub=hub_with_people(),
                              community=community, perf_channel=perf_channel)

    def community(self, *posts):
        community = FakeCommunity()
        for text, day in posts:
            community.add_post("perf", text, create_at=ms(day))
        return community

    def test_passes_on_a_community_post_since_rc1_naming_the_release(self):
        for text in ("Loadtest results for v12.2 vs v12.1", "12.2 comparison", "v12.2.0-rc1: no regressions"):
            community = self.community((text, date(2026, 10, 30)))
            result = checks.loadtest_results(self.context(community), RULE["loadtest-results"])
            self.assertEqual((result.status, result.summary), (checks.PASS, "The loadtest epic is done and its results are posted"), text)
            self.assertEqual(result.proof_url, f"https://community.example/_redirect/pl/{community.posts['perf'][0]['id']}")
            self.assertEqual(result.proof_label, "v12.2 performance comparison on Community")
            self.assertIsNone(result.items[0].public_label)  # the epic key stays out of public output
            self.assertEqual(community.reads, [("posts_since", "perf")])

    def test_no_pass_before_rc1_for_12_20_or_while_the_epic_is_open(self):
        rc1_not_tagged = checks.loadtest_results(self.context(self.community(("v12.2 results", date(2026, 10, 30))), rc=()),
                                                 RULE["loadtest-results"])
        self.assertEqual(rc1_not_tagged.status, checks.FAIL)
        before_rc1 = checks.loadtest_results(self.context(self.community(("v12.2 results", date(2026, 10, 23)))),
                                             RULE["loadtest-results"])
        self.assertEqual(before_rc1.summary, "Loadtests aren't finished: no post since RC-1 names the release in "
                                             "Developers: Performance Comparisons")
        other_release = checks.loadtest_results(self.context(self.community(("v12.20 results", date(2026, 10, 30)))),
                                                RULE["loadtest-results"])
        self.assertEqual(other_release.status, checks.FAIL)
        epic_open = checks.loadtest_results(self.context(self.community(("v12.2 results", date(2026, 10, 30))), status="Open"),
                                            RULE["loadtest-results"])
        self.assertEqual(epic_open.summary, "Loadtests aren't finished: the loadtest epic is Open")

    def test_without_community_access_it_cant_check_never_passes_or_fails(self):
        broken = self.community(("v12.2 results", date(2026, 10, 30)))
        broken.broken = True
        for ctx in (self.context(None), self.context(self.community(), perf_channel=""), self.context(broken)):
            outcome = agent.evaluate(ctx, RULE["loadtest-results"], date(2026, 11, 6), date(2026, 11, 6))
            self.assertEqual((outcome.state, outcome.error), (posting.ERROR, "Community access not set up"))
            report = posting.ReleaseReport(V122, -6, "live", outcomes=[outcome])
            self.assertIn("- :warning: **Loadtest results posted** — couldn't check: Community access not set up",
                          posting.format_post(report, date(2026, 11, 6), RULES["calendar"]["milestones"]))

    def test_the_proof_reply_names_the_community_post(self):
        community = self.community(("v12.2 results", date(2026, 10, 30)))
        result = checks.loadtest_results(self.context(community), RULE["loadtest-results"])
        run = checklist_run("r", "v12.2", "c", [(t, "", 0) for t in TEMPLATE_TITLES])
        tick = playbook.tick_items(None, run, [(RULE["loadtest-results"], result)], live=True, execute=False)[0]
        self.assertEqual(tick.proof_label, "v12.2 performance comparison on Community")


class ManualTestsTest(unittest.TestCase):
    def harness(self, mobile_files=(), desktop_files=()):
        h = Harness()
        h.github.branches = {(MOBILE, "release-2.47"), (MOBILE, "release-2.46"), (DESKTOP, "release-6.4"), (DESKTOP, "release-6.3")}
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

    def test_compares_with_the_newest_earlier_release_branch(self):
        h = self.harness(mobile_files=["share_extension/index.tsx"])
        h.github.milestone_list[MOBILE] = [{"title": "v3.0.0", "due_on": "2026-11-16T00:00:00Z"}]
        h.github.branches = {(MOBILE, "release-3.0"), (MOBILE, "release-2.47"), (DESKTOP, "release-6.4"), (DESKTOP, "release-6.3")}
        h.github.branch_commits.update({(MOBILE, "release-3.0"): [commit("m0", "Change (#9000)", "share_extension/index.tsx")],
                                        (MOBILE, "release-2.47"): []})
        h.github.dates[(MOBILE, "release-2.47")] = "2026-10-10T00:00:00Z"
        self.assertEqual(h.ask("manual-tests", date(2026, 10, 26)).state, asks.WAITING)
        self.assertIn("mattermost-mobile#9000", h.sent("c122")[0]["message"])

    def test_waits_without_an_earlier_release_branch(self):
        h = self.harness(mobile_files=["share_extension/index.tsx"])
        h.github.branches = {(MOBILE, "release-2.47")}
        handoff = h.ask("manual-tests", date(2026, 10, 26))
        self.assertEqual((handoff.state, handoff.summary),
                         (asks.NOT_READY, "no earlier mattermost-mobile release branch to compare with"))

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

    def test_overdue_from_the_working_day_before_the_final_build(self):
        h = self.harness(mobile_files=["share_extension/index.tsx"])
        h.ask("manual-tests", date(2026, 10, 26))
        self.assertFalse(h.ask("manual-tests", date(2026, 11, 5)).escalated)
        self.assertTrue(h.ask("manual-tests", date(2026, 11, 6)).escalated)  # final build Mon Nov 9, so Fri Nov 6
        later = self.harness(mobile_files=["share_extension/index.tsx"])
        later.release = Release(12, 2, {**V122.milestones, "final_build": date(2026, 11, 11)})  # the build moved: so does the date
        later.ask("manual-tests", date(2026, 10, 26))
        self.assertFalse(later.ask("manual-tests", date(2026, 11, 9)).escalated)
        self.assertTrue(later.ask("manual-tests", date(2026, 11, 10)).escalated)

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
        self.assertEqual((enterprise.state, enterprise.summary), (asks.DONE, "Already done, ask not sent: SRE says enterprise is done"))
        self.assertEqual(len(h.sent(self.CHANNEL, root=None)), 1)  # only the first ask

    def test_the_enterprise_ask_replies_in_the_rollout_thread(self):
        h = Harness(tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 11, 10))
        ask = h.sent(self.CHANNEL)[0]
        h.ask("sre-enterprise", date(2026, 11, 11))
        replies = h.sent(self.CHANNEL, root=ask["id"])
        self.assertEqual([r["props"] for r in replies], [{asks.ASK_PROP: "sre-enterprise:v12.2"}])
        self.assertIn("to the Cloud Enterprise ring?", replies[0]["message"])

    def test_the_enterprise_ask_moves_off_a_friday_and_isnt_overdue_the_day_it_goes_out(self):
        # Release Day Wed Dec 16: T-4 is Thu Dec 10; T-3 is Fri Dec 11, so Enterprise is due Mon Dec 14.
        v = Release(12, 2, {"branch_cut": date(2026, 11, 10), "code_freeze": date(2026, 12, 8), "release_day": date(2026, 12, 16)})
        h = Harness(release=v, tags={(12, 2)})
        h.ask("sre-freemium-pro", date(2026, 12, 10))
        friday = h.ask("sre-enterprise", date(2026, 12, 11))
        self.assertEqual((friday.state, friday.due), (asks.NOT_DUE, date(2026, 12, 14)))
        monday = h.ask("sre-enterprise", date(2026, 12, 14))
        self.assertEqual((monday.state, monday.asked_on, monday.escalated), (asks.WAITING, date(2026, 12, 14), False))
        self.assertTrue(h.ask("sre-enterprise", date(2026, 12, 15)).escalated)


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

class CompanionVersionsTest(unittest.TestCase):
    ICS = "\n".join([
        "BEGIN:VCALENDAR",
        *[line for title, day in (("v12.2 & Mobile v2.47 Release Day", "20261116"), ("Desktop v6.4 Release Day", "20261116"),
                                  ("Mobile v2.48 Release Day", "20261216"), ("Desktop v6.3 Feature Complete", "20261102"))
          for line in ("BEGIN:VEVENT", f"SUMMARY:{title}", f"DTSTART;VALUE=DATE:{day}", "END:VEVENT")],
        "END:VCALENDAR"])

    def test_from_the_calendars_mobile_and_desktop_events(self):
        events = release_calendar.parse_ics(self.ICS)
        self.assertEqual(release_calendar.companion_versions(events, V122, "Release Day"), {"mobile": "v2.47", "desktop": "v6.4"})
        self.assertEqual(release_calendar.companion_versions([], V122, "Release Day"), {})

    def test_the_calendar_wins_over_milestones_and_a_difference_is_flagged_in_hub(self):
        h = Harness()
        h.github.milestone_list[MOBILE] = [{"title": "v2.48.0", "due_on": "2026-11-16T00:00:00Z"}]
        env = h.env(date(2026, 10, 23))
        env.calendar_versions = {"mobile": "v2.47"}
        self.assertEqual(asks.same_month_versions(env), {"mobile": "v2.47", "desktop": "v6.4"})  # desktop: from its milestone
        self.assertEqual(env.private_flags, ["The Release Dates calendar says Mobile v2.47 ships with v12.2, but the GitHub "
                                             "milestone due in November is v2.48.0: the asks use v2.47."])
        self.assertEqual(env.flags, [])

    def test_milestones_only_when_the_calendar_names_none(self):
        env = Harness().env(date(2026, 10, 23))
        self.assertEqual(asks.same_month_versions(env), {"mobile": "v2.47", "desktop": "v6.4"})
        self.assertEqual(env.private_flags, [])


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
                  "docs": "@d", "left": "1 server", "left_list": "- Server: [mattermost#1](https://x) A fix", "rc_name": "v12.2.0-RC1", "rc_link": "[v12.2.0-rc1 build](https://x)",
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

    def test_already_done_on_its_day_is_ticked_unsent_with_the_evidence(self):
        from release_agent.tests.test_agent import TODAY
        svc = self.services()
        svc.github.branch_commits[(MM, "release-12.2")] = [commit("a1", "Packet change (#38838)", "server/channels/app/support_packet.go")]
        svc.github.branch_commits[(MM, "v12.1.0")] = []
        issue = "https://github.com/mattermost/mattermost-healthcheck/issues/31"
        svc.healthcheck_github.searches[r"Support Packet changes"] = [{"title": "Mattermost v12.2 Support Packet changes",
                                                                       "html_url": issue}]
        body, _ = self.run_on(svc, TODAY)
        self.assertFalse(any("Support Packet changed" in p["message"] for p in svc.hub.created))  # not sent
        status = next(p for p in svc.hub.created if p["channel_id"] == "c122" and posting.MARKER_PROP in p["props"])
        replies = [p["message"] for p in svc.hub.created if p.get("root_id") == status["id"]]
        self.assertIn("Ticked **Notify CES…** in the playbook run: Already done, ask not sent: the issue is open in "
                      f"mattermost-healthcheck (private repo) · [proof]({issue})", replies)
        self.assertNotIn(issue, json.dumps(body) + step_summary(body))

    def test_loadtest_results_on_community_tick_with_a_named_link_and_stay_out_of_public_output(self):
        from release_agent.tests.test_agent import services, settings
        svc = services(jira=FakeJira({"Loadtest 12.2": [{"key": "MM-71198", "fields": {
            "summary": "📈 Loadtest 12.2, December", "status": {"name": "Closed"}}}]}))
        svc.github.dates[(MM, "v12.1.0")] = "2026-10-16T00:00:00Z"
        perf = svc.community.add_post("perf", "SECRET-PERF: v12.2 vs v12.1, no regressions by @perf.person",
                                      create_at=ms(date(2026, 10, 30)))
        body, details = agent.run(RULES, settings(), svc, date(2026, 11, 5))  # T-6
        status = next(p for p in svc.hub.created if p["channel_id"] == "c122" and posting.MARKER_PROP in p["props"])
        replies = [p["message"] for p in svc.hub.created if p.get("root_id") == status["id"]]
        link = f"[v12.2 performance comparison on Community](https://community.example/_redirect/pl/{perf['id']})"
        self.assertTrue(any(r.startswith("Ticked **Check that the loadtests results were posted…**") and link in r for r in replies))
        public = json.dumps(body) + step_summary(body)
        for private in ("SECRET-PERF", "perf.person", "community.example", "MM-71198"):
            self.assertNotIn(private, public)
        self.assertEqual({c["task"]: c["state"] for c in body["releases"][0]["checks"]}["loadtest-results"], "ok")
        self.assertEqual(svc.community.reads, [("posts_since", "perf")])

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

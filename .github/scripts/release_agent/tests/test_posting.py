import unittest
from datetime import date

from release_agent import posting
from release_agent.checks import FAIL, INFO, PASS, Item, Result
from release_agent.playbook import TICKED, Tick
from release_agent.release_calendar import Release
from release_agent.tests.fakes import FakeHub

NAMES = {"branch_cut": "Release Branch Cut", "code_freeze": "Code Freeze", "final_build": "Final Build",
         "release_day": "Release Day"}


def release():
    return Release(12, 2, {"branch_cut": date(2026, 10, 19), "final_build": date(2026, 11, 9),
                           "release_day": date(2026, 11, 16)})


def report(outcomes=(), flags=(), ticks=(), mode="live"):
    return posting.ReleaseReport(release(), -7, mode, list(outcomes), list(ticks), list(flags))


def outcome(task, state, result=None, kind="notice_txt", item=None, due=None, error=""):
    rule = {"task": task, "type": kind, "playbook_item": item, "title": item}
    return posting.Outcome(rule, state, result, due, error)


class FormatPostTest(unittest.TestCase):
    def test_all_good(self):
        text = posting.format_post(report([
            outcome("notice-txt", posting.OK, Result(PASS, "merged", proof_url="https://p"), item="Update NOTICE.txt"),
        ], ticks=[Tick("notice-txt", "Update NOTICE.txt", TICKED)]), date(2026, 11, 4), NAMES)
        self.assertTrue(text.startswith("#### :large_green_circle: v12.2 release status · T-7 · All good"))
        self.assertIn("Release Day: Mon Nov 16 · Next: Final Build on Mon Nov 9", text)
        self.assertIn("- :white_check_mark: **Update NOTICE.txt** — merged · [proof](https://p) · done in the playbook", text)
        self.assertNotIn("Needs attention", text)

    def test_needs_attention_lists_items_errors_and_flags(self):
        items = [Item("enterprise#7", "Private fix", "https://e/7", "dev", "mattermost/enterprise")]
        text = posting.format_post(report([
            outcome("cherry-picks", posting.NEEDS_ATTENTION, Result(FAIL, "1 of 1 approved cherry-pick", items), "cherry_picks"),
            outcome("e2e", posting.ERROR, kind="e2e_results", error="Mattermost request failed (HTTP 403)"),
            outcome("tags", posting.NOT_DUE, Result(FAIL, "not tagged"), "release_tags", due=date(2026, 11, 9)),
        ], flags=["Calendar and git disagree."]), date(2026, 11, 4), NAMES)
        self.assertIn("· Needs attention", text.splitlines()[0])
        self.assertIn("  - [enterprise#7](https://e/7) Private fix (dev)", text)
        self.assertIn("couldn't check: Mattermost request failed (HTTP 403)", text)
        self.assertIn(":triangular_flag_on_post: Calendar and git disagree.", text)
        self.assertIn("- **Release tags** (due Mon Nov 9) — not tagged", text)

    def test_report_groups_by_owner(self):
        items = [Item("MM-1", "a", owner="Zed"), Item("MM-2", "b"), Item("mattermost#3", "c", owner="alice")]
        text = posting.format_post(report([
            outcome("open", posting.REPORT, Result(INFO, "2 open", items), "other_report"),
        ]), date(2026, 11, 4), NAMES)
        owners = [line for line in text.splitlines() if line.startswith("- **")]
        self.assertEqual(owners, ["- **alice** (1)", "- **Zed** (1)", "- **Unassigned** (1)"])

    def bugs_post(self, items, freeze=date(2026, 12, 7)):
        rel = Release(12, 2, {"code_freeze": freeze, "release_day": date(2027, 1, 16)} if freeze else
                      {"release_day": date(2027, 1, 16)})
        rep = posting.ReleaseReport(rel, -7, "live", [
            outcome("open-release-items", posting.REPORT, Result(INFO, "n open", items, "https://jira"),
                    "open_release_items", item="Open release bugs and PRs")])
        return posting.format_post(rep, date(2026, 11, 4), NAMES).split("**Open release bugs and PRs** — n open · [Jira filter](https://jira)\n", 1)[1]

    def test_open_bugs_mention_each_person_once_most_tickets_first(self):
        def t(key, owner, reason="", links=()):
            return Item(key, "secret summary", f"https://jira/{key}", owner, reason=reason, links=list(links))
        text = self.bugs_post([
            t("MM-1", "@zed"),
            t("MM-2", "@jesse.hallam", "unassigned"), t("MM-3", "@jesse.hallam", "Matty Code"),
            t("MM-4", "", "unassigned"), t("MM-5", "", "Matty Code"),
            t("MM-6", "Ann Lee (no Hub user found)", links=[("pr-mattermost-36558", "https://github.com/m/pull/36558")]),
            t("MM-7", "@zed"), t("MM-8", "@zed"),
            Item("enterprise#20", "PR", "https://github.com/e/pull/20", "dev", "mattermost/enterprise"),
        ])
        self.assertEqual(text.splitlines(), [
            "Kind note that v12.2 Code Freeze deadline for bug fixes is **December 7th** — please action your tickets:",
            "@zed -- [MM-1](https://jira/MM-1), [MM-7](https://jira/MM-7), [MM-8](https://jira/MM-8)",
            "@jesse.hallam -- [MM-2](https://jira/MM-2) (unassigned), [MM-3](https://jira/MM-3) (Matty Code)",
            "Ann Lee (no Hub user found) -- [MM-6](https://jira/MM-6) [pr-mattermost-36558](https://github.com/m/pull/36558)",
            "**Unassigned** -- [MM-4](https://jira/MM-4), [MM-5](https://jira/MM-5) (Matty Code)",
            "Open PRs with the v12.2.0 milestone:",
            "- [enterprise#20](https://github.com/e/pull/20) PR (dev)",
        ])

    def test_open_bugs_when_everything_is_closed(self):
        self.assertEqual(self.bugs_post([]), "✅ All tickets for v12.2 are resolved or closed — nothing to action.")

    def test_ordinal_dates(self):
        self.assertEqual([posting.ordinal(d) for d in (1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 31)],
                         ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "30th", "31st"])
        self.assertIn("is **November 1st** —", self.bugs_post([Item("MM-1", owner="@a")], date(2026, 11, 1)))

    def test_report_says_when_its_item_is_done(self):
        text = posting.format_post(report([
            outcome("open", posting.REPORT, Result(INFO, "2 open", proof_url="https://jira"), "open_release_items", item="Post the list"),
        ], ticks=[Tick("open", "Post the list", TICKED)]), date(2026, 11, 4), NAMES)
        self.assertIn("**Post the list** — 2 open · [Jira filter](https://jira) · done in the playbook", text)

    def test_test_mode_says_so(self):
        self.assertIn("Test mode", posting.format_post(report(mode="test"), date(2026, 11, 4), NAMES))

    def test_test_mode_mentions_notify_nobody(self):
        items = [Item("MM-1", owner="@jesse.hallam", url="https://jira/MM-1"), Item("MM-2", owner="@zed")]
        outcomes = [outcome("open-release-items", posting.REPORT, Result(INFO, "2 open", items), "open_release_items"),
                    outcome("cherry-picks", posting.NEEDS_ATTENTION,
                            Result(FAIL, "1 to label", [Item("mattermost#3", "Fix for @here", owner="@ann")]), "cherry_picks")]
        flags = ["Dev lead `doug.lauder` in rules.yml is deactivated on Hub."]
        test = posting.format_post(report(outcomes, flags, mode="test"), date(2026, 11, 4), NAMES)
        self.assertIn("`@jesse.hallam` -- [MM-1](https://jira/MM-1)", test)
        self.assertIn("`@zed` -- MM-2", test)
        self.assertIn("Fix for `@here` (`@ann`)", test)
        self.assertIn("Dev lead `doug.lauder` in rules.yml", test)
        self.assertEqual(posting.MENTION.findall(test.replace("`@", "`")), [])
        live = posting.format_post(report(outcomes, flags), date(2026, 11, 4), NAMES)
        self.assertIn("@jesse.hallam -- [MM-1](https://jira/MM-1)", live)
        self.assertNotIn("`@", live)

    def test_quiet_mentions(self):
        self.assertEqual(posting.quiet_mentions("@a, (@b.c) **@d** @e."), "`@a`, (`@b.c`) **`@d`** `@e`.")
        self.assertEqual(posting.quiet_mentions("x@y.com [p](https://h/@u) `@code` @"), "x@y.com [p](https://h/@u) `@code` @")


class UpsertPostTest(unittest.TestCase):
    def setUp(self):
        self.hub = FakeHub()
        self.marker = posting.marker(release(), "test")

    def upsert(self, message, props=None):
        existing = posting.find_post(self.hub, "chan", self.marker, 0)
        return posting.upsert_post(self.hub, "chan", self.marker, message, existing, props)

    def test_creates_then_edits_instead_of_posting_twice(self):
        action, post = self.upsert("first")
        self.assertEqual(action, "created")
        self.assertEqual(post["props"], {posting.MARKER_PROP: "release-agent:status:v12.2:test"})
        self.hub.add_post("chan", "chatter in between")

        action, again = self.upsert("second")
        self.assertEqual((action, again["id"], again["message"]), ("updated", post["id"], "second"))
        self.assertEqual(len(self.hub.created), 1)

    def test_unchanged_text_is_not_edited(self):
        self.upsert("same", {posting.SEEN_PROP: {"check:a": 1}})
        action, _ = self.upsert("same", {posting.SEEN_PROP: {"check:a": 1}})
        self.assertEqual(action, "unchanged")
        self.assertEqual(self.hub.patched, [])

    def test_changed_props_are_saved(self):
        self.upsert("same", {posting.SEEN_PROP: {}})
        action, post = self.upsert("same", {posting.SEEN_PROP: {"check:a": 1}})
        self.assertEqual(action, "updated")
        self.assertEqual(post["props"][posting.SEEN_PROP], {"check:a": 1})

    def test_ignores_other_users_and_releases(self):
        self.hub.add_post("chan", "fake", user_id="mallory", props={posting.MARKER_PROP: self.marker})
        self.hub.add_post("chan", "other release", user_id="bot", props={posting.MARKER_PROP: "release-agent:status:v12.3:test"})
        action, _ = self.upsert("mine")
        self.assertEqual(action, "created")

    def test_finds_post_on_a_later_page(self):
        self.upsert("old")
        for n in range(450):
            self.hub.add_post("chan", f"msg {n}", create_at=10**14 + n)
        action, _ = self.upsert("new")
        self.assertEqual(action, "updated")


class FalseAlarmTest(unittest.TestCase):
    EMOJI = "no_entry_sign"

    def setUp(self):
        self.report = report([
            outcome("cherry-picks", posting.NEEDS_ATTENTION, Result(FAIL, "1 missing"), "cherry_picks"),
            outcome("notice-txt", posting.OK, Result(PASS, "merged")),
        ], flags=["Calendar and git disagree."])
        self.alarms = posting.alarm_ids(self.report)

    def reaction(self, at, user="manager", emoji=EMOJI):
        return {"emoji_name": emoji, "user_id": user, "create_at": at}

    def post(self, seen):
        return {"props": {posting.SEEN_PROP: seen}}

    def test_alarm_ids_cover_failing_checks_and_flags(self):
        self.assertEqual(set(self.alarms), {"check:cherry-picks", posting.flag_id("Calendar and git disagree.")})

    def test_first_run_has_no_false_alarms(self):
        dismissed, seen = posting.false_alarms(None, self.alarms, self.EMOJI, "bot", [], 100)
        self.assertEqual(dismissed, set())
        self.assertEqual(seen, {alarm_id: 100 for alarm_id in self.alarms})

    def test_reaction_marks_alarms_raised_before_it(self):
        existing = self.post({alarm_id: 100 for alarm_id in self.alarms})
        dismissed, seen = posting.false_alarms(existing, self.alarms, self.EMOJI, "bot", [self.reaction(150)], 200)
        self.assertEqual(dismissed, set(self.alarms))
        self.assertEqual(seen, {alarm_id: 100 for alarm_id in self.alarms})

    def test_alarms_raised_after_the_reaction_stay(self):
        existing = self.post({"check:cherry-picks": 100})
        dismissed, seen = posting.false_alarms(existing, self.alarms, self.EMOJI, "bot", [self.reaction(150)], 200)
        self.assertEqual(dismissed, {"check:cherry-picks"})
        self.assertEqual(seen[posting.flag_id("Calendar and git disagree.")], 200)

    def test_bot_and_other_emoji_reactions_are_ignored(self):
        existing = self.post({alarm_id: 100 for alarm_id in self.alarms})
        reactions = [self.reaction(150, user="bot"), self.reaction(150, emoji="+1")]
        dismissed, _ = posting.false_alarms(existing, self.alarms, self.EMOJI, "bot", reactions, 200)
        self.assertEqual(dismissed, set())

    def test_resolved_alarm_is_forgotten(self):
        existing = self.post({"check:gone": 100})
        _, seen = posting.false_alarms(existing, self.alarms, self.EMOJI, "bot", [], 200)
        self.assertNotIn("check:gone", seen)

    def test_post_moves_marked_alarms_and_turns_all_good(self):
        hint = "React with :no_entry_sign:"
        self.assertIn(hint, posting.format_post(self.report, date(2026, 11, 4), NAMES))
        self.report.false_alarms = set(self.alarms)
        text = posting.format_post(self.report, date(2026, 11, 4), NAMES)
        self.assertFalse(self.report.needs_attention)
        self.assertIn("· All good", text.splitlines()[0])
        self.assertNotIn("**Needs attention**", text)
        self.assertIn("**Marked as false alarms**\n- ~~Cherry-picks on the release branch~~\n- ~~Calendar and git disagree.~~", text)
        self.assertNotIn(hint, text)

    def test_partly_marked_stays_needs_attention(self):
        self.report.false_alarms = {"check:cherry-picks"}
        text = posting.format_post(self.report, date(2026, 11, 4), NAMES)
        self.assertIn("· Needs attention", text.splitlines()[0])
        self.assertIn(":triangular_flag_on_post: Calendar and git disagree.", text)
        self.assertNotIn(":x: **Cherry-picks", text)


if __name__ == "__main__":
    unittest.main()

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
    rule = {"task": task, "type": kind, "playbook_item": item}
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
            outcome("open", posting.REPORT, Result(INFO, "2 open", items), "open_release_items"),
        ]), date(2026, 11, 4), NAMES)
        owners = [line for line in text.splitlines() if line.startswith("- **")]
        self.assertEqual(owners, ["- **alice** (1)", "- **Zed** (1)", "- **Unassigned** (1)"])

    def test_test_mode_says_so(self):
        self.assertIn("Test mode", posting.format_post(report(mode="test"), date(2026, 11, 4), NAMES))


class UpsertPostTest(unittest.TestCase):
    def setUp(self):
        self.hub = FakeHub()
        self.marker = posting.marker(release(), "test")

    def test_creates_then_edits_instead_of_posting_twice(self):
        action, post = posting.upsert_post(self.hub, "chan", self.marker, "first", 0)
        self.assertEqual(action, "created")
        self.assertEqual(post["props"], {posting.MARKER_PROP: "release-agent:status:v12.2:test"})
        self.hub.add_post("chan", "chatter in between")

        action, again = posting.upsert_post(self.hub, "chan", self.marker, "second", 0)
        self.assertEqual((action, again["id"], again["message"]), ("updated", post["id"], "second"))
        self.assertEqual(len(self.hub.created), 1)

    def test_unchanged_text_is_not_edited(self):
        posting.upsert_post(self.hub, "chan", self.marker, "same", 0)
        action, _ = posting.upsert_post(self.hub, "chan", self.marker, "same", 0)
        self.assertEqual(action, "unchanged")
        self.assertEqual(self.hub.patched, [])

    def test_ignores_other_users_and_releases(self):
        self.hub.add_post("chan", "fake", user_id="mallory", props={posting.MARKER_PROP: self.marker})
        self.hub.add_post("chan", "other release", user_id="bot", props={posting.MARKER_PROP: "release-agent:status:v12.3:test"})
        action, _ = posting.upsert_post(self.hub, "chan", self.marker, "mine", 0)
        self.assertEqual(action, "created")

    def test_finds_post_on_a_later_page(self):
        posting.upsert_post(self.hub, "chan", self.marker, "old", 0)
        for n in range(450):
            self.hub.add_post("chan", f"msg {n}", create_at=10**14 + n)
        action, _ = posting.upsert_post(self.hub, "chan", self.marker, "new", 0)
        self.assertEqual(action, "updated")


if __name__ == "__main__":
    unittest.main()

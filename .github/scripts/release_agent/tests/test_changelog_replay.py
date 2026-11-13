"""Replays of real changelog PRs in test mode (see fixtures/changelog-v12-1-real.json)."""

import json
import unittest
from datetime import date

from release_agent import agent, checks
from release_agent.release_calendar import Release
from release_agent.tests import test_agent
from release_agent.tests.fakes import FakeGitHub, checklist_run, fixture
from release_agent.tests.test_checks import RULES, context
from release_agent.tests.test_changelog_checks import FILE, MIGRATIONS, MM

DATA = json.loads(fixture("changelog-v12-1-real.json"))
# v12.0 shipped and v12.1 has a branch but no final tag yet.
LS_REMOTE = "\n".join(f"0\t{ref}" for ref in ["refs/heads/release-12.0", "refs/heads/release-12.1", "refs/tags/v12.0.0"])
# v12.1's milestones as a calendar (the shared fixture's v12.1 is an older timeline).
EVENTS = [("20261019", "v12.1 Release Branch Cut"), ("20261021", "v12.1 Feature Complete"),
          ("20261028", "v12.1 Code Freeze"), ("20261109", "v12.1 Final Release Build Cut"),
          ("20261116", "v12.1 Release Day")]
CALENDAR = "BEGIN:VCALENDAR\n" + "".join(
    f"BEGIN:VEVENT\nDTSTART;VALUE=DATE:{day}\nDTEND;VALUE=DATE:{day}\nSUMMARY:{name}\nEND:VEVENT\n"
    for day, name in EVENTS) + "END:VCALENDAR\n"
CHANGELOG = ("## Release v12.1 - Feature Release\n\n**Release day: November 16, 2026**\n\n### Upgrade Impact\n\n"
             + DATA["schema_section"] + "\n## Release v12.0 - Major Release\n")


class ReplayTest(unittest.TestCase):
    def run_agent(self, release, pr):
        svc = self.svc = test_agent.services()
        svc.ls_remote = lambda: LS_REMOTE
        svc.fetch_calendar = lambda: CALENDAR
        svc.hub.channels.append({"id": "c121", "display_name": "Release: v12.1"})
        svc.hub.runs.append(checklist_run("run121", "Release: v12.1", "c121", test_agent.template_items()))
        github = svc.github
        github.head_prs.clear()
        github.head_prs[f"mattermost:changelog/{release}.0"] = [pr]
        migrations = DATA["migrations"]
        github.trees[(MM, "v12.0.0", MIGRATIONS)] = {"000100_old.up.sql"}
        github.trees[(MM, "release-12.1", MIGRATIONS)] = {"000100_old.up.sql", *migrations}
        for name, sql in migrations.items():
            github.files[(MM, "release-12.1", f"{MIGRATIONS}/{name}")] = sql
        github.files[(MM, DATA["pr"]["head"]["sha"], FILE)] = CHANGELOG
        svc.fetch_page = lambda url: ""
        body, _ = test_agent.run(svc, mode="test", release=release)
        return body["releases"][0], {c["task"]: c for c in body["releases"][0]["checks"]}

    def test_v12_1_draft_review_and_migrations_would_tick_but_the_open_pr_is_not_merged(self):
        release, checks = self.run_agent("v12.1", DATA["pr"])
        self.assertEqual({t for t in release["would_tick"] if t.startswith("changelog-")},
                         {"changelog-draft", "changelog-migrations", "changelog-review"})
        self.assertEqual(checks["changelog-merged"]["state"], "not_due")  # due on Release Day
        self.assertEqual(checks["changelog-migrations"]["summary"], "The changelog entry covers 5 new migrations")
        self.assertEqual(release["ticked"], [])

    def test_missing_migrations_and_release_day_tbd_go_to_hub_only(self):
        global CHANGELOG
        original = CHANGELOG
        try:
            CHANGELOG = (original.replace("November 16, 2026", "TBD").split("#### Database Schema Changes")[0]
                         + "#### Database Schema Changes\n\n - Added the ``healthfindings`` table.\n\n## Release v12.0 - Major Release\n")
            svc_body = self.run_agent("v12.1", DATA["pr"])
        finally:
            CHANGELOG = original
        release, checks = svc_body
        self.assertIn("not mentioned in the changelog entry", checks["changelog-migrations"]["summary"])
        public = json.dumps(release)
        self.assertNotIn("000242_create_legacy_attribute_view", public)
        self.assertNotIn("TBD", public)
        post = next(p for p in self.svc.hub.created if p["channel_id"] == "test-chan")
        self.assertIn("000242_create_legacy_attribute_view", post["message"])
        self.assertIn("Release day: TBD", post["message"])

    def test_v12_0_was_closed_without_merging_so_none_of_the_four_pass(self):
        github = FakeGitHub()
        github.head_prs["mattermost:changelog/v12.0.0"] = [DATA["closed_v12_0_pr"]]
        rel = Release(12, 0, {"branch_cut": date(2026, 9, 1), "release_day": date(2026, 10, 14)})
        for task in ("changelog-draft", "changelog-migrations", "changelog-review", "changelog-merged"):
            rule = RULES[task]
            ctx = context(github, rel=rel, branches={(11, 11), (12, 0)}, tags={(11, 11)}, today=date(2026, 10, 20))
            github.trees[(MM, "v11.11.0", MIGRATIONS)] = set()
            github.trees[(MM, "release-12.0", MIGRATIONS)] = {"000200_x.up.sql"}
            result = checks.CHECKS[rule["type"]][0](ctx, rule)
            self.assertEqual(result.status, checks.FAIL, task)
            self.assertIn("mattermost#38589", " ".join([result.summary] + [i.label for i in result.items]), task)


if __name__ == "__main__":
    unittest.main()

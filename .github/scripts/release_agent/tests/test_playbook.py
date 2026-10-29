import unittest

from release_agent import playbook
from release_agent.checks import PASS, Result
from release_agent.tests.fakes import FakeHub, checklist_run


def rule(task, item):
    return {"task": task, "playbook_item": item}


class FindRunTest(unittest.TestCase):
    def test_matches_whole_version(self):
        runs = [{"id": "a", "name": "Release v12.20"}, {"id": "b", "name": "Self-Hosted Release v12.2"},
                {"id": "c", "name": "v12.2.1 dot release"}]
        run, problem = playbook.find_run(runs, "v12.2")
        self.assertEqual((run["id"], problem), ("b", None))

    def test_none_or_several_is_reported(self):
        self.assertIn("No in-progress playbook run", playbook.find_run([], "v12.2")[1])
        runs = [{"id": "a", "name": "v12.2 Cloud"}, {"id": "b", "name": "v12.2 Self-Hosted"}]
        run, problem = playbook.find_run(runs, "v12.2")
        self.assertIsNone(run)
        self.assertIn("2 in-progress playbook runs", problem)

    def test_by_channel_takes_any_name(self):
        run, problem = playbook.find_run([{"id": "a", "name": "Anything"}], "Release: v12.2", by_name=False)
        self.assertEqual((run["id"], problem), ("a", None))
        run, problem = playbook.find_run([{"id": "a", "name": "x"}, {"id": "b", "name": "y"}], "Release: v12.2", by_name=False)
        self.assertIsNone(run)
        self.assertEqual(problem, "2 in-progress playbook runs are in the Release: v12.2 channel, so nothing is ticked.")


class PlanTickTest(unittest.TestCase):
    playbook_run = checklist_run("r", "v12.2", "c", [
        ("Update NOTICE.txt on the release branch", "", 0),
        ("Merge the version.go PRs", "closed", 5),
        ("Triage new regressions", "", 7),  # a person ticked, then unticked it
        ("Update Hub to the release branch", "in_progress", 3),
        ("Release tags", "skipped", 4),
        ("Duplicate", "", 0),
        ("Duplicate", "", 0),
    ])

    def test_matches_title_ignoring_case_and_spacing(self):
        self.assertEqual(playbook.plan_tick(self.playbook_run, "  update notice.txt on  the release branch"),
                         (playbook.TICKED, (0, 0)))

    def test_matches_markdown_titles_by_their_text(self):
        run = checklist_run("r", "v12.2", "c", [
            ("Ensure that new [NOTICE.txt](https://github.com/x/NOTICE.txt) for any new libraries are cherry-picked "
             "to the release branch as needed - [example PR](https://github.com/x/pull/1).", "", 0),
            ("Post a list of outstanding release bugs and PRs to the release playbook channel using "
             "`/release-bugs vX.X` in **Claude Cowork**.", "", 0),
        ])
        self.assertEqual(playbook.plan_tick(run, "Ensure that new NOTICE.txt for any new libraries are cherry-picked "
                                                 "to the release branch as needed - example PR."), (playbook.TICKED, (0, 0)))
        self.assertEqual(playbook.plan_tick(run, "Post a list of outstanding release bugs and PRs to the release "
                                                 "playbook channel using /release-bugs vX.X in Claude Cowork."),
                         (playbook.TICKED, (0, 1)))

    def test_falls_back_to_a_former_title_on_older_runs(self):
        run = checklist_run("r", "v12.2", "c", [("Old title.", "", 0)])
        self.assertEqual(playbook.plan_tick(run, "New title.", ["Old title."]), (playbook.TICKED, (0, 0)))
        self.assertEqual(playbook.plan_tick(run, "New title.")[0], playbook.NOT_FOUND)
        newer = checklist_run("r", "v12.2", "c", [("Old title.", "", 0), ("New title.", "", 0)])
        self.assertEqual(playbook.plan_tick(newer, "New title.", ["Old title."]), (playbook.TICKED, (0, 1)))

    def test_never_changes_handled_items(self):
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Merge the version.go PRs")[0], playbook.ALREADY_DONE)
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Triage new regressions")[0], playbook.HANDLED_BY_PERSON)
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Update Hub to the release branch")[0], playbook.HANDLED_BY_PERSON)
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Release tags")[0], playbook.HANDLED_BY_PERSON)

    def test_missing_and_ambiguous(self):
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Nope")[0], playbook.NOT_FOUND)
        self.assertEqual(playbook.plan_tick(self.playbook_run, "Duplicate")[0], playbook.AMBIGUOUS)


class TickItemsTest(unittest.TestCase):
    def setUp(self):
        self.hub = FakeHub()
        self.hub.runs = [checklist_run("r", "v12.2", "c", [("A", "", 0), ("B", "closed", 1)])]
        self.passing = [(rule("a", "A"), Result(PASS, "ok", proof_url="https://proof")),
                        (rule("b", "B"), Result(PASS, "ok"))]

    def test_live_closes_only_open_items(self):
        ticks = playbook.tick_items(self.hub, self.hub.run("r"), self.passing, live=True)
        self.assertEqual([(t.task, t.action) for t in ticks], [("a", playbook.TICKED), ("b", playbook.ALREADY_DONE)])
        self.assertEqual(self.hub.closed, [("r", "A")])
        self.assertEqual(ticks[0].proof_url, "https://proof")

    def test_test_mode_ticks_nothing(self):
        ticks = playbook.tick_items(self.hub, self.hub.run("r"), self.passing, live=False)
        self.assertEqual(ticks[0].action, playbook.WOULD_TICK)
        self.assertEqual(self.hub.closed, [])

    def test_failed_tick_is_reported(self):
        class Broken(FakeHub):
            def close_item(self, *args):
                raise RuntimeError("403")
        hub = Broken()
        hub.runs = self.hub.runs
        ticks = playbook.tick_items(hub, hub.run("r"), self.passing[:1], live=True)
        self.assertEqual(ticks[0].action, playbook.FAILED)


if __name__ == "__main__":
    unittest.main()

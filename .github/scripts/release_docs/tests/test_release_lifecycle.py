"""The release docs PR's Release Lifecycle chart and delayed releases, dated from the milestones."""

import unittest
from datetime import date

from release_docs import __main__ as cli
from release_docs import release_docs_pr
from release_docs.result import TODO_MARKER, Result
from release_docs.versions import Version

from .fakes import FakeGitHub
from .test_tasks import real_docs

ESR = "v10.11,v11.7,v12.4"
V12_1 = Version.parse("v12.1.0")
CHART = """```mermaid
gantt
    dateFormat YYYY-MM-DD
    section Releases
    v11.7 & Desktop App v6.2 Extended Support :crit, :active, 2026-05-15, 2027-05-15
    v11.10                 :active, 2026-08-14, 2026-11-15
    v11.11                 :active, 2026-09-16, 2026-12-15
    v12.0                  :active, 2026-10-16, 2027-01-15
    v12.1                  :active, 2026-11-16, 2027-02-15
    v12.4 & Desktop App v6.5 Extended Support (planned) :crit, 2027-02-16, 2028-02-15
```
"""


NEXT_TWO = {(12, 2): date(2026, 12, 16), (12, 3): date(2027, 1, 15)}


def build(policy=CHART, server=NEXT_TWO, mobile=None, **pages):
    """``server`` and ``mobile``: the due dates of the vX.Y.0 milestones by (major, minor)."""
    files = {**real_docs(), release_docs_pr.RELEASE_POLICY: policy, **pages}
    return release_docs_pr.build(V12_1, files, ESR, date(2026, 11, 16), 15,
                                 {"Server": dict(server), "Mobile": dict(mobile or {}), "Desktop": {}})


def chart_lines(result):
    text = result.files[release_docs_pr.RELEASE_POLICY]
    return [line for line in text.splitlines() if line.startswith("    v")]


class ReleaseLifecycleTest(unittest.TestCase):
    def test_the_next_two_releases_are_added_in_the_hand_made_format(self):
        result = build()
        lines = chart_lines(result)
        # The format #38573 used for v12.1: the name padded to 23, ":active", the Release Day and the support end.
        self.assertIn("    v12.2                  :active, 2026-12-16, 2027-03-15", lines)
        self.assertIn("    v12.3                  :active, 2027-01-15, 2027-04-15", lines)
        self.assertEqual([line.split()[0] for line in lines], ["v11.7", "v11.10", "v11.11", "v12.0", "v12.1", "v12.2", "v12.3", "v12.4"])
        self.assertIn(f"The chart lines follow the format of the last release docs PR made by hand: {release_docs_pr.EXAMPLE_PR}.",
                      result.body)
        self.assertIn("(v12.2, v12.3 added;", result.body)

    def test_an_upcoming_line_already_there_is_filled_not_added_twice(self):
        policy = CHART.replace("    v12.4 & Desktop", "    v12.2                  :active, 2026-12-15, 2027-03-14\n    v12.4 & Desktop")
        lines = chart_lines(build(policy))
        self.assertEqual([line for line in lines if line.split()[0] == "v12.2"],
                         ["    v12.2                  :active, 2026-12-16, 2027-03-15"])  # the milestone's dates
        again = build(policy, )
        self.assertEqual(sum(1 for line in chart_lines(again) if line.split()[0] == "v12.3"), 1)

    def test_a_planned_esr_line_is_left_as_it_is(self):
        result = release_docs_pr.build(Version.parse("v12.2.0"), {**real_docs(), release_docs_pr.RELEASE_POLICY: CHART}, ESR,
                                       date(2026, 12, 16), 15,
                                       {"Server": {(12, 3): date(2027, 1, 15), (12, 4): date(2027, 2, 16)}})
        lines = chart_lines(result)
        self.assertIn("    v12.4 & Desktop App v6.5 Extended Support (planned) :crit, 2027-02-16, 2028-02-15", lines)
        self.assertEqual(sum(1 for line in lines if line.split()[0] == "v12.4"), 1)

    def test_the_releases_own_line_follows_its_milestone_and_keeps_its_label_and_tags(self):
        moved = Result(release_docs_pr.TASK, V12_1.tag)
        text = release_docs_pr.update_esr_chart(CHART, V12_1, ESR, date(2026, 11, 13), moved)
        self.assertIn("    v12.0                  :active, 2026-10-16, 2027-01-15\n"
                      "    v12.1                  :active, 2026-11-13, 2027-02-15\n", text)
        self.assertEqual(text.count("    v12.1 "), 1)
        same = Result(release_docs_pr.TASK, V12_1.tag)
        text = release_docs_pr.update_esr_chart(CHART, V12_1, ESR, date(2026, 11, 16), same)
        self.assertIn("    v12.1                  :active, 2026-11-16, 2027-02-15\n", text)
        self.assertIn("The ESR chart already has v12.1; left as is.", same.notes)

    def test_the_version_out_of_support_is_marked_unsupported(self):
        lines = chart_lines(build())
        self.assertIn("    v11.10                 :done, 2026-08-14, 2026-11-15", lines)  # ended the day before v12.1
        self.assertIn("    v11.11                 :active, 2026-09-16, 2026-12-15", lines)

    def test_a_missing_next_release_is_a_todo_even_when_later_ones_are_dated(self):
        result = build(server={(12, 3): date(2027, 1, 15), (12, 4): date(2027, 2, 16)})
        self.assertIn("no due date on the v12.2.0 milestone in mattermost/mattermost, so the Release Lifecycle chart has no "
                      "line for v12.2", result.todos)
        self.assertIn("    v12.3                  :active, 2027-01-15, 2027-04-15", chart_lines(result))
        self.assertEqual(sum(1 for line in chart_lines(result) if line.split()[0] == "v12.4"), 1)  # only the planned ESR line

    def test_the_next_major_follows_the_last_minor(self):
        found = release_docs_pr.upcoming_releases(Version.parse("v12.9.0"), {
            (13, 0): date(2027, 7, 16), (13, 1): date(2027, 8, 16), (12, 8): date(2027, 5, 14)})
        self.assertEqual([(v.short, str(day)) for v, day in found], [("v13.0", "2027-07-16"), ("v13.1", "2027-08-16")])

    def test_a_release_with_no_release_day_is_a_todo_not_a_guess(self):
        result = build(server={(12, 2): date(2026, 12, 16)})
        self.assertIn("no due date on the v12.3.0 milestone in mattermost/mattermost, so the Release Lifecycle chart has no "
                      "line for v12.3", result.todos)
        self.assertNotIn("v12.3", [line.split()[0] for line in chart_lines(result)])


MOBILE = """## Latest releases

| **Release** | **Support** | **Compatible with** |
|:---|:---|:---|
| v2.45 [FEATURE](./mobile-app-changelog#release-v2-45-1) \\| [Download](https://x) | Released: 2026-10-15<br/>Support Ends: 2026-11-15 | [v12.0](./x) |
| v2.44 [FEATURE](./mobile-app-changelog#release-v2-44-1) \\| [Download](https://x) | Released: 2026-09-16<br/>Support Ends: 2026-10-15 | [v11.11](./x) |
"""


class DelayedReleaseTest(unittest.TestCase):
    def test_a_late_next_release_moves_the_latest_end_date(self):
        result = build(mobile={(2, 46): date(2026, 11, 20)}, **{release_docs_pr.MOBILE_RELEASES: MOBILE})
        page = result.files[release_docs_pr.MOBILE_RELEASES]
        self.assertIn("Released: 2026-10-15<br/>Support Ends: 2026-11-19", page)  # the day before v2.46 ships
        self.assertIn("Released: 2026-09-16<br/>Support Ends: 2026-10-15", page)  # older rows untouched
        self.assertIn("- Mobile v2.45 on mattermost-mobile-releases.mdx: support now ends 2026-11-19 instead of 2026-11-15, "
                      "the day before the next release's Release Day (2026-11-20)", result.body)
        self.assertIn("the next release's milestone is due later than the end date shown", result.body)

    def test_the_next_release_is_chosen_as_on_the_release_lifecycle_chart(self):
        desktop = MOBILE.replace("v2.45", "v5.15").replace("v2.44", "v5.14")

        def v5_15_row(days):
            files = {**real_docs(), release_docs_pr.RELEASE_POLICY: CHART, release_docs_pr.DESKTOP_RELEASES: desktop}
            result = release_docs_pr.build(V12_1, files, ESR, date(2026, 11, 16), 15, {"Server": dict(NEXT_TWO), "Desktop": days})
            page = result.files.get(release_docs_pr.DESKTOP_RELEASES, desktop)
            return next(line for line in page.splitlines() if line.startswith("| v5.15 ")), result

        row, result = v5_15_row({(6, 0): date(2026, 11, 20)})  # no due date on v5.16.0: the next release is v6.0.0
        self.assertIn("Support Ends: 2026-11-19", row)
        self.assertFalse([t for t in result.todos if "v5.16.0" in t])
        row, _ = v5_15_row({(5, 16): date(2026, 11, 16), (6, 0): date(2026, 11, 20)})  # the next minor when it has one
        self.assertIn("Support Ends: 2026-11-15", row)

    def test_on_time_changes_nothing(self):
        result = build(mobile={(2, 46): date(2026, 11, 16)}, **{release_docs_pr.MOBILE_RELEASES: MOBILE})
        self.assertNotIn(release_docs_pr.MOBILE_RELEASES, result.files)
        self.assertNotIn("Delayed releases", result.body)

    def test_no_date_for_the_next_release_is_a_todo(self):
        result = build(**{release_docs_pr.MOBILE_RELEASES: MOBILE})
        self.assertIn("no due date on the v2.46.0 milestone in mattermost/mattermost-mobile (the release after Mobile v2.45), "
                      "so its end date on mattermost-mobile-releases.mdx isn't checked", result.todos)
        self.assertNotIn(release_docs_pr.MOBILE_RELEASES, result.files)


class ReleaseDocsTaskTest(unittest.TestCase):
    """The task end to end: Release Days from the milestones' due dates, never a guess."""

    def run_release_docs(self, milestones, env=None):
        gh = FakeGitHub()
        gh.add_repo(cli.SERVER_REPO, {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"})
        gh.milestone_list[cli.SERVER_REPO] = milestones
        env = {"EVENT_NAME": "workflow_dispatch", "ESR_VERSIONS": ESR, "MODE": "dry_run", "NOW": "2026-10-28", **(env or {})}
        return cli.run_task("release-docs", "v12.1.0", env, gh, None)

    def test_release_day_is_the_milestones_due_date(self):
        run = self.run_release_docs([{"title": "v12.1.0", "due_on": "2026-11-13T08:00:00Z"},
                                     {"title": "v12.2.0", "due_on": "2026-12-16T00:00:00Z"},
                                     {"title": "v12.3.0", "due_on": "2027-01-15T00:00:00Z"}])
        self.assertEqual(run.result.todos, [])
        self.assertIn("| 2026-11-13 | 2027-02-15 |", run.result.files[release_docs_pr.SERVER_RELEASES])
        # The fixture's chart has v12.1 on 2026-11-16; the milestone moved it to 2026-11-13.
        self.assertIn("    v12.1                  :active, 2026-11-13, 2027-02-15",
                      run.result.files[release_docs_pr.RELEASE_POLICY])
        self.assertIn("    v12.2                  :active, 2026-12-16, 2027-03-15",
                      run.result.files[release_docs_pr.RELEASE_POLICY])
        self.assertIn("calculated from the `vX.Y.0` milestones' due dates", run.result.body)

    def test_no_due_date_is_a_todo_marker_never_a_guess(self):
        run = self.run_release_docs([{"title": "v12.1.0", "due_on": None},
                                     {"title": "v12.2.0", "due_on": "2026-12-16T00:00:00Z"},
                                     {"title": "v12.3.0", "due_on": "2027-01-15T00:00:00Z"}])
        self.assertIn("no due date on the v12.1.0 milestone in mattermost/mattermost, so no Release Day", run.result.todos)
        row = next(line for line in run.result.files[release_docs_pr.SERVER_RELEASES].splitlines() if line.startswith("| v12.1 "))
        self.assertIn(TODO_MARKER, row)
        self.assertNotIn("2026-11-1", row)

    def test_accessibility_tickets_are_left_to_the_release_channel(self):
        run = self.run_release_docs([{"title": "v12.1.0", "due_on": "2026-11-13T00:00:00Z"}])
        self.assertIn("- [ ] UI & Accessibility changelog. Accessibility tickets to review: see the release channel.",
                      run.result.body)
        self.assertIn(release_docs_pr.PLACEHOLDER_MARKER, run.result.files[release_docs_pr.UI_ADA_CHANGELOG])

    def test_the_playbook_quote_is_the_new_title(self):
        self.assertIn("Release Lifecycle (add two upcoming versions and mark one version as unsupported)", build().body)


if __name__ == "__main__":
    unittest.main()

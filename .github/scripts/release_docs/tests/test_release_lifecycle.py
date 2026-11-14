"""The release docs PR's Release Lifecycle chart, delayed releases and accessibility tickets."""

import json
import unittest
from datetime import date
from unittest import mock

from release_docs import __main__ as cli
from release_docs import calendar, release_docs_pr
from release_docs.versions import Version

from .fakes import FakeGitHub
from .hub_fakes import FakeHub
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


def events(*pairs):
    return calendar.parse_ics("\n".join(f"BEGIN:VEVENT\nSUMMARY:{title}\nDTSTART;VALUE=DATE:{day}\nEND:VEVENT"
                                        for title, day in pairs))


def build(policy=CHART, cal=(("v12.2 Release Day", "20261216"), ("v12.3 Release Day", "20270115")), **pages):
    files = {**real_docs(), release_docs_pr.RELEASE_POLICY: policy, **pages}
    return release_docs_pr.build(V12_1, files, ESR, date(2026, 11, 16), 15, events(*cal))


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
                         ["    v12.2                  :active, 2026-12-16, 2027-03-15"])  # the calendar's dates
        again = build(policy, )
        self.assertEqual(sum(1 for line in chart_lines(again) if line.split()[0] == "v12.3"), 1)

    def test_a_planned_esr_line_is_left_as_it_is(self):
        result = release_docs_pr.build(Version.parse("v12.2.0"), {**real_docs(), release_docs_pr.RELEASE_POLICY: CHART}, ESR,
                                       date(2026, 12, 16), 15,
                                       events(("v12.3 Release Day", "20270115"), ("v12.4 Release Day", "20270216")))
        lines = chart_lines(result)
        self.assertIn("    v12.4 & Desktop App v6.5 Extended Support (planned) :crit, 2027-02-16, 2028-02-15", lines)
        self.assertEqual(sum(1 for line in lines if line.split()[0] == "v12.4"), 1)

    def test_the_version_out_of_support_is_marked_unsupported(self):
        lines = chart_lines(build())
        self.assertIn("    v11.10                 :done, 2026-08-14, 2026-11-15", lines)  # ended the day before v12.1
        self.assertIn("    v11.11                 :active, 2026-09-16, 2026-12-15", lines)

    def test_a_missing_next_release_is_a_todo_even_when_later_ones_are_dated(self):
        result = build(cal=(("v12.3 Release Day", "20270115"), ("v12.4 Release Day", "20270216")))
        self.assertIn("no Release Day for v12.2 on the Release Dates calendar, so the Release Lifecycle chart has no line "
                      "for it", result.todos)
        self.assertIn("    v12.3                  :active, 2027-01-15, 2027-04-15", chart_lines(result))
        self.assertEqual(sum(1 for line in chart_lines(result) if line.split()[0] == "v12.4"), 1)  # only the planned ESR line

    def test_the_next_major_follows_the_last_minor(self):
        found = release_docs_pr.upcoming_releases(Version.parse("v12.9.0"), events(
            ("v13.0 Release Day", "20270716"), ("v13.1 Release Day", "20270816")))
        self.assertEqual([(v.short, str(day)) for v, day in found], [("v13.0", "2027-07-16"), ("v13.1", "2027-08-16")])

    def test_a_release_with_no_release_day_is_a_todo_not_a_guess(self):
        result = build(cal=(("v12.2 Release Day", "20261216"),))
        self.assertIn("no Release Day for v12.3 on the Release Dates calendar, so the Release Lifecycle chart has no line "
                      "for it", result.todos)
        self.assertNotIn("v12.3", [line.split()[0] for line in chart_lines(result)])


MOBILE = """## Latest releases

| **Release** | **Support** | **Compatible with** |
|:---|:---|:---|
| v2.45 [FEATURE](./mobile-app-changelog#release-v2-45-1) \\| [Download](https://x) | Released: 2026-10-15<br/>Support Ends: 2026-11-15 | [v12.0](./x) |
| v2.44 [FEATURE](./mobile-app-changelog#release-v2-44-1) \\| [Download](https://x) | Released: 2026-09-16<br/>Support Ends: 2026-10-15 | [v11.11](./x) |
"""


class DelayedReleaseTest(unittest.TestCase):
    def test_a_late_next_release_moves_the_latest_end_date(self):
        result = build(cal=(("v12.2 Release Day", "20261216"), ("v12.3 Release Day", "20270115"),
                            ("Mobile v2.46 Release Day", "20261120")),
                       **{release_docs_pr.MOBILE_RELEASES: MOBILE})
        page = result.files[release_docs_pr.MOBILE_RELEASES]
        self.assertIn("Released: 2026-10-15<br/>Support Ends: 2026-11-19", page)  # the day before v2.46 ships
        self.assertIn("Released: 2026-09-16<br/>Support Ends: 2026-10-15", page)  # older rows untouched
        self.assertIn("- Mobile v2.45 on mattermost-mobile-releases.mdx: support now ends 2026-11-19 instead of 2026-11-15, "
                      "the day before the next release's Release Day (2026-11-20)", result.body)

    def test_on_time_changes_nothing(self):
        result = build(cal=(("v12.2 Release Day", "20261216"), ("v12.3 Release Day", "20270115"),
                            ("v12.1 & Mobile v2.46 Release Day", "20261116")),
                       **{release_docs_pr.MOBILE_RELEASES: MOBILE})
        self.assertNotIn(release_docs_pr.MOBILE_RELEASES, result.files)
        self.assertNotIn("Delayed releases", result.body)

    def test_no_date_for_the_next_release_is_a_todo(self):
        result = build(**{release_docs_pr.MOBILE_RELEASES: MOBILE})
        self.assertIn("no Release Day on the Release Dates calendar for the release after Mobile v2.45, so its end date on "
                      "mattermost-mobile-releases.mdx isn't checked", result.todos)
        self.assertNotIn(release_docs_pr.MOBILE_RELEASES, result.files)


class FakeJira:
    def __init__(self, tickets, error=None):
        self.tickets, self.queries, self.error = tickets, [], error

    def search(self, jql, fields):
        self.queries.append(jql)
        if self.error:
            raise self.error
        return self.tickets

    def browse_url(self, key):
        return f"https://jira.example/browse/{key}"

    def filter_url(self, jql):
        return "https://jira.example/issues/?jql=x"


class AccessibilityTest(unittest.TestCase):
    def run_release_docs(self, jira_client, hub):
        gh = FakeGitHub()
        gh.add_repo(cli.SERVER_REPO, {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"})
        ics = ("BEGIN:VEVENT\nSUMMARY:v12.0 Feature Complete\nDTSTART;VALUE=DATE:20260930\nEND:VEVENT\n"
               "BEGIN:VEVENT\nSUMMARY:v12.2 Release Day\nDTSTART;VALUE=DATE:20261216\nEND:VEVENT\n"
               "BEGIN:VEVENT\nSUMMARY:v12.3 Release Day\nDTSTART;VALUE=DATE:20270115\nEND:VEVENT\n")
        env = {"EVENT_NAME": "workflow_dispatch", "ESR_VERSIONS": ESR, "MODE": "dry_run", "RELEASE_DATE": "2026-11-13",
               "CALENDAR_ICS_URL": "https://cal", "REVIEW_CHANNEL_ID": "review", "NOW": "2026-10-28T10:00:00+00:00"}
        with mock.patch.object(cli.jira, "from_env", return_value=jira_client), \
                mock.patch.object(cli.hublib, "from_env", return_value=hub):
            return cli.run_task("release-docs", "v12.1.0", env, gh, gh, None, fetch=lambda url, method="GET": (200, ics))

    def test_tickets_go_to_hub_only_and_the_pr_has_the_count(self):
        jira_client = FakeJira([{"key": "MM-77701", "fields": {"summary": "Fix contrast of the sidebar"}},
                                {"key": "MM-77702", "fields": {"summary": "Label the search button"}}])
        hub = FakeHub()
        run = self.run_release_docs(jira_client, hub)
        self.assertIn("parent = MM-59517", jira_client.queries[0])
        # Since v12.0's FC, and before tomorrow: a date-only bound is midnight, so "<= today" would miss today's updates.
        self.assertIn('updated >= "2026-09-30" AND updated < "2026-10-29"', jira_client.queries[0])
        self.assertIn("- [ ] UI & Accessibility changelog. 2 accessibility tickets to review, listed on Hub.", run.result.body)
        posts = hub.posts_in("review")
        self.assertEqual(len(posts), 1)
        self.assertIn("- [MM-77701](https://jira.example/browse/MM-77701) Fix contrast of the sidebar", posts[0]["message"])
        public = json.dumps({"body": run.result.body, "notes": run.result.notes, "todos": run.result.todos,
                             "outcome": run.outcome, "text": run.result.text, "counts": run.result.counts})
        for private in ("MM-77701", "MM-77702", "Fix contrast", "Label the search button"):
            self.assertNotIn(private, public)
        self.assertNotIn("MM-777", json.dumps(run.result.files))
        self.assertIn(release_docs_pr.PLACEHOLDER_MARKER, run.result.files[release_docs_pr.UI_ADA_CHANGELOG])
        self.run_release_docs(jira_client, hub)  # a rerun lists them once
        self.assertEqual(len(hub.posts_in("review")), 1)

    def test_tickets_found_later_are_added_in_the_thread(self):
        first = {"key": "MM-77701", "fields": {"summary": "Fix contrast of the sidebar"}}
        later = {"key": "MM-77703", "fields": {"summary": "Announce the unread count"}}
        jira_client, hub = FakeJira([first]), FakeHub()
        self.run_release_docs(jira_client, hub)
        jira_client.tickets = [first, later]
        run = self.run_release_docs(jira_client, hub)
        root, = hub.posts_in("review", root="")
        replies = hub.posts_in("review", root=root["id"])
        self.assertEqual(len(replies), 1)
        self.assertIn("1 more accessibility ticket for v12.1", replies[0]["message"])
        self.assertIn("- [MM-77703](https://jira.example/browse/MM-77703) Announce the unread count", replies[0]["message"])
        self.assertNotIn("MM-77701", replies[0]["message"])
        self.assertIn("2 accessibility tickets to review, listed on Hub.", run.result.body)
        self.run_release_docs(jira_client, hub)  # nothing new: nothing posted
        self.assertEqual(len(hub.posts_in("review")), 2)

    def test_a_failed_jira_search_is_a_todo_not_an_unconfigured_jira(self):
        run = self.run_release_docs(FakeJira([], error=RuntimeError("HTTP 500")), FakeHub())
        self.assertIn("the accessibility tickets couldn't be read from Jira (RuntimeError); run the playbook's filter by hand",
                      run.result.todos)
        self.assertIn("Accessibility tickets not checked: the Jira search failed (see the TODO).", run.result.body)
        self.assertNotIn("Jira isn't configured", run.result.body)

    def test_without_jira_the_pr_says_so(self):
        run = self.run_release_docs(None, FakeHub())
        self.assertIn("Accessibility tickets not checked: Jira isn't configured for this run.", run.result.body)

    def test_the_playbook_quote_is_the_new_title(self):
        self.assertIn("Release Lifecycle (add two upcoming versions and mark one version as unsupported)", build().body)


if __name__ == "__main__":
    unittest.main()

"""The Hub and calendar tasks: Announcements approval, key dates, the Marketing hand-off,
ESR comms and the Feature Ready Review. Every one is checked to write nothing in a dry run
and nothing new on a rerun."""

import io
import json
import os
import unittest
from datetime import date, datetime
from unittest import mock

from release_docs import __main__ as cli
from release_docs import announcement, drafts, esr, feature_review, gcal, key_dates, marketing, schedule
from release_docs import hub as hublib
from release_docs.changelog import Highlight
from release_docs.result import TODO_MARKER, Result
from release_docs.versions import Version

from .fakes import FakeClaude, FakeGitHub, fixture
from .hub_fakes import AMY, OWNER, RELEASE_DATES, FakeCalendar, FakeHub, FakeJira, playbook_run
from .test_tasks import real_docs as release_docs_pages

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


def real_docs():
    """The release docs pages and the ESR docs pages, as they are in this checkout."""
    files = release_docs_pages()
    for path in esr.DOCS_FILES:
        with open(os.path.join(ROOT, path), encoding="utf-8") as f:
            files[path] = f.read()
    return files

ESR = "v10.11,v11.7,v12.4"
DESKTOP = json.dumps({"v10.11": "v5.13", "v11.7": "v6.2", "v12.4": "v6.5"})
RELEASE_CHANNEL = {"id": "release", "display_name": "Release: v12.2", "team_id": "team"}
ENV = {"ANNOUNCEMENTS_CHANNEL_ID": "announcements", "MARKETING_CHANNEL_ID": "marketing",
       "MARKETING_EMAIL_OWNER": "caroline.knoche", "MARKETING_SOCIAL_OWNER": "a-rosa.lear",
       "ASANA_FORM_URL": "https://form.asana.com/?k=test", "TEST_CHANNEL_ID": "test"}
V12_2 = Version(12, 2)
RELEASE_DAY = date(2026, 12, 16)


def holidays():
    return schedule.parse_holidays(fixture("holidays-page.html"))


def at(day: str, time: str = "15:00") -> datetime:
    return datetime.fromisoformat(f"{day}T{time}:00+00:00")


# ── Key dates ───────────────────────────────────────────────────────────────────────

class KeyDatesTest(unittest.TestCase):
    def run_task(self, version, month, calendar, hub=None, live=True, pages=None):
        return key_dates.run(version, month, pages or holidays(), calendar, hub, {"REVIEW_CHANNEL_ID": "review"}, live)

    def test_the_calendar_today_matches_v12_3_and_only_v12_2_branch_cut_differs(self):
        calendar, hub = FakeCalendar(RELEASE_DATES), FakeHub([RELEASE_CHANNEL])
        result = self.run_task(Version(12, 1), (2026, 11), calendar, hub)
        self.assertEqual(calendar.writes, [])
        # v12.1's own final build (Nov 6) was before the rule, so its next working day is Nov 9; Nov 10 is left alone.
        self.assertIn("Differs, left as it is: v12.2 & Mobile v2.47 Release Branch Cut is on 2026-11-10, computed 2026-11-09",
                      result.text)
        self.assertNotIn("v12.3 & Mobile v2.48 Release Build Cut is on", result.text)  # matched as the final build
        report = [w for w in hub.writes if w[0] == "post"]
        self.assertEqual(len(report), 1)
        # No playbook run, so no release manager: nobody is mentioned, and the post asks for an owner.
        self.assertNotIn("@", report[0][2])
        self.assertTrue(report[0][2].startswith("These Release Dates calendar events differ"))
        self.assertIn("No release manager is known", report[0][2])
        self.run_task(Version(12, 1), (2026, 11), calendar, hub)
        self.assertEqual(len([w for w in hub.writes if w[0] == "post"]), 1)  # reported once

    def test_creates_the_missing_release_once(self):
        calendar = FakeCalendar(RELEASE_DATES)
        result = self.run_task(V12_2, (2026, 12), calendar)
        created = [(title, day.isoformat()) for _, title, day in calendar.writes]
        self.assertEqual(created, [
            ("v12.4 & Mobile v2.49 Release Branch Cut", "2027-01-11"),
            ("v12.4 & Mobile v2.49 Feature Complete", "2027-01-22"),
            ("v12.4 & Mobile v2.49 RC1 Cut & QA Qualification Starts", "2027-01-25"),
            ("v12.4 & Mobile v2.49 Code Freeze", "2027-02-05"),
            ("v12.4 & Mobile v2.49 Final Release Build Cut", "2027-02-08"),
            ("v12.4 Cloud Freemium & Professional Releases", "2027-02-09"),
            ("v12.4 Cloud Enterprise Release", "2027-02-10"),
            ("v12.4 & Mobile v2.49 Release Day", "2027-02-16"),
        ])
        self.assertEqual(result.todos, [])
        self.assertEqual(calendar.items[-1]["transparency"], "transparent")
        self.run_task(V12_2, (2026, 12), calendar)
        self.assertEqual(len(calendar.writes), 8)  # a rerun creates nothing new

    def test_dry_run_writes_nothing(self):
        calendar, hub = FakeCalendar(RELEASE_DATES), FakeHub([RELEASE_CHANNEL])
        result = self.run_task(V12_2, (2026, 12), calendar, hub, live=False)
        self.assertIn("Would create: 2027-02-16 v12.4 & Mobile v2.49 Release Day", result.text)
        self.assertEqual((calendar.writes, hub.writes), ([], []))

    def test_a_year_missing_from_the_page_writes_nothing_and_is_flagged(self):
        only_2026 = schedule.parse_holidays(fixture("holidays-page.html").split("holidays for 2027")[0])
        calendar = FakeCalendar(RELEASE_DATES)
        result = self.run_task(V12_2, (2026, 12), calendar, pages=only_2026)
        self.assertEqual(calendar.writes, [])
        self.assertTrue(result.failed)
        self.assertIn("2027", result.todos[0])

    def test_titles_use_jira_fix_versions(self):
        calendar = FakeCalendar(RELEASE_DATES)
        versions = schedule.JiraVersions([{"name": "v13.0 (February 2027)"}, {"name": "v3.0 Mobile (February 2027)"}])
        result = key_dates.run(V12_2, (2026, 12), holidays(), calendar, None, {}, True, versions)
        created = [title for _, title, _ in calendar.writes]
        self.assertIn("v13.0 & Mobile v3.0 Release Day", created)
        self.assertIn("Jira's fix version for February 2027 is v13.0, not v12.4 as worked out from the month before; "
                      "Jira's is used.", result.notes)

    def test_ticks_the_playbook_item(self):
        run = playbook_run("release", "Add key dates for the next two releases to the Release Dates calendar.")
        hub = FakeHub([RELEASE_CHANNEL], run)
        self.run_task(V12_2, (2026, 12), FakeCalendar(RELEASE_DATES), hub)
        self.assertIn(("tick", "Add key dates for the next two releases to the Release Dates calendar."), hub.writes)


# ── Announcements ───────────────────────────────────────────────────────────────────

TEXT = "#### Mattermost v12.2 is now available\n\n- Shared Drafts"


class AnnouncementTest(unittest.TestCase):
    def setUp(self):
        self.hub = FakeHub([RELEASE_CHANNEL], playbook_run("release"))
        self.rendered = 0

    def render(self):
        self.rendered += 1
        return TEXT, []

    def run_at(self, now, live=True, dispatched=False):
        return announcement.run(V12_2, RELEASE_DAY, self.render, self.hub, ENV, live, now, holidays(), dispatched)

    def draft(self):
        return next(p for p in self.hub.posts.values() if p["props"].get("release_docs_marker", "").endswith("draft:v12.2"))

    def test_drafted_at_t_minus_1_for_the_run_owner(self):
        self.assertIn("Not due", self.run_at(at("2026-12-14")).text)
        self.run_at(at("2026-12-15"))
        draft = self.draft()
        self.assertEqual(draft["channel_id"], "release")
        self.assertTrue(draft["message"].startswith("@release.manager "))
        self.assertIn("Wed, Dec 16, 2026 at 14:00 UTC in Announcements", draft["message"])
        self.assertTrue(draft["message"].endswith(TEXT))

    def test_no_reaction_means_nothing_is_scheduled_and_the_thread_says_it_waits(self):
        self.run_at(at("2026-12-15"))
        self.run_at(at("2026-12-15", "18:00"))
        self.assertEqual(self.hub.scheduled, [])
        self.run_at(at("2026-12-16", "08:00"))
        self.run_at(at("2026-12-16", "09:00"))
        waiting = [p for p in self.hub.posts.values() if p["root_id"] == self.draft()["id"]]
        self.assertEqual(len(waiting), 1)
        self.assertIn("Still waiting", waiting[0]["message"])
        self.assertEqual(self.hub.scheduled, [])

    def test_only_the_release_managers_reaction_counts(self):
        self.run_at(at("2026-12-15"))
        self.hub.react(self.draft()["id"], AMY)  # not the run's owner
        self.run_at(at("2026-12-15", "16:00"))
        self.assertEqual(self.hub.scheduled, [])

    def test_approved_edited_draft_is_scheduled_once_as_edited(self):
        self.run_at(at("2026-12-15"))
        draft = self.draft()
        edited = draft["message"].replace("- Shared Drafts", "- Shared Drafts, now on mobile")
        self.hub.edit(draft["id"], edited)
        self.hub.react(draft["id"], OWNER)
        self.run_at(at("2026-12-15", "16:00"))
        self.run_at(at("2026-12-15", "17:00"))
        self.assertEqual(len(self.hub.scheduled), 1)
        scheduled = self.hub.scheduled[0]
        self.assertEqual(scheduled["channel_id"], "announcements")
        self.assertEqual(scheduled["message"], TEXT.replace("- Shared Drafts", "- Shared Drafts, now on mobile"))
        self.assertEqual(scheduled["scheduled_at"], int(at("2026-12-16", "14:00").timestamp() * 1000))
        replies = [p for p in self.hub.posts.values() if p["root_id"] == draft["id"]]
        self.assertEqual(len(replies), 1)
        self.assertIn("Scheduled in Announcements for Wed, Dec 16, 2026 at 14:00 UTC", replies[0]["message"])
        self.assertEqual(self.rendered, 1)

    def test_with_no_release_manager_nobody_is_mentioned_and_nobody_can_approve(self):
        self.hub = FakeHub([RELEASE_CHANNEL])  # no playbook run, so no owner
        self.run_at(at("2026-12-15"))
        draft = self.draft()
        self.assertNotIn("@", draft["message"].split("---")[0])
        self.assertIn("No release manager is known", draft["message"])
        self.assertIn("no reaction can approve this draft", draft["message"])
        self.hub.react(draft["id"], AMY)
        self.run_at(at("2026-12-15", "16:00"))
        self.assertEqual(self.hub.scheduled, [])
        self.run_at(at("2026-12-16", "09:00"))
        waiting = [p for p in self.hub.posts.values() if p["root_id"] == draft["id"]]
        self.assertEqual(len(waiting), 1)
        self.assertTrue(waiting[0]["message"].startswith("Still waiting for :white_check_mark:"))
        self.assertIn("No release manager is known", waiting[0]["message"])

    def test_a_dry_run_reports_in_the_test_channel_never_the_release_channel(self):
        env = {k: v for k, v in ENV.items() if k != "TEST_CHANNEL_ID"}
        run = lambda env, live: announcement.run(V12_2, RELEASE_DAY, self.render, self.hub, env, live,  # noqa: E731
                                                 at("2026-12-15"), holidays(), False)
        # No review channel and no test channel: a dry run has nowhere to report, and doesn't use the release channel.
        result = run(env, False)
        self.assertTrue(result.failed)
        self.assertIn("RELEASE_AGENT_TEST_CHANNEL_ID", result.todos[0])
        # An existing draft in the test channel is the one a dry run finds, not one in the release channel.
        self.hub.create_post("release", "x", {hublib.MARKER_PROP: "release-docs:announcement-draft:v12.2"})
        self.assertIn("would have posted the draft", run(ENV, False).text)
        # The review channel, when set, wins; a live run with none keeps the release channel.
        self.assertEqual(hublib.review_channel_id({**ENV, "REVIEW_CHANNEL_ID": "review"}, False), "review")
        self.assertEqual(hublib.review_channel_id(ENV, True, RELEASE_CHANNEL), "release")
        self.assertEqual(hublib.review_channel_id(ENV, False, RELEASE_CHANNEL), "test")
        self.assertEqual(hublib.review_channel_id(env, False, RELEASE_CHANNEL), "")

    def test_dry_run_writes_nothing(self):
        result = self.run_at(at("2026-12-15"), live=False)
        self.assertIn("would have posted the draft", result.text)
        self.assertEqual(self.hub.writes, [])

    def test_a_draft_with_a_todo_is_not_posted(self):
        self.render = lambda: (f"{TODO_MARKER}: no highlights", ["no highlights"])
        result = self.run_at(at("2026-12-15"))
        self.assertTrue(result.failed)
        self.assertEqual(self.hub.writes, [])


# ── Marketing hand-off ──────────────────────────────────────────────────────────────

EMAIL = "Subject: Mattermost v12.2 and recent security updates available\n\n- Shared Drafts.\n"
SOCIAL = "Mattermost v12.2 is out, with Shared Drafts. See what's new: https://docs.mattermost.com/x.html#release-v12-2"


class MarketingTest(unittest.TestCase):
    def run_task(self, hub, email=EMAIL, todos=(), social=SOCIAL, forum="", live=True):
        return marketing.run(V12_2, "December 16, 2026", email, list(todos), social, forum, hub, ENV, live)

    def test_posts_once_with_the_right_mentions(self):
        run = playbook_run("release", "Queue the email for the Marketing team",
                           "Queue the Twitter announcement for the release")
        hub = FakeHub([RELEASE_CHANNEL], run)
        self.run_task(hub, forum="**Forum**\n\nESR text")
        self.run_task(hub)
        marketing_posts = hub.posts_in("marketing", root="")
        self.assertEqual([p["message"].split(" ")[0] for p in marketing_posts], ["@caroline.knoche", "@a-rosa.lear"])
        self.assertEqual(marketing_posts[0]["message"],
                         "@caroline.knoche Release email for Mattermost v12.2, to be sent on December 16, 2026. Email copy below.")
        replies = hub.posts_in("marketing", root=marketing_posts[0]["id"])
        self.assertEqual([r["message"] for r in replies], [EMAIL.strip(), "Forum post draft (to post by hand):\n\n**Forum**\n\nESR text"])
        asana = hub.posts_in("release")
        self.assertEqual(len(asana), 1)
        self.assertTrue(asana[0]["message"].startswith("@release.manager "))
        self.assertIn("[Marketing request form](https://form.asana.com/?k=test)", asana[0]["message"])
        self.assertIn("| Is there a hard deadline? | December 16, 2026 |", asana[0]["message"])
        self.assertIn("A release email copy is ready to be sent out:", asana[0]["message"])
        ticks = [w for w in hub.writes if w[0] == "tick"]
        self.assertEqual(ticks, [("tick", "Queue the Twitter announcement for the release")])  # never the email item

    def test_unset_owners_and_form_url_mention_nobody_and_ask_for_them(self):
        hub = FakeHub([RELEASE_CHANNEL])  # no playbook run either, so no release manager
        result = marketing.run(V12_2, "December 16, 2026", EMAIL, [], SOCIAL, "", hub,
                               {"MARKETING_CHANNEL_ID": "marketing"}, True)
        self.assertFalse(result.failed)
        posts = hub.posts_in("marketing", root="")
        self.assertEqual(len(posts), 2)
        for post in posts:
            self.assertNotIn("@", post["message"])
            self.assertIn("Please set the RELEASE_DOCS_MARKETING_", post["message"])
        self.assertIn("RELEASE_DOCS_MARKETING_EMAIL_OWNER repository variable", posts[0]["message"])
        self.assertIn("RELEASE_DOCS_MARKETING_SOCIAL_OWNER repository variable", posts[1]["message"])
        self.assertTrue(posts[0]["message"].startswith("Release email for Mattermost v12.2"))
        self.assertEqual(sorted(n for n in result.notes if n.startswith("RELEASE_DOCS_")), [
            "RELEASE_DOCS_ASANA_FORM_URL is not set, so the Asana form text has no link to the form.",
            "RELEASE_DOCS_MARKETING_EMAIL_OWNER is not set, so nobody was mentioned in the email post.",
            "RELEASE_DOCS_MARKETING_SOCIAL_OWNER is not set, so nobody was mentioned in the social post."])
        asana = hub.posts_in("release")  # no release channel is posted to: the review channel is the release channel
        for post in hub.posts.values():
            self.assertNotIn("amy.blais", post["message"])
        for post in asana:
            self.assertNotIn("form.asana.com", post["message"])

    def test_an_owner_may_be_written_with_an_at_sign_and_a_form_url_must_be_https(self):
        self.assertEqual(marketing.owner({"X": " @caroline.knoche "}, "X"), "caroline.knoche")
        self.assertEqual(marketing.form_url({"ASANA_FORM_URL": "http://form.asana.com/x"}), "")
        self.assertEqual(marketing.form_url({"ASANA_FORM_URL": " https://form.asana.com/x "}), "https://form.asana.com/x")

    def test_a_todo_or_an_internal_reference_posts_nothing(self):
        for kwargs in ({"todos": ["no Release Day"]}, {"email": EMAIL + "- Fixed MM-12345.\n"},
                       {"social": SOCIAL + " (mattermost/enterprise#77)"}, {"email": f"{TODO_MARKER}: x"}):
            hub = FakeHub([RELEASE_CHANNEL])
            result = self.run_task(hub, **kwargs)
            self.assertTrue(result.failed, kwargs)
            self.assertEqual(hub.writes, [], kwargs)

    def test_dry_run_writes_nothing(self):
        hub = FakeHub([RELEASE_CHANNEL], playbook_run("release", "Queue the Twitter announcement for the release"))
        self.run_task(hub, live=False)
        self.assertEqual(hub.writes, [])

    def test_social_post_from_the_highlights(self):
        text = marketing.social_text(V12_2, [Highlight("Shared Drafts", "", ""), Highlight("Audit Exports", "", "")],
                                     "https://docs/changelog", Result("marketing", "v12.2.0"))
        self.assertEqual(text, "Mattermost v12.2 is out, with Shared Drafts and Audit Exports. See what's new: https://docs/changelog")


# ── ESR comms ───────────────────────────────────────────────────────────────────────

SERVER_RELEASES = """| **Release** | **Released on** | **Support ends** |
|:---|:---|:---|
| v12.4 [Download](x) \\| [Changelog](y) | 2027-02-16 | 2028-02-15 [EXTENDED](./release-policy#release-types) |
| v11.7 [Download](x) \\| [Changelog](y) | 2026-05-15 | 2027-05-15 [EXTENDED](./release-policy#release-types) |
| v10.11 [Download](x) \\| [Changelog](y) | 2025-08-15 | 2026-08-15 [EXTENDED](./release-policy#release-types) |
"""


def esr_list():
    return esr.esrs(ESR, SERVER_RELEASES)


class EsrTest(unittest.TestCase):
    def test_two_dates_per_esr_and_the_next_working_day(self):
        v11_7 = esr_list()[1]
        self.assertEqual(v11_7.dates, {esr.BEFORE: date(2027, 2, 15), esr.ENDED: date(2027, 5, 15)})
        due_on = lambda d: schedule.due_on(d, holidays())  # noqa: E731
        # Feb 15, 2027 is Presidents' Day and Family Day; May 15, 2027 is a Saturday.
        self.assertEqual(esr.due(date(2027, 2, 15), esr_list(), due_on), [])
        self.assertEqual(esr.due(date(2027, 2, 16), esr_list(), due_on), [(v11_7, esr.BEFORE)])
        self.assertEqual(esr.due(date(2027, 5, 17), esr_list(), due_on), [(v11_7, esr.ENDED)])

    def test_section_as_in_august_2026(self):
        v10_11 = esr_list()[0]
        self.assertEqual(esr.for_month((2026, 8), esr_list()), (v10_11, esr.ENDED))
        self.assertEqual(esr.for_month((2026, 5), esr_list()), (v10_11, esr.BEFORE))
        self.assertIsNone(esr.for_month((2026, 9), esr_list()))
        result = Result("drafts", "v11.10.0")
        desktop = esr.desktop_versions(DESKTOP, result)
        blog = esr.section(v10_11, esr.ENDED, desktop, result)
        self.assertEqual(result.todos, [])
        self.assertTrue(blog.startswith("Server v11.7 and Desktop App v6.2 have been implemented as new Extended Support "
                                        "Releases (ESRs) in May 2026. Per [our release and support policy]("))
        self.assertIn("both will be supported until May 15, 2027.\n\nWe have been maintaining server v10.11 and Desktop "
                      "App v5.13 as our previous ESRs. These versions have come to the end of their life cycle. Starting "
                      "August 15, 2026, we are no longer backporting fixes to either release.", blog)
        self.assertEqual(blog.count("\n\n"), 2)
        email = esr.section(v10_11, esr.ENDED, desktop, result, email=True)
        self.assertNotIn("\n", email)
        before = esr.section(v10_11, esr.BEFORE, desktop, result)
        self.assertIn("will come to the end of their life cycle. Starting August 15, 2026, we will no longer backport fixes", before)

    def test_missing_desktop_esr_is_a_todo(self):
        result = Result("drafts", "v12.4.0")
        text = esr.section(esr_list()[1], esr.BEFORE, {"v11.7": "v6.2"}, result)
        self.assertIn(TODO_MARKER, text)
        self.assertEqual(result.todos, ["DESKTOP_ESR_VERSIONS has no desktop ESR for v12.4"])

    def test_docs_paths_mapped_and_edited(self):
        docs = real_docs()
        files = {p: docs[p] for p in esr.DOCS_FILES}
        result = Result(esr.DOCS_TASK, "v11.7.0-before")
        changed = esr.docs_changes(esr_list()[1], esr.BEFORE, files, {}, result)
        self.assertEqual(sorted(changed), sorted(esr.SNIPPETS))
        self.assertIn("Support for Mattermost Server v11.7 [Extended Support Release](/product-overview/release-policy#"
                      "extended-support-releases) will come to the end of its life cycle on May 15, 2027. Upgrading to "
                      "[Mattermost Server v12.4 or later](/product-overview/mattermost-server-releases) is required.",
                      changed["docs/main/product-overview/common-esr-support-rst.mdx"])
        self.assertEqual(result.todos, [])
        ended = Result(esr.DOCS_TASK, "v11.7.0-ended")
        changed = esr.docs_changes(esr_list()[1], esr.ENDED, files, {}, ended)
        policy = changed[esr.RELEASE_POLICY]
        self.assertIn("  - v11.7 & Desktop App v6.2: Support ended May 15, 2027", policy)
        self.assertIn("v11.7 & Desktop App v6.2 Extended Support :crit, :done, 2026-05-15, 2027-05-15", policy)
        self.assertEqual(len(ended.todos), 1)  # the chart, flagged for a person to check
        self.assertIn("has come to the end of its life cycle on May 15, 2027",
                      changed["docs/main/administration-guide/upgrade/prepare-to-upgrade-mattermost.mdx"])

    def test_weekday_run_opens_the_docs_and_mobile_prs_and_the_ticket_once(self):
        gh = esr_github(mobile_side="after")  # mattermost-mobile as #9954 left it: v11.7
        hub, jira = FakeHub([RELEASE_CHANNEL]), FakeJira()
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "REVIEW_CHANNEL_ID": "review"}
        # Three months before v11.7's support ends (Feb 15 is a holiday), twice.
        first = cli.run_esr_comms(cli.SCHEDULED, env, gh, hub, jira, holidays(), date(2027, 2, 16), True, gh)
        self.assertIn("mobile ESR PR: Opened draft PR mattermost/mattermost-mobile#", first.text)
        result = cli.run_esr_comms(cli.SCHEDULED, env, gh, hub, jira, holidays(), date(2027, 2, 16), True, gh)
        self.assertIn("mobile ESR PR: PR #101 is already up to date.", result.text)
        self.assertEqual(len(gh.pulls[cli.SERVER_REPO]), 1)
        self.assertIn("release-agent/v11.7.0-before/esr-docs", gh.repos[cli.SERVER_REPO]["branches"])
        self.assertEqual([p["head"] for p in gh.pulls[esr.MOBILE_REPO]], ["release-agent/v12.4.0-before/mobile-esr"])
        self.assertEqual(gh.pulls[esr.MOBILE_REPO][0]["base"], "main")
        self.assertEqual(jira.writes, [])  # the mobile ESR prompt is a PR now, not a ticket
        result = cli.run_esr_comms(cli.SCHEDULED, env, gh, hub, jira, holidays(), date(2027, 5, 17), True, gh)
        self.assertEqual([w[1] for w in jira.writes], ["Remove feature flags enabled up to v11.7 (v11.7 ESR out of support)"])
        self.assertNotIn("MM-9000", result.text)  # keys go to Hub only
        self.assertIn("MM-9000", hub.posts_in("review")[0]["message"])
        self.assertEqual(len(gh.pulls[esr.MOBILE_REPO]), 1)  # no mobile PR when support ends

    def test_dry_run_writes_nothing(self):
        gh = esr_github()
        hub, jira = FakeHub(), FakeJira()
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "REVIEW_CHANNEL_ID": "review"}
        result = cli.run_esr_comms("v10.11", {**env, "ESR_STAGE": "before"}, gh, hub, jira, holidays(), date(2026, 5, 15),
                                   False, gh)
        self.assertIn("Dry run: would have opened a draft PR from `release-agent/v11.7.0-before/mobile-esr` in "
                      "mattermost/mattermost-mobile", result.text)
        self.assertEqual((gh.writes, hub.writes, jira.writes), ([], [], []))


V10_11 = esr.Esr(Version(10, 11), date(2025, 8, 15), Version(11, 7), date(2026, 5, 15))  # #9954's ESRs


def mobile_files(side: str) -> dict:
    """The four files #9954 changed, before (v10.11) or after (v11.7) it."""
    files = {}
    for path in esr.MOBILE_FILES:
        with open(os.path.join(os.path.dirname(__file__), "fixtures", "mobile-esr-9954", side, path), encoding="utf-8") as f:
            files[path] = f.read()
    return files


def esr_github(mobile_side: str = "before") -> FakeGitHub:
    gh = FakeGitHub()
    docs = real_docs()
    gh.add_repo(cli.SERVER_REPO, {**{p: docs[p] for p in esr.DOCS_FILES},
                                  cli.release_docs_pr.SERVER_RELEASES: SERVER_RELEASES})
    gh.add_repo(esr.MOBILE_REPO, mobile_files(mobile_side), default="main")
    return gh


class MobileEsrPrTest(unittest.TestCase):
    def test_v11_7_edits_match_9954(self):
        # With v9.11 listed, the ESR two before v11.7 is v9.11: '9.11.0', which #9954's file already has.
        result = esr.mobile_result(V10_11, mobile_files("before"), "v9.11," + ESR)
        self.assertEqual(result.files, mobile_files("after"))  # the four files, byte for byte
        self.assertEqual(result.branch, "release-agent/v11.7.0-before/mobile-esr")
        self.assertEqual(result.body, (
            "QA Test Steps:\n"
            "1. Connect to a server with a version lower than ESR (e.g. v11.6). Expected: Prompt to upgrade the server is received.\n"
            "2. Connect to a server with a version equal to ESR (v11.7). Expected: Prompt to upgrade the server is not received.\n"
            "3. Connect to a server with a version greater than ESR (e.g. v11.8). Expected: Prompt to upgrade the server is not "
            "received.\n\n"
            "Merge on August 15, 2026, when v10.11 goes out of support.\n\n"
            "```release-note\nUpdated minimum supported version to v11.7.0.\n```\n"))
        self.assertEqual(result.todos, [])  # no TODO: '9.11.0' is the ESR two before, and it is left as it is
        self.assertIn("MIN_REQUIRED_VERSION is already 9.11.0.", result.notes)
        self.assertIn("export const MIN_REQUIRED_VERSION = '9.11.0';", result.files[esr.MOBILE_CONSTANTS])

    def test_min_required_version_is_the_esr_two_before_the_new_one(self):
        # v12.4.0 (a February ESR, so not only May): the ESRs before it are v9.11, v10.11, v11.7 -> '10.11.0'.
        v12_4 = esr.mobile_result(esr_list()[1], mobile_files("after"), "v9.11," + ESR)
        self.assertEqual(v12_4.todos, [])
        self.assertIn("export const MIN_REQUIRED_VERSION = '10.11.0';", v12_4.files[esr.MOBILE_CONSTANTS])
        self.assertIn("export const FULL_VERSION = '12.4.0';\nexport const MAJOR_VERSION = 12;\n"
                      "export const MIN_VERSION = 4;\nexport const PATCH_VERSION = 0;", v12_4.files[esr.MOBILE_CONSTANTS])
        self.assertEqual(v12_4.branch, "release-agent/v12.4.0-before/mobile-esr")
        # Taken in version order whatever the order of the list, and only ESRs before the new one count.
        self.assertIn("'10.11.0'", esr.mobile_result(esr_list()[1], mobile_files("after"),
                                                    "v12.4, v10.11, v13.1, v9.11, v11.7").files[esr.MOBILE_CONSTANTS])
        # A file with another value gets it set (here from the file before #9954, whose value is '9.11.0').
        other = mobile_files("before")
        other[esr.MOBILE_CONSTANTS] = other[esr.MOBILE_CONSTANTS].replace("'9.11.0'", "'8.1.0'")
        set_ = esr.mobile_result(V10_11, other, "v9.11," + ESR)
        self.assertIn("export const MIN_REQUIRED_VERSION = '9.11.0';", set_.files[esr.MOBILE_CONSTANTS])
        self.assertEqual(set_.todos, [])

    def test_fewer_than_two_esrs_before_the_new_one_is_a_todo(self):
        # #9954 with CHANGELOG_ESR_VERSIONS as it is today: only v10.11 is listed before v11.7.
        result = esr.mobile_result(V10_11, mobile_files("before"), ESR)
        self.assertEqual(len(result.todos), 1)
        self.assertIn("CHANGELOG_ESR_VERSIONS lists 1 ESR(s) before v11.7, but MIN_REQUIRED_VERSION is the ESR two "
                      "before it, so it wasn't set", result.todos[0])
        self.assertEqual(result.files, mobile_files("after"))  # the value is left as it was
        self.assertIn("lists 1 ESR(s) before v11.7", esr.mobile_result(V10_11, mobile_files("before"), "v10.11,v11.7").todos[0])

    def test_a_rerun_updates_the_same_pr(self):
        gh = esr_github()
        env = {"ESR_VERSIONS": "v8.1," + ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "ESR_STAGE": "before"}
        cli.run_esr_comms("v10.11", env, gh, None, FakeJira(), holidays(), date(2026, 5, 15), True, gh)
        branch = "release-agent/v11.7.0-before/mobile-esr"
        # The ESR two before v11.7 is v8.1 in this list, so that is what the first run sets.
        self.assertIn("MIN_REQUIRED_VERSION = '8.1.0'", gh.head_files(esr.MOBILE_REPO, branch)[esr.MOBILE_CONSTANTS])
        # With the list corrected (v9.11), the rerun commits '9.11.0' on the same branch and updates the same PR.
        result = cli.run_esr_comms("v10.11", {**env, "ESR_VERSIONS": "v9.11," + ESR}, gh, None, FakeJira(), holidays(),
                                   date(2026, 5, 15), True, gh)
        self.assertEqual(len(gh.pulls[esr.MOBILE_REPO]), 1)
        self.assertIn("mobile ESR PR: Updated PR mattermost/mattermost-mobile#", result.text)
        self.assertEqual(gh.head_files(esr.MOBILE_REPO, branch), mobile_files("after"))  # '9.11.0', as in #9954
        self.assertEqual(len(gh.repos[esr.MOBILE_REPO]["branches"][branch]), 3)  # base, then two commits on top
        # A person's commit on the branch stops the bot writing there.
        gh.push(esr.MOBILE_REPO, branch, {"README.md": "edited"})
        result = cli.run_esr_comms("v10.11", env, gh, None, FakeJira(), holidays(), date(2026, 5, 15), True, gh)
        self.assertIn("mobile ESR PR: Nothing written:", result.text)

    def test_without_a_mobile_token_the_changes_go_to_hub(self):
        gh, hub = esr_github(), FakeHub([RELEASE_CHANNEL])
        env = {"ESR_VERSIONS": ESR, "DESKTOP_ESR_VERSIONS": DESKTOP, "ESR_STAGE": "before", "REVIEW_CHANNEL_ID": "review"}
        result = cli.run_esr_comms("v10.11", env, gh, hub, FakeJira(), holidays(), date(2026, 5, 15), True, None)
        self.assertEqual(gh.pulls[esr.MOBILE_REPO], [])  # nothing written there
        self.assertFalse([w for w in gh.writes if w[1] == esr.MOBILE_REPO])
        self.assertIn("no changelog write app token for mattermost/mattermost-mobile", " ".join(result.todos))
        message = hub.posts_in("review")[0]["message"]
        self.assertIn("could not be opened in mattermost/mattermost-mobile", message)
        self.assertIn("-export const FULL_VERSION = '10.11.0';\n-export const MAJOR_VERSION = 10;\n"
                      "-export const MIN_VERSION = 11;\n+export const FULL_VERSION = '11.7.0';\n"
                      "+export const MAJOR_VERSION = 11;\n+export const MIN_VERSION = 7;\n", message)  # as in #9954
        self.assertIn("+- **Minimum Server versions:** Current ESR version (11.7.0+)", message)
        self.assertIn("Updated minimum supported version to v11.7.0.", message)
        cli.run_esr_comms("v10.11", env, gh, hub, FakeJira(), holidays(), date(2026, 5, 15), True, None)
        self.assertEqual(len(hub.posts_in("review")), 1)  # posted once


# ── The monthly email ───────────────────────────────────────────────────────────────

class EmailTest(unittest.TestCase):
    def test_shaped_like_august_2026(self):
        result = Result("drafts", "v12.2.0")
        facts = drafts.EmailFacts(
            release_day=RELEASE_DAY, blog_url="https://mattermost.com/blog/v12-2",
            plugins=drafts.plugins_in("- Pre-packaged Calls plugin version [v1.12.2](https://github.com/x/calls/v1.12.2).\n"
                                      "- Pre-packaged Boards plugin version [v9.3.1](https://github.com/x/boards/v9.3.1)."),
            security=[(Version(12, 1, 2), "Medium"), (Version(11, 7, 16), "Low to Medium")],
            patches=[("Mobile v2.47.1", "https://docs/mobile")], esr_email="ESR paragraph.",
            breaking=["Removed X."])
        text = drafts.email_text(V12_2, ESR, "Shared Drafts & More", ["Shared Drafts (MM-1, mattermost/enterprise#2)."],
                                 facts, result)
        self.assertEqual(result.todos, [])
        order = ["Date: December 16, 2026", "Recipients:", "Subject: Mattermost v12.2 and recent security updates available",
                 "**Mattermost v12.2 - Shared Drafts & More**", "pre-packaged Calls plugin [v1.12.2]",
                 "**Mattermost Server - security release updates**", "- 11.7.16 (Extended Support Release): Low to Medium severity",
                 "**Mattermost Mobile and Desktop Apps - patch releases**", "**Extended Support Release Updates**",
                 "**Mattermost v12.2 - Upcoming Breaking Changes**", "Responsible Disclosure policy"]
        positions = [text.index(part) for part in order]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("- Shared Drafts.\n", text)  # sources stripped
        self.assertEqual(drafts.internal_references(text), [])

    def test_unknown_severity_and_internal_names_are_todos(self):
        result = Result("drafts", "v12.2.0")
        facts = drafts.EmailFacts(release_day=RELEASE_DAY, security=[(Version(12, 1, 2), None)])
        drafts.email_text(V12_2, ESR, "", ["The Project Falcon rollout for MM-77 customers."], facts, result)
        self.assertEqual(result.todos, ["no severity for v12.1.2 in its changelog entry",
                                        "the email names 1 internal reference(s) (Jira keys or enterprise PRs); use public names"])


# ── Feature Ready Review ────────────────────────────────────────────────────────────

def series_calendar():
    calendar = FakeCalendar([{"id": "frr", "summary": "Feature Ready Review", "recurrence": ["RRULE:FREQ=MONTHLY"],
                              "start": {"dateTime": "2026-10-30T17:00:00Z"}}])
    calendar.series_instances["frr"] = [
        {"id": "frr_20261030", "start": {"dateTime": "2026-10-30T17:00:00Z"}, "description": "old"},
        {"id": "frr_20261127", "start": {"dateTime": "2026-11-27T17:00:00Z"}, "description": "old"},
        {"id": "frr_20261224", "start": {"dateTime": "2026-12-24T17:00:00Z"}, "description": "old"},
    ]
    return calendar


EPICS = [{"key": "MM-1", "summary": "Shared  Drafts"}, {"key": "MM-2", "summary": "Audit Exports"}]


V12_2_FC = date(2026, 11, 23)


def review(calendar, now, live=True, epics=EPICS):
    """The v12.2 review: Feature Complete Nov 23, Release Day Dec 16."""
    return feature_review.run(V12_2, epics, calendar, at(*now) if isinstance(now, tuple) else at(now), V12_2_FC,
                              RELEASE_DAY, None, live)


class FeatureReviewTest(unittest.TestCase):
    def test_only_the_releases_occurrence_changes(self):
        calendar = series_calendar()
        result = review(calendar, "2026-11-24")
        self.assertEqual(calendar.writes, [("describe", "frr_20261127")])
        description = calendar.series_instances["frr"][1]["description"]
        self.assertTrue(description.startswith(feature_review.INTRO))
        self.assertIn("List of features:\n\n- Shared Drafts (plan TBD, v12.2)\n- Audit Exports (plan TBD, v12.2)\n", description)
        self.assertEqual([i["description"] for i in calendar.series_instances["frr"][::2]], ["old", "old"])
        self.assertNotIn("MM-1", result.text)
        review(calendar, "2026-11-25")
        self.assertEqual(len(calendar.writes), 1)  # unchanged on a rerun

    def test_ticks_the_item_by_the_start_of_its_hub_title(self):
        title = "Schedule a Feature Ready Review meeting with these guidelines."
        self.assertEqual(feature_review.PLAYBOOK_ITEMS, ["Schedule a Feature Ready Review meeting…"])
        hub = FakeHub([RELEASE_CHANNEL], playbook_run("release", "Check the dates", title))
        result = feature_review.run(V12_2, EPICS, series_calendar(), at("2026-11-24"), V12_2_FC, RELEASE_DAY, hub, True)
        self.assertEqual([w for w in hub.writes if w[0] == "tick"], [("tick", title)])
        self.assertFalse(result.failed)
        run = hub.runs_in_channel("release")[0]
        self.assertEqual([i["state"] for i in run["checklists"][0]["items"]], ["", "closed"])  # only that item
        # A rerun finds it closed and ticks nothing more.
        feature_review.run(V12_2, EPICS, series_calendar(), at("2026-11-25"), V12_2_FC, RELEASE_DAY, hub, True)
        self.assertEqual(len([w for w in hub.writes if w[0] == "tick"]), 1)

    def test_after_the_releases_occurrence_the_next_one_is_left_alone(self):
        calendar = series_calendar()
        result = review(calendar, "2026-12-01")  # after Nov 27; Dec 24 is after v12.2's Release Day
        self.assertEqual(calendar.writes, [])
        self.assertEqual([i["description"] for i in calendar.series_instances["frr"]], ["old", "old", "old"])
        self.assertEqual(result.text, "The occurrence on 2026-11-27 has started, so its description is no longer changed.")
        self.assertFalse(result.failed)

    def test_stops_once_the_occurrence_has_started(self):
        calendar = series_calendar()
        self.assertIn("has started", review(calendar, ("2026-11-27", "17:30")).text)
        self.assertEqual(calendar.writes, [])
        review(calendar, ("2026-11-27", "16:30"))  # half an hour before: still updated
        self.assertEqual(calendar.writes, [("describe", "frr_20261127")])

    def test_no_occurrence_between_feature_complete_and_release_day_is_flagged(self):
        calendar = series_calendar()
        calendar.series_instances["frr"].pop(1)  # only Oct 30 and Dec 24 are left
        result = review(calendar, "2026-11-24")
        self.assertTrue(result.failed)
        self.assertIn("no occurrence between Feature Complete (2026-11-23) and Release Day (2026-12-16)", result.todos[0])
        self.assertEqual(calendar.writes, [])

    def test_no_recurring_event_is_flagged_and_nothing_is_created(self):
        calendar = FakeCalendar([{"id": "x", "summary": "v12.1 Feature Ready Review", "start": {"dateTime": "2026-10-30T17:00:00Z"}}])
        result = review(calendar, "2026-11-24")
        self.assertTrue(result.failed)
        self.assertEqual(calendar.writes, [])

    def test_dry_run_writes_nothing(self):
        calendar = series_calendar()
        review(calendar, "2026-11-24", live=False)
        self.assertEqual(calendar.writes, [])


class GoogleCalendarClientTest(unittest.TestCase):
    def test_writes_tell_nobody(self):
        requests = []

        def opener(request, timeout):
            requests.append(request)
            return io.BytesIO(b"{}")

        client = gcal.GoogleCalendar("cal@group.calendar.google.com", "token", opener)
        client.set_description("frr_20261127", "text")
        client.create_all_day("v12.4 Release Day", date(2027, 2, 16))
        self.assertEqual([r.get_method() for r in requests], ["PATCH", "POST"])
        self.assertTrue(all(r.full_url.endswith("sendUpdates=none") for r in requests))
        self.assertEqual(json.loads(requests[0].data), {"description": "text"})
        created = json.loads(requests[1].data)
        self.assertEqual(created["end"], {"date": "2027-02-17"})
        self.assertNotIn("attendees", created)
        self.assertEqual(created["reminders"], {"useDefault": False, "overrides": []})


CHANGELOG_V12 = """## Release v12.2 - [Feature Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types)

### Improvements

#### User Interface (UI)
 - Added [Shared Drafts](https://docs.mattermost.com/shared-drafts).
 - Pre-packaged Calls plugin version [v1.12.2](https://github.com/mattermost/mattermost-plugin-calls/releases/tag/v1.12.2).

## Release v12.1 - [Feature Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types)

### Mattermost v12.1.2 - [Feature Release](x)
 - Mattermost v12.1.2 contains Medium severity level security fixes.
"""
CLAUDE_ANSWER = {
    "highlights": [{"name": "Shared Drafts", "source": 0, "url": "https://docs.mattermost.com/shared-drafts"}],
    "blog_outline": [{"heading": "Drafts", "points": [{"text": "Write together.", "sources": ["MM-1"]}]}],
    "email": {"subject": "Shared Drafts & More", "points": [{"text": "Write messages together.", "sources": ["MM-1"]}]},
}


class MarketingEndToEndTest(unittest.TestCase):
    """Release Day of v12.2, through the CLI: the drafts task's email reaches Marketing without sources."""

    def test_release_day(self):
        gh = FakeGitHub()
        gh.add_repo(cli.SERVER_REPO, {"docs/main/product-overview/mattermost-v12-changelog.mdx": CHANGELOG_V12,
                                      cli.release_docs_pr.SERVER_RELEASES: SERVER_RELEASES})
        gh.release_list[cli.SERVER_REPO] = [{"tag_name": "v12.1.2", "published_at": "2026-12-01T10:00:00Z"},
                                            {"tag_name": "v12.1.1", "published_at": "2026-11-10T10:00:00Z"}]
        gh.release_list["mattermost/desktop"] = [{"tag_name": "v6.4.1", "published_at": "2026-12-03T10:00:00Z"}]
        hub = FakeHub([RELEASE_CHANNEL], playbook_run("release", "Queue the Twitter announcement for the release"))
        env = {**ENV, "EVENT_NAME": "workflow_dispatch", "MODE": "live", "ESR_VERSIONS": ESR, "RELEASE_DATE": "2026-12-16",
               "JIRA_FIX_VERSION": "v12.2 (December 2026)", "NOW": "2026-12-16T09:00:00+00:00"}
        epics = [{"key": "MM-1", "summary": "Shared Drafts", "url": "https://jira/MM-1"}]
        with mock.patch.object(cli.hublib, "from_env", return_value=hub), \
                mock.patch.object(cli.jira, "epics", return_value=epics):
            env_with_jira = {**env, "JIRA_EMAIL": "bot@example.com", "JIRA_TOKEN": "t"}
            run = cli.run_task("marketing", "v12.2.0", env_with_jira, gh, gh, FakeClaude(CLAUDE_ANSWER))
            cli.run_task("marketing", "v12.2.0", env_with_jira, gh, gh, FakeClaude(CLAUDE_ANSWER))
        self.assertEqual(run.result.todos, [])
        email_post = hub.posts_in("marketing", root="")[0]
        email = hub.posts_in("marketing", root=email_post["id"])[0]["message"]
        self.assertIn("- Write messages together.\n", email)
        self.assertIn("- 12.1.2: Medium severity.", email)
        self.assertNotIn("12.1.1", email)  # before the last email
        self.assertIn("- Desktop App v6.4.1: see the [changelog]", email)
        self.assertIn("pre-packaged Calls plugin [v1.12.2]", email)
        self.assertNotIn("MM-1", email)
        self.assertEqual(len(hub.posts_in("marketing", root="")), 2)  # email and social, once each
        self.assertNotIn("MM-1", run.result.text + "".join(run.result.notes))


class ServiceAccountTest(unittest.TestCase):
    def test_assertion_is_signed_with_the_key(self):
        import base64

        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, rsa

        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption()).decode()
        token = gcal.service_account_assertion({"client_email": "sa@project.iam.gserviceaccount.com", "private_key": pem}, 1000)
        header, claims, signature = token.split(".")
        unpad = lambda part: base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))  # noqa: E731
        private.public_key().verify(unpad(signature), f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())
        self.assertEqual(json.loads(unpad(claims)), {"iss": "sa@project.iam.gserviceaccount.com", "scope": gcal.SCOPE,
                                                     "aud": gcal.TOKEN_URL, "iat": 1000, "exp": 4600})


class ResolveTest(unittest.TestCase):
    def test_hub_tasks_run_on_weekdays_and_by_hand(self):
        for task in cli.HUB_TASKS:
            self.assertEqual(cli.resolve(task, {"EVENT_NAME": "schedule"}, {})["version"], cli.SCHEDULED)
            self.assertEqual(cli.resolve(task, {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": ""}, {})["version"],
                             cli.SCHEDULED)
        self.assertEqual(cli.resolve("key-dates", {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": "v12.2"}, {})["version"],
                         "v12.2.0")

    def test_due_release_from_the_calendar(self):
        events = cli.calendar.parse_ics(fixture("release-dates.ics"))
        milestones = cli.calendar.milestones(events)
        line, found = next((line, found) for line, found in sorted(milestones.items()) if "release_day" in found)
        day = found["release_day"].start
        self.assertEqual(cli.due_release("key-dates", events, day, holidays()), (Version(*line), day))
        self.assertEqual(cli.due_release("marketing", events, day, holidays())[0], Version(*line))


if __name__ == "__main__":
    unittest.main()

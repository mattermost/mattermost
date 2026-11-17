"""The release actions (release_agent/actions), against fakes of Hub, GitHub, delivery-platform,
Jira and Google Sheets. The calendar is fixtures/release-dates.ics: v12.3's branch is cut on
Monday, November 2 2026, Feature Complete is November 13 and Release Day December 14."""

import json
import re
import unittest
from datetime import datetime, timezone
from pathlib import Path

from release_agent import rules as rules_module
from release_agent.actions import engine, qa_sheet, rc, runner, text, tickets, versions
from release_agent.actions.people import People
from release_agent.tests.fakes import (FakeDispatcher, FakeGitHub, FakeHub, FakeJira, FakeJiraWriter, FakeMilestoneWriter,
                                       FakeSheets, checklist_run, fixture)

MM, ENT, DP = "mattermost/mattermost", "mattermost/enterprise", "mattermost/delivery-platform"
ALL_LIVE = "qa_sheet,tickets,metrics,versions,rc,branch_cut"
PEOPLE = {"release_manager": ["amy.blais"], "release_backup": ["eva.sarafianou", "nuno.simoes"], "qa": ["yasser.khan"]}
VERSION_GO = 'var versions = []string{\n\t"12.3.0",\n\t"12.2.0",\n}'
RULES = rules_module.load_rules()


def at(month, day, hour=9, minute=0, year=2026):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def ms(moment):
    return int(moment.timestamp() * 1000)


class World:
    """Everything the actions read and write, for v12.3 unless a test says otherwise."""

    def __init__(self, mode="live", live=ALL_LIVE, release="v12.3", people=None, release_channel=True):
        self.mode, self.live, self.release = mode, live, release
        self.people = PEOPLE if people is None else people
        self.refs = ["refs/heads/release-12.1", "refs/heads/release-12.2", "refs/tags/v12.1.0",
                     "refs/tags/v12.2.0-rc1", "refs/tags/v12.2.0"]
        self.github = FakeGitHub()
        self.github.branches = {MM: {"release-12.1", "release-12.2"}, ENT: {"release-12.1", "release-12.2"}}
        self.github.releases_by_tag, self.github.compares = {}, {}
        self.github.milestone_titles = {MM: ["v12.2.0", "v12.3.0"], ENT: ["v12.2.0", "v12.3.0"]}
        self.github.files[(MM, "master", "server/public/model/version.go")] = VERSION_GO
        self.jira = FakeJira()
        self.jira.project_versions = [
            {"id": "1", "name": "v12.2 (November 2026)", "released": False, "releaseDate": "2026-11-16"},
            {"id": "2", "name": "v12.3 (December 2026)", "released": False, "releaseDate": "2026-12-14"},
            {"id": "3", "name": "v12.4 (January 2027)", "released": False, "releaseDate": "2027-01-15"},
        ]
        self.hub = FakeHub()
        self.hub.users = [
            {"id": "u-rm", "username": "amy.blais", "first_name": "", "last_name": ""},
            {"id": "u-eva", "username": "eva.sarafianou", "first_name": "", "last_name": ""},
            {"id": "u-nuno", "username": "nuno.simoes", "first_name": "", "last_name": ""},
            {"id": "u-dev", "username": "some.dev", "first_name": "", "last_name": ""},
            {"id": "u-qa", "username": "yasser.khan", "first_name": "", "last_name": ""},
        ]
        if release_channel:
            self.hub.channels = [{"id": "c123", "display_name": "Release: v12.3"}, {"id": "c122", "display_name": "Release: v12.2"}]
            for run_id, name, channel in (("run123", "Release: v12.3", "c123"), ("run122", "Release: v12.2", "c122")):
                run = checklist_run(run_id, name, channel, [])
                run["owner_user_id"] = "u-rm"
                self.hub.runs.append(run)
        self.dispatcher = FakeDispatcher()
        self.jira_writer = FakeJiraWriter(self.jira)
        self.milestones = FakeMilestoneWriter(self.github)
        self.sheets = FakeSheets([])
        self.extra_events = ""  # more VEVENTs for the calendar

    def calendar(self):
        source = fixture("release-dates.ics")
        return source.replace("END:VCALENDAR", self.extra_events + "END:VCALENDAR") if self.extra_events else source

    def add_branch(self, major, minor, repos=(MM, ENT)):
        if MM in repos:
            self.refs.append(f"refs/heads/release-{major}.{minor}")
        for repo in repos:
            self.github.branches.setdefault(repo, set()).add(f"release-{major}.{minor}")

    def add_tag(self, tag):
        self.refs.append(f"refs/tags/{tag}")
        for repo in (MM, ENT):
            self.github.tags.setdefault(repo, []).append(tag)

    def services(self):
        return runner.Services(hub=self.hub, playbooks=self.hub, github=self.github, jira=self.jira,
                               fetch_calendar=self.calendar,
                               ls_remote=lambda: "\n".join(f"0\t{ref}" for ref in self.refs),
                               dispatcher=self.dispatcher, milestones=self.milestones, jira_writer=self.jira_writer,
                               sheets=self.sheets)

    def settings(self, trigger="schedule"):
        return engine.Settings(mode=self.mode, live_actions=engine.parse_live(self.live), trigger=trigger,
                               release_override=self.release, test_channel="test", log_channel="log",
                               people=People.parse(json.dumps(self.people)), qa_sheet_id="qa-sheet",
                               scorecard_sheet_id="scorecard")

    def run(self, now, only, trigger="schedule", rules=None):
        rules = rules or RULES
        rules = {**rules, "actions": [a for a in rules["actions"] if a["action"] == only]}
        self.hub.clock = lambda: ms(now)
        self.body, self.details, self.audit = runner.run(rules, self.settings(trigger), self.services(), now)
        return self.body["releases"][0]["actions"][0]

    def status(self, now, only):
        """The daily status post's read-only view."""
        rules = {**RULES, "actions": [a for a in RULES["actions"] if a["action"] == only]}
        events = __import__("release_agent.release_calendar", fromlist=["x"])
        cal = events.parse_ics(self.calendar())
        releases, _ = events.releases_from_events(cal, RULES["calendar"]["milestones"])
        release = releases[(12, 3)]
        from release_agent import agent
        import changelog_release
        branches, tags, _ = changelog_release.parse_ls_remote("\n".join(f"0\t{r}" for r in self.refs))
        rcs = events.rc_numbers("\n".join(f"0\t{r}" for r in self.refs), 12, 3)
        variables = agent.template_vars(release, RULES["naming"], rcs)
        return runner.release_status(release, rules, self.settings(), self.services(), now, frozenset(), cal, releases,
                                     branches, tags, rcs, "c123", self.hub.runs[0] if self.hub.runs else None, variables)[0][1]

    def posts(self, channel):
        return [p for p in self.hub.posts.get(channel, []) if not p.get("root_id")]

    def replies(self, post):
        return [p["message"] for p in self.hub.replies(post["id"])]


# ── Engine ──────────────────────────────────────────────────────────────────────────

class WorkingMinutesTest(unittest.TestCase):
    def test_should_put_the_run_on_the_hour_after_the_window(self):
        self.assertEqual(engine.add_working_minutes(at(11, 3, 9, 30), 60, frozenset()), at(11, 3, 11))

    def test_should_round_up_so_the_window_is_never_shorter(self):
        self.assertEqual(engine.add_working_minutes(at(11, 3, 9, 4), 60, frozenset()), at(11, 3, 11))
        self.assertEqual(engine.add_working_minutes(at(11, 3, 9), 60, frozenset()), at(11, 3, 10))

    def test_should_carry_the_window_over_a_weekend_and_a_holiday(self):
        holiday = frozenset({at(11, 9).date()})
        self.assertEqual(engine.add_working_minutes(at(11, 6, 17, 30), 60, holiday), at(11, 10, 9))

    def test_should_start_a_notice_sent_before_working_hours_at_eight(self):
        self.assertEqual(engine.add_working_minutes(at(11, 3, 6), 60, frozenset()), at(11, 3, 9))


class ServicesTest(unittest.TestCase):
    ENV = {"MM_URL": "https://hub.example", "MM_TOKEN": "t", "CALENDAR_ICS_URL": "https://cal", "GH_TOKEN": "g",
           "JIRA_EMAIL": "e", "JIRA_TOKEN": "j", "DISPATCH_TOKEN": "d", "MILESTONES_TOKEN": "m",
           "JIRA_WRITE_EMAIL": "w", "JIRA_WRITE_TOKEN": "wt"}

    def services(self, **env):
        from release_agent import __main__ as main
        full = {**self.ENV, **env}
        return main.action_services_from_env(engine.settings_from_env(full), full)

    def test_should_build_no_write_client_in_a_dry_run(self):
        for env in ({"RELEASE_ACTIONS_MODE": "dry_run", "GITHUB_EVENT_NAME": "schedule", "RELEASE_ACTIONS_LIVE": ALL_LIVE},
                    {"RELEASE_ACTIONS_MODE": "live", "GITHUB_EVENT_NAME": "workflow_dispatch", "RELEASE_ACTIONS_LIVE": ALL_LIVE},
                    {"RELEASE_ACTIONS_MODE": "live", "GITHUB_EVENT_NAME": "schedule"}):
            found = self.services(**env)
            self.assertEqual((found.dispatcher, found.milestones, found.jira_writer), (None, None, None), env)

    def test_should_build_the_write_clients_live_on_the_schedule(self):
        found = self.services(RELEASE_ACTIONS_MODE="live", GITHUB_EVENT_NAME="schedule", RELEASE_ACTIONS_LIVE="rc")
        self.assertIsNotNone(found.dispatcher)
        self.assertIsNotNone(found.jira_writer)


class SettingsTest(unittest.TestCase):
    def test_should_default_to_dry_run(self):
        settings = engine.settings_from_env({"GITHUB_EVENT_NAME": "schedule"})
        self.assertEqual(settings.mode, engine.DRY_RUN)
        self.assertFalse(settings.is_live("branch_cut"))

    def test_should_act_live_only_for_listed_actions_on_the_schedule(self):
        env = {"RELEASE_ACTIONS_MODE": "live", "RELEASE_ACTIONS_LIVE": "qa_sheet", "GITHUB_EVENT_NAME": "schedule"}
        settings = engine.settings_from_env(env)
        self.assertTrue(settings.is_live("qa_sheet"))
        self.assertFalse(settings.is_live("branch_cut"))
        dispatched = engine.settings_from_env({**env, "GITHUB_EVENT_NAME": "workflow_dispatch"})
        self.assertFalse(dispatched.is_live("qa_sheet"))

    def test_should_refuse_unknown_modes_and_actions(self):
        with self.assertRaises(ValueError):
            engine.parse_mode("yes")
        with self.assertRaises(ValueError):
            engine.parse_live("qa_sheet,deploy")


class PeopleTest(unittest.TestCase):
    def test_should_mention_a_role_and_flag_a_missing_one(self):
        people = People.parse(json.dumps({"qa": ["yasser.khan", "saturn.abril"], "release_backup": "eva.sarafianou"}))
        self.assertEqual(people.mention("qa"), "@yasser.khan @saturn.abril")
        self.assertEqual(people.usernames("release_backup"), ["eva.sarafianou"])
        self.assertEqual(people.mention("release_manager"), "")
        self.assertEqual(people.flags(), ["Set RELEASE_AGENT_PEOPLE.release_manager: a message went out with no mention for it."])

    def test_should_flag_invalid_json_without_repeating_it(self):
        people = People.parse("{not json")
        self.assertEqual(people.roles, {})
        self.assertNotIn("not json", people.flags()[0])


# ── Branch cut ──────────────────────────────────────────────────────────────────────

class BranchCutTest(unittest.TestCase):
    def setUp(self):
        self.world = World()

    def notice(self):
        return self.world.run(at(11, 2, 8, 0), "branch_cut")

    def test_should_not_be_due_before_the_branch_cut_day(self):
        result = self.world.run(at(10, 30), "branch_cut")
        self.assertEqual(result["state"], engine.NOT_DUE)
        self.assertEqual(self.world.hub.created, [])

    def test_should_not_be_needed_when_the_branches_exist(self):
        self.world.add_branch(12, 3)
        result = self.world.run(at(11, 2, 8, 0), "branch_cut")
        self.assertEqual(result["state"], engine.DONE)
        self.assertEqual(self.world.hub.created, [])
        self.assertEqual(self.world.dispatcher.dispatched, [])

    def test_should_send_the_notice_once(self):
        self.notice()
        self.world.run(at(11, 2, 8, 40), "branch_cut")
        posts = self.world.posts("c123")
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["message"], "Cutting the release-12.3 branches on Monday, November 2 at 09:00 UTC. "
                                              "Reply `stop` or react :no_entry_sign: to stop.")
        self.assertEqual(self.world.dispatcher.dispatched, [])

    def test_should_start_one_run_per_repo_after_the_window_with_the_workflow_inputs(self):
        self.notice()
        result = self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.assertEqual(result["state"], engine.STARTED)
        self.assertEqual(self.world.dispatcher.dispatched, [
            (DP, "create-release-branches-universal.yaml", "master",
             {"RELEASE_BRANCH": "release-12.3", "REPOSITORY_NAME": "mattermost", "REPOSITORY_SRC_BRANCH": "master"}),
            (DP, "create-release-branches-universal.yaml", "master",
             {"RELEASE_BRANCH": "release-12.3", "REPOSITORY_NAME": "enterprise", "REPOSITORY_SRC_BRANCH": "master"}),
        ])
        self.assertEqual(len(self.world.audit), 2)
        self.assertTrue(self.world.audit[0].startswith("Started: create-release-branches-universal.yaml"))
        self.assertIn("triggered by schedule", self.world.audit[0])

    def test_should_wait_a_full_window_after_a_late_notice(self):
        self.world.run(at(11, 2, 8, 4), "branch_cut")
        self.assertIn("on Monday, November 2 at 10:00 UTC", self.world.posts("c123")[0]["message"])
        self.assertEqual(self.world.run(at(11, 2, 9, 3), "branch_cut")["state"], engine.WAITING)
        self.assertEqual(self.world.dispatcher.dispatched, [])
        self.assertEqual(self.world.run(at(11, 2, 10, 3), "branch_cut")["state"], engine.STARTED)

    def test_should_stop_on_a_reply_from_anyone_until_the_next_day(self):
        self.notice()
        notice = self.world.posts("c123")[0]
        self.world.hub.reply(notice["id"], "Stop", "u-dev", ms(at(11, 2, 8, 30)))
        result = self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.assertEqual(result["state"], engine.STOPPED)
        self.assertEqual(self.world.dispatcher.dispatched, [])
        self.assertTrue(self.world.replies(notice)[-1].startswith("Stopped: the release-12.3 branch cut was stopped by "
                                                                  "some.dev at Monday, November 2 at 08:30 UTC."))
        self.world.run(at(11, 2, 15, 2), "branch_cut")
        self.assertEqual(len(self.world.posts("c123")), 1)
        self.world.run(at(11, 3, 8, 2), "branch_cut")
        self.assertEqual(len(self.world.posts("c123")), 2, "a new notice the next working day")
        self.assertEqual(self.world.dispatcher.dispatched, [])

    def test_should_stop_on_a_reaction(self):
        self.notice()
        notice = self.world.posts("c123")[0]
        self.world.hub.react(notice["id"], "no_entry_sign", "u-dev", ms(at(11, 2, 8, 20)))
        self.assertEqual(self.world.run(at(11, 2, 9, 2), "branch_cut")["state"], engine.STOPPED)
        self.assertEqual(self.world.dispatcher.dispatched, [])

    def test_should_start_a_stopped_cut_on_the_release_managers_go(self):
        self.notice()
        notice = self.world.posts("c123")[0]
        self.world.hub.reply(notice["id"], "stop", "u-dev", ms(at(11, 2, 8, 30)))
        self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.world.hub.reply(notice["id"], "go", "u-rm", ms(at(11, 2, 9, 30)))
        self.assertEqual(self.world.run(at(11, 2, 10, 2), "branch_cut")["state"], engine.STARTED)
        self.assertEqual(len(self.world.dispatcher.dispatched), 2)
        self.assertIn("triggered by amy.blais's go", self.world.audit[0])

    def test_should_refuse_a_go_from_anyone_else_once(self):
        self.notice()
        notice = self.world.posts("c123")[0]
        self.world.hub.reply(notice["id"], "stop", "u-dev", ms(at(11, 2, 8, 30)))
        self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.world.hub.reply(notice["id"], "go", "u-dev", ms(at(11, 2, 9, 30)))
        self.world.run(at(11, 2, 10, 2), "branch_cut")
        self.world.run(at(11, 2, 11, 2), "branch_cut")
        refusals = [m for m in self.world.replies(notice) if m.startswith("Refused")]
        self.assertEqual(refusals, ["Refused: only the release manager or backup can approve the release-12.3 branch cut."])
        self.assertEqual(self.world.dispatcher.dispatched, [])

    def test_should_be_done_when_the_runs_succeeded_and_the_branches_exist(self):
        self.notice()
        self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.world.dispatcher.finish("success")
        self.world.add_branch(12, 3)
        result = self.world.run(at(11, 2, 10, 2), "branch_cut")
        self.assertEqual(result["state"], engine.DONE)
        notice = self.world.posts("c123")[0]
        self.assertIn("Done: release-12.3 branches cut in mattermost and enterprise.", self.world.replies(notice))
        status = self.world.status(at(11, 3), "branch_cut")
        self.assertTrue(status.done)
        self.assertEqual(status.attention, [])

    def test_should_flag_version_go_when_master_doesnt_list_the_release(self):
        self.world.add_branch(12, 3)
        self.world.github.files[(MM, "master", "server/public/model/version.go")] = 'var versions = []string{"12.2.0"}'
        self.world.github.searches["version"] = [{"number": 40001, "title": "Update latest minor version to 12.3.0",
                                                  "html_url": "https://github.com/mattermost/mattermost/pull/40001"}]
        status = self.world.status(at(11, 3), "branch_cut")
        self.assertFalse(status.done)
        self.assertEqual(status.attention, ["version.go on master doesn't list 12.3.0 yet: [the open version.go PR #40001]"
                                            "(https://github.com/mattermost/mattermost/pull/40001)."])

    def test_should_report_a_failed_run_once_and_not_retry(self):
        self.notice()
        self.world.run(at(11, 2, 9, 2), "branch_cut")
        self.world.dispatcher.finish("failure")
        result = self.world.run(at(11, 2, 10, 2), "branch_cut")
        self.assertEqual(result["state"], engine.FAILED)
        notice = self.world.posts("c123")[0]
        failed = [m for m in self.world.replies(notice) if m.startswith("Failed")]
        self.assertEqual(len(failed), 1)
        self.assertTrue(failed[0].startswith("Failed: the branch cut workflow failed: [mattermost run]("))
        self.assertTrue(failed[0].endswith("@amy.blais"))
        self.world.run(at(11, 3, 9, 2), "branch_cut")
        self.assertEqual(len(self.world.dispatcher.dispatched), 2)
        self.assertEqual(len(self.world.posts("c123")), 1)

    def test_should_post_in_the_log_with_a_mention_when_there_is_no_release_channel(self):
        world = World(release_channel=False)
        world.run(at(11, 2, 8, 0), "branch_cut")
        self.assertEqual(world.posts("c123"), [])
        self.assertTrue(world.posts("log")[0]["message"].endswith("to stop. @amy.blais"))

    def test_should_keep_the_log_notice_when_the_release_channel_appears(self):
        world = World(release_channel=False)
        world.run(at(11, 2, 8, 0), "branch_cut")
        world.hub.channels = [{"id": "c123", "display_name": "Release: v12.3"}]
        world.run(at(11, 2, 9, 2), "branch_cut")
        self.assertEqual(world.posts("c123"), [])
        self.assertEqual(len(world.dispatcher.dispatched), 2)

    def test_should_only_show_what_it_would_do_in_a_dry_run(self):
        world = World(mode="dry_run")
        world.run(at(11, 2, 8, 0), "branch_cut")
        result = world.run(at(11, 2, 9, 2), "branch_cut")
        self.assertEqual(result["state"], engine.DRY)
        self.assertEqual(world.posts("c123"), [])
        notice = world.posts("test")[0]
        self.assertIn("_Dry run: this shows what the live agent would post. Nothing will be started._", notice["message"])
        self.assertTrue(world.replies(notice)[0].startswith("Dry run: would start the release-12.3 branch cut now"))
        self.assertEqual(world.dispatcher.dispatched, [])

    def test_should_dry_run_a_live_action_started_from_the_actions_tab(self):
        self.world.run(at(11, 2, 8, 0), "branch_cut", trigger="workflow_dispatch")
        self.world.run(at(11, 2, 9, 2), "branch_cut", trigger="workflow_dispatch")
        self.assertEqual(self.world.dispatcher.dispatched, [])
        self.assertEqual(self.world.posts("c123"), [])
        self.assertEqual(len(self.world.posts("test")), 1)


# ── Release candidates ──────────────────────────────────────────────────────────────

class RcTest(unittest.TestCase):
    T15 = at(11, 23, 8, 0)  # T-15 for a December 14 Release Day, with November 11 not a holiday in the rules

    def setUp(self):
        self.world = World()
        self.world.add_branch(12, 3)
        self.due = runner.release_calendar.resolve_due("T-15", self.release(), frozenset())

    def release(self):
        from release_agent import release_calendar
        releases, _ = release_calendar.releases_from_events(release_calendar.parse_ics(fixture("release-dates.ics")),
                                                           RULES["calendar"]["milestones"])
        return releases[(12, 3)]

    def cut_rc1(self):
        day = self.due
        self.world.run(at(day.month, day.day, 8, 0), "rc")
        self.world.run(at(day.month, day.day, 9, 2), "rc")
        self.world.dispatcher.finish("success")
        self.world.add_tag("v12.3.0-rc1")
        return self.world.run(at(day.month, day.day, 11, 2), "rc")

    def test_should_not_be_due_before_t15(self):
        self.assertEqual(self.world.run(at(11, 13), "rc")["state"], engine.NOT_DUE)
        self.assertEqual(self.world.hub.created, [])

    def test_should_cut_rc1_after_its_window_with_the_workflow_inputs(self):
        day = self.due
        self.world.run(at(day.month, day.day, 8, 0), "rc")
        self.assertTrue(self.world.posts("c123")[0]["message"].startswith("Cutting v12.3.0-rc1 on "))
        self.world.run(at(day.month, day.day, 9, 2), "rc")
        self.assertEqual(self.world.dispatcher.dispatched, [(DP, "release-mattermost-platform.yml", "master", {
            "MAJOR": "12", "MINOR": "3", "RC": True, "LATEST": False, "ESR_RELEASE": False})])

    def test_should_tell_qa_when_rc1_is_ready_and_tick_then(self):
        result = self.cut_rc1()
        self.assertEqual(result["state"], engine.DONE)
        ready = [p for p in self.world.posts("c123") if p["message"].startswith("Done: v12.3.0-rc1 is ready")]
        self.assertEqual([p["message"] for p in ready], [
            "Done: v12.3.0-rc1 is ready for testing: [v12.3.0-rc1 build]"
            "(https://releases.mattermost.com/12.3.0-rc1/mattermost-12.3.0-rc1-linux-amd64.tar.gz). cc @yasser.khan"])
        self.assertTrue(self.world.status(at(12, 1), "rc").done)

    def ready_posts(self):
        return [p for p in self.world.posts("c123") if p["message"].startswith("Done: v12.3.0-rc1 is ready")]

    def test_should_finish_rc1_when_the_tag_shows_up_after_the_run_succeeded(self):
        day = self.due
        self.world.run(at(day.month, day.day, 8, 0), "rc")
        self.world.run(at(day.month, day.day, 9, 2), "rc")
        self.world.dispatcher.finish("success")
        self.assertEqual(self.world.run(at(day.month, day.day, 10, 2), "rc")["state"], engine.FAILED)
        self.world.add_tag("v12.3.0-rc1")
        self.assertEqual(self.world.run(at(day.month, day.day, 11, 2), "rc")["state"], engine.DONE)
        self.assertEqual(len(self.ready_posts()), 1)
        self.assertEqual(len(self.world.dispatcher.dispatched), 1)
        self.assertTrue(self.world.status(at(12, 1), "rc").done)

    def test_should_finish_a_failed_rc1_that_was_tagged_on_go_without_cutting_again(self):
        day = self.due
        self.world.run(at(day.month, day.day, 8, 0), "rc")
        self.world.run(at(day.month, day.day, 9, 2), "rc")
        self.world.dispatcher.finish("failure")
        self.world.add_tag("v12.3.0-rc1")
        self.world.run(at(day.month, day.day, 10, 2), "rc")
        self.world.run(at(day.month, day.day, 11, 2), "rc")
        self.assertEqual(self.ready_posts(), [])
        self.assertFalse(self.world.status(at(day.month, day.day, 11, 30), "rc").done)
        notice = self.world.posts("c123")[0]
        self.world.hub.reply(notice["id"], "go", "u-rm", ms(at(day.month, day.day, 11, 30)))
        self.world.run(at(day.month, day.day, 12, 2), "rc")
        self.assertEqual(len(self.ready_posts()), 1)
        self.assertEqual(len(self.world.dispatcher.dispatched), 1, "rc1 is tagged, so nothing is cut again")
        self.assertTrue(self.world.status(at(12, 1), "rc").done)

    def test_should_not_tick_an_rc1_cut_by_hand(self):
        self.world.add_tag("v12.3.0-rc1")
        self.assertFalse(self.world.status(at(12, 1), "rc").done)

    def propose(self, commits=2, now=None):
        self.world.github.compares[(MM, "v12.3.0-rc1", "release-12.3")] = [
            {"commit": {"message": f"MM-7100{n} Fix thing {n} (#4000{n}) (#4010{n})"}} for n in range(commits)]
        return self.world.run(now or at(12, 1, 10, 2), "rc")

    def proposal(self):
        return next(p for p in self.world.posts("c123") if p["message"].startswith("Proposal"))

    def test_should_propose_the_next_rc_with_the_fixes_listed(self):
        self.cut_rc1()
        self.propose()
        self.assertEqual(self.proposal()["message"],
                         "Proposal: cut v12.3.0-rc2. It includes 2 fixes since rc1 (listed below). Reply `go` or react "
                         ":white_check_mark: to cut it; nothing happens otherwise. @amy.blais\n\n"
                         "- MM-71000: Fix thing 0\n- MM-71001: Fix thing 1")
        self.assertEqual(len(self.world.dispatcher.dispatched), 1, "nothing is cut without a go")

    def test_should_update_the_open_proposal_in_place(self):
        self.cut_rc1()
        self.propose(2)
        self.propose(3, at(12, 1, 11, 2))
        proposals = [p for p in self.world.posts("c123") if p["message"].startswith("Proposal")]
        self.assertEqual(len(proposals), 1)
        self.assertIn("It includes 3 fixes since rc1", proposals[0]["message"])

    def test_should_cut_on_a_go_from_a_backup(self):
        self.cut_rc1()
        self.propose()
        self.world.hub.reply(self.proposal()["id"], "go", "u-eva", ms(at(12, 1, 10, 30)))
        self.propose(now=at(12, 1, 11, 2))
        self.assertEqual(len(self.world.dispatcher.dispatched), 2)

    def test_should_cut_on_a_reaction_from_the_run_owner(self):
        self.cut_rc1()
        self.propose()
        self.world.hub.react(self.proposal()["id"], "white_check_mark", "u-rm", ms(at(12, 1, 10, 30)))
        self.propose(now=at(12, 1, 11, 2))
        self.assertEqual(len(self.world.dispatcher.dispatched), 2)

    def test_should_refuse_a_go_from_anyone_else(self):
        self.cut_rc1()
        self.propose()
        self.world.hub.reply(self.proposal()["id"], "go", "u-dev", ms(at(12, 1, 10, 30)))
        self.propose(now=at(12, 1, 11, 2))
        self.assertEqual(len(self.world.dispatcher.dispatched), 1)
        self.assertIn("Refused: only the release manager or backup can approve the v12.3.0-rc2 cut.",
                      self.world.replies(self.proposal()))

    def test_should_not_propose_with_an_open_blocker(self):
        self.cut_rc1()
        self.world.jira.issues[r"priority = Blocker"] = [{"key": "MM-1", "fields": {"summary": "Broken"}}]
        self.propose()
        self.assertFalse(any(p["message"].startswith("Proposal") for p in self.world.posts("c123")))

    def test_should_not_propose_after_the_final_build_cut(self):
        self.cut_rc1()
        self.propose(now=at(12, 7, 10, 2))
        self.assertFalse(any(p["message"].startswith("Proposal") for p in self.world.posts("c123")))

    def test_should_close_an_open_proposal_at_the_final_build_cut(self):
        self.cut_rc1()
        self.propose()
        self.propose(now=at(12, 7, 10, 2))
        self.assertTrue(self.proposal_or_closed().startswith("Closed: no more RCs are proposed"))

    def proposal_or_closed(self):
        return next(p["message"] for p in self.world.posts("c123") if p["props"].get(engine.ACTION_PROP, "").endswith(":rc2"))

    def test_fix_lines(self):
        self.assertEqual(rc.fix_line({"commit": {"message": "[MM-123] Fix the thing (#1) (#2)\n\nbody"}}), "MM-123: Fix the thing")
        self.assertEqual(rc.fix_line({"commit": {"message": "Bump deps (#5)"}}), "Bump deps")


# ── QA sheet ────────────────────────────────────────────────────────────────────────

HEADERS = ["Release Version", "Feature", "Team", "QA Point", "Dev", "JIRA Epic / docs", "Feature Flag?",
           "Link to Zephyr Tests", "Link to E2E / Unit Tests"]
BROWSE = "https://mattermost.atlassian.net/browse/"


def issue(key, summary, team="Calls", dev="Dev One"):
    return {"key": key, "fields": {"summary": summary, "assignee": {"displayName": dev},
                                   "customfield_10800": {"name": team, "id": "t1"}}}


class QaSheetTest(unittest.TestCase):
    def setUp(self):
        self.world = World()
        self.world.jira.issues[r"issuetype in \(Epic, Story\) AND status = Resolved"] = [
            issue("MM-200", "Second feature", "Reliability", "Dev Two"), issue("MM-100", "First feature")]
        self.newest = {"title": "v12.2 / Mobile v2.47", "sheetId": 5, "rows": [
            HEADERS, ["Mobile v2.47", "A mobile thing", "Calls", "QA", "Dev", f"{BROWSE}MM-1", "N/A"]]}
        self.world.sheets = FakeSheets([self.newest, {"title": "v12.1 / Mobile v2.46", "sheetId": 4, "rows": [HEADERS]}])
        day = runner.release_calendar.resolve_due("T-16", RcTest.release(self), frozenset())
        self.now = at(day.month, day.day, 9, 2)

    def test_should_not_be_due_before_t16(self):
        self.assertEqual(self.world.run(at(11, 2), "qa_sheet")["state"], engine.NOT_DUE)
        self.assertEqual(self.world.sheets.calls, [])

    def test_should_copy_the_newest_tab_and_add_one_row_per_ticket(self):
        result = self.world.run(self.now, "qa_sheet")
        self.assertEqual(result["state"], engine.DONE)
        tab = self.world.sheets.tabs_data[0]
        self.assertEqual(tab["title"], "v12.3")
        self.assertEqual(tab["rows"], [HEADERS,
                                       ["v12.3", "First feature", "Calls", "", "Dev One", f"{BROWSE}MM-100", "", "", ""],
                                       ["v12.3", "Second feature", "Reliability", "", "Dev Two", f"{BROWSE}MM-200", "", "", ""]])
        self.assertEqual(self.newest["rows"][1][0], "Mobile v2.47", "another release's tab is untouched")
        done = self.world.posts("c123")[0]["message"]
        self.assertTrue(done.startswith("Done: added 2 tickets to the [v12.3 QA feature tracking tab]"
                                        "(https://docs.google.com/spreadsheets/d/qa-sheet/edit#gid=777)."))

    def test_should_name_the_tab_after_the_calendars_mobile_and_desktop_releases(self):
        from release_agent import release_calendar
        events = release_calendar.parse_ics(fixture("release-dates.ics"))
        releases, _ = release_calendar.releases_from_events(events, RULES["calendar"]["milestones"])
        self.assertEqual(qa_sheet.tab_name(releases[(12, 4)], qa_sheet.companions(events, releases[(12, 4)])),
                         "v12.4 / Mobile v2.49")
        self.assertEqual(qa_sheet.tab_name(releases[(12, 1)], qa_sheet.companions(events, releases[(12, 1)])),
                         "v12.1 / Mobile v2.46")

    def test_should_use_an_existing_tab_and_never_add_a_row_twice(self):
        mine = {"title": "v12.3 / Mobile v2.48", "sheetId": 9, "rows": [
            HEADERS, ["Mobile v2.48", "QA's mobile row", "Calls", "QA", "Dev", f"{BROWSE}MM-5", "N/A"],
            ["v12.3", "Edited by QA", "Calls", "QA", "Dev", f"{BROWSE}MM-100", "Yes"]]}
        self.world.sheets.tabs_data.insert(0, mine)
        self.world.run(self.now, "qa_sheet")
        self.world.run(self.now.replace(hour=10), "qa_sheet")
        self.assertEqual(len(mine["rows"]), 4)
        self.assertEqual(mine["rows"][1][1], "QA's mobile row")
        self.assertEqual(mine["rows"][2], ["v12.3", "Edited by QA", "Calls", "QA", "Dev", f"{BROWSE}MM-100", "Yes"])
        self.assertEqual(mine["rows"][3][5], f"{BROWSE}MM-200")
        self.assertEqual([c[0] for c in self.world.sheets.writes], ["append"])

    def test_should_add_tickets_resolved_since_on_the_next_day(self):
        self.world.run(self.now, "qa_sheet")
        self.world.jira.issues[r"issuetype in \(Epic, Story\) AND status = Resolved"].append(issue("MM-300", "Late feature"))
        self.world.run(self.now.replace(day=self.now.day + 1), "qa_sheet")
        self.assertEqual([r[5] for r in self.world.sheets.tabs_data[0]["rows"][1:]],
                         [f"{BROWSE}MM-100", f"{BROWSE}MM-200", f"{BROWSE}MM-300"])
        done = self.world.posts("c123")[0]
        self.assertTrue(self.world.replies(done)[0].startswith("Done: added 1 more tickets that reached Resolved"))

    def test_should_write_nothing_in_a_dry_run(self):
        world = World(mode="dry_run")
        world.jira.issues = self.world.jira.issues
        world.sheets = self.world.sheets
        result = world.run(self.now, "qa_sheet")
        self.assertEqual(result["state"], engine.DRY)
        self.assertEqual(world.sheets.writes, [])
        self.assertIn("- MM-100: First feature", world.posts("test")[0]["message"])

    def test_should_report_a_missing_column_and_write_nothing(self):
        self.newest["rows"][0] = HEADERS[:5]
        result = self.world.run(self.now, "qa_sheet")
        self.assertEqual(result["state"], engine.ATTENTION)
        self.assertEqual(self.world.sheets.writes, [])


# ── Fix versions ────────────────────────────────────────────────────────────────────

class VersionsTest(unittest.TestCase):
    def setUp(self):
        self.world = World()
        self.world.github.releases_by_tag[(MM, "v12.3.0")] = {"prerelease": False, "draft": False}

    def plan(self, world=None, release=(12, 3)):
        world = world or self.world
        from release_agent import agent, release_calendar
        releases, _ = release_calendar.releases_from_events(release_calendar.parse_ics(fixture("release-dates.ics")),
                                                           RULES["calendar"]["milestones"])
        spec = next(a for a in RULES["actions"] if a["action"] == "versions")
        ctx = engine.ActionContext(release=releases[release], now=at(12, 14), holidays=frozenset(), rules=RULES, spec=spec,
                                   settings=world.settings(), services=world.services(), releases=releases,
                                   vars=agent.template_vars(releases[release], RULES["naming"], []))
        return versions.plan(ctx, world.jira.versions("MM"), [m["title"] for m in world.github.milestones(MM)])

    def test_should_take_names_from_jira_and_the_calendar_and_work_out_the_rest(self):
        found = self.plan()
        self.assertEqual([(n.name, n.clear) for n in found.upcoming], [
            ("v12.4 (January 2027)", True), ("v12.5 (February 2027)", False), ("v12.6 (March 2027)", False)])

    def test_should_cross_a_year_change(self):
        self.world.jira.project_versions += [
            {"id": "4", "name": "v12.5 (February 2027)", "releaseDate": "2027-02-16"},
            {"id": "5", "name": "v12.6 (March 2027)", "releaseDate": "2027-03-16"}]
        found = self.plan(release=(12, 2))
        self.assertEqual([n.name for n in found.upcoming], ["v12.3 (December 2026)", "v12.4 (January 2027)",
                                                            "v12.5 (February 2027)"])
        self.assertTrue(found.clear)

    def test_should_follow_a_major_bump_only_when_something_names_it(self):
        self.world.jira.project_versions.append({"id": "9", "name": "v13.0 (February 2027)", "releaseDate": "2027-02-16"})
        self.assertEqual([n.name for n in self.plan().upcoming][:2], ["v12.4 (January 2027)", "v13.0 (February 2027)"])

    def test_should_ask_for_a_go_from_t1_when_a_name_is_worked_out(self):
        result = self.world.run(at(12, 11, 9, 2), "versions")
        self.assertEqual(result["state"], engine.WAITING)
        ask = self.world.posts("c123")[0]["message"]
        self.assertTrue(ask.startswith("Waiting: confirm the next fix versions"))
        self.assertIn("- v12.5 (February 2027) (worked out, not confirmed)", ask)
        self.world.run(at(12, 14, 9, 2), "versions")
        self.assertEqual(self.world.jira_writer.created_versions, [])

    def test_should_go_ahead_after_the_release_managers_go(self):
        self.world.run(at(12, 11, 9, 2), "versions")
        self.world.hub.reply(self.world.posts("c123")[0]["id"], "go", "u-rm", ms(at(12, 11, 10)))
        result = self.world.run(at(12, 14, 9, 2), "versions")
        self.assertEqual(result["state"], engine.DONE)
        self.assertEqual(self.world.jira_writer.released, [("2", "2026-12-14")])
        self.assertEqual(self.world.jira_writer.created_versions, [("v12.5 (February 2027)", ""), ("v12.6 (March 2027)", "")])
        self.assertEqual(sorted(self.world.milestones.created), [
            (ENT, "v12.4.0"), (ENT, "v12.5.0"), (ENT, "v12.6.0"), (MM, "v12.4.0"), (MM, "v12.5.0"), (MM, "v12.6.0")])

    def test_should_skip_what_exists_and_do_nothing_on_a_rerun(self):
        self.world.jira.project_versions += [{"id": "4", "name": "v12.5 (February 2027)", "releaseDate": "2027-02-16"},
                                             {"id": "5", "name": "v12.6 (March 2027)", "releaseDate": "2027-03-16"}]
        self.world.github.milestone_titles[MM] += ["v12.4.0"]
        self.world.run(at(12, 14, 9, 2), "versions")
        self.assertEqual(self.world.jira_writer.created_versions, [])
        self.assertNotIn((MM, "v12.4.0"), self.world.milestones.created)
        self.assertEqual(len(self.world.milestones.created), 5)
        self.world.run(at(12, 14, 10, 2), "versions")
        self.assertEqual(len(self.world.milestones.created), 5)
        self.assertEqual(len(self.world.jira_writer.released), 1)

    def test_should_wait_for_the_published_github_release(self):
        self.world.github.releases_by_tag[(MM, "v12.3.0")] = {"prerelease": True}
        self.world.jira.project_versions += [{"id": "4", "name": "v12.5 (February 2027)"}, {"id": "5", "name": "v12.6 (March 2027)"}]
        self.assertEqual(self.world.run(at(12, 14, 9, 2), "versions")["state"], engine.WAITING)
        self.assertEqual(self.world.jira_writer.released, [])

    def test_should_write_nothing_in_a_dry_run(self):
        world = World(mode="dry_run")
        world.github, world.jira = self.world.github, self.world.jira
        world.jira_writer, world.milestones = FakeJiraWriter(world.jira), FakeMilestoneWriter(world.github)
        world.jira.project_versions += [{"id": "4", "name": "v12.5 (February 2027)"}, {"id": "5", "name": "v12.6 (March 2027)"}]
        self.assertEqual(world.run(at(12, 14, 9, 2), "versions")["state"], engine.DRY)
        self.assertEqual((world.jira_writer.released, world.jira_writer.created_versions, world.milestones.created), ([], [], []))
        plan = world.posts("test")[0]["message"]
        self.assertIn("- Mark v12.3 (December 2026) as released on 2026-12-14", plan)
        self.assertIn("- Add the v12.4.0 milestone in mattermost", plan)

    def test_should_preview_the_names_at_t1(self):
        self.world.jira.project_versions += [{"id": "4", "name": "v12.5 (February 2027)"}, {"id": "5", "name": "v12.6 (March 2027)"}]
        result = self.world.run(at(12, 11, 9, 2), "versions")
        self.assertEqual(result["state"], engine.NOT_DUE)
        status = self.world.status(at(12, 11), "versions")
        self.assertEqual(status.line, "Not due yet: on Release Day, close v12.3 (December 2026) and add v12.4 (January 2027), "
                                      "v12.5 (February 2027), v12.6 (March 2027).")


# ── Tickets ─────────────────────────────────────────────────────────────────────────

def adf(text_value):
    return {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [
        {"type": "text", "text": text_value},
        {"type": "text", "text": "releases", "marks": [{"type": "link", "attrs": {"href": "https://x"}}]}]}]}


class TicketsTest(unittest.TestCase):
    def setUp(self):
        self.world = World()
        self.world.jira.project_versions[1]["released"] = True
        sources = {
            "Prepackage Calls for": ("MM-1", "Prepackage Calls for v12.3", "3"),
            "Prepackage Playbooks & FIPS for": ("MM-2", "Prepackage Playbooks & FIPS for v12.3", "10001"),
            "Prepackage Boards & FIPS for": ("MM-3", "Prepackage Boards & FIPS for v12.3", "3"),
            "Prepackage Agents & FIPS for": ("MM-4", "Prepackage Agents & FIPS for v12.3", "10001"),
            "Loadtest": ("MM-5", "📈 Loadtest 12.3, December (vs 12.2, November)", "10000"),
        }
        for search, (key, summary, type_id) in sources.items():
            self.world.jira.issues[re.escape(search)] = [{"key": key, "fields": {
                "summary": summary, "issuetype": {"id": type_id}, "components": [{"id": "c1", "name": "Plugin"}],
                "labels": ["rc2", "keep"], "customfield_10800": {"id": "team-1", "name": "Pod"},
                "assignee": {"displayName": "Someone"}, "duedate": "2026-12-01",
                "description": adf("Feature Complete for v12.3 will be on Monday, December 21st.")}}]

    def test_should_create_the_five_tickets_for_the_next_release(self):
        result = self.world.run(at(12, 14, 10, 2), "tickets")
        # The fixture calendar has no v12.4 Feature Complete yet, so it waits for the epic's Start Date.
        self.assertEqual(result["state"], engine.WAITING)
        created = {fields["summary"]: fields for _, fields in self.world.jira_writer.issues}
        self.assertEqual(sorted(created), sorted([
            "Prepackage Calls for v12.4", "Prepackage Playbooks & FIPS for v12.4", "Prepackage Boards & FIPS for v12.4",
            "Prepackage Agents & FIPS for v12.4", "📈 Loadtest 12.4, January (vs 12.3, December)"]))
        calls = created["Prepackage Calls for v12.4"]
        self.assertEqual(calls["fixVersions"], [{"name": "v12.4 (January 2027)"}])
        self.assertEqual(calls["issuetype"], {"id": "3"})
        self.assertEqual(calls["components"], [{"id": "c1"}])
        self.assertEqual(calls["labels"], ["keep"])
        self.assertEqual(calls["customfield_10800"], "team-1")
        self.assertNotIn("assignee", calls)
        self.assertNotIn("duedate", calls)
        self.assertNotIn("customfield_11107", calls)
        self.assertEqual(calls["description"]["content"][0]["content"][0]["text"], "Feature Complete for TBD will be on TBD.")
        self.assertEqual(calls["description"]["content"][0]["content"][1]["text"], "releases")
        epic = created["📈 Loadtest 12.4, January (vs 12.3, December)"]
        # The fixture calendar has no v12.4 Feature Complete event: flagged, created without it.
        self.assertNotIn("customfield_11107", epic)

    def test_should_set_the_epics_start_date_from_feature_complete(self):
        world = self.world
        rules = {**RULES, "actions": [{**a, "target": "after_next"} if a["action"] == "tickets" else a for a in RULES["actions"]]}
        world.jira.project_versions.append({"id": "9", "name": "v12.5 (February 2027)", "releaseDate": "2027-02-16"})
        world.run(at(12, 14, 10, 2), "tickets", rules=rules)
        summaries = [f["summary"] for _, f in world.jira_writer.issues]
        self.assertIn("Prepackage Calls for v12.5", summaries)
        self.assertIn("📈 Loadtest 12.5, February (vs 12.4, January)", summaries)

    def test_should_be_done_with_the_start_date_from_feature_complete(self):
        self.world.extra_events = "BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261221\nSUMMARY:v12.4 Feature Complete\nEND:VEVENT\n"
        result = self.world.run(at(12, 14, 10, 2), "tickets")
        self.assertEqual(result["state"], engine.DONE)
        epic = next(f for _, f in self.world.jira_writer.issues if f["summary"].startswith("📈"))
        self.assertEqual(epic["customfield_11107"], "2026-12-21")
        done = self.world.posts("c123")[0]["message"]
        self.assertTrue(done.startswith("Done: the tickets for v12.4 exist."))
        self.assertIn("- [MM-90000: Prepackage Calls for v12.4](https://jira.example/browse/MM-90000)", done)

    def test_should_set_the_start_date_once_the_calendar_has_it(self):
        epic = "📈 Loadtest 12.4, January (vs 12.3, December)"
        self.world.jira.issues = {re.escape(f'\\"{epic}\\"'): [{"key": "MM-60", "fields": {"summary": epic}}],
                                  **self.world.jira.issues}
        self.world.run(at(12, 14, 10, 2), "tickets")
        self.assertEqual(self.world.jira_writer.updates, [])
        self.world.extra_events = "BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261221\nSUMMARY:v12.4 Feature Complete\nEND:VEVENT\n"
        self.world.run(at(12, 15, 10, 2), "tickets")
        self.assertEqual(self.world.jira_writer.updates, [("MM-60", {"customfield_11107": "2026-12-21"})])

    def test_should_flag_a_missing_start_date_until_it_can_be_set(self):
        status = self.world.run(at(12, 14, 10, 2), "tickets")
        self.assertEqual(status["state"], engine.WAITING)
        self.assertIn("v12.3 tickets: Set the Start Date on the v12.4 loadtest epic", " ".join(self.world.details).replace(
            "v12.3 next-release-tickets: ", "v12.3 tickets: "))

    def test_should_never_create_a_ticket_twice(self):
        for summary in ("Prepackage Calls for v12.4", "Prepackage Playbooks & FIPS for v12.4", "Prepackage Boards & FIPS for v12.4",
                        "Prepackage Agents & FIPS for v12.4"):
            # First, so the exact-summary search finds it before the search for an earlier one.
            self.world.jira.issues = {re.escape(f'\\"{summary}\\"'): [{"key": "MM-50", "fields": {"summary": summary}}],
                                      **self.world.jira.issues}
        self.world.run(at(12, 14, 10, 2), "tickets")
        self.assertEqual([f["summary"] for _, f in self.world.jira_writer.issues],
                         ["📈 Loadtest 12.4, January (vs 12.3, December)"])

    def test_should_match_the_loadtest_epic_exactly(self):
        pattern = tickets.pattern_for({"summary": "📈 Loadtest {short}, {month} (vs {previous_short}, {previous_month})"})
        self.assertTrue(pattern.match("📈 Loadtest 12.1, November (vs 12.0, October)"))
        self.assertFalse(pattern.match("📈 Agentic Loadtesting"))

    def test_should_write_nothing_in_a_dry_run(self):
        world = World(mode="dry_run")
        world.jira = self.world.jira
        world.jira_writer = FakeJiraWriter(world.jira)
        result = world.run(at(12, 14, 10, 2), "tickets")
        self.assertEqual(result["state"], engine.DRY)
        self.assertEqual(world.jira_writer.issues, [])
        self.assertIn("Would create “Prepackage Calls for v12.4” in v12.4 (January 2027), copied from MM-1",
                      world.posts("test")[0]["message"])


# ── Release metrics ─────────────────────────────────────────────────────────────────

class MetricsTest(unittest.TestCase):
    def setUp(self):
        self.world = World()
        self.world.jira.project_versions[1]["released"] = True
        header = ["TYPE", "METRIC", "DATA SOURCE", "TARGET", "v12.2 (November)", "v12.1 (October)"]
        rows = [header] + [["", name, "Jira", "<10", "1", "2"] for name in RULES["scorecard_metrics"]]
        rows.insert(3, ["", "Non-security bugs requiring patch release", "Release Notes", "0-2", "0", "0"])
        self.tab = {"title": "Cloud & Self-Hosted", "sheetId": 42, "rows": rows}
        self.world.sheets = FakeSheets([{"title": "Release KPIs", "sheetId": 1, "rows": []}, self.tab])
        self.world.add_tag("v12.3.0-rc1")
        self.world.add_tag("v12.3.0-rc2")
        self.world.add_tag("v12.3.0")
        self.world.github.dates[(MM, "v12.3.0-rc1")] = "2026-11-16T06:00:00Z"
        self.world.github.dates[(MM, "v12.3.0")] = "2026-12-07T06:00:00Z"
        self.world.jira.counts = {r"labels in \(customer_bug": 8, r"resolution = Done AND fixVersion": 32}

    def column(self):
        return {row[1]: row[4] for row in self.tab["rows"][1:]}

    def test_should_insert_the_column_and_fill_what_it_can(self):
        result = self.world.run(at(12, 14, 10, 2), "metrics")
        self.assertEqual(result["state"], engine.DONE)
        self.assertEqual(self.tab["rows"][0][4:6], ["v12.3 (December)", "v12.2 (November)"])
        column = self.column()
        self.assertEqual(column["Date/time RC1 cut"], "2026/11/16")
        self.assertEqual(column["Total number of RCs cut"], "2")
        self.assertEqual(column["Number of days the final build is cut before the 16th"], "9")
        self.assertEqual(column["Number of customer-bug bugs fixed during release"], "8")
        self.assertEqual(column["Total valid bug fixes in fix version"], "32")
        self.assertEqual(column["Number of bugs reported within a week after the release"], "")
        self.assertEqual(column["Non-security bugs requiring patch release"], "")
        done = self.world.posts("c123")[0]["message"]
        self.assertTrue(done.startswith("Done: filled 13 of 14 in the [v12.3 scorecard column]"
                                        "(https://docs.google.com/spreadsheets/d/scorecard/edit#gid=42&range=E1). Left for you: "))
        self.assertIn("Number of bugs reported within a week after the release (filled on Monday, December 21)", done)

    def test_should_count_reverts_by_label_or_title_once_each(self):
        def pr(number):
            return {"number": number, "html_url": f"https://github.com/mattermost/mattermost/pull/{number}"}
        self.world.github.searches = {r"label:Revert milestone:\"v12\.3\.0\"": [pr(1), pr(2)],
                                      r"Revert in:title milestone:\"v12\.3\.0\"": [pr(2), pr(3)]}
        self.world.run(at(12, 14, 10, 2), "metrics")
        self.assertEqual(self.column()["Number of PRs reverted"], "3")
        self.assertEqual(len([q for q in self.world.github.queries if "Revert" in q]), 2)

    def test_should_fill_the_week_after_metric_a_week_later_and_never_overwrite(self):
        self.world.run(at(12, 14, 10, 2), "metrics")
        self.tab["rows"][1][4] = "2026/11/15"  # a person corrected it
        self.world.jira.counts[r"created >= \"2026-12-14\" AND created <= \"2026-12-21\""] = 3
        self.world.run(at(12, 21, 10, 2), "metrics")
        column = self.column()
        self.assertEqual(column["Number of bugs reported within a week after the release"], "3")
        self.assertEqual(column["Date/time RC1 cut"], "2026/11/15")

    def test_should_leave_a_failed_count_blank_and_report_it(self):
        from release_agent.clients import ServiceError
        self.world.jira.counts[r"version reported on"] = ServiceError("Jira", 400, message="bad field")
        self.world.run(at(12, 14, 10, 2), "metrics")
        self.assertEqual(self.column()["# of bugs found per release"], "")
        self.assertIn("# of bugs found per release (couldn't count: Jira request failed (HTTP 400): bad field)",
                      self.world.posts("c123")[0]["message"])

    def test_should_report_a_metric_it_cant_find(self):
        del self.tab["rows"][2]
        self.world.run(at(12, 14, 10, 2), "metrics")
        self.assertIn("Total number of RCs cut (not found in column B)", self.world.posts("c123")[0]["message"])

    def test_should_wait_for_the_release_to_be_closed(self):
        self.world.jira.project_versions[1]["released"] = False
        self.assertEqual(self.world.run(at(12, 14, 10, 2), "metrics")["state"], engine.WAITING)
        self.assertEqual(self.world.sheets.writes, [])

    def test_should_write_nothing_in_a_dry_run(self):
        world = World(mode="dry_run")
        world.jira, world.github, world.sheets = self.world.jira, self.world.github, self.world.sheets
        world.refs = self.world.refs
        world.run(at(12, 14, 10, 2), "metrics")
        self.assertEqual(world.sheets.writes, [])
        self.assertIn("Write Total number of RCs cut: 2", world.posts("test")[0]["message"])


# ── Accessibility, privacy and the workflow ─────────────────────────────────────────

SAMPLE = {"branch": "release-12.3", "when": "Monday, November 2 at 09:00 UTC", "mention": "@amy.blais",
          "rc_tag": "v12.3.0-rc2", "previous_rc": "rc1", "fix_count": "2 fixes", "fixes": "- MM-1: Fix",
          "build_url": "https://releases.mattermost.com/12.3.0-rc2/x.tar.gz", "what": "the release-12.3 branch cut",
          "who": "some.dev", "time": "Monday, November 2 at 08:30 UTC", "trigger": "schedule",
          "runs": "[mattermost run](https://github.com/x)", "reason": "the branch cut workflow failed", "plan": "- Start",
          "summary": "release-12.3 branches cut.", "short_version": "v12.3", "names": "- v12.4 (January 2027)",
          "workflow": "release-mattermost-platform.yml", "target": "v12.3.0-rc2", "run_text": "release runs",
          "run_url": "https://github.com/x", "count": "2 tickets", "tab_url": "https://docs.google.com/x",
          "created": "", "rows": "- MM-1: A", "target_short": "v12.4", "tickets": "- [MM-1: A](https://x)",
          "filled": 12, "total": 14, "column_url": "https://docs.google.com/x", "left": " Left for you: A.",
          "closed": "v12.3 (December 2026) is released."}


class AccessibilityTest(unittest.TestCase):
    def test_every_template_has_link_text_no_tables_and_its_status_word_first(self):
        templates = sorted(text.TEMPLATES_DIR.glob("*.md"))
        self.assertGreater(len(templates), 10)
        for path in templates:
            rendered = text.render(path.stem, **SAMPLE)
            self.assertEqual(text.accessibility_problems(rendered), [], path.name)

    def test_the_checker_finds_each_problem(self):
        self.assertEqual(text.accessibility_problems("Done: see https://x.com"), ["bare URL"])
        self.assertEqual(text.accessibility_problems("Done:\n| a | b |"), ["table"])
        self.assertEqual(text.accessibility_problems("Done at 14:00"), ["time without UTC"])
        self.assertEqual(text.accessibility_problems(":white_check_mark: done"), ["status word not first"])
        self.assertEqual(text.accessibility_problems("Done: [https://x](https://x)"), ["link text is a URL or empty"])

    def test_every_status_line_starts_with_its_status_word(self):
        world = World()
        for action in ("branch_cut", "rc", "qa_sheet", "versions", "tickets", "metrics"):
            for now in (at(10, 30), at(11, 2, 9), at(12, 14, 9)):
                status = world.status(now, action)
                self.assertEqual(text.accessibility_problems(status.line.split("\n")[0]), [], (action, status.line))

    def test_dates_are_in_words_and_utc(self):
        self.assertEqual(text.when(at(11, 24, 14)), "Tuesday, November 24 at 14:00 UTC")


class PrivacyTest(unittest.TestCase):
    def test_run_json_and_the_summary_have_no_keys_ticket_text_links_or_sheet_contents(self):
        world = World()
        world.jira.issues[r"issuetype in \(Epic, Story\) AND status = Resolved"] = [issue("MM-100", "Secret feature")]
        world.sheets = FakeSheets([{"title": "v12.2", "sheetId": 5, "rows": [HEADERS]}])
        world.run(QaSheetTest.setUp.__globals__["at"](11, 23, 9, 2), "qa_sheet")
        world.run(at(11, 2, 8, 0), "branch_cut")
        world.run(at(11, 2, 9, 2), "branch_cut")
        public = json.dumps(world.body) + runner.step_summary(world.body)
        for secret in ("MM-100", "Secret feature", "delivery-platform/actions", "docs.google.com", "https://"):
            self.assertNotIn(secret, public)
        self.assertTrue(any("delivery-platform/actions" in line for line in world.audit), "the audit is Hub only")


class StatusPostTest(unittest.TestCase):
    """The daily run (release-agent.yml) shows the actions and ticks the done ones."""

    def test_should_show_release_actions_and_tick_a_done_action(self):
        from release_agent import agent
        from release_agent.tests import test_agent
        svc = test_agent.services()
        svc.github.branches = {ENT: {"release-12.3"}}
        svc.github.files[(MM, "master", "server/public/model/version.go")] = VERSION_GO
        svc.github.releases_by_tag, svc.github.milestone_titles = {}, {}
        svc.jira.project_versions = []
        settings = test_agent.settings()
        settings.actions = engine.Settings(mode="live", live_actions=engine.parse_live(ALL_LIVE), test_channel="test-chan",
                                           people=People.parse(json.dumps(PEOPLE)))
        body, _ = agent.run(rules_module.load_rules(), settings, svc, test_agent.TODAY)
        v123 = next(r for r in body["releases"] if r["version"] == "v12.3")
        self.assertIn({"task": "branch-cut", "playbook_item": next(
            a["playbook_item"] for a in RULES["actions"] if a["task"] == "branch-cut")}, v123["ticked"])
        self.assertIn({"task": "branch-cut", "state": "Done", "summary": "done"}, v123["actions"])
        post = next(p for p in svc.hub.created if p["channel_id"] == "c123" and not p.get("root_id"))
        self.assertIn("**Release actions**\n- Done: release-12.3 branches cut. · done in the playbook", post["message"])
        self.assertIn("- Not due yet: fill in the QA feature tracking sheet", post["message"])


class WorkflowTest(unittest.TestCase):
    WORKFLOWS = Path(__file__).resolve().parents[3] / "workflows"

    def test_only_release_actions_mints_a_delivery_platform_token(self):
        for path in self.WORKFLOWS.glob("*.y*ml"):
            source = "\n".join(line for line in path.read_text().splitlines() if not line.strip().startswith("#"))
            if path.name == "release-actions.yml":
                continue
            self.assertNotIn("delivery-platform", source, path.name)
            self.assertNotIn("permission-actions", source, path.name)

    def test_the_dispatch_token_is_minted_only_on_masters_live_schedule(self):
        source = (self.WORKFLOWS / "release-actions.yml").read_text()
        step = source[source.index("id: dispatchToken") - 400:source.index("permission-actions: write") + 30]
        self.assertIn("env.ACTS_LIVE == 'true'", step)
        self.assertIn("repositories: delivery-platform", step)
        self.assertEqual(source.count("repositories: delivery-platform"), 1)
        self.assertIn("ACTS_LIVE: ${{ vars.RELEASE_ACTIONS_MODE == 'live' && github.event_name == 'schedule' "
                      "&& github.ref == 'refs/heads/master' }}", source)

    def test_every_write_app_token_names_its_permissions(self):
        for path in self.WORKFLOWS.glob("*.y*ml"):
            source = path.read_text()
            for match in re.finditer(r"client-id: \$\{\{ vars\.CHANGELOG_WRITE_CLIENT_ID \}\}(.*?)(?:\n\s*\n|\n\s+- )", source, re.S):
                self.assertIn("permission-", match.group(1), f"{path.name}: a write token without named permissions")


if __name__ == "__main__":
    unittest.main()

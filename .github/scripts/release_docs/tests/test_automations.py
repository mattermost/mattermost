"""Each automation end to end against a fake GitHub: dry run, rerun, people's commits, TODOs."""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

from release_docs import __main__ as cli
from release_docs import docker_env, notice, publish, release_docs_pr, version_archive
from release_docs.result import LABEL, TODO_MARKER

from .fakes import FakeClaude, FakeGitHub, fixture, release_server
from .test_replay import published_fetch
from .test_tasks import real_docs

ESR = "v10.11,v11.7,v12.4"
SERVER = "mattermost/mattermost"
CHANGELOG = """## Release v12.0 - [Major Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types)

### Improvements

#### User Interface (UI)
 - Added [Attribute Management](https://docs.mattermost.com/administration-guide/manage/admin/attribute-management).
 - Pre-packaged Calls plugin version v1.12.0.

### Bug Fixes
 - Fixed a thing.
"""
HIGHLIGHT_ANSWER = {"highlights": [{"name": "Attribute Management", "source": 0,
                                    "url": "https://docs.mattermost.com/administration-guide/manage/admin/attribute-management"}]}


class Scenario:
    """One automation: its repo and inputs, with ``complete`` toggling the input it needs."""

    def __init__(self, task, version, repo, path, files, env=None):
        self.task, self.version, self.repo, self.path = task, version, repo, path
        self.files, self.env = files, env or {}

    def github(self):
        gh = FakeGitHub()
        gh.add_repo(self.repo, self.files())
        if self.repo != SERVER:
            gh.add_repo(SERVER, {"docs/main/product-overview/mattermost-v12-changelog.mdx": CHANGELOG})
        return gh

    def inputs(self, complete: bool) -> dict:
        """Keyword arguments for ``run_task`` other than the GitHub clients."""
        env = {"EVENT_NAME": "workflow_dispatch", "ESR_VERSIONS": ESR, "WAIT_ATTEMPTS": "1", **self.env}
        claude = FakeClaude(HIGHLIGHT_ANSWER)
        fetch = published_fetch()
        if not complete:
            if self.task == "version-archive":
                fetch = release_server({}, missing=("mattermost-team",))
            elif self.task == "upgrade-notice":
                claude = None
            elif self.task == "release-docs":
                env.pop("RELEASE_DATE")
        return {"env": env, "claude": claude, "fetch": fetch}

    def run(self, gh, live: bool, complete: bool = True):
        inputs = self.inputs(complete)
        env = {**inputs.pop("env"), "MODE": "live" if live else "dry_run"}
        return cli.run_task(self.task, self.version, env, gh, gh, sleep=lambda _: None, **inputs)

    @property
    def branch(self):
        return f"release-agent/{self.version}/{self.task}"


SCENARIOS = [
    Scenario("version-archive", "v12.0.0", SERVER, version_archive.ARCHIVE_PATH,
             lambda: {version_archive.ARCHIVE_PATH: fixture("version-archive-before-v12.0.0.mdx")}),
    Scenario("upgrade-notice", "v12.0.0", notice.REPO, notice.PATH,
             lambda: {notice.PATH: fixture("notices-before-v12.0.json")}, {"RELEASE_DATE": "2026-10-16"}),
    Scenario("release-docs", "v12.1.0", SERVER, release_docs_pr.SERVER_RELEASES,
             lambda: {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"},
             {"RELEASE_DATE": "2026-11-13"}),
    Scenario("docker-env", "v11.7.0", docker_env.REPO, docker_env.PATH,
             lambda: {docker_env.PATH: fixture("env.example-before-v11.7.0")}),
]


class AutomationTest(unittest.TestCase):
    def test_dry_run_changes_nothing(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                gh = s.github()
                run = s.run(gh, live=False)
                self.assertEqual(gh.writes, [])
                self.assertIn(f"Dry run: would have opened a draft PR from `{s.branch}`", run.outcome)
                self.assertIn(s.path, run.result.files)
                self.assertEqual(run.result.todos, [])

    def test_live_opens_one_labelled_draft_pr_on_the_task_branch(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                gh = s.github()
                run = s.run(gh, live=True)
                self.assertEqual([w[0] for w in gh.writes], ["create_branch", "commit_files", "create_pr", "add_labels"])
                [pr] = gh.pulls[s.repo]
                self.assertEqual((pr["head"], pr["base"], pr["draft"], pr["labels"]), (s.branch, "master", True, [LABEL]))
                self.assertIn(f"on branch `{s.branch}`", pr["body"])
                self.assertTrue(gh.repos[s.repo]["branches"][s.branch][-1]["commit"]["message"].endswith(
                    f"\n\n{publish.TRAILER}: {s.task}\n"))
                self.assertEqual(gh.head_files(s.repo, s.branch)[s.path], run.result.files[s.path])
                self.assertEqual(gh.head_files(s.repo, "master")[s.path], s.files()[s.path])
                self.assertTrue(run.outcome.startswith(f"Opened draft PR {s.repo}#"))

    def test_rerun_with_nothing_new_writes_nothing(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                gh = s.github()
                s.run(gh, live=True)
                gh.writes.clear()
                run = s.run(gh, live=True)
                self.assertEqual(gh.writes, [])
                self.assertEqual(run.result.files, {})
                self.assertEqual(len(gh.pulls[s.repo]), 1)

    def test_missing_input_is_a_todo_and_a_failed_check(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                if s.task == "docker-env":
                    continue  # see test_docker_env_without_esr_lines_opens_nothing
                gh = s.github()
                run = s.run(gh, live=True, complete=False)
                self.assertTrue(run.result.failed)
                self.assertIn(TODO_MARKER, gh.head_files(s.repo, s.branch)[s.path])
                [pr] = gh.pulls[s.repo]
                self.assertIn("#### Missing inputs", pr["body"])
                self.assertIn(f"- [ ] {run.result.todos[0]}", pr["body"])

    def test_rerun_after_the_input_arrives_updates_the_same_pr(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                if s.task == "docker-env":
                    continue
                gh = s.github()
                s.run(gh, live=True, complete=False)
                gh.writes.clear()
                run = s.run(gh, live=True)
                self.assertEqual([w[0] for w in gh.writes], ["commit_files", "update_pr", "add_labels"])
                [pr] = gh.pulls[s.repo]
                self.assertNotIn(TODO_MARKER, gh.head_files(s.repo, s.branch)[s.path])
                self.assertNotIn("#### Missing inputs", pr["body"])
                self.assertEqual(len(gh.repos[s.repo]["branches"][s.branch]), 3)  # base, first run, rerun: no force-push
                self.assertFalse(run.result.failed)

    def test_a_persons_commit_stops_all_updates(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                gh = s.github()
                s.run(gh, live=True, complete=s.task == "docker-env")
                gh.push(s.repo, s.branch, {s.path: "edited by hand\n"}, author="Release Manager")
                gh.writes.clear()
                run = s.run(gh, live=True)
                self.assertEqual(gh.writes, [])
                self.assertIn("1 commit(s) from Release Manager", run.outcome)
                self.assertEqual(gh.head_files(s.repo, s.branch)[s.path], "edited by hand\n")

    def test_merged_pr_is_done_and_closed_pr_is_not_reopened(self):
        for s in SCENARIOS:
            with self.subTest(s.task):
                for state, merged_at, expected in (("closed", "2026-10-01T00:00:00Z", "was merged; the task is done"),
                                                   ("closed", None, "closed without merging")):
                    gh = s.github()
                    s.run(gh, live=True)
                    gh.pulls[s.repo][0].update(state=state, merged_at=merged_at)
                    gh.writes.clear()
                    run = s.run(gh, live=True)
                    self.assertEqual(gh.writes, [])
                    self.assertIn(expected, run.outcome)
                    self.assertEqual(len(gh.pulls[s.repo]), 1)

    def test_docker_env_without_esr_lines_opens_nothing(self):
        s = SCENARIOS[-1]
        gh = s.github()
        run = cli.run_task(s.task, s.version, {"MODE": "live", "ESR_VERSIONS": ""}, gh, gh, None)
        self.assertEqual(gh.writes, [])
        self.assertTrue(run.result.failed)

    def test_docker_env_regular_release_is_skipped(self):
        s = SCENARIOS[-1]
        gh = s.github()
        run = cli.run_task(s.task, "v12.2.0", {"MODE": "live", "ESR_VERSIONS": ESR}, gh, gh, None)
        self.assertEqual(gh.writes, [])
        self.assertTrue(run.outcome.startswith("Skipped:"))


class ReleaseEventTest(unittest.TestCase):
    def github(self):
        gh = FakeGitHub()
        gh.add_repo(SERVER, {"docs/main/product-overview/mattermost-v12-changelog.mdx": CHANGELOG})
        gh.add_repo(notice.REPO, {notice.PATH: fixture("notices-before-v12.0.json")})
        gh.releases[(SERVER, "v12.0.0")] = {"id": 1, "tag_name": "v12.0.0", "body": ""}
        gh.releases[(SERVER, "v11.7.15")] = {"id": 2, "tag_name": "v11.7.15", "body": ""}
        gh.latest[SERVER] = "v12.0.0"
        return gh

    def run_task(self, task, version, gh, live, claude=None):
        env = {"EVENT_NAME": "release", "MODE": "live" if live else "dry_run", "ESR_VERSIONS": ESR}
        return cli.run_task(task, version, env, gh, gh, claude or FakeClaude(HIGHLIGHT_ANSWER))

    def test_github_release_text_dry_run_shows_only(self):
        gh = self.github()
        run = self.run_task("github-release", "v12.0.0", gh, live=False)
        self.assertEqual(gh.writes, [])
        self.assertEqual(run.result.text, "Mattermost Platform Release 12.0.0 contains multiple new quality of life "
                                          "improvements, including Attribute Management.")
        self.assertIn("Dry run: would have set the v12.0.0 release description", run.outcome)

    def test_github_release_text_live_then_rerun(self):
        gh = self.github()
        self.run_task("github-release", "v12.0.0", gh, live=True)
        self.assertEqual(gh.writes, [("update_release_body", SERVER, 1)])
        self.assertIn("Attribute Management", gh.releases[(SERVER, "v12.0.0")]["body"])
        gh.writes.clear()
        self.assertEqual(self.run_task("github-release", "v12.0.0", gh, live=True).outcome,
                         "The release description already matches.")
        self.assertEqual(gh.writes, [])

    def test_github_release_without_highlights_writes_nothing_and_fails(self):
        gh = self.github()
        run = self.run_task("github-release", "v12.0.0", gh, live=True, claude=FakeClaude(RuntimeError("down")))
        self.assertEqual(gh.writes, [])
        self.assertTrue(run.result.failed)

    def test_released_but_not_latest_is_skipped(self):
        gh = self.github()
        for task in ("github-release", "upgrade-notice"):
            run = self.run_task(task, "v11.7.15", gh, live=True)
            self.assertIn("is not the latest release", run.result.skipped)
        self.assertEqual(gh.writes, [])


class TextTaskTest(unittest.TestCase):
    def test_posts_and_breaking_changes_never_write(self):
        gh = FakeGitHub()
        gh.add_repo(SERVER, {"docs/main/product-overview/mattermost-v12-changelog.mdx": CHANGELOG,
                             release_docs_pr.SERVER_RELEASES: real_docs()[release_docs_pr.SERVER_RELEASES]})
        ics = fixture("release-dates.ics")
        env = {"EVENT_NAME": "workflow_dispatch", "MODE": "live", "ESR_VERSIONS": ESR, "CALENDAR_ICS_URL": "https://cal"}
        run = cli.run_task("posts", "v12.0.0", env, gh, gh, FakeClaude(HIGHLIGHT_ANSWER), fetch=lambda u, m="GET": (200, ics))
        self.assertIn("Attribute Management", run.result.text)
        gh.search_results['milestone:"v12.2.0" label:"Breaking Change"'] = []
        run = cli.run_task("breaking-changes", "v12.2.0", env, gh, gh, None)
        self.assertEqual(run.result.text.count(TODO_MARKER), 0)
        self.assertEqual(gh.writes, [])


class ResolveTest(unittest.TestCase):
    def test_events(self):
        resolve = cli.resolve
        self.assertEqual(resolve("version-archive", {"EVENT_NAME": "release"}, {"action": "published", "release": {"tag_name": "v12.0.1"}}),
                         {"run": "true", "version": "v12.0.1", "mode": "dry_run", "reason": "release published"})
        self.assertEqual(resolve("version-archive", {"EVENT_NAME": "release"}, {"release": {"tag_name": "v12.1.0-rc1"}})["run"], "false")
        self.assertEqual(resolve("release-docs", {"EVENT_NAME": "push", "PHASE3_MODE": "live"},
                                 {"ref": "refs/heads/release-12.2", "created": True}),
                         {"run": "true", "version": "v12.2.0", "mode": "live", "reason": "branch cut"})
        self.assertEqual(resolve("release-docs", {"EVENT_NAME": "push"}, {"ref": "refs/heads/release-12.2", "created": False})["run"], "false")
        self.assertEqual(resolve("release-docs", {"EVENT_NAME": "push"}, {"ref": "refs/heads/release-12.2-fix", "created": True})["run"], "false")

    def test_mode_input_overrides_the_variable(self):
        env = {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": "12.2.0", "PHASE3_MODE": "live", "INPUT_MODE": "dry_run"}
        self.assertEqual(cli.resolve("version-archive", env, {})["mode"], "dry_run")
        self.assertEqual(cli.resolve("version-archive", {**env, "INPUT_MODE": ""}, {})["mode"], "live")
        self.assertEqual(cli.resolve("version-archive", {**env, "INPUT_MODE": "", "PHASE3_MODE": ""}, {})["mode"], "dry_run")
        with self.assertRaises(ValueError):
            cli.resolve("version-archive", {**env, "INPUT_MODE": "yes"}, {})

    def test_breaking_changes_needs_a_milestone(self):
        with self.assertRaises(ValueError):
            cli.resolve("breaking-changes", {"EVENT_NAME": "workflow_dispatch"}, {})


class MainTest(unittest.TestCase):
    def test_todo_fails_the_check_and_writes_the_summary_and_artifact(self):
        gh = SCENARIOS[0].github()
        with tempfile.TemporaryDirectory() as out:
            summary = os.path.join(out, "summary.md")
            env = {"GITHUB_TOKEN": "x", "VERSION": "v12.0.0", "MODE": "dry_run", "ESR_VERSIONS": ESR, "WAIT_ATTEMPTS": "1",
                   "EVENT_NAME": "workflow_dispatch", "OUTPUT_DIR": os.path.join(out, "artifact"), "GITHUB_STEP_SUMMARY": summary}
            stdout = io.StringIO()
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(cli, "GitHub", return_value=gh), \
                    mock.patch.object(cli.http, "fetch", release_server({}, missing=("mattermost-team",))), \
                    mock.patch.object(version_archive.time, "sleep", lambda _: None), redirect_stdout(stdout):
                code = cli.main(["run", "version-archive"])
            self.assertEqual(code, 1)
            self.assertIn("::error title=Missing input::", stdout.getvalue())
            self.assertEqual(gh.writes, [])
            with open(summary, encoding="utf-8") as f:
                self.assertIn("### Missing inputs (this check fails)", f.read())
            with open(os.path.join(out, "artifact", "result.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f)["branch"], "release-agent/v12.0.0/version-archive")
            self.assertTrue(os.path.exists(os.path.join(out, "artifact", "files", version_archive.ARCHIVE_PATH)))


if __name__ == "__main__":
    unittest.main()

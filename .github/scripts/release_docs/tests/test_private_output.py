"""drafts, release-highlights and breaking-changes: Jira keys, epic names and mattermost/enterprise
PRs go to Hub only. The run summary, log, annotations, result.json and artifacts get counts
and mattermost/mattermost PRs, nothing else."""

import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

from release_docs import __main__ as cli
from release_docs import report

from .fakes import FakeClaude, FakeGitHub
from .hub_fakes import FakeHub
from .test_breaking import item, milestone_github, note
from .test_highlights import FakeJira as HighlightsJira
from .test_highlights import answer, docs, epic

# What must never reach Actions.
JIRA_KEY, EPIC_NAME = "MM-4242", "Project Nightingale"
EXCLUDED_KEY, EXCLUDED_NAME = "MM-4243", "Falcon Internal Rollout"
ENTERPRISE_PR, ENTERPRISE_TITLE = "mattermost/enterprise#77", "Rework the Falcon licence check"
SECRETS = (JIRA_KEY, EPIC_NAME, EXCLUDED_KEY, EXCLUDED_NAME, ENTERPRISE_PR, ENTERPRISE_TITLE,
           "mattermost/enterprise", "github.com/mattermost/enterprise")
ENTERPRISE = "mattermost/enterprise"
CHANGELOG = """## Release v12.2 - [Feature Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types)

### Improvements
 - Added Project Nightingale to channels.
"""


class PrivateOutputTest(unittest.TestCase):
    def finish(self, run, hub, env=None):
        """Run ``finish`` and return (exit code, everything Actions would get, the Hub posts)."""
        with tempfile.TemporaryDirectory() as out:
            summary_file = os.path.join(out, "step-summary.md")
            output_dir = os.path.join(out, "artifact")
            full_env = {"MODE": "dry_run", "OUTPUT_DIR": output_dir, "GITHUB_STEP_SUMMARY": summary_file,
                        "REVIEW_CHANNEL_ID": "review", **(env or {})}
            log = io.StringIO()
            with redirect_stdout(log):
                code = cli.finish(run, full_env, hub)
            public = [log.getvalue()]
            for root, _, files in os.walk(out):
                for name in files:
                    with open(os.path.join(root, name), encoding="utf-8") as f:
                        public.append(f"--- {name}\n{f.read()}")
            artifact_files = sorted(os.listdir(output_dir))
        posts = "\n".join(p["message"] for p in hub.posts.values()) if hub else ""
        return code, "\n".join(public), posts, artifact_files

    def assert_private(self, public: str, posts: str, expected_in_hub: tuple):
        for secret in SECRETS:
            self.assertNotIn(secret, public)
        for value in expected_in_hub:
            self.assertIn(value, posts)

    def test_breaking_changes(self):
        gh = milestone_github()
        del gh.search_results['milestone:"v12.2.0"']
        gh.search_results[f'repo:{cli.SERVER_REPO} is:pr'] = [
            item(101, "Remove the legacy SAML setting", note("Removed ``SamlSettings.Legacy`` configuration setting."))]
        gh.search_results[f"repo:{ENTERPRISE} is:pr"] = [
            item(77, ENTERPRISE_TITLE, note(f"Removed the {JIRA_KEY} licence setting."), labels=["Breaking Change"],
                 repo=ENTERPRISE)]
        env = {"MODE": "dry_run", "REPOS": f"{cli.SERVER_REPO},{ENTERPRISE}"}
        run = cli.run_task("breaking-changes", "v12.2.0", env, gh, gh, None)
        hub = FakeHub()
        code, public, posts, files = self.finish(run, hub)
        self.assert_private(public, posts, (ENTERPRISE_PR, ENTERPRISE_TITLE, "mattermost/mattermost#101"))
        self.assertIn("- candidates: 3", public)
        self.assertIn("- strong signals: 3", public)
        self.assertIn("- mattermost/mattermost#101", public)  # a public ref stays
        self.assertIn("posted to the review channel in Hub", public)
        self.assertEqual(files, ["result.json", "summary.md"])
        self.assertEqual(code, 0)
        self.assertEqual(hub.posts["p1"]["channel_id"], "review")

        # The same list again posts nothing new; a different one is posted.
        self.finish(cli.run_task("breaking-changes", "v12.2.0", env, gh, gh, None), hub)
        self.assertEqual(len(hub.posts), 1)

        # Confirming the enterprise PR: the notice and its source go to Hub only.
        confirmed = cli.run_task("breaking-changes", "v12.2.0", {**env, "CONFIRMED": ENTERPRISE_PR}, gh, gh,
                                 FakeClaude({"notices": [{"source": ENTERPRISE_PR, "notice": "The Falcon setting was removed."}]}))
        code, public, posts, _ = self.finish(confirmed, hub)
        self.assert_private(public, posts, ("The Falcon setting was removed.", ENTERPRISE_PR))
        self.assertIn("- notices drafted: 1", public)

    def test_drafts(self):
        gh = FakeGitHub()
        gh.add_repo(cli.SERVER_REPO, {"docs/main/product-overview/mattermost-v12-changelog.mdx": CHANGELOG})
        gh.search_results[f'repo:{cli.SERVER_REPO} is:pr'] = [item(39001, "Add Nightingale channels", note("Added channels."))]
        gh.search_results[f"repo:{ENTERPRISE} is:pr"] = [item(77, ENTERPRISE_TITLE, note("Licence check reworked."),
                                                              repo=ENTERPRISE)]
        claude = FakeClaude({
            "blog_outline": [{"heading": EPIC_NAME, "points": [{"text": f"{EPIC_NAME} arrives.", "sources": [JIRA_KEY]},
                                                               {"text": "Licences.", "sources": [ENTERPRISE_PR]}]}],
            "email": {"subject": "Channels", "points": [{"text": "Channels arrive.", "sources": ["mattermost/mattermost#39001"]}]},
        })
        env = {"MODE": "dry_run", "REPOS": f"{cli.SERVER_REPO},{ENTERPRISE}", "JIRA_EMAIL": "e", "JIRA_TOKEN": "t",
               "JIRA_FIX_VERSION": "v12.2 (December 2026)", "RELEASE_DATE": "2026-12-16"}
        epics = [{"key": JIRA_KEY, "summary": EPIC_NAME, "url": f"https://jira.example/browse/{JIRA_KEY}"}]
        with mock.patch.object(cli.jira, "epics", return_value=epics):
            run = cli.run_task("drafts", "v12.2.0", env, gh, gh, claude)
        hub = FakeHub()
        code, public, posts, files = self.finish(run, hub)
        self.assert_private(public, posts, (JIRA_KEY, EPIC_NAME, ENTERPRISE_PR, ENTERPRISE_TITLE))
        self.assertIn("- Jira epics: 1", public)
        self.assertIn("- blog sections: 1", public)
        self.assertIn("- mattermost/mattermost#39001", public)
        self.assertEqual(files, ["result.json", "summary.md"])  # email.md goes to Hub as a file
        self.assertEqual(hub.uploads, ["email.md"])

    def test_release_highlights(self):
        jira = HighlightsJira({"200": [epic(JIRA_KEY, EPIC_NAME), epic(EXCLUDED_KEY, EXCLUDED_NAME)]})
        claude = FakeClaude(answer((JIRA_KEY, True, "feature", EPIC_NAME, "Channels for everyone."),
                                   (EXCLUDED_KEY, False, f"internal work on {EXCLUDED_NAME}", "", "")))
        env = {"MODE": "dry_run", "JIRA_EMAIL": "e", "JIRA_TOKEN": "t"}
        with mock.patch.object(cli.jira, "Jira", return_value=jira):
            run = cli.run_task("release-highlights", "v12.2.0", env, FakeGitHub(), FakeGitHub(), claude, docs=docs())
        hub = FakeHub()
        code, public, posts, files = self.finish(run, hub)
        self.assert_private(public, posts, (JIRA_KEY, EPIC_NAME, EXCLUDED_KEY, EXCLUDED_NAME))
        self.assertIn("- slide lines: 1", public)
        self.assertIn("- left out: 1", public)
        self.assertEqual(files, ["result.json", "summary.md"])
        self.assertEqual(hub.uploads, ["release-highlights-December-2026.html", "release-highlights-December-2026.json"])
        self.assertEqual(hub.posts["p1"]["file_ids"], ["f1", "f2"])

    def test_without_hub_nothing_leaks_and_the_run_fails(self):
        run = cli.Run(cli.Result("drafts", "v12.2.0", text=f"{JIRA_KEY} {EPIC_NAME}", private=True,
                                 todos=[f"no notice drafted for {ENTERPRISE_PR}"]), "Nothing sent: drafts only.")
        code, public, _, _ = self.finish(run, None)
        self.assertEqual(code, 1)
        for secret in SECRETS:
            self.assertNotIn(secret, public)
        self.assertIn("not posted: RELEASE_AGENT_MM_TOKEN is not set", public)
        self.assertIn("::error title=Missing input::1 missing input(s); they are listed in the Hub post", public)

    def test_long_output_is_split_across_replies(self):
        text = "\n".join(f"- line {i} " + "x" * 80 for i in range(400))
        parts = report.chunks(text)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(p) <= report.CHUNK for p in parts))
        self.assertEqual("".join(parts), text)
        hub = FakeHub()
        report.deliver(cli.Result("drafts", "v12.2.0", text=text, private=True), {"REVIEW_CHANNEL_ID": "review"}, hub)
        roots = [p for p in hub.posts.values() if not p["root_id"]]
        self.assertEqual(len(roots), 1)
        self.assertEqual(len(hub.posts), len(report.chunks(report.full_report(
            cli.Result("drafts", "v12.2.0", text=text), ""))))


if __name__ == "__main__":
    unittest.main()

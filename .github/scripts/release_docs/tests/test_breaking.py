"""Breaking changes found without asking developers: the signals, the candidate list, and confirming."""

import os
import subprocess
import unittest

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)

from changelog_release import MIGRATIONS_DIR, WEBSOCKET_EVENTS_FILE  # noqa: E402

from release_docs import __main__ as cli  # noqa: E402
from release_docs import breaking  # noqa: E402
from release_docs.result import TODO_MARKER  # noqa: E402
from release_docs.versions import Version  # noqa: E402

from .fakes import FakeClaude, FakeGitHub  # noqa: E402

SERVER = "mattermost/mattermost"
REPO_ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True,
                           cwd=os.path.dirname(__file__)).stdout.strip()


def note(text: str) -> str:
    return f"#### Summary\nA change.\n\n#### Release Note\n```release-note\n{text}\n```\n"


def item(number, title, body="", labels=(), repo=SERVER):
    return {"repository_url": f"https://api.github.com/repos/{repo}", "number": number, "title": title, "body": body,
            "html_url": f"https://github.com/{repo}/pull/{number}", "labels": [{"name": n} for n in labels]}


WS_OLD = 'const (\n\tWebsocketEventPosted WebsocketEventType = "posted"\n\tWebsocketEventTyping WebsocketEventType = "typing"\n)\n'
WS_NEW = 'const (\n\tWebsocketEventPosted WebsocketEventType = "posted"\n)\n'
MIGRATION = f"{MIGRATIONS_DIR}/000151_drop_props.up.sql"


def milestone_github():
    gh = FakeGitHub()
    gh.add_repo(SERVER, {WEBSOCKET_EVENTS_FILE: WS_OLD, f"{MIGRATIONS_DIR}/000150_add.up.sql": "CREATE INDEX x ON posts(id);"})
    gh.repos[SERVER]["branches"]["release-12.1"] = list(gh.repos[SERVER]["branches"]["master"])
    gh.push(SERVER, "master", {
        WEBSOCKET_EVENTS_FILE: WS_NEW,
        MIGRATION: "ALTER TABLE users DROP COLUMN IF EXISTS props;",
        f"{MIGRATIONS_DIR}/000152_index.up.sql": "CREATE INDEX CONCURRENTLY idx ON posts(createat);",
        f"{MIGRATIONS_DIR}/000152_index.down.sql": "DROP INDEX idx;",
    })
    gh.repos[SERVER]["branches"]["release-12.2"] = list(gh.repos[SERVER]["branches"]["master"])
    gh.tags[SERVER] = ["v12.1.0", "v12.1.1", "v12.2.0-rc1"]
    gh.path_commits[(SERVER, MIGRATION)] = "mig-sha"
    gh.pulls_by_commit[(SERVER, "mig-sha")] = [{"number": 105, "html_url": "https://github.com/mattermost/mattermost/pull/105"}]
    # The fake reads files by branch name, so the v12.1.0 tag is also a branch here.
    gh.repos[SERVER]["branches"]["v12.1.0"] = gh.repos[SERVER]["branches"]["release-12.1"]
    gh.search_results['milestone:"v12.2.0"'] = [
        item(101, "Remove the legacy SAML setting", note("Removed ``SamlSettings.Legacy`` configuration setting.")),
        item(102, "Stop sending typing events from the old client", note("The typing event is no longer sent by the server.")),
        item(103, "Fix the login loop", note("Fixed an issue where users were sent back to the login page.")),
        item(104, "Change the default session length", note("NONE"), labels=["Deprecation"]),
        item(105, "Clean up user props", note("NONE")),
        item(106, "Require PostgreSQL 14", note("PostgreSQL 14 is now the minimum supported version.")),
    ]
    return gh


class SignalsTest(unittest.TestCase):
    def test_strong_and_weak(self):
        body = note("Removed ``A.Old`` configuration setting.\nAdded ``A.New`` configuration setting.\n"
                    "🗑️  Removed API file: `old.go`\nThe export no longer includes archived channels.")
        self.assertEqual(breaking.signals(["Breaking Change", "Kind/Bug"], body, {"deprecation"}), [
            ("PR label `Breaking Change`", True),
            ("Jira label `deprecation`", True),
            ("config-change-checker: Removed ``A.Old`` configuration setting.", True),
            ("config-change-checker: 🗑️  Removed API file: `old.go`", True),
            ('release note says "no longer": The export no longer includes archived channels.', False),
        ])

    def test_nothing(self):
        self.assertEqual(breaking.signals([], note("Fixed an issue where a thing broke."), set()), [])
        self.assertEqual(breaking.signals([], note("NONE"), set()), [])
        self.assertEqual(breaking.signals([], "Removed the old thing, but not in a release note.", set()), [])


class ReleaseDiffTest(unittest.TestCase):
    def test_refs(self):
        gh = milestone_github()
        self.assertEqual(breaking.release_refs(gh, SERVER, Version.parse("v12.2.0")), ("v12.1.0", "release-12.2"))
        self.assertEqual(breaking.release_refs(gh, SERVER, Version.parse("v12.3.0")), ("release-12.2", "master"))
        self.assertIsNone(breaking.release_refs(gh, SERVER, Version.parse("v12.0.0")))

    def test_removed_events_and_destructive_migrations(self):
        found, others = breaking.diff_signals(milestone_github(), SERVER, "v12.1.0", "release-12.2")
        self.assertEqual(found, [
            {"pr": None, "url": "", "event": "typing",
             "reason": "release diff: the ``typing`` WebSocket event was removed (`v12.1.0...release-12.2`)"},
            {"pr": "mattermost/mattermost#105", "url": "https://github.com/mattermost/mattermost/pull/105",
             "reason": "release diff: migration ``000151_drop_props.up.sql`` runs `DROP COLUMN`"},
        ])
        self.assertEqual(others, 1)


class ReviewClaude(FakeClaude):
    def __init__(self):
        super().__init__({"candidates": [
            {"source": "mattermost/mattermost#106", "reason": "Admins on PostgreSQL 13 must upgrade the database first."},
            {"source": "mattermost/mattermost#999", "reason": "Not a PR it was given."},
        ]})


class CandidatesTest(unittest.TestCase):
    def test_list(self):
        gh = milestone_github()
        claude = ReviewClaude()
        result = breaking.run(gh, [SERVER], "v12.2.0", "", claude)
        self.assertEqual(gh.writes, [])
        self.assertEqual(result.todos, [])
        text = result.text
        self.assertIn("From 6 merged PRs in the milestone and the release diff `v12.1.0...release-12.2`.", text)
        self.assertIn("with `confirmed` set to their PRs", text)
        order = [line.removeprefix("- [ ] [").split("]")[0] for line in text.splitlines() if line.startswith("- [ ] [")]
        self.assertEqual(order, ["mattermost/mattermost#102", "mattermost/mattermost#101", "mattermost/mattermost#104",
                                 "mattermost/mattermost#105", "mattermost/mattermost#106"])
        self.assertIn("  - release diff: the ``typing`` WebSocket event was removed (`v12.1.0...release-12.2`)", text)
        self.assertIn("  - config-change-checker: Removed ``SamlSettings.Legacy`` configuration setting.", text)
        self.assertIn("  - PR label `Deprecation`", text)
        self.assertIn("  - Claude: Admins on PostgreSQL 13 must upgrade the database first.", text)
        self.assertNotIn("#103", text)
        self.assertNotIn("#999", text)
        self.assertIn("1 other new migration(s) were not flagged", text)
        self.assertIn('"rule_signals": [\n   "config-change-checker: Removed', claude.prompts[0])

    def test_without_claude_the_rules_still_list(self):
        result = breaking.run(milestone_github(), [SERVER], "v12.2.0", "", None)
        self.assertIn("mattermost/mattermost#101", result.text)
        self.assertNotIn("#106", result.text)
        self.assertIn("ANTHROPIC_API_KEY is not set, so Claude did not review the milestone; only the rules ran", result.notes)

    def test_notices_only_for_confirmed_prs(self):
        gh = milestone_github()
        claude = FakeClaude({"notices": [{"source": "mattermost/mattermost#101", "notice": "Removed the legacy SAML setting."}]})
        result = breaking.run(gh, [SERVER], "v12.2.0", "101, #555", claude)
        self.assertIn("## Remove the legacy SAML setting", result.text)
        self.assertNotIn("Fix the login loop", result.text)
        self.assertIn('"source": "mattermost/mattermost#101"', claude.prompts[0])
        self.assertNotIn("#102", claude.prompts[0])
        self.assertEqual(result.todos, ["mattermost/mattermost#555 is not a merged PR in milestone v12.2.0"])
        self.assertEqual(breaking.run(gh, [SERVER], "v12.2.0", "none", claude).text,
                         "No breaking changes confirmed for v12.2.0; no notices drafted.\n")

    def test_confirmed_input(self):
        self.assertIsNone(breaking.parse_confirmed(" "))
        self.assertEqual(breaking.parse_confirmed("None"), [])
        self.assertEqual(breaking.parse_confirmed("39001, mattermost/enterprise#12 #39001 39002"),
                         ["mattermost/mattermost#39001", "mattermost/enterprise#12", "mattermost/mattermost#39002"])
        with self.assertRaises(ValueError):
            breaking.parse_confirmed("PR-1")


class WorkflowTest(unittest.TestCase):
    def test_runs_at_code_freeze(self):
        resolved = cli.resolve("breaking-changes", {"EVENT_NAME": "push"}, {"ref": "refs/heads/release-12.2", "created": True})
        self.assertEqual((resolved["run"], resolved["version"]), ("true", "v12.2.0"))

    def test_run_task(self):
        gh = milestone_github()
        env = {"EVENT_NAME": "push", "MODE": "dry_run", "CONFIRMED": ""}
        run = cli.run_task("breaking-changes", "v12.2.0", env, gh, gh, None)
        self.assertEqual(run.outcome, "Nothing published: drafts only.")
        self.assertIn("# Possible breaking changes in v12.2.0", run.result.text)
        self.assertIn("Jira was not read (no RELEASE_AGENT_JIRA_* settings): labels were read from GitHub only.", run.result.notes)
        run = cli.run_task("breaking-changes", "v12.2.0", {**env, "CONFIRMED": "102"}, gh, gh, None)
        self.assertEqual(run.result.text.count(TODO_MARKER), 1)
        self.assertIn("ANTHROPIC_API_KEY is not set, so no notices were drafted", run.result.todos)

    def test_jira_labels_mark_candidates(self):
        gh = milestone_github()
        gh.search_results['milestone:"v12.2.0"'].append(item(107, "MM-123 Rework the export", note("NONE")))
        asked = []

        def labels(keys):
            asked.append(keys)
            return {"MM-123": {"breaking-change"}}
        result = breaking.run(gh, [SERVER], "v12.2.0", "", None, labels)
        self.assertEqual(asked, [{"MM-123"}])
        self.assertIn("[mattermost/mattermost#107](https://github.com/mattermost/mattermost/pull/107) MM-123 Rework the export "
                      "(strong signal)\n  - Jira label `breaking-change`", result.text)

    def test_the_pr_template_is_unchanged_for_developers(self):
        with open(os.path.join(REPO_ROOT, ".github", "PULL_REQUEST_TEMPLATE.md"), encoding="utf-8") as f:
            template = f.read()
        self.assertNotIn("Breaking change", template)


if __name__ == "__main__":
    unittest.main()

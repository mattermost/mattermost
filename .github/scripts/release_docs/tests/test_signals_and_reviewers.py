"""The dot release docs' breaking-change signals, and RELEASE_DOCS_REVIEWERS on the PRs the tasks open."""

import os
import unittest

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)  # generate_changelog, whose release-note parser the signals use, reads them

from release_docs import publish  # noqa: E402
from release_docs.breaking_signals import is_signal, signals  # noqa: E402
from release_docs.result import Result  # noqa: E402

from .fakes import FakeGitHub  # noqa: E402

SERVER = "mattermost/mattermost"


def note(text: str) -> str:
    return f"#### Summary\nA change.\n\n#### Release Note\n```release-note\n{text}\n```\n"


class SignalsTest(unittest.TestCase):
    def test_labels_and_checker_removals_are_strong_and_wording_is_weak(self):
        body = note("Removed ``A.Old`` configuration setting.\nAdded ``A.New`` configuration setting.\n"
                    "🗑️  Removed API file: `old.go`\nThe export no longer includes archived channels.")
        self.assertEqual(signals(["Breaking Change", "Kind/Bug"], body), [
            ("PR label `Breaking Change`", True),
            ("config-change-checker: Removed ``A.Old`` configuration setting.", True),
            ("config-change-checker: 🗑️  Removed API file: `old.go`", True),
            ('release note says "no longer": The export no longer includes archived channels.', False),
        ])

    def test_nothing_outside_a_release_note_and_negated_labels_are_not_signals(self):
        self.assertEqual(signals([], note("NONE")), [])
        self.assertEqual(signals([], "Removed the old thing, but not in a release note."), [])
        self.assertTrue(is_signal("Deprecation"))
        self.assertFalse(is_signal("Non-breaking"))
        self.assertFalse(is_signal("No deprecation"))


class ReviewersTest(unittest.TestCase):
    def test_logins_and_teams_of_the_repos_org(self):
        self.assertEqual(publish.parse_reviewers("alice, @bob,mattermost/release-team , @mattermost/docs,alice", "mattermost"),
                         (["alice", "bob"], ["release-team", "docs"], []))
        users, teams, problems = publish.parse_reviewers("other-org/team, not a login", "mattermost")
        self.assertEqual((users, teams), ([], []))
        self.assertEqual(problems, ["RELEASE_DOCS_REVIEWERS: other-org/team is not a team in mattermost, so it can't review here",
                                    "RELEASE_DOCS_REVIEWERS: 'not a login' is neither a GitHub login nor an org/team"])
        self.assertEqual(publish.parse_reviewers("", "mattermost"), ([], [], []))

    def open_pr(self, reviewers, gh=None):
        gh = gh or FakeGitHub()
        gh.add_repo(SERVER, {"a.md": "old"})
        result = Result("version-archive", "v12.2.0", title="Title", body="Body", files={"a.md": "new"})
        target = publish.locate(gh, SERVER, "v12.2.0", "version-archive")
        return gh, publish.apply(gh, result, target, True, reviewers)

    def test_a_new_pr_asks_them_and_an_updated_one_does_not_ask_again(self):
        gh, outcome = self.open_pr("alice, mattermost/release-team")
        self.assertIn(("request_reviewers", SERVER, 100, ("alice",), ("release-team",)), gh.writes)
        self.assertTrue(outcome.endswith("Review requested from alice, mattermost/release-team."))
        gh.writes.clear()
        result = Result("version-archive", "v12.2.0", title="Title", body="Body", files={"a.md": "newer"})
        publish.apply(gh, result, publish.locate(gh, SERVER, "v12.2.0", "version-archive"), True, "alice")
        self.assertNotIn("request_reviewers", [w[0] for w in gh.writes])

    def test_unset_asks_nobody_and_a_refusal_is_a_note_not_a_failure(self):
        gh, outcome = self.open_pr("")
        self.assertNotIn("request_reviewers", [w[0] for w in gh.writes])
        self.assertNotIn("Review", outcome)
        refusing = FakeGitHub()
        refusing.reviewers_refused = True
        gh, outcome = self.open_pr("alice", refusing)
        self.assertEqual(len(gh.pulls[SERVER]), 1)
        self.assertIn("Review not requested from alice: GitHub answered 422.", outcome)


if __name__ == "__main__":
    unittest.main()

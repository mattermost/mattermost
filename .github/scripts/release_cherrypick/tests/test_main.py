import unittest

from release_cherrypick import __main__ as cli
from release_cherrypick.tests.fakes import FakeGitHub, FakeJira


class DispatchTest(unittest.TestCase):
    def test_a_jira_dispatch_without_an_issue_key_fails_instead_of_labelling_every_ticket(self):
        env = {"EVENT_NAME": "repository_dispatch", "ISSUE_KEY": " ", "CHERRYPICK_LABEL_MODE": "live"}
        github = FakeGitHub()
        _, _, code = cli.run(env, FakeJira(), github)
        self.assertEqual(code, 1)
        self.assertEqual(github.writes, [])

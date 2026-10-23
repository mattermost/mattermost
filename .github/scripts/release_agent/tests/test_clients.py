import unittest

from release_agent.clients import GitHub, Http, Jira, Mattermost, Playbooks


class RecordingHttp(Http):
    def __init__(self, responses):
        super().__init__("Test", "https://example", {})
        self.responses, self.calls = list(responses), []

    def request(self, method, path, params=None, body=None):
        self.calls.append((method, path, params, body))
        return self.responses.pop(0)


class GitHubTest(unittest.TestCase):
    def test_commits_can_filter_by_path(self):
        http = RecordingHttp([({}, [{"sha": "a"}])])
        self.assertEqual(GitHub("t", http).commits("o/r", "release-12.2", path="NOTICE.txt"), [{"sha": "a"}])
        self.assertEqual(http.calls[0][2], {"sha": "release-12.2", "per_page": 100, "page": 1, "path": "NOTICE.txt"})

    def test_search_pages_until_short_page(self):
        http = RecordingHttp([({}, {"items": [{}] * 100}), ({}, {"items": [{}] * 3})])
        self.assertEqual(len(GitHub("t", http).search_issues("q")), 103)
        self.assertEqual([c[2]["page"] for c in http.calls], [1, 2])

    def test_is_on_branch(self):
        http = RecordingHttp([({}, {"status": "ahead"}), ({}, {"status": "diverged"})])
        github = GitHub("t", http)
        self.assertTrue(github.is_on_branch("o/r", "abc", "release-12.2"))
        self.assertFalse(github.is_on_branch("o/r", "abc", "release-12.2"))
        self.assertEqual(http.calls[0][1], "/repos/o/r/compare/abc...release-12.2")


class JiraTest(unittest.TestCase):
    def test_search_follows_next_page_token(self):
        http = RecordingHttp([({}, {"issues": [{"key": "MM-1"}], "nextPageToken": "n", "isLast": False}),
                              ({}, {"issues": [{"key": "MM-2"}], "isLast": True})])
        issues = Jira("https://jira", "e", "t", http).search("project = MM")
        self.assertEqual([i["key"] for i in issues], ["MM-1", "MM-2"])
        self.assertEqual(http.calls[1][3]["nextPageToken"], "n")
        self.assertEqual(http.calls[0][:2], ("POST", "/rest/api/3/search/jql"))


class MattermostTest(unittest.TestCase):
    def test_server_version(self):
        http = RecordingHttp([({"X-Version-Id": "12.2.0.123.abc.true"}, {"status": "OK"}),
                              ({}, {"Version": "12.2.0", "BuildHash": "deadbeef"})])
        self.assertEqual(Mattermost("https://hub", "t", http).server_version(), ("12.2.0", "deadbeef"))

    def test_playbooks_close_item(self):
        http = RecordingHttp([({}, None)])
        Playbooks(Mattermost("https://hub", "t", http)).close_item("run1", 2, 5)
        self.assertEqual(http.calls[0], ("PUT", "/plugins/playbooks/api/v0/runs/run1/checklists/2/item/5/state",
                                         None, {"new_state": "closed"}))


if __name__ == "__main__":
    unittest.main()

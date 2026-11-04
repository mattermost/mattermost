import io
import json
import unittest
import urllib.error
from unittest import mock

from release_agent.clients import Confluence, GitHub, Http, Jira, Mattermost, Playbooks, ServiceError, TruncatedError, error_message


class RecordingHttp(Http):
    def __init__(self, responses):
        super().__init__("Test", "https://example", {})
        self.responses, self.calls = list(responses), []

    def request(self, method, path, params=None, body=None):
        self.calls.append((method, path, params, body))
        return self.responses.pop(0)


class ConfluenceTest(unittest.TestCase):
    def test_page_text_and_url(self):
        page = {"body": {"storage": {"value": "<h2>2027 Holidays</h2><table><tr><td>New Year&rsquo;s Day</td>"
                                              "<td>Jan&nbsp;1</td></tr></table>"}},
                "_links": {"base": "https://site.atlassian.net/wiki", "webui": "/spaces/HR/pages/42/Holidays"}}
        http = RecordingHttp([({}, page)])
        text, url = Confluence("https://site.atlassian.net", "a@b.c", "t", http).page("42")
        self.assertEqual(text, "2027 Holidays New Year\u2019s Day Jan 1")
        self.assertEqual(url, "https://site.atlassian.net/wiki/spaces/HR/pages/42/Holidays")
        self.assertEqual(http.calls[0][1:3], ("/wiki/api/v2/pages/42", {"body-format": "storage"}))


class GitHubTest(unittest.TestCase):
    def test_commits_can_filter_by_path(self):
        http = RecordingHttp([({}, [{"sha": "a"}])])
        self.assertEqual(GitHub("t", http).commits("o/r", "release-12.2", path="NOTICE.txt"), [{"sha": "a"}])
        self.assertEqual(http.calls[0][2], {"sha": "release-12.2", "per_page": 100, "page": 1, "path": "NOTICE.txt"})

    def test_changelog_prs_are_listed_by_head_branch_with_closed_ones(self):
        http = RecordingHttp([({}, [{"number": 7}])])
        self.assertEqual(GitHub("t", http).pulls_by_head("o/r", "o:changelog/v12.2.0"), [{"number": 7}])
        self.assertEqual(http.calls[0][1:3], ("/repos/o/r/pulls", {"head": "o:changelog/v12.2.0", "state": "all",
                                                                    "sort": "created", "direction": "desc", "per_page": 100}))

    def test_file_text_decodes_content_and_reads_big_files_from_the_blob(self):
        import base64
        encoded = base64.b64encode("## Release v12.2\n".encode()).decode()
        http = RecordingHttp([({}, {"encoding": "base64", "content": encoded})])
        self.assertEqual(GitHub("t", http).file_text("o/r", "docs/a b.mdx", "master"), "## Release v12.2\n")
        self.assertEqual(http.calls[0][1:3], ("/repos/o/r/contents/docs/a%20b.mdx", {"ref": "master"}))
        big = RecordingHttp([({}, {"sha": "abc", "content": ""}), ({}, {"encoding": "base64", "content": encoded})])
        self.assertEqual(GitHub("t", big).file_text("o/r", "big.mdx", "master"), "## Release v12.2\n")
        self.assertEqual(big.calls[1][1], "/repos/o/r/git/blobs/abc")

    def test_file_text_of_a_missing_file_is_none(self):
        class Missing(RecordingHttp):
            def request(self, *args, **kwargs):
                raise ServiceError("GitHub", 404)
        self.assertIsNone(GitHub("t", Missing([])).file_text("o/r", "nope", "master"))

    def test_tree_files_walks_the_path_so_a_big_folder_is_not_cut_short(self):
        http = RecordingHttp([
            ({}, {"tree": [{"path": "server", "type": "tree", "sha": "s1"}]}),
            ({}, {"tree": [{"path": "db", "type": "tree", "sha": "s2"}, {"path": "x.go", "type": "blob", "sha": "b"}]}),
            ({}, {"tree": [{"path": "000001_a.up.sql", "type": "blob", "sha": "b1"}, {"path": "sub", "type": "tree", "sha": "t"}]}),
        ])
        self.assertEqual(GitHub("t", http).tree_files("o/r", "release-12.2", "server/db"), {"000001_a.up.sql"})
        self.assertEqual([c[1] for c in http.calls], ["/repos/o/r/git/trees/release-12.2", "/repos/o/r/git/trees/s1",
                                                       "/repos/o/r/git/trees/s2"])

    def test_tree_files_of_a_missing_folder_is_empty(self):
        http = RecordingHttp([({}, {"tree": [{"path": "other", "type": "tree", "sha": "s1"}]})])
        self.assertEqual(GitHub("t", http).tree_files("o/r", "v1.0.0", "server/db"), set())

    def search_pages(self, total, sizes=(100,)):
        """Responses of a search with ``total`` results, ``sizes`` per page, then 100 each."""
        pages, left, size = [], total, iter(sizes)
        while left > 0:
            take = min(next(size, 100), left)
            pages.append(({}, {"total_count": total, "incomplete_results": False, "items": [{"n": 1}] * take}))
            left -= take
        return pages

    def test_a_search_of_more_than_100_results_is_read_in_full(self):
        http = RecordingHttp(self.search_pages(250))
        self.assertEqual(len(GitHub("t", http).search_issues("q")), 250)
        self.assertEqual([c[2]["page"] for c in http.calls], [1, 2, 3])

    def test_results_past_githubs_1000_limit_are_an_error_not_a_pass(self):
        http = RecordingHttp(self.search_pages(1500))
        with self.assertRaises(TruncatedError) as raised:
            GitHub("t", http).search_issues("q")
        self.assertEqual(str(raised.exception), "GitHub results truncated at 1000, can't confirm")
        self.assertEqual(len(http.calls), 10)

    def test_a_last_page_that_goes_over_a_smaller_limit_is_an_error(self):
        with self.assertRaisesRegex(TruncatedError, "GitHub results truncated at 175"):
            GitHub("t", RecordingHttp(self.search_pages(175))).search_issues("q", limit=150)

    def test_exactly_1000_results_are_all_there_is(self):
        self.assertEqual(len(GitHub("t", RecordingHttp(self.search_pages(1000))).search_issues("q")), 1000)

    def test_incomplete_results_are_an_error(self):
        http = RecordingHttp([({}, {"total_count": 3, "incomplete_results": True, "items": [{}] * 2})])
        with self.assertRaisesRegex(TruncatedError, "truncated at 2"):
            GitHub("t", http).search_issues("q")

    def test_a_smaller_limit_is_enforced_too(self):
        with self.assertRaisesRegex(TruncatedError, "truncated at 200"):
            GitHub("t", RecordingHttp(self.search_pages(450))).search_issues("q", limit=200)

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


class JiraPagingTest(unittest.TestCase):
    def pages(self, total, per_page=50):
        out, key = [], 0
        while key < total:
            take = min(per_page, total - key)
            issues = [{"key": f"MM-{key + n}"} for n in range(take)]
            key += take
            out.append(({}, {"issues": issues, "nextPageToken": f"t{key}", "isLast": key >= total}))
        return out

    def test_more_than_50_issues_are_read_across_pages(self):
        http = RecordingHttp(self.pages(120))
        issues = Jira("https://jira", "e", "t", http).search("project = MM")
        self.assertEqual((len(issues), len({i["key"] for i in issues})), (120, 120))
        self.assertEqual([c[3].get("nextPageToken") for c in http.calls], [None, "t50", "t100"])

    def test_a_limit_hit_with_more_to_read_is_an_error_not_a_pass(self):
        with self.assertRaises(TruncatedError) as raised:
            Jira("https://jira", "e", "t", RecordingHttp(self.pages(300))).search("project = MM", limit=100)
        self.assertEqual(str(raised.exception), "Jira results truncated at 100, can't confirm")

    def test_a_final_page_that_goes_over_the_limit_is_an_error(self):
        http = RecordingHttp([({}, {"issues": [{"key": f"MM-{n}"} for n in range(100)], "nextPageToken": "t", "isLast": False}),
                              ({}, {"issues": [{"key": f"MM-{n}"} for n in range(100, 175)], "isLast": True})])
        with self.assertRaisesRegex(TruncatedError, "Jira results truncated at 175"):
            Jira("https://jira", "e", "t", http).search("project = MM", limit=150)

    def test_exactly_the_limit_with_nothing_more_is_complete(self):
        self.assertEqual(len(Jira("https://jira", "e", "t", RecordingHttp(self.pages(100))).search("project = MM", limit=100)), 100)


class ErrorMessageTest(unittest.TestCase):
    JQL_ERROR = json.dumps({"errorMessages": ["The value 'Won't Fix' does not exist for the field 'resolution'."],
                            "warningMessages": []})

    def test_a_rejected_jql_keeps_jiras_reason(self):
        error = urllib.error.HTTPError("https://jira/rest/api/3/search/jql", 400, "Bad Request", {},
                                       io.BytesIO(self.JQL_ERROR.encode()))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaises(ServiceError) as raised:
                Jira("https://jira", "e", "t").search('resolution not in ("Won\'t Fix")')
        self.assertEqual(str(raised.exception), "Jira request failed (HTTP 400)")
        self.assertEqual(raised.exception.message, "The value 'Won't Fix' does not exist for the field 'resolution'.")

    def test_error_message_forms(self):
        self.assertEqual(error_message(json.dumps({"errorMessages": [], "errors": {"jql": "Bad JQL"}})), "jql: Bad JQL")
        self.assertEqual(error_message(json.dumps({"message": "Not Found", "status": 404})), "Not Found")
        self.assertEqual(error_message("<html>502</html>"), "")
        self.assertEqual(error_message("[1]"), "")


class MattermostTest(unittest.TestCase):
    def test_server_version(self):
        http = RecordingHttp([({"X-Version-Id": "12.2.0.123.abc.true"}, {"status": "OK"}),
                              ({}, {"Version": "12.2.0", "BuildHash": "deadbeef"})])
        self.assertEqual(Mattermost("https://hub", "t", http).server_version(), ("12.2.0", "deadbeef"))

    def test_user_search_asks_for_up_to_100_users(self):
        http = RecordingHttp([({}, [{"username": "ann"}])])
        self.assertEqual(Mattermost("https://hub", "t", http).search_users("Ann Lee"), [{"username": "ann"}])
        self.assertEqual(http.calls[0][3], {"term": "Ann Lee", "allow_inactive": False, "limit": 100})

    def test_playbooks_close_item(self):
        http = RecordingHttp([({}, None)])
        Playbooks(Mattermost("https://hub", "t", http)).close_item("run1", 2, 5)
        self.assertEqual(http.calls[0], ("PUT", "/plugins/playbooks/api/v0/runs/run1/checklists/2/item/5/state",
                                         None, {"new_state": "closed"}))


if __name__ == "__main__":
    unittest.main()

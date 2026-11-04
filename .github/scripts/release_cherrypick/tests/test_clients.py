import unittest

from release_cherrypick.clients import GitHub, Http, Jira, TruncatedError
from release_cherrypick.tests.fakes import FakeGitHub, FakeJira, pull, ticket
from release_cherrypick.tests.test_labeller import V122, label_run


class RecordingHttp(Http):
    def __init__(self, responses):
        super().__init__("Test", "https://example", {})
        self.responses, self.calls = list(responses), []

    def request(self, method, path, params=None, body=None, retries=None):
        self.calls.append((method, path, params, body))
        return self.responses.pop(0)


def search_pages(total):
    return [{"total_count": total, "incomplete_results": False, "items": [{"number": s + n} for n in range(min(100, total - s))]}
            for s in range(0, total, 100)]


class SearchPrsTest(unittest.TestCase):
    def test_more_than_100_results_are_read_in_full(self):
        http = RecordingHttp(search_pages(230))
        self.assertEqual(len(GitHub("t", http=http).search_prs("q")), 230)
        self.assertEqual([c[2]["page"] for c in http.calls], [1, 2, 3])

    def test_results_past_the_1000_limit_are_an_error(self):
        with self.assertRaisesRegex(TruncatedError, "GitHub results truncated at 1000, can't confirm"):
            GitHub("t", http=RecordingHttp(search_pages(1400))).search_prs("q")

    def test_a_last_page_that_goes_over_a_smaller_limit_is_an_error(self):
        with self.assertRaisesRegex(TruncatedError, "GitHub results truncated at 175"):
            GitHub("t", http=RecordingHttp(search_pages(175))).search_prs("q", limit=150)

    def test_incomplete_results_are_an_error(self):
        http = RecordingHttp([{"total_count": 5, "incomplete_results": True, "items": [{}]}])
        with self.assertRaises(TruncatedError):
            GitHub("t", http=http).search_prs("q")


class JiraSearchTest(unittest.TestCase):
    def pages(self, total, size=50):
        return [{"issues": [{"key": f"MM-{s + n}"} for n in range(min(size, total - s))], "nextPageToken": f"t{s}",
                 "isLast": s + size >= total} for s in range(0, total, size)]

    def test_more_than_50_issues_are_read_across_pages(self):
        issues = Jira("https://jira", "e", "t", RecordingHttp(self.pages(120))).search("project = MM", ["summary"])
        self.assertEqual(len(issues), 120)

    def test_a_final_page_that_goes_over_the_limit_is_an_error(self):
        pages = [{"issues": [{"key": "a"}] * 100, "nextPageToken": "t", "isLast": False},
                 {"issues": [{"key": "b"}] * 75, "isLast": True}]
        with self.assertRaisesRegex(TruncatedError, "Jira results truncated at 175"):
            Jira("https://jira", "e", "t", RecordingHttp(pages)).search("project = MM", ["summary"], limit=150)

    def test_over_the_limit_is_an_error(self):
        with self.assertRaisesRegex(TruncatedError, "Jira results truncated at 100, can't confirm"):
            Jira("https://jira", "e", "t", RecordingHttp(self.pages(300))).search("project = MM", ["summary"], limit=100)


class TruncationInARunTest(unittest.TestCase):
    def test_a_ticket_whose_pr_search_is_cut_short_is_an_error_not_unlabelled_quietly(self):
        jira = FakeJira([ticket("MM-1", status="Submitted", fix_versions=[V122.name])])
        github = FakeGitHub()

        def cut_short(query, limit=1000):
            raise TruncatedError("GitHub", 1000)
        github.search_prs = cut_short
        report = label_run(jira, github, live=False)
        self.assertEqual(report.errors, ["MM-1: GitHub results truncated at 1000, can't confirm"])
        self.assertEqual(report.changes, [])


if __name__ == "__main__":
    unittest.main()

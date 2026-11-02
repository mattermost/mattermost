import json
import unittest

from release_docs.github import GitHub


class Response:
    def __init__(self, body):
        self.body = json.dumps(body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self.body


class TokensAndCommitter(unittest.TestCase):
    def client(self, **kwargs):
        self.requests = []

        def opener(request, timeout):
            self.requests.append(request)
            return Response({"tree": {"sha": "t"}, "sha": "s"})

        return GitHub("read-token", opener=opener, **kwargs)

    def test_reads_use_the_read_token_and_writes_the_write_token(self):
        gh = self.client(write_token="write-token")
        gh.request("GET", "/repos/o/r/pulls")
        gh.request("POST", "/repos/o/r/issues/1/labels", {"labels": ["x"]})
        self.assertEqual([r.get_header("Authorization") for r in self.requests],
                         ["Bearer read-token", "Bearer write-token"])

    def test_commits_are_authored_and_committed_by_the_configured_identity(self):
        who = {"name": "Changelog Bot", "email": "bot@example.com"}
        gh = self.client(write_token="write-token", committer=who)
        gh.commit_files("o/r", "branch", "parent", {"a.md": "text"}, "message")
        [commit] = [json.loads(r.data) for r in self.requests if r.full_url.endswith("/git/commits")]
        self.assertEqual((commit["author"], commit["committer"]), (who, who))


if __name__ == "__main__":
    unittest.main()

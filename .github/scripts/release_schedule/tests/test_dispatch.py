"""The milestone dispatcher."""

import contextlib
import io
import os
import unittest
from datetime import date
from unittest import mock

from release_schedule import api, dispatch, schedule


class DispatchTest(unittest.TestCase):
    def setUp(self):
        self.sched = schedule.load()
        self.calls = []

    def request(self, method, url, token, body=None):
        self.calls.append((method, url, token, body))

    def run_main(self, *args, env=None):
        env = {"GITHUB_TOKEN": "t", "GITHUB_REPOSITORY": "mattermost/mattermost"} if env is None else env
        with mock.patch.dict(os.environ, env, clear=True), \
                contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
            code = dispatch.main(list(args), request=self.request)
        return code, out.getvalue(), err.getvalue()

    def test_payloads_only_for_automated_releases(self):
        # Nov 10: v12.1's Cloud Freemium & Professional release (before automate_from) and v12.2's branch cut.
        self.assertEqual(dispatch.payloads(self.sched, date(2026, 11, 10)),
                         [{"version": "v12.2", "milestone": "branch_cut", "date": "2026-11-10"}])

    def test_dispatches_each_milestone(self):
        # Dec 10, 2026: v12.2's two cloud releases (moved off a Friday) and v12.3's branch cut.
        code, out, _ = self.run_main("--date", "2026-12-10")
        self.assertEqual(code, 0)
        self.assertEqual([c[3]["client_payload"] for c in self.calls], [
            {"version": "v12.2", "milestone": "cloud_freemium_professional", "date": "2026-12-10"},
            {"version": "v12.2", "milestone": "cloud_enterprise", "date": "2026-12-10"},
            {"version": "v12.3", "milestone": "branch_cut", "date": "2026-12-10"},
        ])
        self.assertEqual({(c[0], c[1], c[2], c[3]["event_type"]) for c in self.calls},
                         {("POST", "https://api.github.com/repos/mattermost/mattermost/dispatches", "t",
                           "release-milestone")})
        self.assertIn("Dispatched release-milestone: v12.3 branch_cut (2026-12-10)", out)

    def test_quiet_day(self):
        code, out, _ = self.run_main("--date", "2026-12-12")
        self.assertEqual((code, self.calls), (0, []))
        self.assertIn("No milestones on 2026-12-12", out)

    def test_dry_run(self):
        code, out, _ = self.run_main("--date", "2026-12-16", "--dry-run", env={})
        self.assertEqual((code, self.calls), (0, []))
        self.assertIn("would dispatch release-milestone: v12.2 release_day (2026-12-16)", out)

    def test_needs_a_token(self):
        code, _, err = self.run_main("--date", "2026-12-16", env={})
        self.assertEqual(code, 1)
        self.assertIn("GITHUB_TOKEN", err)

    def test_reports_failures(self):
        def failing(method, url, token, body=None):
            raise api.APIError(method, url, 403, "Resource not accessible by integration")
        self.request = failing
        code, _, err = self.run_main("--date", "2026-12-16")
        self.assertEqual(code, 1)
        self.assertIn("403", err)

    def test_warns_when_the_schedule_runs_out(self):
        _, out, _ = self.run_main("--date", "2031-01-02", "--dry-run")
        self.assertIn("::warning::", out)


class RequestTest(unittest.TestCase):
    def test_retries_server_errors(self):
        import urllib.error
        attempts = []

        def urlopen(req, timeout):
            attempts.append(req.get_method())
            raise urllib.error.HTTPError(req.full_url, 503, "busy", {}, io.BytesIO(b"busy"))

        with mock.patch("urllib.request.urlopen", urlopen), self.assertRaises(api.APIError) as caught:
            api.request("POST", "https://example.com/x", "t", {"a": 1}, sleep=lambda s: None)
        self.assertEqual(len(attempts), 5)
        self.assertEqual(caught.exception.status, 503)

    def test_retries_google_rate_limits_but_not_other_403s(self):
        import urllib.error
        for body, expected in [(b'{"error": {"errors": [{"reason": "rateLimitExceeded"}]}}', 5),
                               (b'{"error": {"errors": [{"reason": "forbidden"}]}}', 1)]:
            attempts = []

            def urlopen(req, timeout):
                attempts.append(1)
                raise urllib.error.HTTPError(req.full_url, 403, "no", {}, io.BytesIO(body))

            with mock.patch("urllib.request.urlopen", urlopen), self.assertRaises(api.APIError):
                api.request("POST", "https://example.com/x", "t", {}, sleep=lambda s: None)
            self.assertEqual(len(attempts), expected)


if __name__ == "__main__":
    unittest.main()

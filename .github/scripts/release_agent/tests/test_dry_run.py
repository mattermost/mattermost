"""--as-of and --no-post: a dry run against real data that writes nothing anywhere."""

import json
import os
import re
import tempfile
import unittest
from argparse import Namespace
from datetime import date
from pathlib import Path
from unittest import mock

from release_agent import __main__ as cli
from release_agent import agent, preview
from release_agent.clients import Community, Http, Mattermost, Playbooks, ServiceError
from release_agent.tests import test_agent
from release_agent.tests.fakes import FakeHub, checklist_run

TEST_ENV = {"RELEASE_AGENT_MODE": "test", "TEST_CHANNEL_ID": "test-chan", "TESTING_ALERTS_CHANNEL_ID": "alerts",
            "HOLIDAYS_PAGE_ID": "page9", "INPUT_RELEASE": "", "INPUT_MODE": ""}


class GetOnlyHttp(Http):
    """A Hub or Community server that answers reads, and records every request's method."""

    def __init__(self, service, run=None):
        super().__init__(service, f"https://{service.lower()}.example", {})
        self.methods, self.run = [], run

    def request(self, method, path, params=None, body=None, retries=None):
        self.methods.append((method, path))
        if path == "/api/v4/users/me":
            return {}, {"id": "bot", "username": "release-agent"}
        if path == "/api/v4/users/me/channels":
            return {}, [{"id": "c122", "display_name": "Release: v12.2"}]
        if path == "/plugins/playbooks/api/v0/runs":
            return {}, {"items": [self.run] if self.run else [], "has_more": False}
        if path.startswith("/plugins/playbooks/api/v0/runs/"):
            return {}, self.run
        if path.startswith("/api/v4/users/username/") or re.fullmatch(r"/api/v4/users/[^/]+", path):
            raise ServiceError(self.service, 404)
        if path == "/api/v4/system/ping":
            return {"X-Version-Id": "12.2.0.123"}, {}
        if path == "/api/v4/users/autocomplete":
            return {}, {"users": []}
        if path.endswith("/posts") or path.endswith("/thread"):
            return {}, {"posts": {}, "order": []}
        if path.endswith("/reactions"):
            return {}, []
        return {}, {}


def run_args(out_dir, as_of=None, no_post=False):
    return Namespace(out_dir=out_dir, as_of=as_of, no_post=no_post)


class OptionsTest(unittest.TestCase):
    def test_refused_in_live_mode(self):
        for args in (run_args("x", as_of="2026-11-24"), run_args("x", no_post=True)):
            with self.assertRaisesRegex(ValueError, "test mode only"):
                cli.dry_run_options(args, "live")

    def test_no_post_is_refused_in_actions_whose_artifact_is_public(self):
        with mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}):
            with self.assertRaisesRegex(ValueError, "public artifact"):
                cli.dry_run_options(run_args("x", no_post=True), "test")

    def test_as_of_sets_today(self):
        today, previewed = cli.dry_run_options(run_args("x", as_of="2026-11-24"), "test")
        self.assertEqual((today, previewed), (date(2026, 11, 24), None))
        with self.assertRaises(ValueError):
            cli.dry_run_options(run_args("x", as_of="24/11/2026"), "test")

    def test_the_options_parse(self):
        with mock.patch.object(cli, "command_run", side_effect=lambda args: (args.as_of, args.no_post)) as run:
            self.assertEqual(cli.main(["run", "--out-dir", "o", "--as-of", "2026-11-24", "--no-post"]), ("2026-11-24", True))
            run.assert_called_once()


class WrapperTest(unittest.TestCase):
    def test_writes_go_to_the_preview_and_reads_to_hub(self):
        hub, previewed = FakeHub(), preview.Preview()
        hub.users = [{"username": "ann", "first_name": "Ann", "last_name": "Lee"}]
        wrapped = preview.PreviewHub(hub, previewed)
        post = wrapped.create_post("chan", "Hello @ann", {"k": "v"})
        wrapped.create_post("chan", "A reply", root_id=post["id"])
        wrapped.patch_post(post["id"], "Edited", {})
        preview.PreviewPlaybooks(hub, previewed).close_item("run1", 2, 5)
        self.assertEqual((hub.created, hub.patched, hub.closed), ([], [], []))
        self.assertEqual([kind for kind, _, _ in previewed.writes], ["Post", "Reply", "Edit", "Tick"])
        self.assertEqual(wrapped.user_by_username("ann")["first_name"], "Ann")  # reads still reach Hub
        text = previewed.markdown()
        self.assertIn("## 1. Post\n\nChannel `chan`\n\n````markdown\nHello @ann\n````", text)
        self.assertIn("## 4. Tick\n\nRun `run1`, checklist 2, item 5", text)


class NoPostRunTest(unittest.TestCase):
    def test_a_no_post_run_makes_no_non_get_request_to_hub_or_community(self):
        run = checklist_run("run122", "Release: v12.2", "c122", test_agent.template_items())
        run["owner_user_id"] = "owner"
        hub_http, community_http = GetOnlyHttp("Hub", run), GetOnlyHttp("Community")
        hub = Mattermost("https://hub.example", "t", hub_http)
        svc = test_agent.services()
        svc = agent.replace(svc, hub=hub, playbooks=Playbooks(hub),
                            community=Community("https://community.example", "t", community_http))
        env = {**TEST_ENV, "PERF_CHANNEL_ID": "perf", "RC_ANNOUNCE_CHANNEL_ID": "rc"}
        with tempfile.TemporaryDirectory() as out, mock.patch.dict(os.environ, env), \
                mock.patch.object(cli, "services_from_env", return_value=svc), \
                mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "", "GITHUB_STEP_SUMMARY": ""}):
            self.assertEqual(cli.command_run(run_args(out, as_of="2026-11-05", no_post=True)), 0)
            body = json.loads((Path(out) / "run.json").read_text())
            previewed = (Path(out) / "preview.md").read_text()
        self.assertEqual({method for method, _ in hub_http.methods}, {"GET"})
        self.assertEqual({method for method, _ in community_http.methods}, {"GET"})
        self.assertTrue(any(path.endswith("/posts") for _, path in community_http.methods))  # Community was read
        self.assertEqual((body["date"], body["mode"], body["preview"]), ("2026-11-05", "test", True))
        self.assertIn("## 1. Post\n\nChannel `test-chan`", previewed)  # the status post, in the test channel
        self.assertIn("release status", previewed)
        self.assertEqual(body["releases"][0]["ticked"], [])

    def test_without_no_post_nothing_is_previewed(self):
        svc = test_agent.services()
        with tempfile.TemporaryDirectory() as out, mock.patch.dict(os.environ, TEST_ENV), \
                mock.patch.object(cli, "services_from_env", return_value=svc), \
                mock.patch.dict(os.environ, {"GITHUB_ACTIONS": "", "GITHUB_STEP_SUMMARY": ""}):
            self.assertEqual(cli.command_run(run_args(out, as_of="2026-11-05")), 0)
            self.assertFalse((Path(out) / "preview.md").exists())
        self.assertEqual({p["channel_id"] for p in svc.hub.created}, {"test-chan"})


if __name__ == "__main__":
    unittest.main()

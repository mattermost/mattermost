import base64
import json
import os
import re
import tempfile
import unittest
import urllib.parse
from datetime import date, datetime, timezone
from pathlib import Path
from unittest import mock

import changelog_automation as ca

VERSION = "v12.2.0"
FILE = "docs/main/product-overview/mattermost-v12-changelog.mdx"
SRC = "mattermost/mattermost#101"
GOOD = "Fixed an issue where the sidebar kept collapsing after switching teams."
CHANGELOG = f"""## Release v12.3 - Feature Release

**Release day: 2026-12-16**

## Release v12.2 - Feature Release

**Release day: November 16, 2026**

### Improvements

#### User Interface
 - Updated sidebar.
 - {GOOD}

### Upgrade Impact

#### Database Schema Changes
 - Added the ``Foo`` table.

## Release v12.1 - Feature Release

 - Updated sidebar.
"""
REPORT = {
    "version": VERSION,
    "sections": [{"section": "Improvements", "subsection": "User Interface", "items": [
        {"text": "Updated sidebar.", "sources": [SRC]}, {"text": GOOD, "sources": ["mattermost/mattermost#102"]}]}],
    "readiness": {"note_quality": [{"source": SRC, "title": "t", "reason": "under 6 words", "excerpt": "Updated sidebar."}],
                  "preflight": [{"check": "Go version", "status": "pass", "detail": "x", "remedy": "", "blocking": False}],
                  "gaps": [{"section": "Benchmarking", "status": "ready", "detail": "x"}],
                  "notes": {"missing": 1}, "missing_by_owner": [{"owner": "amy", "sources": ["mattermost/mattermost#7"]}]},
    "metrics": {},
}


class FakeApi:
    def __init__(self):
        self.routes, self.calls = {}, []

    def _route(self, method, path, payload):
        self.calls.append((method, path, payload))
        route = self.routes.get((method, path))
        if route is None:
            raise ca.ApiError(404)
        return route(payload) if callable(route) else route

    def get(self, path, **params):
        return self._route("GET", path, params)

    def paginate(self, path, **params):
        return self._route("GET", path, params) or []

    def post(self, path, body):
        return self._route("POST", path, body)

    def put(self, path, body=None):
        return self._route("PUT", path, body)

    def delete(self, path):
        return self._route("DELETE", path, None)

    def graphql(self, query, variables):
        return self._route("POST", "graphql", variables)

    def calls_to(self, method, path):
        return [c for c in self.calls if c[0] == method and c[1] == path]


def source_api():
    api = FakeApi()
    api.routes[("GET", "/repos/mattermost/mattermost/pulls/101")] = {"title": "Sidebar collapses after a team switch", "body": "The sidebar state was not reset when switching teams."}
    api.routes[("GET", "/repos/mattermost/mattermost/pulls/101/files")] = [{"filename": "sidebar.tsx", "additions": 4, "deletions": 1}]
    return api


def comments_api(existing=()):
    """A PR's review comments: a posted comment is kept, as GitHub would list it afterwards."""
    api = FakeApi()
    comments = list(existing)
    api.routes[("GET", "/repos/mattermost/mattermost/pulls/50/comments")] = comments

    def post(body):
        comments.append({"id": 900 + len(comments), "user": {"type": "Bot", "login": "x[bot]"}, "body": body["body"]})
        return {"id": comments[-1]["id"]}
    api.routes[("POST", "/repos/mattermost/mattermost/pulls/50/comments")] = post
    api.routes[("POST", "graphql")] = {"repository": {"pullRequest": {"reviewThreads": {"nodes": []}}}}
    return api


def rewrite(facts, text, reason):
    return "Fixed an issue where the sidebar kept its collapsed state after switching teams."


class SuggestionTest(unittest.TestCase):
    def suggest(self, api, report=REPORT, content=CHANGELOG, rewriter=rewrite):
        return ca.suggest_rewrites(api, source_api(), 50, "headsha", content, report, VERSION, rewriter)

    def test_a_weak_bullet_gets_one_suggestion_on_its_line(self):
        api = comments_api()
        result = self.suggest(api)
        self.assertEqual((result["posted"], result["suggestions_made"], result["suggestions_pending"]), (1, 1, 1))
        (_, _, body), = api.calls_to("POST", "/repos/mattermost/mattermost/pulls/50/comments")
        self.assertEqual((body["path"], body["line"], body["side"], body["commit_id"]), (FILE, 12, "RIGHT", "headsha"))
        self.assertIn("```suggestion\n - Fixed an issue where the sidebar kept its collapsed state after switching teams.\n```", body["body"])
        self.assertIn(ca.SUGGESTION_MARKER.format(source=SRC), body["body"])
        self.assertIn("Based on mattermost/mattermost#101: its title, description and a summary of the 1 file(s) it changes.", body["body"])
        self.assertIn("This note is under 6 words", body["body"])

    def test_a_bullet_with_a_suggestion_already_is_not_suggested_again(self):
        existing = [{"id": 1, "user": {"type": "Bot", "login": "x[bot]"}, "body": ca.suggestion_comment(SRC, "r", " - Old.", "b")}]
        api = comments_api(existing)
        result = self.suggest(api)
        self.assertEqual(result["posted"], 0)
        self.assertEqual(api.calls_to("POST", "/repos/mattermost/mattermost/pulls/50/comments"), [])

    def test_a_source_in_a_private_repo_gets_no_rewrite(self):
        report = {**REPORT, "sections": [{"section": "Improvements", "subsection": "User Interface", "items": [
            {"text": "Updated sidebar.", "sources": ["mattermost/enterprise#5"]}]}],
            "readiness": {**REPORT["readiness"], "note_quality": [
                {"source": "mattermost/enterprise#5", "title": "t", "reason": "under 6 words", "excerpt": "x"}]}}
        asked = []
        api = comments_api()
        result = self.suggest(api, report, rewriter=lambda *a: asked.append(a) or rewrite(*a))
        self.assertEqual((result["posted"], result["skipped"], asked), (0, 1, []))
        self.assertEqual(api.calls_to("POST", "/repos/mattermost/mattermost/pulls/50/comments"), [])

    def test_a_private_repo_pr_is_not_named_in_the_public_comment(self):
        facts = {"source": "mattermost/enterprise#9", "title": "t", "body": "b", "files": [], "file_count": 0}
        self.assertEqual(ca.basis_sentence(facts), "Based on a PR in a private repo: its title and description.")

    def test_a_marker_in_a_persons_comment_does_not_count(self):
        existing = [{"id": 1, "user": {"type": "User", "login": "amy"}, "body": ca.suggestion_comment(SRC, "r", " - x.", "b")}]
        self.assertEqual(self.suggest(comments_api(existing))["posted"], 1)

    def test_bullets_that_are_not_flagged_get_nothing(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "note_quality": []}}
        api = comments_api()
        result = self.suggest(api, report)
        self.assertEqual(result["posted"], 0)
        self.assertEqual(api.calls_to("POST", "/repos/mattermost/mattermost/pulls/50/comments"), [])

    def test_a_bullet_edited_since_is_left_alone(self):
        api = comments_api()
        self.assertEqual(self.suggest(api, content=CHANGELOG.replace("Updated sidebar.", "Reworded by a reviewer."))["posted"], 0)

    def test_the_other_releases_bullet_with_the_same_text_is_not_commented(self):
        lines = ca.weak_bullets(REPORT, CHANGELOG, VERSION)
        self.assertEqual([b["line"] for b in lines], [12])

    def test_a_weak_bullet_whose_text_is_on_two_bullets_is_left_alone(self):
        twice = CHANGELOG.replace(" - Added the ``Foo`` table.", " - Updated sidebar.", 1)
        self.assertEqual(ca.weak_bullets(REPORT, twice, VERSION), [])

    def test_an_unusable_rewrite_posts_nothing(self):
        for bad in ("", "Too short.", "Ping @here about the fix to the sidebar state please.", "```x``` " + "word " * 8,
                    "MM-123"):
            api = comments_api()
            self.assertEqual(self.suggest(api, rewriter=lambda *a, bad=bad: bad)["posted"], 0, bad)

    def test_a_new_link_or_html_in_a_rewrite_is_refused(self):
        original = "Layout. [Docs](https://docs.mattermost.com/x)"
        for bad in ("Added the new sidebar layout, see https://evil.example for every team member.",
                    "Added the new sidebar layout for every team [member](https://evil.example) today.",
                    "Added the new sidebar layout for <b>every</b> team member today.",
                    "Added the new sidebar layout for every team member, see www.evil.example now."):
            self.assertIsNone(ca.clean_rewrite(bad, original), bad)
        kept = "Added the new sidebar layout for every team member. [Docs](https://docs.mattermost.com/x)"
        self.assertEqual(ca.clean_rewrite(kept, original), kept)  # the original's link inline is fine

    def test_one_source_that_cannot_be_read_does_not_stop_the_others(self):
        report = {**REPORT, "sections": [{"section": "Improvements", "subsection": "User Interface", "items": [
            {"text": "Updated sidebar.", "sources": [SRC]}, {"text": GOOD, "sources": ["mattermost/mattermost#102"]}]}],
            "readiness": {**REPORT["readiness"], "note_quality": [
                {"source": "mattermost/mattermost#102", "title": "t", "reason": "r", "excerpt": "x"},
                {"source": SRC, "title": "t", "reason": "under 6 words", "excerpt": "x"}]}}
        # #101 is readable through source_api(); #102 is a 404 there.
        api = comments_api()
        result = self.suggest(api, report)
        self.assertEqual((result["posted"], result["skipped"]), (1, 1))
        (_, _, body), = api.calls_to("POST", "/repos/mattermost/mattermost/pulls/50/comments")
        self.assertEqual(body["line"], 12)

    def test_a_rewrite_that_raises_is_skipped_too(self):
        def boom(*args):
            raise RuntimeError("overloaded")
        result = self.suggest(comments_api(), rewriter=boom)
        self.assertEqual((result["posted"], result["skipped"]), (0, 1))

    def test_links_on_the_original_bullet_are_kept(self):
        text = ca.clean_rewrite("Added the new sidebar layout for every team member.", "Layout. [Docs](https://docs.mattermost.com/x)")
        self.assertEqual(text, "Added the new sidebar layout for every team member. [Docs](https://docs.mattermost.com/x)")

    def test_a_suggestion_is_accepted_only_when_its_bullet_changed(self):
        def comment(id_, source, line, original):
            return {"id": id_, "user": {"type": "Bot", "login": "x[bot]"},
                    "body": ca.suggestion_comment(source, "r", line, "b", original)}
        api = comments_api([
            comment(1, "a#1", f" - {GOOD}", " - Updated sidebar."),   # rewrite taken, original gone from... (still there)
            comment(2, "a#2", " - Fixed the sidebar after a team switch.", " - Gone bullet."),  # not in entry
            comment(3, "a#3", f" - {GOOD}", " - Not in the entry.")])  # suggested line present, original gone
        metrics = ca.suggestion_metrics(api, ca.REPO, 50, CHANGELOG, VERSION)
        # 1: the suggested line is in the entry but so is the original, so it stays pending (a rewrite
        # that copies another bullet isn't an acceptance); 3 is accepted; 2 is pending.
        self.assertEqual((metrics["suggestions_made"], metrics["suggestions_accepted"], metrics["suggestions_pending"]), (3, 1, 2))

    def test_resolved_threads_are_read_across_pages(self):
        api = FakeApi()

        def threads(variables):
            if variables["cursor"] is None:
                return {"repository": {"pullRequest": {"reviewThreads": {"pageInfo": {"hasNextPage": True, "endCursor": "c1"},
                        "nodes": [{"isResolved": True, "comments": {"nodes": [{"databaseId": 1}]}}]}}}}
            return {"repository": {"pullRequest": {"reviewThreads": {"pageInfo": {"hasNextPage": False},
                    "nodes": [{"isResolved": True, "comments": {"nodes": [{"databaseId": 2}]}},
                              {"isResolved": False, "comments": {"nodes": [{"databaseId": 3}]}}]}}}}
        api.routes[("POST", "graphql")] = threads
        self.assertEqual(ca.resolved_comment_ids(api, ca.REPO, 50), {1, 2})

    def test_accepted_dismissed_and_pending_are_counted(self):
        def comment(id_, line):
            return {"id": id_, "user": {"type": "Bot", "login": "x[bot]"}, "body": ca.suggestion_comment(f"mattermost/mattermost#{id_}", "r", line, "b")}
        api = comments_api([comment(1, f" - {GOOD}"), comment(2, " - A rewrite nobody took."), comment(3, " - Another not taken.")])
        api.routes[("POST", "graphql")] = {"repository": {"pullRequest": {"reviewThreads": {"nodes": [
            {"isResolved": True, "comments": {"nodes": [{"databaseId": 2}]}},
            {"isResolved": False, "comments": {"nodes": [{"databaseId": 3}]}}]}}}}
        self.assertEqual(ca.suggestion_metrics(api, ca.REPO, 50, CHANGELOG, VERSION), {
            "suggestions_made": 3, "suggestions_accepted": 1, "suggestions_dismissed": 1, "suggestions_pending": 1})


class ReadyTest(unittest.TestCase):
    def api(self, rc1="2026-11-02T12:00:00Z", ready_events=()):
        api = FakeApi()
        api.routes[("GET", "/repos/mattermost/mattermost/commits/v12.2.0-rc1")] = {"commit": {"committer": {"date": rc1}}}
        api.routes[("GET", "/repos/mattermost/mattermost/issues/50/events")] = [{"event": e} for e in ready_events]
        return api

    def decide(self, api, today=date(2026, 11, 3), report=REPORT, draft=True, event="schedule", mode="auto"):
        return ca.decide_ready(api, VERSION, {"number": 50, "draft": draft}, report, today, event, mode)

    def test_ready_the_working_day_after_rc1(self):
        ready, why = self.decide(self.api())
        self.assertTrue(ready, why)

    def test_not_before_rc1_plus_one_working_day(self):
        ready, why = self.decide(self.api(), today=date(2026, 11, 2))
        self.assertEqual((ready, why), (False, "it is marked ready from 2026-11-03"))

    def test_the_friday_rc1_is_ready_on_monday(self):
        api = self.api(rc1="2026-10-30T12:00:00Z")
        self.assertFalse(self.decide(api, today=date(2026, 10, 31))[0])
        self.assertTrue(self.decide(api, today=date(2026, 11, 2))[0])

    def test_no_rc1_tag_no_ready(self):
        api = FakeApi()
        api.routes[("GET", "/repos/mattermost/mattermost/issues/50/events")] = []
        self.assertEqual(self.decide(api), (False, "v12.2.0-rc1 is not tagged"))

    def test_a_blocking_preflight_failure_stops_it(self):
        report = {"readiness": {"preflight": [{"check": "x.mdx", "status": "fail", "detail": "d", "blocking": True}]}}
        self.assertEqual(self.decide(self.api(), report=report), (False, "1 blocking preflight failure(s)"))
        soft = {"readiness": {"preflight": [{"check": "Go", "status": "fail", "detail": "d", "blocking": False}]}}
        self.assertTrue(self.decide(self.api(), report=soft)[0])

    def test_only_the_first_time(self):
        self.assertFalse(self.decide(self.api(ready_events=["labeled", "ready_for_review"]))[0])
        self.assertFalse(self.decide(self.api(), draft=False)[0])

    def test_only_scheduled_auto_runs(self):
        self.assertFalse(self.decide(self.api(), event="workflow_dispatch")[0])
        self.assertFalse(self.decide(self.api(), mode="dry_run")[0])

    def test_reviewers_are_requested_again_when_nobody_is_asked(self):
        api = self.api(ready_events=["ready_for_review"])
        api.routes[("GET", "/repos/mattermost/mattermost/pulls/50/reviews")] = []
        pull = {"number": 50, "draft": False, "requested_reviewers": [], "requested_teams": []}
        self.assertTrue(ca.reviewers_missing(api, pull, "schedule", "auto"))
        self.assertFalse(ca.reviewers_missing(api, {**pull, "requested_teams": [{"slug": "docs"}]}, "schedule", "auto"))
        api.routes[("GET", "/repos/mattermost/mattermost/pulls/50/reviews")] = [{"state": "COMMENTED"}]
        self.assertFalse(ca.reviewers_missing(api, pull, "schedule", "auto"))
        self.assertFalse(ca.reviewers_missing(self.api(), pull, "schedule", "auto"))  # never marked ready by the run
        # A bot's review (CodeRabbit, Cursor) isn't one of the people asked: the request is still retried.
        api.routes[("GET", "/repos/mattermost/mattermost/pulls/50/reviews")] = [
            {"state": "COMMENTED", "user": {"login": "coderabbitai[bot]", "type": "Bot"}}]
        self.assertTrue(ca.reviewers_missing(api, pull, "schedule", "auto"))

    def test_reviewers_are_the_section_reviewers_plus_the_default(self):
        names = ca.reviewers_to_request(CHANGELOG, VERSION, {"Upgrade Impact/*": ["org/db"], "Improvements": "ui-lead"}, "amy, ui-lead  bob")
        self.assertEqual(names, ["org/db", "ui-lead", "amy", "bob"])

class FakeLabels(FakeApi):
    """Labels and label events on source PRs, changed by the calls the module makes."""

    def __init__(self, labels=None, events=None, refuse=()):
        super().__init__()
        self.labels = {source: list(found) for source, found in (labels or {}).items()}
        self.events = {source: list(found) for source, found in (events or {}).items()}
        self.refuse = set(refuse)

    def _route(self, method, path, payload):
        match = re.match(r"^/repos/([^/]+/[^/]+)/issues/(\d+)/(labels|events)(?:/(.+))?$", path)
        if not match:
            return super()._route(method, path, payload)
        self.calls.append((method, path, payload))
        source = f"{match.group(1)}#{match.group(2)}"
        if match.group(1) in self.refuse and method != "GET":
            raise ca.ApiError(403)
        if match.group(3) == "events":
            return self.events.get(source, [])
        labels = self.labels.setdefault(source, [])
        if method == "POST":
            for name in payload["labels"]:
                labels.append(name)
                self.events.setdefault(source, []).append({"event": "labeled", "label": {"name": name}, "actor": {"login": "changelog-app[bot]"}})
        elif method == "DELETE":
            labels.remove(urllib.parse.unquote(match.group(4)))
        return [{"name": name} for name in labels]

    def added(self):
        return [(path, body["labels"]) for method, path, body in self.calls if method == "POST"]


ENT = "mattermost/enterprise#9"
LABEL_REPORT = {
    "version": VERSION,
    "sources_included": [SRC, "mattermost/mattermost#102", ENT, "derived:websocket:foo"],
    "sections": REPORT["sections"],
    "prs_without_notes": [{"source": "mattermost/mattermost#7", "title": "No note, no label"},
                          {"source": "mattermost/mattermost#8", "title": "Wrote NONE"},
                          {"source": "mattermost/enterprise#10", "title": "Secret enterprise thing"}],
    "prs_flagged": [{"source": "mattermost/mattermost#7", "title": "No note, no label", "reason": "no release note"}],
}


class LabelTest(unittest.TestCase):
    def test_labels_are_added_once_and_a_rerun_adds_nothing(self):
        api = FakeLabels()
        result = ca.apply_labels(api, LABEL_REPORT, "auto")
        self.assertEqual(sorted(api.added()), sorted([
            ("/repos/mattermost/mattermost/issues/101/labels", ["Changelog/Done"]),
            ("/repos/mattermost/mattermost/issues/102/labels", ["Changelog/Done"]),
            ("/repos/mattermost/enterprise/issues/9/labels", ["Changelog/Done"]),
            ("/repos/mattermost/mattermost/issues/8/labels", ["Changelog/Not Needed"]),
            ("/repos/mattermost/enterprise/issues/10/labels", ["Changelog/Not Needed"])]))
        self.assertNotIn("mattermost/mattermost#7", api.labels)  # no note and no opt-out: the developer's to fix
        self.assertEqual(result["added"], {"mattermost/mattermost": {"Changelog/Done": 2, "Changelog/Not Needed": 1},
                                           "mattermost/enterprise": {"Changelog/Done": 1, "Changelog/Not Needed": 1}})
        api.calls.clear()
        again = ca.apply_labels(api, LABEL_REPORT, "auto")
        self.assertEqual(api.added(), [])
        self.assertEqual(again["already"], 5)

    def test_a_persons_label_is_kept_and_no_pr_gets_both(self):
        api = FakeLabels({SRC: ["Changelog/Not Needed"], "mattermost/mattermost#8": ["Changelog/Done"]})
        result = ca.apply_labels(api, LABEL_REPORT, "auto")
        self.assertEqual(api.labels[SRC], ["Changelog/Not Needed"])
        self.assertEqual(api.labels["mattermost/mattermost#8"], ["Changelog/Done"])
        self.assertEqual(result["kept"], 2)
        self.assertFalse(any(m == "DELETE" for m, _, _ in api.calls))

    def test_dry_run_and_regenerate_add_nothing(self):
        for mode in ("dry_run", "regenerate"):
            api = FakeLabels()
            result = ca.apply_labels(api, LABEL_REPORT, mode)
            self.assertEqual(api.calls, [])
            self.assertIn("auto runs only", ca.labels_summary(result))

    def test_an_enterprise_permission_failure_is_counted_and_listed_in_the_report_only(self):
        api = FakeLabels(refuse={"mattermost/enterprise"})
        result = ca.apply_labels(api, LABEL_REPORT, "auto")
        self.assertEqual([f["source"] for f in result["failed"]], [ENT, "mattermost/enterprise#10"])
        summary = ca.labels_summary(result)
        self.assertIn("- 2 PR(s) in mattermost/enterprise couldn't be labelled (listed in the run's sections.json "
                      "for the release status post).", summary)
        self.assertIn("- mattermost/mattermost: 2 Changelog/Done, 1 Changelog/Not Needed", summary)
        self.assertNotIn("enterprise#", summary)

    def test_no_enterprise_titles_in_the_summary(self):
        summary = ca.labels_summary(ca.apply_labels(FakeLabels(), LABEL_REPORT, "auto"))
        self.assertIn("- mattermost/enterprise: 1 Changelog/Done, 1 Changelog/Not Needed", summary)
        for private in ("Secret enterprise thing", "enterprise#9", "enterprise#10"):
            self.assertNotIn(private, summary)

    def test_the_label_command_records_the_result_in_sections_json(self):
        import json
        import os
        import tempfile
        from unittest import mock
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "sections.json"), "w") as f:
                json.dump(LABEL_REPORT, f)
            api = FakeLabels()
            with mock.patch.object(ca, "Api", return_value=api), mock.patch.object(ca, "_summary"):
                ca.cmd_label({"GH_TOKEN": "t", "MODE": "auto", "OUTPUT_DIR": directory})
            with open(os.path.join(directory, "sections.json")) as f:
                self.assertEqual(json.load(f)["labels"]["added"]["mattermost/enterprise"]["Changelog/Done"], 1)


MERGED = CHANGELOG.replace(" - Updated sidebar.\n - Fixed", " - Fixed", 1)  # a reviewer deleted #101's bullet


class ReconcileTest(unittest.TestCase):
    def reconcile(self, api, content=MERGED, suggestions=()):
        return ca.reconcile_labels(api, [REPORT], list(suggestions), content, VERSION, "changelog-app[bot]")

    def labelled_by(self, actor):
        return FakeLabels({SRC: ["Changelog/Done"], "mattermost/mattermost#102": ["Changelog/Done"]},
                          {SRC: [{"event": "labeled", "label": {"name": "Changelog/Done"}, "actor": {"login": actor}}]})

    def test_a_deleted_bullet_gets_done_swapped_for_not_needed(self):
        api = self.labelled_by("changelog-app[bot]")
        result = self.reconcile(api)
        self.assertEqual(api.labels[SRC], ["Changelog/Not Needed"])
        self.assertEqual(api.labels["mattermost/mattermost#102"], ["Changelog/Done"])  # its bullet is still there
        self.assertEqual(result["swapped"]["mattermost/mattermost"], 1)

    def test_done_added_by_a_person_is_kept(self):
        api = self.labelled_by("amy")
        result = self.reconcile(api)
        self.assertEqual(api.labels[SRC], ["Changelog/Done"])
        self.assertEqual(result["person"], 1)

    def test_an_edited_or_rewritten_bullet_is_not_deleted(self):
        edited = CHANGELOG.replace(" - Updated sidebar.\n - Fixed", " - Updated the sidebar.\n - Fixed", 1)
        api = self.labelled_by("changelog-app[bot]")
        self.reconcile(api, edited)
        rewritten = CHANGELOG.replace(" - Updated sidebar.\n - Fixed", " - Made the sidebar remember its width per team.\n - Fixed", 1)
        self.reconcile(api, rewritten, [{"source": SRC, "line": " - Made the sidebar remember its width per team."}])
        self.assertEqual(api.labels[SRC], ["Changelog/Done"])
        self.assertFalse(any(m == "DELETE" for m, _, _ in api.calls))

    def test_the_merge_job_reconciles_against_the_merged_entry(self):
        api = self.labelled_by("changelog-app[bot]")
        base = "/repos/mattermost/mattermost"
        api.routes[("GET", f"{base}/pulls")] = [{**pr(), "merged_at": "2026-11-16T10:00:00Z"}]
        api.routes[("GET", f"{base}/contents/{ca.urllib.parse.quote(FILE)}")] = {
            "encoding": "base64", "content": base64.b64encode(MERGED.encode()).decode()}
        api.routes[("GET", f"{base}/pulls/50/comments")] = []
        summary = ca.merge_labels(api, VERSION, [REPORT], "changelog-app[bot]")
        self.assertEqual(api.labels[SRC], ["Changelog/Not Needed"])
        self.assertIn("mattermost/mattermost: 1, mattermost/enterprise: 0", summary)

    def test_the_label_swap_uses_the_labels_token_and_reads_the_entry_with_the_repo_token(self):
        repo_api, label_api = FakeApi(), self.labelled_by("changelog-app[bot]")
        base = "/repos/mattermost/mattermost"
        repo_api.routes[("GET", f"{base}/pulls")] = [{**pr(), "merged_at": "2026-11-16T10:00:00Z"}]
        repo_api.routes[("GET", f"{base}/contents/{ca.urllib.parse.quote(FILE)}")] = {
            "encoding": "base64", "content": base64.b64encode(MERGED.encode()).decode()}
        repo_api.routes[("GET", f"{base}/pulls/50/comments")] = []
        ca.merge_labels(repo_api, VERSION, [REPORT], "changelog-app[bot]", label_api)
        self.assertEqual(label_api.labels[SRC], ["Changelog/Not Needed"])
        self.assertFalse([c for c in repo_api.calls if "/issues/" in c[1]])  # no label call with the repo token
        self.assertFalse([c for c in label_api.calls if "/contents/" in c[1] or c[1].endswith("/pulls")])

    def test_a_swap_that_failed_half_way_is_finished_next_time(self):
        api = self.labelled_by("changelog-app[bot]")
        api.labels[SRC].append("Changelog/Not Needed")  # added, then removing Done failed
        result = self.reconcile(api)
        self.assertEqual(api.labels[SRC], ["Changelog/Not Needed"])
        self.assertEqual(result["swapped"]["mattermost/mattermost"], 1)

    def test_not_needed_is_added_before_done_is_removed(self):
        api = self.labelled_by("changelog-app[bot]")
        self.reconcile(api)
        writes = [(m, p) for m, p, _ in api.calls if m in ("POST", "DELETE") and "/issues/101/" in p]
        self.assertEqual([m for m, _ in writes], ["POST", "DELETE"])

    def test_an_unreadable_merged_entry_deletes_nothing(self):
        api = self.labelled_by("changelog-app[bot]")
        api.routes[("GET", "/repos/mattermost/mattermost/pulls")] = [{**pr(), "merged_at": "2026-11-16T10:00:00Z"}]
        api.routes[("GET", "/repos/mattermost/mattermost/pulls/50/comments")] = []
        summary = ca.merge_labels(api, VERSION, [REPORT], "changelog-app[bot]")  # the contents read is a 404
        self.assertIn("couldn't be read", summary)
        self.assertEqual(api.labels[SRC], ["Changelog/Done"])

    def test_the_merged_entry_is_read_at_the_merge_commit(self):
        api = self.labelled_by("changelog-app[bot]")
        base = "/repos/mattermost/mattermost"
        api.routes[("GET", f"{base}/pulls")] = [{**pr(), "merged_at": "2026-11-16T10:00:00Z", "merge_commit_sha": "m1"}]
        api.routes[("GET", f"{base}/pulls/50/comments")] = []
        refs = []

        def contents(params):
            refs.append(params["ref"])
            return {"encoding": "base64", "content": base64.b64encode(MERGED.encode()).decode()}
        api.routes[("GET", f"{base}/contents/{ca.urllib.parse.quote(FILE)}")] = contents
        ca.merge_labels(api, VERSION, [REPORT], "changelog-app[bot]")
        self.assertEqual(refs, ["m1"])

    def test_reconciled_only_once_the_pr_is_merged(self):
        api = self.labelled_by("changelog-app[bot]")
        api.routes[("GET", "/repos/mattermost/mattermost/pulls")] = [{"number": 49, "merged_at": None}]
        self.assertEqual(ca.merge_labels(api, VERSION, [REPORT], "changelog-app[bot]"),
                         "Changelog labels are reconciled once the changelog PR is merged.")
        self.assertEqual(api.labels[SRC], ["Changelog/Done"])


class FetchReportTest(unittest.TestCase):
    def runner(self, reports):
        """A fake `gh`: `run list` names runs 3, 2, 1; `run download` writes that run's sections.json."""
        import json
        import os
        import types
        calls = []

        def run(args, capture_output, text, env):
            calls.append(args)
            self.assertEqual(env["GH_TOKEN"], "actions-token")
            if args[1:3] == ["run", "list"]:
                return types.SimpleNamespace(returncode=0, stdout=json.dumps([{"databaseId": n} for n in (3, 2, 1)]))
            run_id = int(args[3])
            if run_id not in reports:
                return types.SimpleNamespace(returncode=1, stdout="")
            target = args[args.index("-D") + 1]
            os.makedirs(target)
            with open(os.path.join(target, "sections.json"), "w") as f:
                json.dump(reports[run_id], f)
            return types.SimpleNamespace(returncode=0, stdout="")
        return run, calls

    def test_the_newest_run_for_the_version_is_used(self):
        published = {"pr": 50, "head": "abc", "mode": "auto"}
        run, calls = self.runner({3: {"version": "v12.3.0", "published": published},
                                  2: {"version": VERSION, "n": 2, "published": published},
                                  1: {"version": VERSION, "n": 1, "published": published}})
        self.assertEqual(ca.fetch_report(VERSION, {"ACTIONS_TOKEN": "actions-token"}, run)["n"], 2)
        self.assertEqual([c[3] for c in calls if c[2] == "download"], ["3", "2"])

    def test_a_dry_runs_preview_is_never_the_prs_report(self):
        run, calls = self.runner({3: {"version": VERSION, "n": 3},  # dry run: never published
                                  2: {"version": VERSION, "n": 2, "published": {"pr": 50, "head": "abc", "mode": "auto"}}})
        self.assertEqual(ca.fetch_report(VERSION, {"ACTIONS_TOKEN": "actions-token"}, run)["n"], 2)

    def test_the_published_command_records_the_pr(self):
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "sections.json"), "w") as f:
                json.dump({"version": VERSION}, f)
            ca.cmd_published({"OUTPUT_DIR": directory, "PR_NUMBER": "50", "HEAD_SHA": "abc", "MODE": "auto"})
            with open(os.path.join(directory, "sections.json")) as f:
                self.assertEqual(json.load(f)["published"], {"pr": 50, "head": "abc", "mode": "auto"})

    def test_none_when_no_run_has_it(self):
        run, _ = self.runner({3: {"version": "v12.3.0"}})
        self.assertIsNone(ca.fetch_report(VERSION, {"ACTIONS_TOKEN": "actions-token"}, run))



class RequestReviewersTest(unittest.TestCase):
    def test_users_and_teams_are_requested_with_rest(self):
        api = FakeApi()
        api.routes[("POST", "/repos/mattermost/mattermost/pulls/50/requested_reviewers")] = {}
        self.assertIsNone(ca.request_reviewers(api, 50, ["amy", "mattermost/docs-team"]))
        (_, _, body), = api.calls
        self.assertEqual(body, {"reviewers": ["amy"], "team_reviewers": ["docs-team"]})

    def test_a_refused_request_is_reported_without_names(self):
        problem = ca.request_reviewers(FakeApi(), 50, ["amy"])
        self.assertEqual(problem, "could not request review on #50 (HTTP 404)")


def pr(draft=False, sha="abc", base="master", labels=()):
    return {"number": 50, "draft": draft, "head": {"sha": sha, "ref": "changelog/v12.2.0"}, "base": {"ref": base},
            "labels": [{"name": name} for name in labels]}


GUESS = "https://mattermost.com/blog/mattermost-v12-2-is-now-available/"
POST = "https://mattermost.com/blog/mattermost-v12-2-faster-search-and-more/"
BLOG_CHANGELOG = CHANGELOG.replace("### Improvements\n", f"### Improvements\nSee [this blog post]({GUESS}) on the highlights "
                                   "in our latest release.\n", 1)
RELEASE_DAY = date(2026, 11, 16)


def at(day, hour, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc)


class Repo(FakeApi):
    """mattermost/mattermost on Release Day: the changelog PR (open, then merged), its branch,
    master, the v12.2.0 release, the PR's labels and events, and the PRs opened."""

    def __init__(self, content=BLOG_CHANGELOG, merged=False, release=None, pull=None, events=()):
        super().__init__()
        self.files = {"changelog/v12.2.0": content, "master": content if merged else CHANGELOG}
        self.merged, self.opened, self.refs, self.reviewers = merged, [], [], []
        self.pull = pull or pr()
        self.commits = {self.pull["head"]["sha"]: "changelog/v12.2.0", "merge1": "master"}
        self.live = {}  # changes a person makes to the PR while a run is going
        self.events = [{"event": "labeled", "label": {"name": name}} for name in events]
        self.release = release if release is not None else {"published_at": "2026-11-16T09:00:00Z", "prerelease": False,
                                                            "draft": False}

    def _route(self, method, path, payload):
        base = "/repos/mattermost/mattermost"
        self.calls.append((method, path, payload))
        contents = f"{base}/contents/{urllib.parse.quote(FILE)}"
        if path == f"{base}/pulls" and method == "GET":
            if payload.get("head", "").endswith("-blog-link"):
                return [p for p in self.opened if p["head"] == payload["head"].split(":")[1]]
            if payload.get("state") == "closed":
                return [{**self.pull, "merged_at": "2026-11-16T12:00:00Z"}] if self.merged else []
            return [] if self.merged else [self.pull]
        if path == contents and method == "GET":
            ref = payload["ref"]
            text = self.files.get(self.commits.get(ref, ref))
            if text is None:
                raise ca.ApiError(404)
            return {"encoding": "base64", "content": base64.b64encode(text.encode()).decode(), "sha": blob_of(text)}
        if path == contents and method == "PUT":
            assert payload["branch"] != "master", "never pushes to master"
            if payload["sha"] != blob_of(self.files[payload["branch"]]):
                raise ca.ApiError(409)  # the file changed since the text was read
            self.files[payload["branch"]] = base64.b64decode(payload["content"]).decode()
            if payload["branch"] == "changelog/v12.2.0":
                self.pull["head"]["sha"] += "x"  # a new commit on the PR branch
                self.commits[self.pull["head"]["sha"]] = "changelog/v12.2.0"
            return {}
        if path == f"{base}/pulls/50" and method == "GET":
            return {**self.pull, **self.live}
        if path == f"{base}/releases/tags/v12.2.0":
            if not self.release:
                raise ca.ApiError(404)
            return self.release
        if path == f"{base}/issues/50/events":
            return self.events
        if path == f"{base}/issues/50/labels" and method == "POST":
            self.pull["labels"] += [{"name": name} for name in payload["labels"]]
            self.events += [{"event": "labeled", "label": {"name": name}} for name in payload["labels"]]
            return self.pull["labels"]
        if path == f"{base}/git/ref/heads/master":
            return {"object": {"sha": "m1"}}
        if path == f"{base}/git/refs":
            self.refs.append(payload["ref"])
            self.files[payload["ref"].removeprefix("refs/heads/")] = self.files["master"]
            return {}
        if path == f"{base}/pulls" and method == "POST":
            created = {"number": 77, "html_url": "https://github.com/mattermost/mattermost/pull/77", "state": "open", **payload}
            self.opened.append(created)
            return created
        if path == f"{base}/pulls/77/requested_reviewers":
            self.reviewers.append(payload)
            return {}
        raise ca.ApiError(404)

    def merge(self):
        """The AutoMerge automation merges the PR."""
        self.merged, self.files["master"] = True, self.files["changelog/v12.2.0"]

    def labelled(self):
        return [name for method, path, body in self.calls if method == "POST" and path.endswith("/issues/50/labels")
                for name in body["labels"]]


def blob_of(text):
    return "blob-" + str(abs(hash(text)))


def finder(*answers):
    """``find(version)`` answering each call from ``answers`` in turn (the last one repeats)."""
    answers = list(answers)
    return lambda version: (answers.pop(0) if len(answers) > 1 else answers[0], None)


class ReleaseDayTest(unittest.TestCase):
    def run_day(self, repo, report=REPORT, auto=True, find=finder(GUESS), now=at(RELEASE_DAY, 10)):
        return ca.run_release_day(repo, VERSION, lambda: report, auto, find, now)

    def assert_not_labelled(self, repo, problem, report=REPORT):
        outcome = self.run_day(repo, report)
        self.assertFalse(outcome["labelled"])
        self.assertIn(problem, outcome["problems"])
        self.assertEqual(repo.labelled(), [])

    def test_the_automerge_label_is_added_when_everything_holds(self):
        repo = Repo()
        outcome = self.run_day(repo)
        self.assertEqual((outcome["labelled"], outcome["problems"], outcome["blog_link"]), (True, [], "post"))
        self.assertEqual(repo.labelled(), ["AutoMerge"])
        self.assertFalse([c for c in repo.calls if c[1].endswith("/merge")])  # never merges itself
        self.assertIn("Added the AutoMerge label to [mattermost#50]", ca.release_day_summary(VERSION, outcome))

    def test_the_label_is_added_once(self):
        repo = Repo()
        self.run_day(repo)
        again = self.run_day(repo)
        self.assertEqual((again["already"], repo.labelled()), ("labelled", ["AutoMerge"]))
        self.assertIn("has the AutoMerge label", ca.release_day_summary(VERSION, again))

    def test_a_label_a_person_took_off_is_not_added_again(self):
        repo = Repo(events=["AutoMerge"])
        loaded = []
        outcome = ca.run_release_day(repo, VERSION, lambda: loaded.append(1) or REPORT, True, finder(GUESS), at(RELEASE_DAY, 10))
        self.assertEqual((outcome["already"], repo.labelled(), loaded), ("removed", [], []))
        self.assertIn("isn't added again", ca.release_day_summary(VERSION, outcome))

    def test_not_before_the_release_is_published(self):
        for release in ({}, {"published_at": "2026-11-12T09:00:00Z", "prerelease": True, "draft": False},
                        {"published_at": None, "prerelease": False, "draft": True}):
            repo = Repo(release=release)
            outcome = self.run_day(repo)
            self.assertFalse(outcome["labelled"])
            self.assertIn("v12.2.0 is not released yet", outcome["problems"][0])
            self.assertEqual(repo.labelled(), [])

    def test_not_for_a_pr_that_targets_another_branch(self):
        self.assert_not_labelled(Repo(pull=pr(base="release-12.2")), "the PR targets release-12.2 instead of master")

    def test_not_for_a_draft(self):
        self.assert_not_labelled(Repo(pull=pr(draft=True)), "the PR is still a draft")

    def test_not_while_release_day_is_tbd(self):
        self.assert_not_labelled(Repo(BLOG_CHANGELOG.replace("November 16, 2026", "TBD")),
                                 "the entry still says Release day: TBD")

    def test_not_while_the_benchmarking_line_is_pending(self):
        pending = BLOG_CHANGELOG.replace("#### User Interface\n", "#### Performance\n - Benchmarking test results: TBD. Added by "
                                         "the changelog workflow once the v12.2 performance comparison is published.\n\n"
                                         "#### User Interface\n", 1)
        self.assert_not_labelled(Repo(pending), "the entry still says Benchmarking test results: TBD")

    def test_tbd_in_another_releases_entry_does_not_count(self):
        self.assertTrue(self.run_day(Repo(BLOG_CHANGELOG.replace("2026-12-16", "TBD")))["labelled"])

    def test_not_while_benchmarking_is_pending_or_needs_a_person(self):
        pending = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [{"section": "Benchmarking", "status": "not_yet_checked"}]}}
        self.assert_not_labelled(Repo(), "benchmarking is pending", pending)
        flagged = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [{"section": "Benchmarking", "status": "needs_review"}]}}
        self.assert_not_labelled(Repo(), "benchmarking needs a person: write the Performance bullet (\"Benchmarking "
                                         "test results ...\") in the PR from the performance report", flagged)
        old = {**REPORT, "readiness": {"preflight": []}}  # a report from before the readiness section
        self.assert_not_labelled(Repo(), "benchmarking is pending", old)

    def test_not_for_notes_not_placed_by_the_model(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "not_placed": [{"source": "a#1"}, {"source": "a#2"}]}}
        self.assert_not_labelled(Repo(), "2 note(s) not placed by the model", report)

    def test_not_without_a_generator_report(self):
        outcome = self.run_day(Repo(), report=None)
        self.assertFalse(outcome["labelled"])
        self.assertTrue(any("no generator report" in p for p in outcome["problems"]))

    def test_not_when_the_generator_preflight_is_failing(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "preflight": [{"check": "c", "status": "fail", "detail": "d", "blocking": True}]}}
        self.assert_not_labelled(Repo(), "the generator's preflight is failing", report)

    def test_with_auto_merge_off_it_only_reports(self):
        repo = Repo()
        outcome = self.run_day(repo, auto=False, find=finder(POST))
        self.assertEqual((outcome["labelled"], outcome["problems"]), (False, [f"the blog link would be set to {POST}"]))
        self.assertEqual(repo.labelled(), [])
        self.assertEqual(ca.entry_blog_link(repo.files["changelog/v12.2.0"], VERSION), GUESS)
        clean = self.run_day(Repo(), auto=False)
        self.assertIn("CHANGELOG_AUTO_MERGE is not `true`", ca.release_day_summary(VERSION, clean))

    def test_the_summary_lists_what_is_missing(self):
        outcome = self.run_day(Repo(pull=pr(draft=True)))
        summary = ca.release_day_summary(VERSION, outcome)
        self.assertIn("AutoMerge label not added: [mattermost#50](https://github.com/mattermost/mattermost/pull/50)", summary)
        self.assertIn("- the PR is still a draft", summary)

    def test_a_refused_label_is_not_reported_as_added(self):
        repo = Repo()
        repo.routes = {}
        original = repo._route

        def refuse(method, path, payload):
            if method == "POST" and path.endswith("/issues/50/labels"):
                raise ca.ApiError(403)
            return original(method, path, payload)
        repo._route = refuse
        outcome = self.run_day(repo)
        self.assertEqual((outcome["labelled"], outcome["problems"]), (False, ["the AutoMerge label couldn't be added (HTTP 403)"]))

    def test_a_hand_written_performance_bullet_clears_benchmarking_that_needs_a_person(self):
        flagged = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [{"section": "Benchmarking", "status": "needs_review"}]}}
        written = BLOG_CHANGELOG.replace("#### User Interface\n", "#### Performance\n - Benchmarking test results showed a "
                                         "7.50% increase in the number of supported users.\n\n#### User Interface\n", 1)
        self.assertTrue(self.run_day(Repo(written), report=flagged)["labelled"])
        pending = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [{"section": "Benchmarking", "status": "not_yet_checked"}]}}
        self.assertFalse(self.run_day(Repo(written), report=pending)["labelled"])  # no report published: never cleared

    def test_a_bullet_for_an_earlier_report_doesnt_clear_a_corrected_one(self):
        flagged = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [
            {"section": "Benchmarking", "status": "needs_review", "delta": "9.10"}]}}

        def entry_with(bullet):
            return BLOG_CHANGELOG.replace("#### User Interface\n", f"#### Performance\n - {bullet}\n\n#### User Interface\n", 1)
        stale_generated = ("Benchmarking test results showed no significant difference: a 2.00% increase in the number "
                           "of supported users for the new release.")
        stale_person = "Benchmarking test results showed a 7.50% increase in the number of supported users."
        current = "Benchmarking test results showed a 9.10% increase in the number of supported users."
        for bullet, labelled in ((stale_generated, False), (stale_person, False), (current, True)):
            self.assertEqual(self.run_day(Repo(entry_with(bullet)), report=flagged)["labelled"], labelled, bullet)

    def test_a_bullet_with_the_other_direction_doesnt_clear_a_corrected_sign(self):
        decrease = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [
            {"section": "Benchmarking", "status": "needs_review", "delta": "-9.10"}]}}

        def entry_with(bullet):
            return BLOG_CHANGELOG.replace("#### User Interface\n", f"#### Performance\n - {bullet}\n\n#### User Interface\n", 1)
        for bullet, labelled in (
                ("Benchmarking test results showed a 9.10% increase in the number of supported users.", False),
                ("Benchmarking test results showed a +9.10% change in the number of supported users.", False),
                ("Benchmarking test results showed a 9.10% decrease in the number of supported users.", True),
                ("Benchmarking test results showed a -9.10% change in the number of supported users.", True)):
            self.assertEqual(self.run_day(Repo(entry_with(bullet)), report=decrease)["labelled"], labelled, bullet)
        increase = {**decrease, "readiness": {**decrease["readiness"], "gaps": [
            {"section": "Benchmarking", "status": "needs_review", "delta": "9.10"}]}}
        self.assertFalse(self.run_day(Repo(entry_with(
            "Benchmarking test results showed a -9.10% change in the number of supported users.")), report=increase)["labelled"])

    def test_the_pr_is_read_again_before_the_label(self):
        for change, problem in (({"draft": True}, "the PR is still a draft"),
                                ({"base": {"ref": "release-12.2"}}, "the PR targets release-12.2 instead of master"),
                                ({"head": {"sha": "zzz", "ref": "changelog/v12.2.0"}},
                                 "the PR got new commits during this run; it is checked again on the next run")):
            repo = Repo()
            repo.live = change  # made while the run read the report and the blog
            outcome = self.run_day(repo)
            self.assertEqual((outcome["labelled"], outcome["problems"]), (False, [problem]))
            self.assertEqual(repo.labelled(), [])

    def test_the_runs_own_blog_commit_is_not_a_change(self):
        repo = Repo()
        self.assertTrue(self.run_day(repo, find=finder(POST))["labelled"])

    def test_no_changelog_pr(self):
        repo = Repo(merged=True)
        self.assertEqual(self.run_day(repo)["problems"], ["no open changelog PR for v12.2.0"])

    def test_only_feature_releases(self):
        self.assertEqual(ca.release_version("release", "v12.2.0", ""), "v12.2.0")
        self.assertIsNone(ca.release_version("release", "v12.2.1", ""))
        self.assertIsNone(ca.release_version("release", "v12.2.0-rc1", ""))
        self.assertEqual(ca.release_version("workflow_dispatch", "", "v12.2.0"), "v12.2.0")


CATEGORY_PAGE = """<html><body>
<a href="https://mattermost.com/blog/category/releases/">Releases</a>
<article><h2><a href="https://mattermost.com/blog/mattermost-v12-20-is-now-available/">Mattermost v12.20</a></h2></article>
<article><h2><a href="https://mattermost.com/blog/mattermost-v12-2-1-security-update/">Mattermost 12.2.1 security update</a></h2></article>
<article><h2><a href="/blog/mattermost-v12-1-is-now-available/">Mattermost v12.1 is now available</a></h2></article>
<a href="https://mattermost.com/blog/author/someone/">Mattermost 12.2 author page</a>
</body></html>"""


class BlogFinderTest(unittest.TestCase):
    def test_a_post_whose_slug_starts_with_the_release_prefix(self):
        page = CATEGORY_PAGE.replace("</body>", f'<a class="x" href="{POST}"><span>Faster search</span></a></body>')
        self.assertEqual(ca.find_blog_post(page, 12, 2), POST)

    def test_a_post_whose_title_names_the_release(self):
        url = "https://mattermost.com/blog/faster-search-in-mattermost/"
        page = CATEGORY_PAGE.replace("</body>", f'<a href="{url}">Mattermost&nbsp;v12.2: faster search</a></body>')
        self.assertEqual(ca.find_blog_post(page, 12, 2), url)

    def test_a_release_candidate_title_is_not_it(self):
        for title in ("Mattermost v12.2-rc1 is out for testing", "Mattermost 12.2 RC2", "Try v12.2.rc1"):
            page = f'<a href="https://mattermost.com/blog/testing-the-next-release/">{title}</a>'
            self.assertIsNone(ca.find_blog_post(page, 12, 2), title)
        self.assertTrue(ca.names_version("Mattermost v12.2: faster search", 12, 2))

    def test_other_releases_dot_releases_and_other_pages_are_not_it(self):
        self.assertIsNone(ca.find_blog_post(CATEGORY_PAGE, 12, 2))  # v12.20, 12.2.1 and an author page only
        self.assertEqual(ca.find_blog_post(CATEGORY_PAGE, 12, 1), "https://mattermost.com/blog/mattermost-v12-1-is-now-available/")
        self.assertIsNone(ca.find_blog_post('<a href="https://evil.example/blog/mattermost-v12-2-x/">x</a>', 12, 2))

    def test_the_finder_reads_the_category_page_only(self):
        asked = []
        find = ca.blog_finder(lambda url: asked.append(url) or CATEGORY_PAGE)
        self.assertEqual(find("v12.1.0"), ("https://mattermost.com/blog/mattermost-v12-1-is-now-available/", None))
        self.assertEqual(asked, [ca.CATEGORY_URL])

    def test_a_page_that_cant_be_read_is_not_found_yet(self):
        def fail(url):
            raise ca.urllib.error.HTTPError(url, 503, "unavailable", {}, None)
        self.assertEqual(ca.blog_finder(fail)("v12.2.0"), (None, "the releases category page couldn't be read (HTTP 503)"))


class BlogLinkTest(unittest.TestCase):
    def run_day(self, repo, find, now):
        return ca.run_release_day(repo, VERSION, lambda: REPORT, True, find, now)

    def link_on(self, repo, ref):
        return ca.entry_blog_link(repo.files[ref], VERSION)

    def test_the_post_found_is_swapped_in_and_the_label_added(self):
        repo = Repo()
        outcome = self.run_day(repo, finder(POST), at(RELEASE_DAY, 10))
        self.assertTrue(outcome["labelled"])
        self.assertEqual(repo.files["changelog/v12.2.0"], BLOG_CHANGELOG.replace(GUESS, POST))  # the link only
        repo.merge()
        self.assertEqual(ca.run_blog_fixup(repo, VERSION, RELEASE_DAY, finder(POST), "amy"), "")  # nothing to fix
        self.assertEqual(repo.opened, [])

    def test_a_link_a_person_set_in_the_pr_is_the_override(self):
        mine = "https://mattermost.com/blog/our-v12-2-story/"
        repo = Repo(BLOG_CHANGELOG.replace(GUESS, mine))
        outcome = self.run_day(repo, finder(POST), at(RELEASE_DAY, 10))
        self.assertEqual((outcome["labelled"], outcome["blog_link"]), (True, "person"))
        self.assertEqual([c for c in repo.calls if c[0] == "PUT" and "contents" in c[1]], [])
        repo.merge()
        self.assertEqual(ca.run_blog_fixup(repo, VERSION, date(2026, 11, 17), finder(POST), "amy"), "")
        self.assertEqual(repo.opened, [])

    def test_never_found_waits_until_23_utc_then_links_the_category_and_labels(self):
        repo = Repo()
        waiting = self.run_day(repo, finder(None), at(RELEASE_DAY, 15))
        self.assertFalse(waiting["labelled"])
        self.assertIn("waiting for the v12.2 blog post: checked again each run until 23:00 UTC on Release Day (2026-11-16)",
                      waiting["problems"][0])
        self.assertEqual(self.link_on(repo, "changelog/v12.2.0"), GUESS)  # nothing changed while waiting
        late = self.run_day(repo, finder(None), at(RELEASE_DAY, 23))
        self.assertTrue(late["labelled"])
        self.assertEqual((late["blog_link"], self.link_on(repo, "changelog/v12.2.0")), ("category", ca.CATEGORY_URL))
        self.assertIn("It links the releases category page until the blog post is out", ca.release_day_summary(VERSION, late))
        repo.merge()
        # The post comes out two days later: one fix PR, for the link only, never on master.
        self.assertIn("isn't out yet", ca.run_blog_fixup(repo, VERSION, date(2026, 11, 17), finder(None), "amy"))
        self.assertEqual(repo.opened, [])
        self.assertIn("Opened [mattermost#77]", ca.run_blog_fixup(repo, VERSION, date(2026, 11, 18), finder(POST), "amy"))
        self.assertEqual(repo.files["changelog/v12.2.0-blog-link"], repo.files["master"].replace(ca.CATEGORY_URL, POST, 1))
        self.assertEqual(self.link_on(repo, "master"), ca.CATEGORY_URL)  # master untouched

    def test_an_edit_made_since_the_read_is_never_overwritten(self):
        repo = Repo()
        original = repo._route

        def edit_first(method, path, payload):
            if method == "PUT" and "/contents/" in path:  # a reviewer edits a bullet just before the commit
                repo.files["changelog/v12.2.0"] = repo.files["changelog/v12.2.0"].replace("Updated sidebar.", "Edited.")
            return original(method, path, payload)
        repo._route = edit_first
        outcome = self.run_day(repo, finder(POST), at(RELEASE_DAY, 10))
        self.assertFalse(outcome["labelled"])
        self.assertIn("the changelog changed on the PR branch during this run", outcome["problems"][0])
        self.assertIn("Edited.", repo.files["changelog/v12.2.0"])
        self.assertEqual(self.link_on(repo, "changelog/v12.2.0"), GUESS)

    def test_an_entry_without_a_blog_line_is_not_labelled(self):
        repo = Repo(CHANGELOG)
        outcome = self.run_day(repo, finder(POST), at(RELEASE_DAY, 10))
        self.assertFalse(outcome["labelled"])
        self.assertIn('the v12.2 entry has no "this blog post" link to set; add it in the PR', outcome["problems"])

    def test_found_after_the_merge_opens_one_fix_pr_for_the_release_manager(self):
        repo = Repo(merged=True)  # merged by hand with the guessed link, and the post's URL is another one
        self.assertIn("Opened [mattermost#77]", ca.run_blog_fixup(repo, VERSION, date(2026, 11, 17), finder(POST), "amy"))
        self.assertEqual([(p["head"], p["base"]) for p in repo.opened], [("changelog/v12.2.0-blog-link", "master")])
        self.assertEqual(repo.reviewers, [{"reviewers": ["amy"], "team_reviewers": []}])
        self.assertIn("This changes only that link.", repo.opened[0]["body"])
        again = ca.run_blog_fixup(repo, VERSION, date(2026, 11, 18), finder(POST), "amy")
        self.assertIn("Blog link fix PR for v12.2: [mattermost#77]", again)
        repo.opened[0]["state"] = "closed"  # even closed without merging: never a second one
        ca.run_blog_fixup(repo, VERSION, date(2026, 11, 19), finder(POST), "amy")
        self.assertEqual(len(repo.opened), 1)

    def test_no_fix_after_10_working_days(self):
        repo = Repo(merged=True)
        self.assertEqual(ca.add_working_days(RELEASE_DAY, 10), date(2026, 11, 30))
        self.assertEqual(ca.run_blog_fixup(repo, VERSION, date(2026, 12, 1), finder(POST), "amy"), "")
        self.assertEqual(repo.opened, [])

    def test_never_commits_to_master(self):
        with self.assertRaises(ValueError):
            ca.put_file(FakeApi(), ca.REPO, FILE, "master", "x", "m", "blob")


class MergeCommandTest(unittest.TestCase):
    def merge(self, env, merged_pr=None, open_pr=None):
        env = {"GH_TOKEN": "t", "LABEL_TOKEN": "l", "LABEL_ACTOR": "app[bot]", "AUTO_MERGE": "true", **env}
        outcome = {"labelled": True, "already": None, "pr": 50, "problems": [], "auto": True, "blog_link": "post"}
        with mock.patch.object(ca, "recent_releases", return_value=[VERSION]), \
                mock.patch.object(ca, "find_changelog_pr", return_value=open_pr), \
                mock.patch.object(ca, "merged_changelog_pr", return_value=merged_pr), \
                mock.patch.object(ca, "fetch_reports", return_value=iter([REPORT])) as reports, \
                mock.patch.object(ca, "run_release_day", return_value=outcome) as day, \
                mock.patch.object(ca, "run_blog_fixup", return_value=""), \
                mock.patch.object(ca, "merge_labels", return_value="reconciled") as labels, \
                mock.patch.object(ca, "Api"), mock.patch.object(ca, "_summary") as summary:
            ca.cmd_merge(env)
        return day, labels, reports, summary

    def test_release_day_runs_for_an_open_pr(self):
        day, labels, _, _ = self.merge({"EVENT_NAME": "release", "RELEASE_TAG": VERSION}, open_pr=pr())
        day.assert_called_once()
        self.assertTrue(day.call_args.args[3])  # CHANGELOG_AUTO_MERGE
        labels.assert_not_called()  # nothing merged yet

    def test_a_dispatch_after_a_hand_merge_reconciles_the_labels(self):
        merged = {**pr(), "merged_at": "2026-11-10T10:00:00Z"}
        day, labels, _, summary = self.merge({"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": VERSION}, merged_pr=merged)
        day.assert_not_called()
        self.assertEqual(labels.call_args.args[2], [REPORT])
        summary.assert_called_once_with("reconciled")

    def test_a_scheduled_run_reconciles_only_just_after_the_merge(self):
        just = {**pr(), "merged_at": (datetime.now(timezone.utc) - ca.timedelta(minutes=50)).isoformat()}
        _, labels, _, _ = self.merge({"EVENT_NAME": "schedule"}, merged_pr=just)
        labels.assert_called_once()
        old = {**pr(), "merged_at": (datetime.now(timezone.utc) - ca.timedelta(days=2)).isoformat()}
        _, labels, reports, _ = self.merge({"EVENT_NAME": "schedule"}, merged_pr=old)
        labels.assert_not_called()
        reports.assert_not_called()

    def test_without_a_labels_token_only_the_swap_is_skipped(self):
        merged = {**pr(), "merged_at": "2026-11-10T10:00:00Z"}
        _, labels, _, summary = self.merge({"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": VERSION, "LABEL_TOKEN": ""},
                                           merged_pr=merged)
        labels.assert_not_called()
        summary.assert_called_once_with("Changelog labels not reconciled: no labels token for the source repos.")

    def test_a_dot_release_does_nothing(self):
        day, labels, _, summary = self.merge({"EVENT_NAME": "release", "RELEASE_TAG": "v12.2.1"}, open_pr=pr())
        day.assert_not_called()
        summary.assert_called_once_with("Not a feature release (vX.Y.0), so the changelog PR is left as it is.")


class WorkflowTest(unittest.TestCase):
    """generate-changelog.yml: every write-app token names its permissions, and only the labelling
    steps' token reaches mattermost/enterprise."""

    WRITE = {"permission-contents": "write", "permission-pull-requests": "write", "permission-checks": "read",
             "permission-statuses": "read"}

    def setUp(self):
        path = Path(__file__).resolve().parents[1] / "workflows" / "generate-changelog.yml"
        self.text = path.read_text(encoding="utf-8")

    def mints(self):
        """Each create-github-app-token step: (its id, its `with:` inputs)."""
        found = []
        for step in re.split(r"\n\s+- name: ", self.text):
            if "actions/create-github-app-token@" not in step:
                continue
            step_id = re.search(r"\n\s+id: (\w+)", step)
            block = step[step.index("with:"):]
            inputs = dict(re.findall(r"\n\s+([\w-]+): ([^\n]+)", block))
            found.append((step_id.group(1) if step_id else "", inputs))
        return found

    def test_every_write_app_mint_names_its_permissions(self):
        write = [(step_id, inputs) for step_id, inputs in self.mints() if "CHANGELOG_WRITE_CLIENT_ID" in inputs["client-id"]]
        self.assertEqual(len(write), 4)  # the write token and the labels token, in the generate and merge jobs
        for step_id, inputs in write:
            named = {k: v for k, v in inputs.items() if k.startswith("permission-")}
            self.assertTrue(named, f"{step_id} names no permission-* input, so it gets every permission the app has")
            if step_id == "labelToken":
                self.assertEqual(named, {"permission-pull-requests": "write"})
                self.assertEqual(inputs["repositories"], "mattermost,enterprise")
            else:
                self.assertEqual(named, self.WRITE)
                self.assertEqual(inputs["repositories"], "mattermost")

    def test_the_permission_test_fails_for_a_mint_that_names_none(self):
        self.text = self.text.replace("          permission-checks: read\n", "", 1).replace(
            "          permission-contents: write\n          permission-pull-requests: write\n          permission-statuses: read\n",
            "", 1)
        with self.assertRaises(AssertionError):
            self.test_every_write_app_mint_names_its_permissions()

    def test_a_labels_token_that_cant_be_minted_never_blocks_the_run_or_the_label(self):
        mints = re.findall(r"- name: Get labels token \(source repos\)\n((?:\s+[^\n]*\n)*?)\s+with:", self.text)
        self.assertEqual(len(mints), 2)
        for mint in mints:
            self.assertIn("continue-on-error: true", mint)
        label_step = self.text[self.text.index("- name: Set changelog labels on the source PRs"):]
        self.assertIn("if: ${{ !cancelled() && steps.labelToken.outcome == 'success' }}", label_step[:200])
        self.assertIn("GH_TOKEN: ${{ steps.labelToken.outputs.token }}", label_step[:400])

    def test_a_failed_suggestion_step_never_fails_the_published_run(self):
        step = self.text[self.text.index("- name: Suggest rewrites for weak notes"):]
        step = step[:step.index("\n      - name: ")]
        self.assertIn("\n        continue-on-error: true\n", step)

    def test_merge_on_release_holds_no_secret_and_starts_the_merge_on_master(self):
        job = workflow_jobs(self.text)["merge-on-release"]
        self.assertNotIn("secrets.", job)
        self.assertNotIn("environment:", job)
        self.assertIn("actions: write", job)
        self.assertIn("gh workflow run generate-changelog.yml --repo \"$GITHUB_REPOSITORY\" --ref master", job)
        self.assertIn("TAG: ${{ github.event.release.tag_name }}", job, "the tag reaches the script through env only")

    def test_only_the_merge_trigger_runs_on_the_release_event(self):
        jobs = workflow_jobs(self.text)
        for name, job in jobs.items():
            condition = re.search(r"\n    if: ([^\n]+)", job)
            if name == "merge-on-release":
                continue
            self.assertFalse(condition and "github.event_name == 'release'" in condition.group(1)
                             and "!=" not in condition.group(1), name)

    def test_the_changelog_pr_is_labelled_release_note_none_only(self):
        step = self.text[self.text.index("- name: Label the changelog PR release-note-none"):]
        step = step[:step.index("\n      - name:")]
        self.assertIn('-f "labels[]=release-note-none"', step)
        self.assertIn("GH_TOKEN: ${{ steps.writeToken.outputs.token }}", step)
        self.assertNotIn("Contributor", self.text)

    def test_nothing_talks_to_hub(self):
        for name in ("RELEASE_AGENT_MM_TOKEN", "RELEASE_AGENT_MM_URL", "RELEASE_AGENT_RELEASE_CHANNEL_IDS", "digest"):
            self.assertNotIn(name, self.text)

    def test_the_merge_cron_runs_on_weekends(self):
        crons = re.findall(r"- cron: '([^']+)'", self.text)
        self.assertIn("37 * * * *", crons)
        self.assertEqual(self.text.count("github.event.schedule == '37 * * * *'"), 2)  # the merge job and run-name
        self.assertEqual(self.text.count("github.event.schedule != '37 * * * *'"), 1)


WORKFLOWS_DIR = Path(__file__).resolve().parents[1] / "workflows"
WRITE_ENVIRONMENT = "release-write"


def workflow_jobs(text: str) -> dict:
    """{job id: the job's text} for a workflow file, split on the two-space job keys under jobs:."""
    body = text[text.index("\njobs:\n") + len("\njobs:\n"):]
    parts = re.split(r"(?m)^  ([A-Za-z0-9_-]+):\s*$", body)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def uncommented(text: str) -> str:
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


class WriteEnvironmentTest(unittest.TestCase):
    """The changelog write app's key is a secret of the `release-write` environment, which only
    master can use. Every job that mints a write-app token declares that environment and runs only
    with ref master; no public workflow asks an app for actions or for delivery-platform (only the
    private mattermost/release-automation starts delivery-platform workflows)."""

    def workflows(self):
        return {path.name: path.read_text(encoding="utf-8") for path in sorted(WORKFLOWS_DIR.glob("*.y*ml"))}

    def problems(self, files: dict) -> list:
        found = []
        for name, text in files.items():
            code = uncommented(text)
            if "delivery-platform" in code:
                found.append(f"{name}: names delivery-platform")
            if re.search(r"(?m)^\s+permission-actions:", code):
                found.append(f"{name}: asks an app for actions")
            if "\njobs:\n" not in code:
                continue
            for job_id, job in workflow_jobs(code).items():
                if "CHANGELOG_WRITE_PRIVATE_KEY" not in job:
                    continue
                if not re.search(rf"(?m)^    environment: {WRITE_ENVIRONMENT}\s*$", job):
                    found.append(f"{name} {job_id}: mints a write-app token outside {WRITE_ENVIRONMENT}")
                condition = re.search(r"(?m)^    if: (.+)$", job)
                if not condition or "github.ref == 'refs/heads/master'" not in condition.group(1):
                    found.append(f"{name} {job_id}: mints a write-app token without requiring ref master")
        return found

    def test_write_tokens_are_minted_only_in_release_write_on_master(self):
        self.assertEqual(self.problems(self.workflows()), [])

    def test_the_check_finds_each_problem(self):
        bad = {
            "a.yml": "on: pull_request\njobs:\n  pr:\n    if: true\n    steps:\n      - with:\n          private-key: ${{ secrets.CHANGELOG_WRITE_PRIVATE_KEY }}\n",
            "b.yml": "on: push\njobs:\n  x:\n    steps:\n      - with:\n          repositories: delivery-platform\n          permission-actions: write\n",
        }
        self.assertEqual(self.problems(bad), [
            "a.yml pr: mints a write-app token outside release-write",
            "a.yml pr: mints a write-app token without requiring ref master",
            "b.yml: names delivery-platform",
            "b.yml: asks an app for actions",
        ])


if __name__ == "__main__":
    unittest.main()

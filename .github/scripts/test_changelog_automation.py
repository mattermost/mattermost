import base64
import unittest
from datetime import date

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

    def test_reviewers_are_the_section_reviewers_plus_the_default(self):
        names = ca.reviewers_to_request(CHANGELOG, VERSION, {"Upgrade Impact/*": ["org/db"], "Improvements": "ui-lead"}, "amy, ui-lead  bob")
        self.assertEqual(names, ["org/db", "ui-lead", "amy", "bob"])


def pr(draft=False, reviewers=(), sha="abc", base="master"):
    return {"number": 50, "draft": draft, "head": {"sha": sha}, "base": {"ref": base},
            "requested_reviewers": [{"login": r} for r in reviewers], "requested_teams": []}


def checks(*runs):
    return {"check_runs": [{"name": n, "status": s, "conclusion": c} for n, s, c in runs]}


GREEN = checks(("Check docs links", "completed", "success"), ("lint", "completed", "success"))


def merge_api(pull=None, reviews=(("amy", "APPROVED"),), runs=GREEN, content=CHANGELOG):
    api = FakeApi()
    base = "/repos/mattermost/mattermost"
    api.routes[("GET", f"{base}/pulls")] = [pull or pr()]
    api.routes[("GET", f"{base}/pulls/50/reviews")] = [{"state": s, "user": {"login": u}} for u, s in reviews]
    api.routes[("GET", f"{base}/commits/abc/check-runs")] = runs
    api.routes[("GET", f"{base}/contents/{ca.urllib.parse.quote(FILE)}")] = {
        "encoding": "base64", "content": base64.b64encode(content.encode()).decode()}
    api.routes[("PUT", f"{base}/pulls/50/merge")] = {"merged": True}
    return api


class MergeTest(unittest.TestCase):
    def merge(self, api, report=REPORT, auto=True):
        return ca.run_merge(api, VERSION, report, auto)

    def test_merges_when_everything_holds(self):
        api = merge_api()
        outcome = self.merge(api)
        self.assertEqual((outcome["merged"], outcome["problems"]), (True, []))
        (_, _, body), = api.calls_to("PUT", "/repos/mattermost/mattermost/pulls/50/merge")
        self.assertEqual(body["sha"], "abc")

    def assert_refused(self, api, problem, report=REPORT):
        outcome = self.merge(api, report)
        self.assertFalse(outcome["merged"])
        self.assertIn(problem, outcome["problems"])
        self.assertEqual(api.calls_to("PUT", "/repos/mattermost/mattermost/pulls/50/merge"), [])

    def test_refused_when_the_pr_targets_another_branch(self):
        self.assert_refused(merge_api(pr(base="release-12.2")), "the PR targets release-12.2 instead of master")

    def test_refused_for_a_draft(self):
        self.assert_refused(merge_api(pr(draft=True)), "the PR is still a draft")

    def test_refused_while_a_review_is_outstanding(self):
        self.assert_refused(merge_api(pr(reviewers=["bob"])), "1 requested review(s) outstanding")

    def test_refused_without_an_approval(self):
        self.assert_refused(merge_api(reviews=[("amy", "COMMENTED")]), "no approving review")

    def test_refused_when_changes_are_requested(self):
        self.assert_refused(merge_api(reviews=[("amy", "APPROVED"), ("bob", "CHANGES_REQUESTED")]), "changes are requested")

    def test_the_latest_review_of_a_person_counts(self):
        outcome = self.merge(merge_api(reviews=[("bob", "CHANGES_REQUESTED"), ("bob", "APPROVED")]))
        self.assertTrue(outcome["merged"])

    def test_refused_for_a_failing_check(self):
        runs = checks(("Check docs links", "completed", "success"), ("lint", "completed", "failure"))
        self.assert_refused(merge_api(runs=runs), "1 check(s) failing")

    def test_refused_for_a_running_check(self):
        runs = checks(("Check docs links", "completed", "success"), ("lint", "in_progress", None))
        self.assert_refused(merge_api(runs=runs), "1 check(s) still running")

    def test_refused_when_the_link_check_has_not_run_or_passed(self):
        self.assert_refused(merge_api(runs=checks(("lint", "completed", "success"))), "Changelog Link Check has not run")
        self.assert_refused(merge_api(runs=checks(("Check docs links", "in_progress", None))), "Changelog Link Check has not passed")

    def test_refused_for_release_day_tbd(self):
        content = CHANGELOG.replace("November 16, 2026", "TBD")
        self.assert_refused(merge_api(content=content), "the entry still says Release day: TBD")

    def test_tbd_in_another_releases_entry_does_not_count(self):
        self.assertTrue(self.merge(merge_api(content=CHANGELOG.replace("2026-12-16", "TBD")))["merged"])

    def test_refused_while_benchmarking_is_pending(self):
        pending = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [{"section": "Benchmarking", "status": "not_yet_checked"}]}}
        self.assert_refused(merge_api(), "benchmarking is pending", pending)

    def test_refused_when_the_report_has_no_benchmarking_gap_at_all(self):
        old = {**REPORT, "readiness": {"preflight": []}}  # a report from before the readiness section
        self.assert_refused(merge_api(), "benchmarking is pending", old)

    def test_checks_beyond_the_first_100_are_counted(self):
        api = merge_api()
        first = {"check_runs": [{"name": f"c{n}", "status": "completed", "conclusion": "success"} for n in range(99)]
                 + [{"name": "Check docs links", "status": "completed", "conclusion": "success"}]}
        second = {"check_runs": [{"name": "late", "status": "in_progress", "conclusion": None}]}
        api.routes[("GET", "/repos/mattermost/mattermost/commits/abc/check-runs")] = lambda p: first if p["page"] == 1 else second
        outcome = self.merge(api)
        self.assertIn("1 check(s) still running", outcome["problems"])
        self.assertFalse(outcome["merged"])

    def test_refused_for_notes_not_placed_by_the_model(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "not_placed": [{"source": "a#1"}, {"source": "a#2"}]}}
        self.assert_refused(merge_api(), "2 note(s) not placed by the model", report)

    def test_refused_without_a_generator_report(self):
        outcome = self.merge(merge_api(), report=None)
        self.assertFalse(outcome["merged"])
        self.assertTrue(any("no generator report" in p for p in outcome["problems"]))

    def test_refused_when_the_generator_preflight_is_failing(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "preflight": [{"check": "c", "status": "fail", "detail": "d", "blocking": True}]}}
        self.assert_refused(merge_api(), "the generator's preflight is failing", report)

    def test_with_auto_merge_off_it_only_reports(self):
        api = merge_api()
        outcome = self.merge(api, auto=False)
        self.assertEqual((outcome["merged"], outcome["problems"], outcome["pr"]), (False, [], 50))
        self.assertEqual(api.calls_to("PUT", "/repos/mattermost/mattermost/pulls/50/merge"), [])
        self.assertIn("CHANGELOG_AUTO_MERGE is not `true`", ca.merge_summary(VERSION, outcome))

    def test_the_summary_lists_what_is_missing_without_names(self):
        outcome = self.merge(merge_api(pr(draft=True, reviewers=["bob"])))
        summary = ca.merge_summary(VERSION, outcome)
        self.assertIn("- the PR is still a draft", summary)
        self.assertIn("[mattermost#50](https://github.com/mattermost/mattermost/pull/50)", summary)
        self.assertNotIn("bob", summary)

    def test_a_refused_merge_is_not_reported_as_merged(self):
        api = merge_api()
        api.routes[("PUT", "/repos/mattermost/mattermost/pulls/50/merge")] = lambda body: (_ for _ in ()).throw(ca.ApiError(405))
        outcome = self.merge(api)
        self.assertEqual((outcome["merged"], outcome["problems"]), (False, ["GitHub refused the merge (HTTP 405)"]))

    def test_no_changelog_pr(self):
        api = merge_api()
        api.routes[("GET", "/repos/mattermost/mattermost/pulls")] = []
        self.assertFalse(self.merge(api)["merged"])

    def test_only_feature_releases_are_merged(self):
        self.assertEqual(ca.release_version("release", "v12.2.0", ""), "v12.2.0")
        self.assertIsNone(ca.release_version("release", "v12.2.1", ""))
        self.assertIsNone(ca.release_version("release", "v12.2.0-rc1", ""))
        self.assertEqual(ca.release_version("workflow_dispatch", "", "v12.2.0"), "v12.2.0")


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
        run, calls = self.runner({3: {"version": "v12.3.0"}, 2: {"version": VERSION, "n": 2}, 1: {"version": VERSION, "n": 1}})
        self.assertEqual(ca.fetch_report(VERSION, {"ACTIONS_TOKEN": "actions-token"}, run), {"version": VERSION, "n": 2})
        self.assertEqual([c[3] for c in calls if c[2] == "download"], ["3", "2"])

    def test_none_when_no_run_has_it(self):
        run, _ = self.runner({3: {"version": "v12.3.0"}})
        self.assertIsNone(ca.fetch_report(VERSION, {"ACTIONS_TOKEN": "actions-token"}, run))


class FakeMattermost:
    def __init__(self):
        self.posts, self.created, self.patched = {}, 0, 0

    def me(self):
        return {"id": "bot"}

    def channels_named(self, name):
        return [{"id": "c122"}] if name == "Release: v12.2" else []

    def channel_posts(self, channel_id, page=0, per_page=200):
        return [] if page else list(self.posts.values())

    def create_post(self, channel_id, message, props=None, root_id=""):
        self.created += 1
        post = {"id": f"p{self.created}", "user_id": "bot", "message": message, "props": props or {}, "create_at": 1}
        self.posts[post["id"]] = post
        return post

    def patch_post(self, post_id, message, props):
        self.patched += 1
        self.posts[post_id].update(message=message, props=props)
        return self.posts[post_id]


class DigestTest(unittest.TestCase):
    def post(self, mattermost, report):
        from release_agent import posting
        return ca.post_digest(mattermost, "c122", VERSION, 50, report, posting.upsert_post, posting.find_post, 10**13)

    def test_the_same_post_is_edited_not_posted_twice(self):
        mattermost = FakeMattermost()
        self.assertEqual(self.post(mattermost, REPORT), "created")
        self.assertEqual(self.post(mattermost, REPORT), "unchanged")
        changed = {**REPORT, "readiness": {**REPORT["readiness"], "notes": {"missing": 0}, "missing_by_owner": []}}
        self.assertEqual(self.post(mattermost, changed), "updated")
        self.assertEqual((mattermost.created, mattermost.patched, len(mattermost.posts)), (1, 1, 1))

    def test_the_digest_names_owners_on_hub_and_counts_in_the_summary(self):
        message = ca.digest_message(VERSION, 50, REPORT)
        self.assertIn("[mattermost#50](https://github.com/mattermost/mattermost/pull/50)", message)
        self.assertIn("- @amy: mattermost/mattermost#7", message)
        self.assertIn("ready: Benchmarking", message)
        self.assertIn("- mattermost/mattermost#101: under 6 words", message)
        counts = ca.digest_counts(REPORT)
        self.assertEqual(counts, "Digest: 1 of 1 generated sections ready, 1 missing note(s), 1 weak note(s).")
        self.assertNotIn("amy", counts)

    def test_pending_sections_are_listed(self):
        report = {**REPORT, "readiness": {**REPORT["readiness"], "gaps": [
            {"section": "Benchmarking", "status": "not_yet_checked"}, {"section": "Go version", "status": "ready"}]}}
        self.assertIn("ready: Go version. Pending: Benchmarking.", ca.digest_message(VERSION, 50, report))

    def test_the_release_channel_is_found_by_name_or_override(self):
        names = ["Release: {short_version}", "Release: {short_version} (ESR)"]
        self.assertEqual(ca.find_channel(FakeMattermost(), VERSION, names), "c122")
        self.assertEqual(ca.find_channel(FakeMattermost(), VERSION, names, {"v12.2": "override"}), "override")
        self.assertIsNone(ca.find_channel(FakeMattermost(), "v12.3.0", names))


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Regression tests for check_config_changes_ci.py git history filtering."""

import os
import shutil
import subprocess
import tempfile
import unittest

import check_config_changes_ci as checker

_HANDLE = (
    'package api4\n\n'
    'func Init() {\n'
    '\tr.Handle("/api/v4/foo", r.APIHandler(getFoo)).Methods("GET")\n'
    '}\n'
)

_HANDLE_BAR = (
    'package api4\n\n'
    'func Init() {\n'
    '\tr.Handle("/api/v4/bar", r.APIHandler(getBar)).Methods("POST")\n'
    '}\n'
)


def _git(repo: str, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo, *args],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def _write(repo: str, relpath: str, contents: str) -> None:
    path = os.path.join(repo, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(contents)


class UniqueCommitFilterTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.old_cwd = os.getcwd()
        os.chdir(self.tmpdir)
        _git(self.tmpdir, "init", "-b", "master")
        _git(self.tmpdir, "config", "user.email", "test@example.com")
        _git(self.tmpdir, "config", "user.name", "Test")
        checker.DEFAULT_BRANCH = "master"
        checker.reset_git_caches()

    def tearDown(self):
        os.chdir(self.old_cwd)
        shutil.rmtree(self.tmpdir)
        checker.reset_git_caches()

    def _commit(self, message: str) -> str:
        _git(self.tmpdir, "add", "-A")
        _git(self.tmpdir, "commit", "-m", message)
        return _git(self.tmpdir, "rev-parse", "HEAD")

    def _point_checker(self, base: str, head: str, base_ref: str = "") -> None:
        checker.BASE_SHA = base
        checker.BASE_REF = base_ref
        checker.HEAD_SHA = head
        checker.DEFAULT_BRANCH = "master"
        checker.reset_git_caches()

    def test_retargeted_base_does_not_attribute_default_branch_api_files(self):
        """PR #38944: GitHub base moved onto an older branch; head already had master.

        A three-dot diff against that base includes every watched file master
        gained since the older branch diverged — including real API files, not
        only tests. Unique commits vs master must drop those.
        """
        _write(self.tmpdir, "README", "start\n")
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "docs-branch")
        _write(self.tmpdir, "docs/note.md", "docs\n")
        docs_tip = self._commit("docs only")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        _write(self.tmpdir, "server/channels/api4/post_test.go", "package api4\n")
        _write(self.tmpdir, "server/public/model/config.go", "package model\n\ntype Config struct {\n\tEnableFoo bool\n}\n")
        self._commit("master adds API and config")

        _git(self.tmpdir, "checkout", "-b", "feature")
        _write(self.tmpdir, "webapp/i18n/da.json", "{}\n")
        head = self._commit("restore locales")

        self._point_checker(docs_tip, head)

        self.assertEqual(checker.files_changed_in_unique_commits(), [])
        self.assertEqual(checker.get_full_patch(), "")

        # Sanity: the naive three-dot vs the retargeted base still sees master's files.
        naive = _git(self.tmpdir, "diff", "--name-only", f"{docs_tip}...{head}")
        self.assertIn("server/channels/api4/post.go", naive)
        self.assertIn("server/public/model/config.go", naive)

    def test_real_api_change_on_feature_branch_is_still_reported(self):
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        base = self._commit("base")

        _git(self.tmpdir, "checkout", "-b", "feature")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        head = self._commit("add GET /foo")

        self._point_checker(base, head)
        patches = checker.split_patch_by_file(checker.get_full_patch())
        result = checker.check_api(patches)

        self.assertTrue(result.has_findings())
        self.assertTrue(any("/api/v4/foo" in item for item in result.additions))

    def test_cherry_pick_onto_release_branch_is_still_reported(self):
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        _write(self.tmpdir, "README", "start\n")
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "release-12.0")
        # A distinct parent so the cherry-pick cannot reuse master_api's SHA
        # (same parent/tree/message/author in the same second).
        _write(self.tmpdir, "RELEASE", "12.0\n")
        self._commit("release-only commit")
        release = _git(self.tmpdir, "rev-parse", "HEAD")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        master_api = self._commit("add GET /foo on master")

        _git(self.tmpdir, "checkout", "release-12.0")
        _git(self.tmpdir, "cherry-pick", master_api)
        head = _git(self.tmpdir, "rev-parse", "HEAD")
        self.assertNotEqual(head, master_api)

        self._point_checker(release, head)
        patches = checker.split_patch_by_file(checker.get_full_patch())
        result = checker.check_api(patches)

        self.assertTrue(result.has_findings())
        self.assertTrue(any("/api/v4/foo" in item for item in result.additions))

    def test_retarget_plus_real_pr_api_change_only_reports_the_pr(self):
        """If the PR also changes api4, snapshots must not include master's extras."""
        _write(self.tmpdir, "README", "start\n")
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "docs-branch")
        _write(self.tmpdir, "docs/note.md", "docs\n")
        docs_tip = self._commit("docs only")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        self._commit("master adds GET /foo")

        _git(self.tmpdir, "checkout", "-b", "feature")
        _write(self.tmpdir, "server/channels/api4/bar.go", _HANDLE_BAR)
        head = self._commit("PR adds POST /bar")

        self._point_checker(docs_tip, head)
        self.assertEqual(
            checker.files_changed_in_unique_commits(),
            ["server/channels/api4/bar.go"],
        )
        patches = checker.split_patch_by_file(checker.get_full_patch())
        result = checker.check_api(patches)
        self.assertTrue(any("/api/v4/bar" in item for item in result.additions))
        self.assertFalse(any("/api/v4/foo" in item for item in result.additions))

    def test_endpoints_master_already_has_are_not_reported_again(self):
        """A stacked PR carries the first PR's raw commits; master has them squashed."""
        _write(self.tmpdir, "server/channels/api4/api.go", _API_ROUTES)
        _write(self.tmpdir, "server/channels/api4/properties.go", "package api4\n")
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "stack")
        _write(self.tmpdir, "server/channels/api4/properties.go", _OPTIONS_ROUTES)
        self._commit("first PR, before it was squashed")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/properties.go", _OPTIONS_ROUTES)
        self._commit("first PR, squashed into master")
        master = _git(self.tmpdir, "rev-parse", "HEAD")

        _git(self.tmpdir, "checkout", "stack")
        _git(self.tmpdir, "merge", "master", "-m", "merge master")
        _write(self.tmpdir, "server/channels/api4/properties.go",
               _OPTIONS_ROUTES.replace("}\n", '\tapi.BaseRoutes.Properties.Handle("/new", api.APISessionRequired(newOne)).Methods(http.MethodPost)\n}\n'))
        head = self._commit("second PR")

        self._point_checker(master, head)
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertEqual(result.additions, ["`POST /properties/new` (`newOne`)"])
        self.assertEqual(result.removals, [])

    def test_a_route_on_a_subrouter_is_reported_with_its_prefix(self):
        _write(self.tmpdir, "server/channels/api4/api.go", _API_ROUTES)
        _write(self.tmpdir, "server/channels/api4/properties.go", "package api4\n")
        base = self._commit("root")
        _git(self.tmpdir, "checkout", "-b", "feature")
        _write(self.tmpdir, "server/channels/api4/properties.go", _OPTIONS_ROUTES)
        head = self._commit("add routes")

        self._point_checker(base, head)
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertIn(
            "`DELETE /properties/groups/{group_name}/{object_type}/fields/{field_id}/options` (`deletePropertyFieldOptions`)",
            result.additions,
        )
        self.assertFalse(any(item.startswith("`DELETE /`") for item in result.additions))

    def test_stack_that_never_took_master_in_adds_nothing_master_already_has(self):
        """The #37851 case: its raw commits are in the stack, master has them squashed."""
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "stack")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        self._commit("first PR, before it was squashed")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        self._commit("first PR, squashed into master")
        master = _git(self.tmpdir, "rev-parse", "HEAD")

        _git(self.tmpdir, "checkout", "stack")  # never merged master
        _write(self.tmpdir, "server/channels/api4/bar.go", _HANDLE_BAR)
        head = self._commit("second PR")

        self._point_checker(master, head, "master")
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertEqual(result.additions, ["`POST /api/v4/bar` (`getBar`)"])
        self.assertEqual(result.removals, [])

    def test_cherry_pick_to_a_release_branch_is_compared_with_that_branch(self):
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        _write(self.tmpdir, "README", "start\n")
        self._commit("root")
        _git(self.tmpdir, "checkout", "-b", "release-12.0")
        _write(self.tmpdir, "RELEASE", "12.0\n")
        self._commit("release-only commit")
        release_tip = _git(self.tmpdir, "rev-parse", "HEAD")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        master_api = self._commit("add GET /foo on master")

        _git(self.tmpdir, "checkout", "-b", "pick", "release-12.0")
        _git(self.tmpdir, "cherry-pick", master_api)
        head = _git(self.tmpdir, "rev-parse", "HEAD")

        self._point_checker(release_tip, head, "release-12.0")
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertEqual(result.additions, ["`GET /api/v4/foo` (`getFoo`)"])

    def test_a_release_branch_pr_is_compared_with_the_release_line_not_master(self):
        # The release line added /foo and a new file after it was cut from master; a PR to the
        # release branch that removes /foo and edits that file is judged against the release line.
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        self._commit("root")
        _git(self.tmpdir, "checkout", "-b", "release-12.0")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        _write(self.tmpdir, "server/channels/api4/extra.go", "package api4\n")
        release_tip = self._commit("release-only: GET /foo and extra.go")

        _git(self.tmpdir, "checkout", "-b", "fix", "release-12.0")
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        _write(self.tmpdir, "server/channels/api4/extra.go", "package api4\n\n// a comment\n")
        head = self._commit("remove GET /foo and touch extra.go on the release branch")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "README", "master moves on\n")
        self._commit("master moves on")

        self._point_checker(release_tip, head, "release-12.0")
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertEqual(result.removals, ["`GET /api/v4/foo` (`getFoo`)"])
        self.assertNotIn("🆕 New API file: `extra.go`", result.changes)

    def test_a_route_master_already_removed_is_not_this_prs_removal(self):
        both = _HANDLE.replace("}\n", '\tr.Handle("/api/v4/baz", r.APIHandler(getBaz)).Methods("GET")\n}\n')
        _write(self.tmpdir, "server/channels/api4/post.go", both)
        self._commit("root")

        _git(self.tmpdir, "checkout", "-b", "stack")
        _write(self.tmpdir, "server/channels/api4/post.go", "package api4\n")
        head = self._commit("the stack removes both routes")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go",
               'package api4\n\nfunc Init() {\n\tr.Handle("/api/v4/baz", r.APIHandler(getBaz)).Methods("GET")\n}\n')
        self._commit("another PR removes /foo on master")
        master = _git(self.tmpdir, "rev-parse", "HEAD")

        self._point_checker(master, head, "master")
        result = checker.check_api(checker.split_patch_by_file(checker.get_full_patch()))
        self.assertEqual(result.removals, ["`GET /api/v4/baz` (`getBaz`)"], "/foo went with the other PR")
        self.assertEqual(result.additions, [])

    def test_net_changes_without_a_known_tip_uses_the_merge_base_and_head_alone(self):
        self.assertEqual(checker.net_changes({"a", "b"}, {"b", "c"}, None), ({"c"}, {"a"}))
        self.assertEqual(checker.net_changes({"a", "b"}, {"b", "c"}, {"c"}), (set(), set()))
        self.assertEqual(checker.net_changes({"a", "b"}, {"b", "c"}, {"a"}), ({"c"}, {"a"}))


_API_ROUTES = (
    'package api4\n\n'
    'func Init(api *API) {\n'
    '\tapi.BaseRoutes.Properties = api.BaseRoutes.APIRoot.PathPrefix("/properties").Subrouter()\n'
    '\tapi.BaseRoutes.PropertyFields = api.BaseRoutes.Properties.PathPrefix("/groups/{group_name:[a-z][a-z0-9_]*}/{object_type:[a-z]+}/fields").Subrouter()\n'
    '\tapi.BaseRoutes.PropertyField = api.BaseRoutes.PropertyFields.PathPrefix("/{field_id:[A-Za-z0-9]+}").Subrouter()\n'
    '\tapi.BaseRoutes.PropertyFieldOptions = api.BaseRoutes.PropertyField.PathPrefix("/options").Subrouter()\n'
    '}\n'
)

_OPTIONS_ROUTES = (
    'package api4\n\n'
    'func (api *API) InitProperties() {\n'
    '\tapi.BaseRoutes.PropertyFieldOptions.Handle("", api.APISessionRequired(getPropertyFieldOptions)).Methods(http.MethodGet)\n'
    '\tapi.BaseRoutes.PropertyFieldOptions.Handle("", api.APISessionRequired(deletePropertyFieldOptions)).Methods(http.MethodDelete)\n'
    '\tapi.BaseRoutes.Properties.Handle("/ping", api.APISessionRequired(pingProperties)).Methods(http.MethodGet)\n'
    '}\n'
)


class RoutePrefixTest(unittest.TestCase):
    def test_subrouter_prefixes_chain_from_their_parents(self):
        prefixes = checker._route_prefixes(_API_ROUTES)
        self.assertEqual(prefixes["Properties"], "/properties")
        self.assertEqual(
            prefixes["PropertyFieldOptions"],
            "/properties/groups/{group_name:[a-z][a-z0-9_]*}/{object_type:[a-z]+}/fields/{field_id:[A-Za-z0-9]+}/options",
        )

    def test_a_route_on_a_subrouter_keeps_its_prefix(self):
        endpoints = checker._parse_endpoints(_OPTIONS_ROUTES, checker._route_prefixes(_API_ROUTES))
        options = "/properties/groups/{group_name}/{object_type}/fields/{field_id}/options"
        self.assertEqual(endpoints, {
            (options, "getPropertyFieldOptions", "GET"),
            (options, "deletePropertyFieldOptions", "DELETE"),
            ("/properties/ping", "pingProperties", "GET"),
        })

    def test_a_path_variable_whose_pattern_has_braces_is_shortened_whole(self):
        # api4/health_dashboard.go: the pattern's own {32} must not leave a stray brace.
        src = ('\tapi.BaseRoutes.HealthFindings.Handle("/{fingerprint:[a-f0-9]{32}}/mute", '
               'api.APISessionRequired(muteHealthFinding)).Methods(http.MethodPost)\n')
        self.assertEqual(checker._parse_endpoints(src, {"HealthFindings": "/health/findings"}),
                         {("/health/findings/{fingerprint}/mute", "muteHealthFinding", "POST")})
        self.assertEqual(checker._shorten_path_vars("/{a:[0-9]{2,3}}/{b}/{c:x}"), "/{a}/{b}/{c}")

    def test_a_route_on_an_unknown_router_keeps_its_own_path(self):
        self.assertEqual(checker._parse_endpoints(_HANDLE), {("/api/v4/foo", "getFoo", "GET")})


if __name__ == "__main__":
    unittest.main()

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

    def _point_checker(self, base: str, head: str) -> None:
        checker.BASE_SHA = base
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
        release = _git(self.tmpdir, "rev-parse", "HEAD")

        _git(self.tmpdir, "checkout", "master")
        _write(self.tmpdir, "server/channels/api4/post.go", _HANDLE)
        master_api = self._commit("add GET /foo on master")

        _git(self.tmpdir, "checkout", "release-12.0")
        _git(self.tmpdir, "cherry-pick", master_api)
        head = _git(self.tmpdir, "rev-parse", "HEAD")

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


if __name__ == "__main__":
    unittest.main()

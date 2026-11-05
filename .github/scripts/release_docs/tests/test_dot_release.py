"""The dot release docs task: each rule, the PR across runs, and replays of two hand-made days."""

import os
import unittest
from datetime import datetime, timezone

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)

from release_docs import __main__ as cli  # noqa: E402
from release_docs import dot_release as dr  # noqa: E402
from release_docs.result import LABEL, TODO_MARKER, Result  # noqa: E402
from release_docs.versions import Version  # noqa: E402

from . import dot_replay  # noqa: E402
from .fakes import FakeGitHub  # noqa: E402

V = Version.parse
OCT22 = "2026-10-22"
OCT19 = "2026-10-19"
SECURITY_TEXT = ("Upgrading](https://docs.mattermost.com/upgrade/upgrading-mattermost-server.html) to this release is "
                 "recommended.")


def before_docs(day: str = OCT22) -> dict:
    return dot_replay.read_docs(day, "before", dot_replay.day_versions(day))


def note(text: str) -> str:
    return f"#### Summary\nA change.\n\n#### Release Note\n```release-note\n{text}\n```\n"


# ── Which kind of minor ─────────────────────────────────────────────────────────────

class MinorKindTest(unittest.TestCase):
    def test_from_the_server_releases_table(self):
        table = before_docs()[dr.SERVER_RELEASES]
        self.assertEqual(dr.deploy_tabs(table, V("v12.0.1")), ["latest"])
        self.assertEqual(dr.deploy_tabs(table, V("v11.7.14")), ["esr"])
        self.assertEqual(dr.deploy_tabs(table, V("v11.11.3")), [])
        self.assertIsNone(dr.deploy_tabs(table, V("v12.1.1")))
        self.assertEqual(dr.kind_name(["latest"]), "latest feature release")
        self.assertEqual(dr.kind_name(["esr"]), "current ESR")
        self.assertEqual(dr.kind_name([]), "older supported minor")

    def test_newest_extended_row_is_the_current_esr(self):
        def row(line, listed, end):
            return (f"| v{line} [Download](https://releases.mattermost.com/{listed}/mattermost-{listed}-linux-amd64.tar.gz) "
                    f"\\| [Changelog](./x) | 2026-01-01 | {end} |")
        table = "\n".join([row("11.7", "11.7.3", "2027-05-15 [EXTENDED](./release-policy#release-types)"),
                           row("11.6", "11.6.2", "2026-07-15"),
                           row("10.11", "10.11.9", "2026-08-15 [EXTENDED](./release-policy#release-types)")])
        self.assertEqual(dr.deploy_tabs(table, V("v11.7.4")), ["latest", "esr"])
        self.assertEqual(dr.kind_name(["latest", "esr"]), "latest feature release and current ESR")
        self.assertEqual(dr.deploy_tabs(table, V("v10.11.10")), [])


# ── The commit filters ──────────────────────────────────────────────────────────────

def commit(title, files, sha="abc", message=""):
    return {"title": title, "files": files, "sha": sha, "message": message or title}


class CommitFilterTest(unittest.TestCase):
    def test_version_bump_tooling_and_product(self):
        self.assertEqual(dr.skip_reason(commit("Update latest patch version to 12.1.1", ["server/public/model/version.go"]), False, False),
                         "version bump")
        for title, files in (("ci: cache the webapp build", [".github/workflows/ci.yml"]),
                             ("Fix flaky channel test", ["server/channels/app/channel_test.go"]),
                             ("[MM-1] Stabilise login e2e", ["e2e-tests/playwright/specs/login.spec.ts", "server/scripts/e2e.sh"]),
                             ("Pin the linter", ["server/Makefile"]),
                             ("e2e/ retry on timeout", ["webapp/channels/src/x.ts"])):
            self.assertEqual(dr.skip_reason(commit(title, files), False, False), "CI, test, e2e, lint or build tooling only", title)
        self.assertIsNone(dr.skip_reason(commit("Fix the login loop", ["server/channels/app/login.go", "server/channels/app/login_test.go"]),
                                         False, False))

    def test_go_and_plugin_bumps_are_covered_by_their_own_lines(self):
        go = commit("Bump Go to 1.25.9", ["server/.go-version", "server/build/Dockerfile.buildenv"])
        self.assertEqual(dr.skip_reason(go, True, False), "Go update: in the Go runtime line")
        plugin = commit("Update pre-packaged Boards plugin to v9.2.3", ["server/Makefile"])
        self.assertEqual(dr.skip_reason(plugin, False, True), "plugin update: in the pre-packaged plugin lines")
        self.assertEqual(dr.skip_reason(plugin, False, False), "plugin update, undone in this range")
        self.assertIsNone(dr.skip_reason(commit("Fix the plugin v1.2.3 upload", ["server/channels/app/plugin.go"]), False, True))

    def test_revert_pairs_cancel_out(self):
        commits = [commit("Add the thing (#10)", [], sha="aaaa1111"),
                   commit('Revert "Add the thing (#10)" (#11)', [], sha="bbbb2222"),
                   commit("Other (#12)", [], sha="cccc3333"),
                   commit('Revert "Something earlier"', [], sha="dddd4444", message='Revert "Something earlier"\n\nThis reverts commit cccc333.'),
                   commit('Revert "Not in range"', [], sha="eeee5555")]
        self.assertEqual(dr.revert_pairs(commits), {"aaaa1111", "bbbb2222", "cccc3333", "dddd4444"})

    def test_product_files(self):
        for path in ("server/channels/app/x.go", "webapp/channels/src/components/x.tsx", "server/Makefile"):
            self.assertTrue(dr.is_product_file(path), path)
        for path in (".github/workflows/x.yml", "e2e-tests/x.ts", "server/channels/app/x_test.go", "webapp/x/__snapshots__/a.snap",
                     "server/build/Dockerfile.buildenv", "server/channels/testlib/testdata/x.json"):
            self.assertFalse(dr.is_product_file(path), path)


# ── Bullets from notes, Claude, Go and plugins ──────────────────────────────────────

class NoteBulletsTest(unittest.TestCase):
    def test_pr_39380_rules_and_house_style(self):
        body = note("Fixed an issue where `mmctl` hung ([MM-123](https://mattermost.atlassian.net/browse/MM-123)). "
                    "Also fixed a crash in the **System Console** (#39001)\n"
                    "Added the `ServiceSettings.Foo` configuration setting under `ServiceSettings`.\n"
                    "Docs: https://docs.mattermost.com/x")
        self.assertEqual(dr.note_bullets(body), [
            "Fixed an issue where ``mmctl`` hung.",
            "Fixed a crash in the **System Console**.",
            "Added the ``ServiceSettings.Foo`` configuration setting under ``ServiceSettings``.",
        ])
        wrapped = note("- Fixed an issue where the **Threads** view\n  was empty.\n- Updated the bundled\nfonts.")
        self.assertEqual(dr.note_bullets(wrapped), ["Fixed an issue where the **Threads** view was empty.", "Updated the bundled fonts."])

    def test_dependency_module_is_not_a_go_update(self):
        self.assertIsNone(dr.GO_BUMP.search("Bump golang.org/x/net from 0.1.0 to 0.2.0"))
        self.assertIsNone(dr.GO_BUMP.search("Update github.com/foo/go-bar to 1.2.3"))
        self.assertTrue(dr.GO_BUMP.search("Upgrade golang to 1.25.9"))

    def test_no_note(self):
        self.assertEqual(dr.note_bullets(note("NONE")), [])
        self.assertEqual(dr.note_bullets("#### Summary\nNo note."), [])

    def test_claude_bullet_must_start_the_changelog_way(self):
        class Claude:
            def __init__(self, bullet):
                self.bullet, self.systems = bullet, []

            def ask_json(self, system, prompt, max_tokens=400):
                self.systems.append(system)
                return {"bullet": self.bullet}

        good = Claude("Fixed an issue where the **Threads** view was empty (MM-1)")
        self.assertEqual(dr.write_bullet(good, {"title": "x", "body": ""}, False), ("Fixed an issue where the **Threads** view was empty.", None))
        bullet, problem = dr.write_bullet(Claude("This PR fixes a thing"), {"title": "x"}, False)
        self.assertIsNone(bullet)
        self.assertIn("does not start the changelog way", problem)
        security = Claude("Fixed an issue with session handling.")
        self.assertEqual(dr.write_bullet(security, {"title": "x"}, True)[0], "Fixed an issue with session handling.")
        self.assertIn("never describe the\n  vulnerability", security.systems[0])
        self.assertEqual(dr.write_bullet(None, {"title": "x"}, False), (None, "ANTHROPIC_API_KEY is not set"))

    def test_plugin_name_is_the_changelogs_usual_one(self):
        link = "https://github.com/mattermost/mattermost-plugin-mscalendar/releases/tag/v1"
        changelogs = [f"- Pre-packaged Microsoft Calendar plugin version [v1]({link})\n"
                      f"- Pre-packaged MS Calendar plugin version [v1]({link})\n"
                      f"- Pre-packaged Microsoft Calendar plugin version [v1]({link})"]
        self.assertEqual(dr.plugin_name("mattermost-plugin-mscalendar", changelogs), "Microsoft Calendar")
        self.assertEqual(dr.plugin_name("mattermost-plugin-calls", []), "Calls")


class GatherGitHub:
    """Tags, commits, PRs and files for one release, without the docs."""

    def __init__(self, commits, pulls, files):
        self.commits, self.pulls, self.files = commits, pulls, files

    def commit(self, repo, sha):
        if sha.startswith("v"):
            return {"sha": "tagcommit0123456", "message": "Update latest patch version", "date": "2026-11-02T09:00:00Z",
                    "parents": [], "files": []}
        found = next(c for c in self.commits if c["sha"] == sha)
        return {"parents": [f"{sha}-parent"], "date": "2026-11-01T00:00:00Z", **found}

    def commits_between(self, repo, base, head):
        return [{"sha": c["sha"]} for c in self.commits]

    def pull(self, repo, number):
        return self.pulls.get(number)

    def commit_pulls(self, repo, sha):
        return []

    def file(self, repo, path, ref):
        return self.files.get((path, ref))


def pull(number, title, body="", labels=(), login="someone"):
    return {"number": number, "title": title, "body": body, "labels": [{"name": n} for n in labels], "user": {"login": login},
            "html_url": f"https://github.com/mattermost/mattermost/pull/{number}", "head": {"ref": "branch"}}


CONFIG_BEFORE = "type ServiceSettings struct {\n\tSiteURL *string\n}\n"
CONFIG_AFTER = "type ServiceSettings struct {\n\tSiteURL *string\n\tEnableFoo *bool\n}\n"


def release_scene():
    commits = [
        {"sha": "c01", "message": "Update latest patch version to 12.1.1 (#1)", "files": ["server/public/model/version.go"]},
        {"sha": "c02", "message": "Bump Go to 1.25.9 (#2)", "files": ["server/.go-version"]},
        {"sha": "c03", "message": "Update pre-packaged Boards plugin to v9.2.3 (#3)", "files": ["server/Makefile"]},
        {"sha": "c04", "message": "ci: speed up the workflow (#4)", "files": [".github/workflows/ci.yml"]},
        {"sha": "c05", "message": "Automated cherry pick of #50 (#5)", "files": ["server/channels/app/login.go"]},
        {"sha": "c06", "message": "Automated cherry pick of #50 (#6)", "files": ["webapp/channels/src/login.tsx"]},
        {"sha": "c07", "message": "Bump golang.org/x/net from 0.1.0 to 0.2.0 (#7)", "files": ["server/go.mod"]},
        {"sha": "c08", "message": "Tidy the channel settings modal (#8)", "files": ["webapp/channels/src/modal.tsx"]},
        {"sha": "c09", "message": "Tighten session checks (#9)", "files": ["server/channels/app/session.go"]},
        {"sha": "c10", "message": "Add the thing (#10)", "files": ["server/channels/app/thing.go"]},
        {"sha": "c11", "message": 'Revert "Add the thing (#10)" (#11)', "files": ["server/channels/app/thing.go"]},
        {"sha": "c12", "message": "Add EnableFoo (#12)", "files": [dr.CONFIG_GO, "server/channels/app/foo.go"]},
        {"sha": "c13", "message": "Index posts faster (#13)", "files": [f"{dr.MIGRATIONS_DIR}/000150_index.up.sql"]},
        {"sha": "c14", "message": "Change the default (#14)", "files": ["server/channels/app/default.go"]},
    ]
    pulls = {
        5: pull(5, "Automated cherry pick of #50", note("NONE")),
        6: pull(6, "Automated cherry pick of #50", note("NONE")),
        50: pull(50, "Fix the login loop", note("Fixed an issue where users were sent back to the login page.")),
        7: pull(7, "Bump golang.org/x/net from 0.1.0 to 0.2.0", "", login="dependabot[bot]"),
        8: pull(8, "Tidy the channel settings modal", note("NONE")),
        9: pull(9, "Tighten session checks", note("NONE"), labels=["Security"]),
        12: pull(12, "Add EnableFoo", note("Added the ``ServiceSettings.EnableFoo`` configuration setting.")),
        13: pull(13, "Index posts faster", note("Added an index to the posts table.")),
        14: pull(14, "Change the default", note("Changed the default of the thing."), labels=["Breaking Change"]),
    }
    files = {
        ("server/.go-version", "v12.1.0"): "1.25.8\n", ("server/.go-version", "v12.1.1"): "1.25.9\n",
        ("server/Makefile", "v12.1.0"): "PLUGIN_PACKAGES += mattermost-plugin-boards-v9.2.2\nPLUGIN_PACKAGES += mattermost-plugin-jira-v4.7.4\n",
        ("server/Makefile", "v12.1.1"): "PLUGIN_PACKAGES += mattermost-plugin-boards-v9.2.3\n",
        (dr.CONFIG_GO, "c12-parent"): CONFIG_BEFORE, (dr.CONFIG_GO, "c12"): CONFIG_AFTER,
    }
    return GatherGitHub(commits, pulls, files)


class WritingClaude:
    def __init__(self):
        self.asked = []

    def ask_json(self, system, prompt, max_tokens=400):
        self.asked.append(prompt.splitlines()[0])
        if "session" in prompt:
            return {"bullet": "Fixed an issue with session handling."}
        return {"bullet": "Updated the **Channel Settings** modal."}


class GatherTest(unittest.TestCase):
    def gather(self, claude=None, fetch=None):
        release = dr.Release(V("v12.1.1"), tabs=["latest"], severity="Medium")
        result = Result(dr.TASK, "v12.1.1")
        changelog = ("- Pre-packaged Boards plugin version [v9.2.2](https://github.com/mattermost/mattermost-plugin-boards/releases/tag/v9.2.2).")
        dr.gather(release_scene(), release, [changelog], claude or WritingClaude(), fetch or (lambda url, method="GET": (200, "")),
                  None, result)
        return release, result

    def test_entry(self):
        release, result = self.gather()
        self.assertEqual(result.todos, [])
        self.assertEqual(release.date, "2026-11-02")
        self.assertEqual(release.date_source, "the commit date of tag v12.1.1")
        self.assertEqual(release.go, ("1.25.8", "1.25.9"))
        self.assertEqual(dr.entry_lines(release), [
            "- **12.1.1, released 2026-11-02**",
            "  - Mattermost v12.1.1 contains Medium severity level security fixes. [" + SECURITY_TEXT +
            " Details will be posted on our [security updates page](https://mattermost.com/security-updates/) 30 days after release as "
            "per the [Mattermost Responsible Disclosure Policy](https://mattermost.com/security-vulnerability-report/).",
            "  - Go runtime was updated from 1.25.8 to 1.25.9.",
            "  - Pre-packaged Boards plugin version [v9.2.3](https://github.com/mattermost/mattermost-plugin-boards/releases/tag/v9.2.3).",
            "  - Removed the pre-packaged Jira plugin; it is no longer included with the server.",
            "  - Updated the **Channel Settings** modal.",
            "  - Changed the default of the thing.",
            "  - Fixed an issue where users were sent back to the login page.",
            "  - Fixed an issue with session handling.",
            "  - Mattermost v12.1.1 contains the following functional changes:",
            "     - Added the ``ServiceSettings.EnableFoo`` configuration setting.",
            "  - Mattermost v12.1.1 contains the following database changes:",
            "     - Added an index to the posts table.",
        ])

    def test_what_was_left_out_and_why(self):
        release, _ = self.gather()
        self.assertEqual([(s, r) for s, _, r in release.skipped], [
            ("#1", "version bump"),
            ("#2", "Go update: in the Go runtime line"),
            ("#3", "plugin update: in the pre-packaged plugin lines"),
            ("#4", "CI, test, e2e, lint or build tooling only"),
            ("#6", "same change as #50"),
            ("#7", "dependency update with no release note"),
            ("#10", "revert pair that cancels out"),
            ("#11", "revert pair that cancels out"),
        ])

    def test_a_pr_with_an_opt_out_label_is_left_out_even_with_a_release_note(self):
        scene = release_scene()
        scene.commits += [
            {"sha": "c15", "message": "Rework the sidebar (#15)", "files": ["webapp/channels/src/sidebar.tsx"]},
            {"sha": "c16", "message": "Automated cherry pick of #52 (#16)", "files": ["webapp/channels/src/list.tsx"]},
            {"sha": "c17", "message": "Reorder the menu (#17)", "files": ["webapp/channels/src/menu.tsx"]},
        ]
        scene.pulls[15] = pull(15, "Rework the sidebar", note("Reworked the sidebar layout."), labels=["Changelog/Not Needed"])
        scene.pulls[16] = pull(16, "Automated cherry pick of #52", note("NONE"), labels=["CherryPick/Approved"])
        scene.pulls[52] = pull(52, "Fix the list", note("Fixed an issue where the list was empty."), labels=["release-note-none"])
        scene.pulls[17] = pull(17, "Reorder the menu", note("Reordered the menu."), labels=["release-note/na"])
        release = dr.Release(V("v12.1.1"), tabs=["latest"], severity="none")
        dr.gather(scene, release, [], WritingClaude(), lambda url, method="GET": (200, ""), None, Result(dr.TASK, "v12.1.1"))
        texts = [c.text for c in release.changes]
        self.assertFalse(any("sidebar layout" in t or "list was empty" in t or "menu" in t.lower() for t in texts), texts)
        skipped = {s: r for s, _, r in release.skipped}
        self.assertEqual(skipped["#15"], "has the Changelog/Not Needed label, so it is left out")
        self.assertEqual(skipped["#52"], "has the release-note-none label, so it is left out")
        self.assertEqual(skipped["#17"], "has the release-note/na label, so it is left out")
        self.assertIn("#50", {c.source for c in release.changes})  # a PR without the label is still written up

    def test_a_security_fix_is_never_left_out_whatever_its_opt_out_label(self):
        for how in ("label", "jira"):
            scene = release_scene()
            scene.commits.append({"sha": "c18", "message": "Tighten session lookups (MM-5555) (#18)",
                                  "files": ["server/channels/app/session.go"]})
            scene.pulls[18] = pull(18, "Tighten session lookups (MM-5555)", note("Fixed a flaw that let anyone read sessions."),
                                   labels=["Changelog/Not Needed", "release-note-none"] + (["Security"] if how == "label" else []))
            release = dr.Release(V("v12.1.1"), tabs=["latest"], severity="Medium")
            claude = WritingClaude()
            jira = (lambda keys: {"security"} if "MM-5555" in keys else set()) if how == "jira" else None
            dr.gather(scene, release, [], claude, lambda url, method="GET": (200, ""), jira, Result(dr.TASK, "v12.1.1"))
            changes = [c for c in release.changes if c.source == "#18"]
            self.assertEqual([(c.text, c.security, c.written) for c in changes],
                             [("Fixed an issue with session handling.", True, False)], how)  # Claude's vague one, never the note
            self.assertEqual([(s[1], s[3]) for s in release.opted_out_security], [("#18", "Changelog/Not Needed")], how)
            self.assertNotIn("#18", [s for s, _, _ in release.skipped], how)
            state = {"order": ["v12.1.1"], "versions": {"v12.1.1": dr.release_state(release)}}
            text = dr.details(state, {}, [], "branch")
            self.assertIn("**v12.1.1 security fix with the Changelog/Not Needed label**, from [#18]", text)
            self.assertTrue(any("Tighten session lookups" in a for a in claude.asked), how)

    def test_a_security_fix_with_an_opt_out_label_needs_claude(self):
        scene = release_scene()
        scene.commits.append({"sha": "c19", "message": "Tighten token checks (#19)", "files": ["server/channels/app/token.go"]})
        scene.pulls[19] = pull(19, "Tighten token checks", note("NONE"), labels=["release-note-none", "Security"])

        class Down:
            def ask_json(self, *args, **kwargs):
                raise RuntimeError("overloaded")
        release = dr.Release(V("v12.1.1"), tabs=["latest"], severity="none")
        result = Result(dr.TASK, "v12.1.1")
        dr.gather(scene, release, [], Down(), lambda url, method="GET": (200, ""), None, result)
        self.assertTrue(any("no bullet for #19" in t for t in result.todos), result.todos)  # a TODO, not a silent drop

    def test_written_security_and_breaking_are_marked(self):
        release, _ = self.gather()
        by_source = {c.source: c for c in release.changes}
        self.assertEqual(by_source["#50"].source, "#50")
        self.assertTrue(by_source["#8"].written)
        self.assertTrue(by_source["#9"].written and by_source["#9"].security)
        self.assertTrue(by_source["#14"].breaking)
        self.assertFalse(by_source["#50"].written or by_source["#50"].security)
        self.assertEqual(by_source["#13"].maybe_breaking, [])

    def test_wording_alone_asks_a_person_and_adds_no_callout(self):
        scene = release_scene()
        scene.pulls[13] = pull(13, "Index posts faster", note("Posts are no longer indexed twice."))
        scene.pulls[12] = pull(12, "Add EnableFoo", note("Added the ``ServiceSettings.EnableFoo`` configuration setting.\n"
                                                         "Removed ``ServiceSettings.Old`` configuration setting."))
        release = dr.Release(V("v12.1.1"), tabs=["latest"], severity="none")
        dr.gather(scene, release, [], WritingClaude(), lambda url, method="GET": (200, ""), None, Result(dr.TASK, "v12.1.1"))
        by_source = {c.source: c for c in release.changes}
        self.assertFalse(by_source["#13"].breaking)
        self.assertEqual(by_source["#13"].maybe_breaking, ['release note says "no longer": Posts are no longer indexed twice.'])
        self.assertTrue(by_source["#12"].breaking)
        state = {"order": ["v12.1.1"], "versions": {"v12.1.1": dr.release_state(release)}}
        text = dr.details(state, {}, [], "branch")
        self.assertIn("- [ ] **v12.1.1 possible breaking change** (no callout added), from "
                      "[#13](https://github.com/mattermost/mattermost/pull/13): Posts are no longer indexed twice.", text)
        self.assertIn("**v12.1.1 breaking change callout**, from [#12]", text)

    def test_no_claude_leaves_a_todo_not_a_guess(self):
        class Down:
            def ask_json(self, *args, **kwargs):
                raise RuntimeError("overloaded")
        release, result = self.gather(claude=Down())
        texts = [c.text for c in release.changes]
        self.assertTrue(any(t.startswith(f"{TODO_MARKER}: v12.1.1: no bullet for #8") for t in texts))
        self.assertIn("v12.1.1: no bullet for #8 (Tidy the channel settings modal): Claude could not write it: overloaded", result.todos)

    def test_plugin_release_page_must_exist(self):
        _, result = self.gather(fetch=lambda url, method="GET": (404, "") if "boards" in url else (200, ""))
        self.assertEqual(result.todos, ["v12.1.1: the changelog links mattermost-plugin-boards v9.2.3, but its GitHub release page "
                                        "is not public (not found)"])

    def test_go_version_prefers_the_pinned_file(self):
        gh = GatherGitHub([], {}, {("server/.go-version", "v10.11.24"): "1.25.8\n",
                                   ("server/build/Dockerfile.buildenv", "v10.11.24"): "FROM mattermost/golang-bullseye:1.24.5@sha256:x\n"})
        self.assertEqual(dr.go_version(gh, "v10.11.24"), ("1.25.8", "v10.11.24: server/.go-version says 1.25.8, "
                                                          "server/build/Dockerfile.buildenv says 1.24.5; used 1.25.8"))
        gh = GatherGitHub([], {}, {("server/build/Dockerfile.buildenv", "v9.0.1"): "FROM golang:1.21.3\n"})
        self.assertEqual(dr.go_version(gh, "v9.0.1"), ("1.21.3", ""))


# ── Severity ────────────────────────────────────────────────────────────────────────

class SeverityTest(unittest.TestCase):
    def test_inputs(self):
        versions = [V("v12.1.1"), V("v11.7.15")]
        result = Result(dr.TASK, "x")
        self.assertEqual(dr.parse_severities("v12.1.1=medium, v11.7.15=low to medium", versions, result),
                         {"v12.1.1": "Medium", "v11.7.15": "Low to Medium"})
        self.assertEqual(dr.parse_severities("High fix", versions, result), {"v12.1.1": "High fix", "v11.7.15": "High fix"})
        self.assertEqual(dr.parse_severities("v12.1.1: none", versions, result), {"v12.1.1": "none"})
        self.assertEqual(dr.parse_severities("", versions, result), {})
        self.assertEqual(result.todos, [])
        self.assertEqual(dr.parse_severities("v12.1.1=severe", versions, result), {})
        self.assertEqual(len(result.todos), 1)

    def test_line(self):
        self.assertTrue(dr.security_line(V("v12.1.1"), "Medium").startswith(
            "Mattermost v12.1.1 contains Medium severity level security fixes. [Upgrading]"))
        self.assertTrue(dr.security_line(V("v12.1.1"), "High fix").startswith(
            "Mattermost v12.1.1 contains a High severity level security fix. [Upgrading]"))
        self.assertTrue(dr.security_line(V("v12.1.1"), None).startswith(
            "Mattermost v12.1.1 contains \\<SEVERITY> severity level security fixes."))
        self.assertIsNone(dr.security_line(V("v12.1.1"), "none"))


# ── The changelog ───────────────────────────────────────────────────────────────────

HEADING = "## Release v12.1 - [Feature Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types) \\{#release-v12-1-feature-release}"
FIRST = f"""# Changelog

{HEADING}

<Attention>

**Breaking Changes**
 - Removed the old thing.

</Attention>

**Release day: 2026-10-16**

### Improvements
 - Added a thing.

## Release v12.0 - [Major Release](https://docs.mattermost.com/product-overview/release-policy.html#release-types) \\{{#release-v12-0-major-release}}

- **12.0.1, released 2026-09-30**
  - Original bullet.
"""


def simple_release(version, changes=(), severity="none", date="2026-11-02"):
    return dr.Release(V(version), date=date, severity=severity, changes=[dr.Change(t, **kw) for t, kw in changes])


class ChangelogTest(unittest.TestCase):
    def test_first_dot_release_replaces_the_release_day_and_moves_the_callout(self):
        result = Result(dr.TASK, "x")
        text = dr.update_changelog(FIRST, simple_release("v12.1.1", [("Fixed an issue where a thing broke.", {})]), result)
        self.assertEqual(result.todos, [])
        self.assertEqual(text.split("## Release v12.0")[0], f"""# Changelog

{HEADING}

- **12.1.1, released 2026-11-02**
  - Fixed an issue where a thing broke.
  - Mattermost v12.1.1 contains no database or functional changes.
- **12.1.0, released 2026-10-16**
  - Original 12.1.0 release.

<Attention>

**Breaking Changes**
 - Removed the old thing.

</Attention>

### Improvements
 - Added a thing.

""")
        self.assertEqual(dr.mdx_issues(text), dr.mdx_issues(FIRST))
        self.assertEqual(dr.changelog_listed(text, V("v12.1.1")), V("v12.1.1"))

    def test_later_dot_release_goes_above_the_newest_one(self):
        result = Result(dr.TASK, "x")
        first = dr.update_changelog(FIRST, simple_release("v12.1.1", [("Fixed an issue where a thing broke.", {})]), result)
        second = dr.update_changelog(first, simple_release("v12.1.2", [("Fixed an issue where another thing broke.", {})],
                                                           date="2026-11-20"), result)
        lines = second.split("\n")
        start = lines.index(HEADING)
        self.assertEqual(lines[start + 2:start + 8], [
            "- **12.1.2, released 2026-11-20**",
            "  - Fixed an issue where another thing broke.",
            "  - Mattermost v12.1.2 contains no database or functional changes.",
            "- **12.1.1, released 2026-11-02**",
            "  - Fixed an issue where a thing broke.",
            "  - Mattermost v12.1.1 contains no database or functional changes.",
        ])
        self.assertEqual(dr.update_changelog(second, simple_release("v12.1.2"), result), second)
        self.assertEqual(second.count("Original 12.1.0 release."), 1)
        self.assertNotIn("12.0.2", second)

    def test_breaking_change_gets_a_callout(self):
        result = Result(dr.TASK, "x")
        first = dr.update_changelog(FIRST, simple_release("v12.1.1"), result)
        text = dr.update_changelog(first, simple_release("v12.1.2", [("Changed the default of the thing.", {"breaking": True})]), result)
        lines = text.split("\n")
        start = lines.index(HEADING)
        self.assertEqual(lines[start + 1:start + 8], ["", "<Attention>", "", "**Breaking Changes**",
                                                      " - v12.1.2: Changed the default of the thing.", "", "</Attention>"])
        again = dr._add_breaking(lines, V("v12.1.3"), [dr.Change("Removed a setting.", breaking=True)])
        self.assertEqual(again[start + 5:start + 9], [" - v12.1.2: Changed the default of the thing.", " - v12.1.3: Removed a setting.",
                                                      "", "</Attention>"])
        self.assertEqual(dr.mdx_issues(text), dr.mdx_issues(FIRST))

    def test_one_fix_and_no_security_line(self):
        lines = dr.entry_lines(simple_release("v12.1.1", [("Fixed an issue where a thing broke.", {})], severity="High fix"))
        self.assertIn("contains a High severity level security fix.", lines[1])
        lines = dr.entry_lines(simple_release("v12.1.1", [("Fixed an issue where a thing broke.", {})]))
        self.assertEqual(lines[1], "  - Fixed an issue where a thing broke.")

    def test_no_section_is_a_todo(self):
        result = Result(dr.TASK, "x")
        self.assertEqual(dr.update_changelog(FIRST, simple_release("v11.9.3"), result), FIRST)
        self.assertEqual(len(result.todos), 1)


# ── Deploy pages, server releases row, version archive ──────────────────────────────

class FileEditsTest(unittest.TestCase):
    def setUp(self):
        self.docs = before_docs()
        self.result = Result(dr.TASK, "x")

    def test_deploy_pages_latest_tab(self):
        for page in dr.DEPLOY_PAGES:
            before = self.docs[page]
            after = dr.update_deploy(before, V("v12.0.1"), ["latest"], page, self.result)
            self.assertEqual(dr.tab_version(after, "latest"), V("v12.0.1"))
            self.assertEqual(dr.tab_version(after, "esr"), V("v11.7.13"))
            self.assertIn("releases.mattermost.com/12.0.1/mattermost-12.0.1-linux-amd64.tar.gz", after)
            self.assertNotIn("12.0.0", after[after.find('value="latest"'):after.find('value="esr"')])
            self.assertEqual(after.replace("12.0.1", "12.0.0"), before)
        self.assertEqual(self.result.todos, [])

    def test_deploy_pages_esr_tab_and_older_minor(self):
        page = dr.DEPLOY_PAGES[0]
        after = dr.update_deploy(self.docs[page], V("v11.7.14"), ["esr"], page, self.result)
        self.assertEqual((dr.tab_version(after, "latest"), dr.tab_version(after, "esr")), (V("v12.0.0"), V("v11.7.14")))
        self.assertEqual(dr.update_deploy(self.docs[page], V("v11.11.3"), [], page, self.result), self.docs[page])
        self.assertEqual(dr.update_deploy(after, V("v11.7.13"), ["esr"], page, self.result), after)

    def test_server_releases_row(self):
        before = self.docs[dr.SERVER_RELEASES]
        after = dr.update_server_row(before, V("v11.11.3"), self.result)
        changed = [(a, b) for a, b in zip(before.split("\n"), after.split("\n")) if a != b]
        self.assertEqual(len(changed), 1)
        old, new = changed[0]
        self.assertEqual(old.count("11.11.2"), 6)
        self.assertEqual(new.count("11.11.3"), 6)
        self.assertEqual(new.replace("11.11.3", "11.11.2"), old)
        self.assertIn("#release-v11-11-feature-release", new)
        self.assertEqual(dr.update_server_row(after, V("v11.11.3"), self.result), after)
        self.assertEqual(self.result.todos, [])

    def test_version_archive_in_place(self):
        before = self.docs[dr.ARCHIVE]
        after = dr.update_archive(before, V("v11.7.14"), {"enterprise": "a" * 64, "team": None}, self.result)
        self.assertEqual(self.result.todos, [])
        for tab, sha in (("mattermost-enterprise", "a" * 64), ("mattermost-team-edition", dr.TBD)):
            lines = after.split("\n")
            start, end, listed = dr._archive_block(lines, tab, V("v11.7.14"))
            block = "\n".join(lines[start:end])
            self.assertEqual(listed, V("v11.7.14"))
            self.assertIn("v11.7.14 *Extended Support Release (ESR)* - [View Changelog](https://docs.mattermost.com/product-overview/"
                          "mattermost-v11-changelog.html#release-v11-7-extended-support-release)", block)
            self.assertIn(f"SHA-256 Checksum: `{sha}`", block)
            self.assertNotIn("11.7.13", block)
        self.assertEqual(dr.archive_tbd(after, V("v11.7.14")), ["team"])
        self.assertEqual(len(after.split("\n")), len(before.split("\n")))


# ── Consistency and the PR's check ──────────────────────────────────────────────────

class ConsistencyTest(unittest.TestCase):
    def setUp(self):
        self.base = before_docs()
        self.release = dr.Release(V("v11.11.3"), tabs=[], date="2026-10-22")
        result = Result(dr.TASK, "x")
        self.files = dict(self.base)
        self.files[dr.SERVER_RELEASES] = dr.update_server_row(self.base[dr.SERVER_RELEASES], V("v11.11.3"), result)
        self.files[dr.ARCHIVE] = dr.update_archive(self.base[dr.ARCHIVE], V("v11.11.3"), {"enterprise": "a" * 64, "team": "b" * 64}, result)
        path = dr.changelog_path(V("v11.11.3"))
        self.files[path] = dr.update_changelog(self.base[path], self.release, result)

    def test_clean(self):
        self.assertEqual(dr.consistency(self.files, self.base, [self.release]), ([], []))

    def test_leftovers_and_disagreement(self):
        self.files[dr.SERVER_RELEASES] = self.files[dr.SERVER_RELEASES].replace(
            "sbom-enterprise-v11.11.3.json", "sbom-enterprise-v11.11.2.json")
        self.files[dr.ARCHIVE] = self.base[dr.ARCHIVE]
        problems, _ = dr.consistency(self.files, self.base, [self.release])
        self.assertIn(f"{dr.SERVER_RELEASES}: the v11.11 row still has 11.11.2 or not every link moved to 11.11.3", problems)
        self.assertIn("v11.11 does not agree: server releases 11.11.3, version archive (Enterprise) 11.11.2, "
                      "version archive (Team Edition) 11.11.2, changelog 11.11.3", problems)

    def test_two_entries_and_mdx(self):
        path = dr.changelog_path(V("v11.11.3"))
        entry = "\n".join(dr.entry_lines(self.release))
        self.files[path] = self.files[path].replace(entry, entry + "\n" + entry)
        self.files[dr.DEPLOY_PAGES[0]] = self.base[dr.DEPLOY_PAGES[0]].replace("</TabItem>\n", "", 1)
        self.files[dr.SERVER_RELEASES] = self.files[dr.SERVER_RELEASES].replace("| 2026-09-16 | 2026-12-15 |", "| 2026-09-16 | x | 2026-12-15 |")
        problems, _ = dr.consistency(self.files, self.base, [self.release])
        self.assertIn(f"{path}: 2 entries for 11.11.3, expected one", problems)
        self.assertIn(f"{dr.DEPLOY_PAGES[0]}: <TabItem> without a closing tag", problems)
        self.assertIn(f"{dr.SERVER_RELEASES}: a server releases row without three cells", problems)
        self.files[path] = self.files[path].replace("<Attention>\n\n", "<Attention>\n", 1)
        self.assertIn(f"{path}: no blank line around <Attention>",
                      dr.consistency(self.files, self.base, [self.release])[0])

    def test_other_minors_are_reported_not_fixed(self):
        self.base[dr.ARCHIVE] = self.base[dr.ARCHIVE].replace("Edition v11.10.3 ", "Edition v11.10.2 ")
        self.files[dr.ARCHIVE] = self.files[dr.ARCHIVE].replace("Edition v11.10.3 ", "Edition v11.10.2 ")
        problems, others = dr.consistency(self.files, self.base, [self.release])
        self.assertEqual(problems, [])
        self.assertEqual(others, ["v11.10 does not agree: server releases 11.10.3, version archive (Enterprise) 11.10.2, "
                                  "version archive (Team Edition) 11.10.2, changelog 11.10.3"])


def replay_run(day=OCT22, versions=None, severity=None, fetch=None, gh=None, live=False):
    config = dot_replay.DAYS[day]
    versions = versions or dot_replay.day_versions(day)
    recorded = dot_replay.load(day)
    gh = gh or dot_replay.ReplayGitHub(recorded, before_docs(day))
    env = {"SEVERITY": config["severity"] if severity is None else severity, "RELEASE_DATE": day, "WAIT_ATTEMPTS": "1"}
    return dr.run(gh, versions, env, dot_replay.TitleClaude(), fetch or dot_replay.replay_fetch(recorded), live,
                  jira_labels=dot_replay.jira_labels)


class CheckTest(unittest.TestCase):
    def test_severity_and_tbd_keep_the_check_failing(self):
        recorded = dot_replay.load(OCT22)
        published = dot_replay.replay_fetch(recorded)

        def fetch(url, method="GET"):
            return (404, "") if "mattermost-team-12.0.1" in url else published(url, method)

        result, _, _ = replay_run(versions=[V("v12.0.1")], severity="", fetch=fetch)
        self.assertIn("v12.0.1: severity not given (<SEVERITY> in the changelog)", result.todos)
        self.assertIn("v12.0.1: the Team Edition SHA-256 is TBD (its .sha256 file is not published yet)", result.todos)
        self.assertIn("**v12.0.1 severity:** not given", result.body)
        self.assertIn("**v12.0.1 Team Edition SHA-256:** TBD", result.body)
        base = before_docs()
        files = {**base, **result.files}
        self.assertEqual(dr.check_pr(result.title, files, base), [
            "v12.0.1: the changelog still says <SEVERITY>",
            "v12.0.1: the Team Edition SHA-256 in the version archive is TBD",
        ])
        path = dr.changelog_path(V("v12.0.1"))
        files[path] = dr.set_severity(files[path], V("v12.0.1"), "Medium")
        files[dr.ARCHIVE] = files[dr.ARCHIVE].replace(f"SHA-256 Checksum: `{dr.TBD}`", "SHA-256 Checksum: `" + "f" * 64 + "`")
        self.assertEqual(dr.check_pr(result.title, files, base), [])
        files[path] += f"\n{TODO_MARKER}: something\n"
        self.assertEqual(dr.check_pr(result.title, files, base), [f"{path} has a TODO(release-agent) marker"])

    def test_check_command(self):
        result, _, _ = replay_run(versions=[V("v11.11.3")], severity="")
        with self.subTest("fails on <SEVERITY>"):
            self.assertEqual(self._check(result.title, result.files), 1)
        path = dr.changelog_path(V("v11.11.3"))
        fixed = {**result.files, path: dr.set_severity(result.files[path], V("v11.11.3"), "Medium")}
        self.assertEqual(self._check(result.title, fixed), 0)

    def _check(self, title, changed):
        import io
        import subprocess
        import tempfile
        from contextlib import redirect_stdout
        base = before_docs()
        with tempfile.TemporaryDirectory() as root:
            def write(files):
                for path, text in files.items():
                    os.makedirs(os.path.dirname(os.path.join(root, path)), exist_ok=True)
                    with open(os.path.join(root, path), "w", encoding="utf-8") as f:
                        f.write(text)
            git = ["git", "-C", root, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"]
            subprocess.run(["git", "init", "-q", root], check=True)
            write(base)
            subprocess.run([*git, "add", "."], check=True)
            subprocess.run([*git, "commit", "-qm", "base"], check=True)
            write(changed)
            subprocess.run([*git, "commit", "-qam", "docs"], check=True)
            cwd = os.getcwd()
            os.chdir(root)
            try:
                with redirect_stdout(io.StringIO()):
                    return cli.check_dot_release_pr({"PR_TITLE": title, "BASE_REF": "HEAD^1", "REPO_ROOT": root})
            finally:
                os.chdir(cwd)


# ── The PR across runs ──────────────────────────────────────────────────────────────

class DotGitHub(FakeGitHub):
    """The docs on branches, as the fake GitHub keeps them; tags, commits and PRs from a recorded day."""

    def __init__(self, day=OCT22):
        super().__init__()
        self.recorded = dot_replay.load(day)
        self.replay = dot_replay.ReplayGitHub(self.recorded, {})
        self.add_repo(dr.REPO, before_docs(day))

    def file(self, repo, path, ref):
        if ref in self.repos[repo]["branches"]:
            return super().file(repo, path, ref)
        return self.replay.file(repo, path, ref)

    def branches_with_prefix(self, repo, prefix):
        return [b for b in self.repos[repo]["branches"] if b.startswith(prefix)]

    def remove_label(self, repo, number, label):
        self.writes.append(("remove_label", repo, number, label))
        pr = next(p for p in self.pulls[repo] if p["number"] == number)
        pr["labels"] = [name for name in pr["labels"] if name != label]

    def commit_pulls(self, repo, sha):
        return self.replay.commit_pulls(repo, sha)

    def __getattr__(self, name):
        if name in ("tag_sha", "commit", "commits_between", "pull"):
            return getattr(self.replay, name)
        raise AttributeError(name)


class AutomationTest(unittest.TestCase):
    def run_day(self, gh, versions, live=True, severity=None):
        return replay_run(versions=[V(v) for v in versions], gh=gh, live=live, severity=severity)

    def test_dry_run_changes_nothing(self):
        gh = DotGitHub()
        result, outcome, _ = self.run_day(gh, ["v12.0.1", "v11.7.14"], live=False)
        self.assertEqual(gh.writes, [])
        self.assertTrue(outcome.startswith("Dry run: would have opened a draft PR from `release-agent/dot-release-docs/v12.0.1`"))
        self.assertEqual(result.title, "Add dot release docs for server v12.0.1, v11.7.14")
        self.assertEqual(result.branch, "release-agent/dot-release-docs/v12.0.1")

    def test_one_pr_for_the_releases_shipped_together(self):
        gh = DotGitHub()
        branch = "release-agent/dot-release-docs/v12.0.1"
        _, outcome, _ = self.run_day(gh, ["v12.0.1"])
        self.assertTrue(outcome.startswith("Opened draft PR mattermost/mattermost#"), outcome)
        pr = gh.pulls[dr.REPO][0]
        self.assertEqual((pr["head"], pr["base"], pr["draft"]), (branch, "master", True))
        self.assertEqual(pr["title"], "Add dot release docs for server v12.0.1")
        self.assertEqual(pr["labels"], sorted([LABEL, "release-note-none", "Changelog/Not Needed", dr.AWAITING_LABEL]))
        self.assertIn("#### Release Note\n```release-note\nNONE\n```", pr["body"])

        person = "  - Fixed an issue where a person's edit was kept."
        path = dr.changelog_path(V("v12.0.1"))
        text = gh.head_files(dr.REPO, branch)[path].replace("- **12.0.1, released 2026-10-22**",
                                                            "- **12.0.1, released 2026-10-22**\n" + person)
        gh.push(dr.REPO, branch, {path: text}, author="A Person")
        person_sha = gh.branch_sha(dr.REPO, branch)

        _, outcome, _ = self.run_day(gh, ["v11.7.14"])
        self.assertTrue(outcome.startswith(f"Updated PR mattermost/mattermost#{pr['number']}"), outcome)
        self.assertEqual(len(gh.pulls[dr.REPO]), 1)
        self.assertEqual(pr["title"], "Add dot release docs for server v12.0.1, v11.7.14")
        commits = gh.repos[dr.REPO]["branches"][branch]
        self.assertEqual(commits[-2]["sha"], person_sha)
        head = gh.head_files(dr.REPO, branch)
        self.assertIn(person, head[path])
        self.assertIn("- **11.7.14, released 2026-10-22**", head[dr.changelog_path(V("v11.7.14"))])
        self.assertEqual(dr.tab_version(head[dr.DEPLOY_PAGES[0]], "esr"), V("v11.7.14"))
        self.assertEqual(dr.tab_version(head[dr.DEPLOY_PAGES[0]], "latest"), V("v12.0.1"))
        self.assertIn("- v11.7.14: commits on `release-11.7`", pr["body"])
        self.assertIn("- v12.0.1: commits on `release-12.0`", pr["body"])

        writes = len(gh.writes)
        _, outcome, _ = self.run_day(gh, ["v12.0.1", "v11.7.14"])
        self.assertEqual(gh.writes[writes:], [])
        self.assertIn("is already up to date", outcome)

        for tag in ("v12.0.1", "v11.7.14"):
            gh.releases[(dr.REPO, tag)] = {"tag_name": tag, "prerelease": False}
        self.run_day(gh, ["v12.0.1"])
        self.assertEqual(gh.writes[writes:], [("remove_label", dr.REPO, pr["number"], dr.AWAITING_LABEL)])
        self.assertNotIn(dr.AWAITING_LABEL, pr["labels"])

    def test_severity_given_later_fills_in_the_open_pr(self):
        gh = DotGitHub()
        branch = "release-agent/dot-release-docs/v11.11.3"
        self.run_day(gh, ["v11.11.3"], severity="")
        path = dr.changelog_path(V("v11.11.3"))
        self.assertIn(dr.SEVERITY_PLACEHOLDER, gh.head_files(dr.REPO, branch)[path])
        result, _, _ = self.run_day(gh, ["v11.11.3"], severity="Medium")
        head = gh.head_files(dr.REPO, branch)[path]
        self.assertNotIn(dr.SEVERITY_PLACEHOLDER, head)
        self.assertIn("Mattermost v11.11.3 contains Medium severity level security fixes.", head)
        self.assertEqual(result.todos, [])

    def test_already_published_and_untagged_versions(self):
        result, outcome, _ = replay_run(versions=[V("v11.11.2")], gh=dot_replay.ReplayGitHub({"tag_sha v11.11.2": "x"}, before_docs()))
        self.assertIn("v11.11.2 is already in the version archive on master; skipped.", result.notes)
        self.assertEqual(outcome, "Nothing to do: no dot release to add.")
        result, _, _ = replay_run(versions=[V("v12.0.2")], gh=dot_replay.ReplayGitHub({"tag_sha v12.0.2": None}, before_docs()))
        self.assertEqual(result.todos, ["v12.0.2: not tagged yet"])
        result, _, _ = replay_run(versions=[V("v12.1.1")], gh=dot_replay.ReplayGitHub({"tag_sha v12.1.1": "x"}, before_docs()))
        self.assertEqual(result.todos, ["v12.1.1: the server releases table on master has no v12.1 row, so this is a feature release"])

    def test_closed_pr_branch_is_not_reused(self):
        gh = DotGitHub()
        gh.create_branch(dr.REPO, "release-agent/dot-release-docs/v12.0.1", gh.branch_sha(dr.REPO, "master"))
        writes = list(gh.writes)
        result, outcome, _ = self.run_day(gh, ["v12.0.1"])
        self.assertEqual(gh.writes, writes)
        self.assertTrue(outcome.startswith("Nothing written: release-agent/dot-release-docs/v12.0.1 already exists"), outcome)


class EventsTest(unittest.TestCase):
    def test_version_archive_leaves_dot_releases_to_this_task(self):
        event = {"action": "published", "release": {"tag_name": "v12.1.1"}}
        env = {"EVENT_NAME": "release"}
        self.assertEqual(cli.resolve("version-archive", env, event),
                         {"run": "false", "reason": "v12.1.1 is a dot release: handled by the dot release docs PR"})
        self.assertEqual(cli.resolve(dr.TASK, env, event)["run"], "true")
        self.assertEqual(cli.resolve(dr.TASK, env, {"action": "published", "release": {"tag_name": "v12.1.0"}})["run"], "false")
        self.assertEqual(cli.resolve("version-archive", env, {"action": "published", "release": {"tag_name": "v12.1.0"}})["run"], "true")
        run = cli.run_task("version-archive", "v12.1.1", {"EVENT_NAME": "workflow_dispatch"}, FakeGitHub(), None, None)
        self.assertEqual(run.result.skipped, "v12.1.1 is a dot release: handled by the dot release docs PR")

    def test_dispatch_versions(self):
        resolved = cli.resolve(dr.TASK, {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": "v12.1.1, 11.7.15 v12.1.1"}, {})
        self.assertEqual(resolved, {"run": "true", "version": "v12.1.1,v11.7.15", "mode": "dry_run", "reason": "dispatched"})
        live = cli.resolve(dr.TASK, {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": "v12.1.1", "PHASE3_MODE": "live"}, {})
        self.assertEqual(live["mode"], "live")
        with self.assertRaises(ValueError):
            cli.resolve(dr.TASK, {"EVENT_NAME": "workflow_dispatch", "INPUT_VERSION": ""}, {})

    def test_release_event_also_checks_the_others_published_with_it(self):
        class Releases:
            def recent_releases(self, repo, count=30):
                return [{"tag_name": "v12.1.1", "created_at": "2026-11-02T08:00:00Z"},
                        {"tag_name": "v11.7.15", "created_at": "2026-11-02T07:00:00Z", "prerelease": True},
                        {"tag_name": "v12.2.0", "created_at": "2026-11-02T07:00:00Z"},
                        {"tag_name": "v11.11.9", "created_at": "2026-11-02T07:00:00Z", "draft": True},
                        {"tag_name": "v11.6.9", "created_at": "2026-10-20T07:00:00Z"}]
        now = datetime(2026, 11, 2, 12, tzinfo=timezone.utc)
        self.assertEqual(cli.released_together(Releases(), V("v12.1.1"), now), [V("v11.7.15")])


# ── Replays: the task against two days that were documented by hand ─────────────────

class ReplayTest(unittest.TestCase):
    def replay(self, day):
        versions = dot_replay.day_versions(day)
        result, outcome, _ = replay_run(day)
        before, after = before_docs(day), dot_replay.read_docs(day, "after", versions)
        generated = {p: result.files.get(p, before[p]) for p in dot_replay.docs_paths(versions)}
        return versions, result, outcome, before, after, generated

    def assert_exact(self, generated, after, paths):
        for path in paths:
            self.assertEqual(generated[path], after[path], path)

    def test_2026_10_22(self):
        versions, result, outcome, before, after, generated = self.replay(OCT22)
        self.assertTrue(outcome.startswith("Dry run:"))
        self.assertEqual(result.todos, ["v12.0.1: the changelog links mattermost-plugin-dataminr v3.0.0, but its GitHub release "
                                        "page is not public (not found)"])
        self.assertIn("v10.11.24: server/.go-version says 1.25.8, server/build/Dockerfile.buildenv says 1.24.5; used 1.25.8",
                      result.notes)
        self.assert_exact(generated, after, [*dr.DEPLOY_PAGES, dr.SERVER_RELEASES, dr.ARCHIVE])
        for path in {dr.changelog_path(v) for v in versions}:
            got = dot_replay.trim(path, generated[path], versions)
            self.assertEqual(dot_replay.changelog_shape(got), dot_replay.changelog_shape(after[path]), path)
            self.assertEqual(dot_replay.entries(got)[1].keys(), dot_replay.entries(after[path])[1].keys())
        self.assertEqual(result.title, "Add dot release docs for server v12.0.1, v11.11.3, v11.10.4, v11.7.14, v10.11.25")

    def test_2026_10_19(self):
        """Deploy pages, server releases and version archive exactly; v11.11.2 and v11.10.3 the same shape.

        v11.7.13 differs where the hand-made PR did: its EnableFileIndexing setting is listed as a
        functional change (the rule; by hand it was a plain bullet), and the OpenSearch node discovery
        bullet came from #39151's description rather than its release note. Bullets the hand-made PR
        added to the earlier 11.7.12 entry are not added: the task never edits earlier entries.
        """
        versions, result, _, before, after, generated = self.replay(OCT19)
        self.assertEqual(result.todos, [])
        self.assert_exact(generated, after, [*dr.DEPLOY_PAGES, dr.SERVER_RELEASES, dr.ARCHIVE])
        path = dr.changelog_path(V("v11.7.13"))
        got = dot_replay.trim(path, generated[path], versions)
        _, got_entries = dot_replay.entries(dot_replay.plugin_order_free(got))
        _, want_entries = dot_replay.entries(dot_replay.plugin_order_free(after[path]))
        # The hand-made entries also list three PRs that carry release-note-none and Changelog/Not
        # Needed: #38781 (a PDF parsing bump) and, in v11.10.3, #38479 and #38048. The task leaves a
        # PR with an opt-out label out, as the changelog generator does, unless it is a security fix:
        # #38479 and #38048 are (their Jira tickets have the security label), so they stay, with a
        # vague bullet to confirm. #38781 has no security signal, so it is left out and listed.
        for tag, dropped in (("11.11.2", 1), ("11.10.3", 1)):
            self.assertEqual(got_entries[tag]["fixes"], want_entries[tag]["fixes"] - dropped, tag)
            self.assertEqual({k: v for k, v in got_entries[tag].items() if k != "fixes"},
                             {k: v for k, v in want_entries[tag].items() if k != "fixes"}, tag)
        for source in ("#38479", "#38048"):
            self.assertIn(f"security fix with the Changelog/Not Needed label**, from [{source}]", result.body)
        self.assertIn("v11.10.3: #38781 Bump mattermost/pdf for content-stream array parsing fix: has the Changelog/Not Needed label, "
                      "so it is left out", result.body)
        self.assertNotIn("#38479 MM-70601", result.body.split("**Left out**")[1])
        self.assertEqual(got_entries["11.7.13"]["fixed"][:2], want_entries["11.7.13"]["fixed"][:2])
        entry = dr._entry_text(got, V("v11.7.13")).split("\n")
        self.assertEqual(dot_replay.closing_kind([line.removeprefix("  - ") for line in entry[-2:]]),
                         ["Mattermost v11.7.13 contains the following functional changes:"])
        self.assertIn("EnableFileIndexing", entry[-1])
        want = dr._entry_text(after[path], V("v11.7.13"))
        self.assertIn("node discovery", want)
        self.assertEqual(got_entries["11.7.13"]["fixes"], want_entries["11.7.13"]["fixes"] - 1)
        self.assertEqual(dr._entry_text(got, V("v11.7.12")), dr._entry_text(before[path], V("v11.7.12")))


if __name__ == "__main__":
    unittest.main()

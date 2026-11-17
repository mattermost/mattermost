"""Breaking-change signals from the changelog and the release diff, and the upgrade pages they fill."""

import json
import os
import types
import unittest
from datetime import date
from unittest import mock

for name, value in {"GITHUB_TOKEN": "test", "REPOS": "mattermost/mattermost", "MILESTONE": "v12.2.0", "VERSION": "v12.2.0"}.items():
    os.environ.setdefault(name, value)

from release_docs import __main__ as cli  # noqa: E402
from release_docs import breaking, breaking_diff, changelog_run, release_docs_pr, report, upgrade_docs  # noqa: E402
from release_docs import hub as hublib  # noqa: E402
from release_docs.result import TODO_MARKER, Result  # noqa: E402
from release_docs.versions import Version  # noqa: E402

from .hub_fakes import FakeHub  # noqa: E402
from .test_breaking import SERVER, milestone_github, note  # noqa: E402
from .test_tasks import real_docs  # noqa: E402

ENT = "mattermost/enterprise"
PHRASES = breaking.strong_phrases()


# ── 1. Strong signals ───────────────────────────────────────────────────────────────

class PhraseSignalsTest(unittest.TestCase):
    def test_rules_yml_lists_the_strong_phrases(self):
        self.assertEqual(PHRASES, ["breaking change", "no longer supported", "will fail to start", "must be re-signed",
                                   "before upgrading", "is removed", "deprecated"])

    def test_a_listed_phrase_is_strong_and_other_wording_stays_weak(self):
        strong = breaking.signals([], note("Plugins signed with SHA-1 must be re-signed with SHA-256."), phrases=PHRASES)
        self.assertEqual(strong, [('release note says "must be re-signed": Plugins signed with SHA-1 must be re-signed '
                                   'with SHA-256.', True)])
        for text in ("Upgrade PostgreSQL BEFORE upgrading.", "The ``Foo`` setting is removed.",
                     "OpenSearch 1.x is no longer\tsupported.", "Deprecated the ``Bar`` API."):
            with self.subTest(text):
                self.assertEqual([s for _, s in breaking.signals([], note(text), phrases=PHRASES)], [True])
        for text in ("Removed an unused helper.", "The page no longer flickers.", "Users must now sign in again."):
            with self.subTest(text):
                self.assertEqual([s for _, s in breaking.signals([], note(text), phrases=PHRASES)], [False])
        # "is removed" is a phrase, not "removed": a word inside another one doesn't count either.
        self.assertEqual(breaking.signals([], note("Fixed the undeprecated path."), phrases=PHRASES), [])

    def test_a_rules_file_without_phrases_is_refused(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".yml", delete=False) as f:
            f.write("breaking_changes:\n  strong_phrases: []\n")
        self.addCleanup(os.unlink, f.name)
        with self.assertRaises(ValueError):
            breaking.strong_phrases(breaking.Path(f.name))


ITEMS = [
    {"section": "Upgrade Impact", "subsection": "Compatibility", "text": "Plugin signatures using SHA-1 are now rejected.",
     "sources": [f"{SERVER}#201"]},
    {"section": "API Changes", "subsection": None, "text": "Removed ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.",
     "sources": [f"{SERVER}#202"]},
    {"section": "Upgrade Impact", "subsection": "config.json",
     "text": "Removed ``ServiceSettings.EnableLegacy`` configuration setting.", "sources": [f"{ENT}#7"]},
    {"section": "Upgrade Impact", "subsection": "Database Schema Changes",
     "text": "Dropped the ``Props`` column from the ``Users`` table.", "sources": ["migration:000151_drop_props"]},
    {"section": "Upgrade Impact", "subsection": "Database Schema Changes",
     "text": "Added a new ``Grants`` table.", "sources": ["migration:000152_grants"]},
    {"section": "API Changes", "subsection": None, "text": "Added ``GET /api/v4/things`` API endpoint.",
     "sources": [f"{SERVER}#203"]},
    {"section": "Improvements", "subsection": "User Interface", "text": "Removed the old sidebar.", "sources": [f"{SERVER}#204"]},
]


class ChangelogSignalsTest(unittest.TestCase):
    def test_where_the_changelog_placed_a_bullet_is_strong(self):
        found = breaking.changelog_signals(ITEMS, {"000151_drop_props": f"{SERVER}#105"}.get)
        self.assertEqual(sorted(found), [f"{ENT}#7", f"{SERVER}#105", f"{SERVER}#201", f"{SERVER}#202"])
        self.assertTrue(all(strong for reasons in found.values() for _, strong in reasons))
        self.assertTrue(found[f"{SERVER}#201"][0][0].startswith("changelog places it under Upgrade Impact/Compatibility"))
        self.assertTrue(found[f"{SERVER}#202"][0][0].startswith("changelog: a removed API endpoint"))
        self.assertTrue(found[f"{ENT}#7"][0][0].startswith("changelog: a removed config setting"))
        self.assertTrue(found[f"{SERVER}#105"][0][0].startswith("changelog: a destructive schema change"))

    def test_the_candidate_list_takes_the_changelog_signals(self):
        result = breaking.run(milestone_github(), [SERVER], "v12.2.0", "", None, changelog_items=ITEMS[:2],
                              phrases=PHRASES)
        self.assertIn("- [ ] [mattermost/mattermost#201](https://github.com/mattermost/mattermost/pull/201) (not in the "
                      "milestone) (strong signal)", result.text)
        self.assertIn("  - changelog: a removed API endpoint: Removed ``GET /api/v4/usage/posts``", result.text)
        self.assertIn(f"{SERVER}#201", result.state["candidates"])
        unread = breaking.run(milestone_github(), [SERVER], "v12.2.0", "", None)
        self.assertIn("the changelog run's sections.json was not read, so the changelog's placements were not used",
                      unread.notes)


# ── 2. Diff signals ─────────────────────────────────────────────────────────────────

class DiffGitHub:
    """Files by (path, ref), and commits with patches and PRs for attributing a change."""

    def __init__(self, base: dict, head: dict, commits=()):
        self.files = {"v12.1.0": base, "release-12.2": head}
        self.commits = list(commits)  # (sha, {path: patch}, pr number)

    def file(self, repo, path, ref):
        return self.files[ref].get(path)

    def list_dir(self, repo, path, ref):
        return sorted(p.rsplit("/", 1)[1] for p in self.files[ref] if p.rsplit("/", 1)[0] == path)

    def merge_base_date(self, repo, base, head):
        return "2026-10-16T09:00:00Z"

    def commits_for_path(self, repo, path, ref, since):
        return [sha for sha, patches, _ in self.commits if any(p.startswith(path) for p in patches)]

    def commit_patches(self, repo, sha):
        return next(patches for s, patches, _ in self.commits if s == sha)

    def commit_pulls(self, repo, sha):
        number = next(n for s, _, n in self.commits if s == sha)
        return [{"number": number, "html_url": f"https://github.com/{repo}/pull/{number}"}]


API_OLD = "type API interface {\n\t// Gets a user.\n\tGetUser(userID string) (*model.User, *model.AppError)\n\tGetTeam(teamID string) (*model.Team, *model.AppError)\n\tKVGet(key string) ([]byte, *model.AppError)\n}\n"
API_NEW = "type API interface {\n\tGetUser(userID string) (*model.User, *model.AppError)\n\tKVGet(key string, opts ...Option) ([]byte, *model.AppError)\n}\n"
CONFIG_OLD = ("const (\n\tServiceSettingsDefaultListen = \":8065\"\n)\n\n"
              "func (s *ServiceSettings) SetDefaults(isUpdate bool) {\n\tif s.ListenAddress == nil {\n"
              "\t\ts.ListenAddress = new(ServiceSettingsDefaultListen)\n\t}\n\n\tif s.EnableLinks == nil {\n"
              "\t\ts.EnableLinks = NewPointer(true)\n\t}\n}\n\n\tMinimumPostgresMajorVersion = 14\n")
CONFIG_NEW = CONFIG_OLD.replace("NewPointer(true)", "NewPointer(false)").replace("= 14", "= 15")
MMCTL_OLD = ('var UserCmd = &cobra.Command{\n\tUse: "user",\n}\n\nvar UserMigrateCmd = &cobra.Command{\n\tUse: "migrate-auth [from] [to]",\n}\n\n'
             'func init() {\n\tUserCmd.Flags().Bool("all", false, "x")\n\tUserCmd.Flags().StringP("team", "t", "", "x")\n}\n')
MMCTL_NEW = ('var UserCmd = &cobra.Command{\n\tUse: "user",\n}\n\nfunc init() {\n\tUserCmd.Flags().Bool("all", false, "x")\n}\n')
EN_OLD = json.dumps([{"id": "web.error.unsupported_browser.min_browser_version.chrome", "translation": "Version 150+"}])
EN_NEW = json.dumps([{"id": "web.error.unsupported_browser.min_browser_version.chrome", "translation": "Version 156+"}])


def diff_github():
    base = {breaking_diff.PLUGIN_FILES["API"]: API_OLD, breaking_diff.CONFIG: CONFIG_OLD,
            f"{breaking_diff.MMCTL_DIR}/user.go": MMCTL_OLD, breaking_diff.PUBLIC_GO_MOD: "module x\n\ngo 1.26.10\n",
            breaking_diff.EN_JSON: EN_OLD}
    head = {breaking_diff.PLUGIN_FILES["API"]: API_NEW, breaking_diff.CONFIG: CONFIG_NEW,
            f"{breaking_diff.MMCTL_DIR}/user.go": MMCTL_NEW, breaking_diff.PUBLIC_GO_MOD: "module x\n\ngo 1.27.3\n",
            breaking_diff.EN_JSON: EN_NEW}
    commits = [
        ("c1", {breaking_diff.PLUGIN_FILES["API"]: "@@\n-\tGetTeam(teamID string) (*model.Team, *model.AppError)\n"}, 301),
        ("c2", {breaking_diff.PLUGIN_FILES["API"]: "@@\n-\tKVGet(key string) ([]byte, *model.AppError)\n+\tKVGet(key string, "
                                                   "opts ...Option) ([]byte, *model.AppError)\n"}, 302),
        ("c3", {breaking_diff.CONFIG: "@@\n-\t\ts.EnableLinks = NewPointer(true)\n+\t\ts.EnableLinks = NewPointer(false)\n"}, 303),
        ("c4", {f"{breaking_diff.MMCTL_DIR}/user.go": "@@\n-var UserMigrateCmd = &cobra.Command{\n"
                                                      "-\tUserCmd.Flags().StringP(\"team\", \"t\", \"\", \"x\")\n"}, 304),
        ("c5", {breaking_diff.CONFIG: "@@\n-\tMinimumPostgresMajorVersion = 14\n+\tMinimumPostgresMajorVersion = 15\n"}, 305),
    ]
    return DiffGitHub(base, head, commits)


class DiffSignalsTest(unittest.TestCase):
    def setUp(self):
        self.found, self.problems = breaking_diff.diff_changes(diff_github(), SERVER, "v12.1.0", "release-12.2")
        self.by_reason = {f["reason"]: f["pr"] for f in self.found}

    def pr_of(self, words):
        return next(pr for reason, pr in self.by_reason.items() if words in reason)

    def test_plugin_api_methods_removed_or_changed(self):
        self.assertEqual(self.pr_of("method ``GetTeam`` was removed"), f"{SERVER}#301")
        self.assertEqual(self.pr_of("method ``KVGet`` changed from ``KVGet(key string)"), f"{SERVER}#302")
        self.assertFalse([r for r in self.by_reason if "GetUser" in r])  # unchanged, comment ignored

    def test_a_changed_config_default(self):
        self.assertEqual(self.pr_of("the default of ``ServiceSettings.EnableLinks`` changed from ``true`` to ``false``"),
                         f"{SERVER}#303")
        self.assertFalse([r for r in self.by_reason if "ListenAddress" in r])  # a constant, unchanged
        self.assertEqual(breaking_diff.config_defaults(CONFIG_OLD)["ServiceSettings.ListenAddress"], '":8065"')
        wrapped = "const (\n\tTeamSettingsDefaultMaxChannelsPerTeam = 2000\n)\n\nfunc (s *TeamSettings) SetDefaults() {\n" \
                  "\tif s.MaxChannelsPerTeam == nil {\n\t\ts.MaxChannelsPerTeam = new(int64(TeamSettingsDefaultMaxChannelsPerTeam))\n\t}\n}\n"
        self.assertEqual(breaking_diff.config_defaults(wrapped), {"TeamSettings.MaxChannelsPerTeam": "int64(2000)"})

    def test_removed_mmctl_commands_and_flags(self):
        self.assertEqual(self.pr_of("the ``mmctl migrate-auth`` command (``UserMigrateCmd``) was removed"), f"{SERVER}#304")
        self.assertEqual(self.pr_of("the ``--team`` flag of ``mmctl user`` was removed"), f"{SERVER}#304")

    def test_raised_minimum_versions(self):
        self.assertEqual(self.pr_of("the minimum PostgreSQL version went from 14 to 15"), f"{SERVER}#305")
        self.assertIsNone(self.pr_of("now needs Go 1.27.3 (was 1.26.10)"))  # no commit found: no PR, never a guess
        self.assertIsNone(self.pr_of("the minimum Chrome version went from 150 to 156"))
        self.assertEqual(self.problems, [])

    def test_apidiff_output_is_parsed_without_noise(self):
        output = ("Ignoring internal package github.com/mattermost/mattermost/server/public/plugin/checker/internal/x\n"
                  "- ./model.(*Client4).GetPostsUsage: removed\n"
                  "- ./model.IsEmptyPropertyValue: changed from func(encoding/json.RawMessage) bool to func(encoding/json.RawMessage) bool\n"
                  "- ./model.PostMetadata.PropertyValuesUnavailable: changed from bool to *bool\n"
                  "- ./model.PropertyValue.Value: changed from encoding/json.RawMessage to encoding/json/jsontext.Value\n"
                  "- ./plugin.API.GetClusterNodes: added\n")
        self.assertEqual(breaking_diff.parse_apidiff(output), [
            ("model", "(*Client4).GetPostsUsage", "removed"),
            ("model", "PostMetadata.PropertyValuesUnavailable", "changed from bool to *bool"),
        ])
        gh = DiffGitHub({}, {}, [("c9", {"server/public/model/client4.go": "@@\n-func (c *Client4) GetPostsUsage(\n"}, 309)])
        owners = breaking_diff.Owners(gh, SERVER, "release-12.2", "2026-10-16T09:00:00Z")
        found = breaking_diff.apidiff_changes(output, owners)
        self.assertEqual([f["pr"] for f in found], [f"{SERVER}#309", None])
        self.assertIn("``model.(*Client4).GetPostsUsage`` removed", found[0]["reason"])

    def test_without_go_apidiff_is_skipped_with_a_reason(self):
        with mock.patch.object(breaking_diff.shutil, "which", return_value=None):
            self.assertEqual(breaking_diff.run_apidiff("v12.1.0", "release-12.2"),
                             (None, "Go is not installed, so the server/public module was not compared (apidiff)"))


# ── Reading the changelog runs ──────────────────────────────────────────────────────

REPORTS = [
    {"version": "v12.2.0", "sections": [{"section": "API Changes", "subsection": None, "items": [
        {"text": "Removed ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.", "sources": [f"{SERVER}#202"]}]}]},
    {"version": "v12.2.0", "sections": [{"section": "Upgrade Impact", "subsection": "Compatibility", "items": [
        {"text": "Plugin signatures using SHA-1 are now rejected.", "sources": [f"{SERVER}#201"]},
        {"text": "Removed  ``GET /api/v4/usage/posts`` (``getPostsUsage``) API endpoint.", "sources": [f"{SERVER}#202"]}]}]},
]
ENTRY = ("## Release v12.2 - Feature Release\n\n### Upgrade Impact\n\n#### Compatibility\n"
         " - Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256.\n\n### API Changes\n"
         " - Added ``GET /api/v4/things`` API endpoint.\n")


class ChangelogRunTest(unittest.TestCase):
    def test_every_run_for_the_release_is_read_and_each_bullet_once(self):
        found = changelog_run.items(REPORTS)
        self.assertEqual([(i["section"], i["sources"]) for i in found],
                         [("API Changes", [f"{SERVER}#202"]), ("Upgrade Impact", [f"{SERVER}#201"])])

    def test_a_bullet_takes_the_entrys_current_wording_and_a_deleted_one_is_left_out(self):
        found = changelog_run.items(REPORTS)
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#201", found, ENTRY), [{
            "section": "Upgrade Impact", "subsection": "Compatibility", "sources": [f"{SERVER}#201"],
            "text": "Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256."}])
        self.assertEqual(changelog_run.bullets_for(f"{SERVER}#202", found, ENTRY), [])  # a reviewer deleted it

    def test_reports_come_from_the_changelog_workflows_artifacts(self):
        calls = []

        def run(args, capture_output, text, env):
            calls.append(args)
            if args[1:3] == ["run", "list"]:
                return types.SimpleNamespace(returncode=0, stdout=json.dumps([{"databaseId": 2}, {"databaseId": 1}]))
            target = args[args.index("-D") + 1]
            os.makedirs(target)
            with open(os.path.join(target, "sections.json"), "w") as f:
                json.dump({"version": "v12.2.0" if args[3] == "2" else "v12.1.0", "sections": []}, f)
            return types.SimpleNamespace(returncode=0, stdout="")
        reports, problem = changelog_run.fetch_reports("v12.2.0", "actions-token", run=run)
        self.assertEqual((len(reports), problem), (1, None))
        self.assertIn("generate-changelog.yml", calls[0])
        self.assertEqual(changelog_run.fetch_reports("v12.2.0", "")[1], "no token that can read Actions (ACTIONS_TOKEN)")


# ── 3. The upgrade pages ────────────────────────────────────────────────────────────

BULLETS = {
    f"{SERVER}#201": [{"section": "Upgrade Impact", "subsection": "Compatibility",
                       "text": "Plugin signatures using SHA-1 are now rejected. See [the guide](https://docs.mattermost.com/x)."}],
    f"{SERVER}#202": [{"section": "API Changes", "subsection": None,
                       "text": "Removed ``GET /api/v4/usage/{kind}`` (``getUsage``) API endpoint."}],
    f"{ENT}#7": [{"section": "Upgrade Impact", "subsection": "config.json",
                  "text": "Removed ``ServiceSettings.EnableLegacy`` configuration setting."}],
    f"{SERVER}#204": [{"section": "Improvements", "subsection": "User Interface", "text": "Refreshed the sidebar."}],
}


class UpgradeDocsTest(unittest.TestCase):
    def test_confirmed_items_take_their_changelog_wording(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"], [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"],
                                 [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"], BULLETS, {})
        self.assertTrue(docs.complete)
        self.assertEqual([e.source for e in docs.notes], [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"])
        self.assertEqual([e.source for e in docs.removed], [f"{SERVER}#202", f"{ENT}#7"])  # removals only
        self.assertEqual(docs.drafted(), [])

    def test_unconfirmed_candidates_keep_the_placeholder_and_the_run_failing(self):
        docs = upgrade_docs.plan([f"{SERVER}#201"], [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"], [f"{SERVER}#201"], BULLETS, {})
        self.assertEqual(docs.pending, 2)
        self.assertFalse(docs.complete)
        self.assertIn("2 breaking-change candidate(s) are neither confirmed nor removed", docs.todos[0])
        never = upgrade_docs.plan([], None, None, {}, {})
        self.assertIn("the breaking-change list hasn't run for this release", never.todos[0])

    def test_claude_drafts_only_for_a_public_pr_with_no_bullet_and_it_is_marked_for_review(self):
        docs = upgrade_docs.plan([f"{SERVER}#204", f"{ENT}#8"], [f"{SERVER}#204", f"{ENT}#8"], [f"{SERVER}#204", f"{ENT}#8"],
                                 BULLETS, {f"{SERVER}#204": "The sidebar was removed; pin channels again after upgrading.",
                                           f"{ENT}#8": "never used"})
        self.assertEqual([(e.source, e.drafted) for e in docs.notes], [(f"{SERVER}#204", True)])
        self.assertEqual(docs.todos, ["1 confirmed breaking change(s) from a private repo have no changelog bullet in "
                                      "Upgrade Impact or API Changes: write their upgrade notes by hand"])
        self.assertNotIn("enterprise", " ".join(docs.todos))
        missing = upgrade_docs.plan([f"{SERVER}#204"], [f"{SERVER}#204"], [f"{SERVER}#204"], BULLETS, {})
        self.assertIn(f"{SERVER}#204 is a confirmed breaking change with no changelog bullet", missing.todos[0])

    def test_the_row_and_entry_templates(self):
        entries = [upgrade_docs.Entry("a", "Removed ``GET /x/{id}`` & <b>. See [the guide](https://d/x)."),
                   upgrade_docs.Entry("b", "Upgrade **before** you start.")]
        self.assertEqual(upgrade_docs.note_rows("v12.2", entries),
                         '<tr>\n<td rowspan="2">v12.2</td>\n<td><p>Removed <code>GET /x/&#123;id&#125;</code> &amp; &lt;b&gt;. '
                         'See <a href="https://d/x">the guide</a>.</p></td>\n</tr>\n'
                         '<tr>\n<td><p>Upgrade <strong>before</strong> you start.</p></td>\n</tr>\n')
        self.assertTrue(upgrade_docs.note_rows("v12.2", entries[1:]).startswith("<tr>\n<td>v12.2</td>\n"))
        self.assertEqual(upgrade_docs.removed_section("v12.2", date(2026, 12, 16), entries[:1]),
                         "### Mattermost Server v12.2 (December 2026)\n\n- Removed ``GET /x/{id}`` & <b>. See "
                         "[the guide](https://d/x).\n\n")

    def build(self, docs):
        files = {**real_docs(), release_docs_pr.POSTGRES_REQUIREMENT: "\tMinimumPostgresMajorVersion = 15\n"}
        return release_docs_pr.build(Version.parse("v12.2.0"), files, "v10.11,v11.7,v12.4", date(2026, 12, 16), 15,
                                     [], None, docs)

    def test_the_release_docs_pr_writes_only_confirmed_items(self):
        docs = upgrade_docs.plan([f"{SERVER}#201", f"{ENT}#7"], [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"],
                                 [f"{SERVER}#201", f"{SERVER}#202", f"{ENT}#7"], BULLETS, {})
        result = self.build(docs)
        notes, removed = result.files[release_docs_pr.UPGRADE_NOTES], result.files[release_docs_pr.DEPRECATED_FEATURES]
        self.assertIn('<tbody>\n<tr>\n<td rowspan="2">v12.2</td>\n<td><p>Plugin signatures using SHA-1 are now rejected.',
                      notes)
        self.assertIn("### Mattermost Server v12.2 (December 2026)\n\n- Removed ``ServiceSettings.EnableLegacy`` "
                      "configuration setting.\n\n### Mattermost Server v12.0", removed)
        self.assertNotIn("getUsage", notes + removed)  # #202 was reviewed but not confirmed
        self.assertNotIn(release_docs_pr.PLACEHOLDER_MARKER + ": v12.2 Important", notes)
        self.assertFalse([t for t in result.todos if "breaking" in t or "upgrade note" in t])  # (the calendar isn't given)
        self.assertIn("- [x] Important Upgrade Notes: 2 row(s) from confirmed breaking changes", result.body)
        self.assertNotIn(ENT, result.body)
        self.assertEqual(cli.release_docs_problems(result.files), [])

    def test_pending_candidates_leave_the_placeholders_and_fail_the_check(self):
        docs = upgrade_docs.plan([f"{SERVER}#201"], [f"{SERVER}#201", f"{SERVER}#202"], [f"{SERVER}#201"], BULLETS, {})
        result = self.build(docs)
        notes = result.files[release_docs_pr.UPGRADE_NOTES]
        self.assertIn("Plugin signatures using SHA-1", notes)  # the confirmed one is written...
        self.assertIn(f"{release_docs_pr.PLACEHOLDER_MARKER}: v12.2 Important Upgrade Notes", notes)  # ...the rest waits
        self.assertNotIn("getUsage", notes)
        self.assertTrue(result.failed)
        self.assertEqual(len(cli.release_docs_problems(result.files)), 2)
        self.assertIn("- [ ] Important Upgrade Notes: 1 row(s)", result.body)

    def test_a_drafted_row_is_listed_for_review_in_the_pr_body(self):
        docs = upgrade_docs.plan([f"{SERVER}#204"], [f"{SERVER}#204"], [f"{SERVER}#204"], BULLETS,
                                 {f"{SERVER}#204": "The sidebar was removed."})
        body = self.build(docs).body
        self.assertIn("Drafted by Claude, because the PR has no changelog bullet in Upgrade Impact or API Changes.", body)
        self.assertIn(f"- [ ] {SERVER}#204", body)

    def test_a_rerun_gives_the_same_pages(self):
        docs = upgrade_docs.plan([f"{SERVER}#201"], [f"{SERVER}#201", f"{SERVER}#202"], [f"{SERVER}#201"], BULLETS, {})
        first = self.build(docs).files[release_docs_pr.UPGRADE_NOTES]
        placeholder = release_docs_pr.placeholder(Version.parse("v12.2.0"), "Important Upgrade Notes")
        self.assertEqual(upgrade_docs.fill(first.replace("Plugin signatures using SHA-1 are now rejected. See "
                                                         '<a href="https://docs.mattermost.com/x">the guide</a>.', "x"),
                                           "<tbody>\n", "", placeholder, True).count(placeholder), 1)

    def test_the_check_ignores_the_ui_accessibility_placeholder(self):
        page = "<tbody>\n{/* release-agent placeholder: v12.2 UI & Accessibility changelog rows, filled in a later PR. */}\n"
        self.assertEqual(cli.release_docs_problems({release_docs_pr.UPGRADE_NOTES: page}), [])
        self.assertEqual(cli.release_docs_problems({release_docs_pr.DEPRECATED_FEATURES: f"- {TODO_MARKER}: x\n"}),
                         [f"{release_docs_pr.DEPRECATED_FEATURES} has a {TODO_MARKER} marker"])


# ── Confirmations kept in Hub ───────────────────────────────────────────────────────

ENV = {"MODE": "dry_run", "REVIEW_CHANNEL_ID": "review", "MM_TOKEN": "t"}


class ConfirmationStateTest(unittest.TestCase):
    def test_the_list_and_the_confirmation_are_kept_apart_in_hub(self):
        hub = FakeHub()
        listing = Result(breaking.TASK, "v12.2.0", text="the list", private=True)
        listing.state = {"candidates": [f"{SERVER}#201", f"{SERVER}#202"]}
        report.deliver(listing, ENV, hub)
        state, _ = report.read_state(hub, ENV, breaking.TASK, "v12.2.0")
        self.assertEqual(state, {"candidates": [f"{SERVER}#201", f"{SERVER}#202"]})
        self.assertEqual(report.read_state(hub, ENV, breaking.TASK, "v12.2.0", breaking.DECISION), (None, None))

        result = breaking.run(milestone_github(), [SERVER], "v12.2.0", "201", None, listed=state["candidates"])
        self.assertEqual((result.report_kind, result.state),
                         (breaking.DECISION, {"confirmed": [f"{SERVER}#201"], "reviewed": [f"{SERVER}#201", f"{SERVER}#202"]}))
        report.deliver(result, ENV, hub)
        self.assertEqual(report.read_state(hub, ENV, breaking.TASK, "v12.2.0", breaking.DECISION)[0]["confirmed"],
                         [f"{SERVER}#201"])
        self.assertEqual(report.read_state(hub, ENV, breaking.TASK, "v12.2.0")[0], state)  # the list is still there

    def test_none_confirmed_decides_on_every_listed_candidate(self):
        result = breaking.run(milestone_github(), [SERVER], "v12.2.0", "none", None, listed=[f"{SERVER}#202"])
        self.assertEqual(result.state, {"confirmed": [], "reviewed": [f"{SERVER}#202"]})

    def test_the_release_docs_pr_reads_the_confirmations_from_the_dry_run_channel(self):
        hub = FakeHub()
        listing = Result(breaking.TASK, "v12.2.0", text="the list", private=True)
        listing.state = {"candidates": [f"{SERVER}#201", f"{SERVER}#202"]}
        report.deliver(listing, ENV, hub)
        decision = breaking.run(milestone_github(), [SERVER], "v12.2.0", "201", None, listed=listing.state["candidates"])
        report.deliver(decision, ENV, hub)
        items = changelog_run.items(REPORTS)
        with mock.patch.object(hublib, "from_env", return_value=hub), \
                mock.patch.object(changelog_run, "fetch_reports", return_value=(REPORTS, None)), \
                mock.patch.object(cli, "changelog_entry", return_value=(ENTRY, "")):
            # A live release docs run reads where breaking-changes (always a dry run) reported.
            docs = cli.upgrade_from_breaking_changes({**ENV, "MODE": "live", "REVIEW_CHANNEL_ID": "review"},
                                                     milestone_github(), milestone_github(), None, Version.parse("v12.2.0"))
        self.assertTrue(docs.complete)
        self.assertEqual([(e.source, e.text) for e in docs.notes],
                         [(f"{SERVER}#201", "Plugin signatures that use SHA-1 are now rejected; re-sign them with SHA-256.")])
        self.assertTrue(items)

    def test_without_hub_nothing_is_written_and_the_run_fails(self):
        with mock.patch.object(hublib, "from_env", return_value=None):
            docs = cli.upgrade_from_breaking_changes({}, None, None, None, Version.parse("v12.2.0"))
        self.assertEqual((docs.notes, docs.removed), ([], []))
        self.assertIn("could not be read from Hub", docs.todos[0])


if __name__ == "__main__":
    unittest.main()

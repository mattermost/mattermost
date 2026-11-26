#!/usr/bin/env python3
"""Tests for changelog_facts: checker lines, facts read from the code, plans and rendering.

The release notes are the v12.2 PRs' own, as config-change-checker left them.
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import changelog_facts as cf  # noqa: E402

# mattermost/mattermost#38637: real text plus checker lines. Its two config lines are wrong:
# both settings shipped in v12.1, and the checker compared against an older branch.
NOTE_38637 = """Added a "brotli" option to the Web Server Mode setting. When selected, API responses are compressed with Brotli for clients that support it, and with gzip for those that do not. The default remains gzip.
Added ``ElasticsearchSettings.EnableFileIndexing`` configuration setting.
Added ``SSOSettings.AdditionalScopes`` configuration setting.
🆕 New API file: `brotli.go`
🆕 New API file: `compression.go`
🆕 New API file: `compression_bench_test.go`
🆕 New API file: `compression_test.go`"""

# mattermost/mattermost#38885: checker lines only.
NOTE_38885 = """Added `GET /api/v4/properties/groups/{group_name}/{object_type}/fields/missing_values/summary` (`getPropertyFieldsComplianceSummary`) API endpoint.
Added `GET /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/missing_values/summary` (`getPropertyFieldComplianceSummary`) API endpoint.
Added `GET /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/missing_values` (`getPropertyFieldMissingValues`) API endpoint.
Added `POST /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/missing_values/notify` (`notifyPropertyFieldMissingValues`) API endpoint.
🆕 New API file: `property_channel_compliance.go`
🆕 New API file: `property_channel_compliance_test.go`
Added ``AuditEventGetPropertyFieldComplianceSummary`` audit log event.
Added ``AuditEventGetPropertyFieldMissingValues`` audit log event.
Added ``AuditEventGetPropertyFieldsComplianceSummary`` audit log event.
Added ``AuditEventNotifyPropertyFieldMissingValues`` audit log event."""

# mattermost/mattermost#39500, after generate_changelog.resolve_endpoint_lines gave the endpoint its full path.
NOTE_39500 = """Added POST /api/v4/properties/groups/access_control/attributes/search, which returns the System Console's Global Attributes listing, optionally filtered by a search term. The Global Attributes page now loads with a single request.
Added ``POST /api/v4/properties/groups/access_control/attributes/search`` (``searchGlobalAttributeListing``) API endpoint.
🆕 New API file: `properties_global_attributes.go`
🆕 New API file: `properties_global_attributes_test.go`
Added ``AuditEventSearchGlobalAttributeListing`` audit log event."""

NOTE_39502 = """Added mmctl plugin keys, plugin keys add, and plugin keys delete commands (local mode only) to manage plugin signature public keys, along with local-mode API endpoints under /api/v4/plugins/public_keys.
Added ``POST /api/v4/plugins/public_keys`` (``localAddPluginPublicKey``) API endpoint.
🆕 New API file: `plugin_local_test.go`
Added ``AuditEventLocalAddPluginPublicKey`` audit log event.
Added ``AuditEventLocalDeletePluginPublicKey`` audit log event."""

V12_2_AUDIT_EVENTS = [
    "AuditEventGetPropertyFieldComplianceSummary", "AuditEventGetPropertyFieldMissingValues",
    "AuditEventGetPropertyFieldsComplianceSummary", "AuditEventLocalAddPluginPublicKey",
    "AuditEventLocalDeletePluginPublicKey", "AuditEventNotifyPropertyFieldMissingValues",
    "AuditEventSearchGlobalAttributeListing",
]

CONFIG_BASE = """package model

const (
\tTeamSettingsDefaultMaxUsersPerTeam = 50
)

type Config struct {
\tServiceSettings       ServiceSettings
\tTeamSettings          TeamSettings
\tCacheSettings         CacheSettings
\tElasticsearchSettings ElasticsearchSettings
\tGitLabSettings        SSOSettings
\tOpenIdSettings        SSOSettings
\tCloudSettings         CloudSettings  // telemetry: none
}

type ServiceSettings struct {
\tWebserverMode *string `access:"environment_web_server"`
\tEnableSVGs    *bool
}

type TeamSettings struct {
\tMaxUsersPerTeam *int
}

type CacheSettings struct {
\tCacheType *string
}

type ElasticsearchSettings struct {
\tEnableFileIndexing *bool
}

type SSOSettings struct {
\tAdditionalScopes *string
}

type CloudSettings struct {
\tCWSURL *string
}

type helper struct {
\tNotASetting string
}

func (s *ServiceSettings) SetDefaults(isUpdate bool) {
\tif s.WebserverMode == nil {
\t\ts.WebserverMode = new("gzip")
\t}

\tif s.EnableSVGs == nil {
\t\tif isUpdate {
\t\t\ts.EnableSVGs = new(true)
\t\t} else {
\t\t\ts.EnableSVGs = new(false)
\t\t}
\t}
}

func (s *TeamSettings) SetDefaults() {
\tif s.MaxUsersPerTeam == nil {
\t\ts.MaxUsersPerTeam = new(TeamSettingsDefaultMaxUsersPerTeam)
\t}
}
"""

CONFIG_HEAD = (CONFIG_BASE
               .replace("TeamSettingsDefaultMaxUsersPerTeam = 50", "TeamSettingsDefaultMaxUsersPerTeam = 0")
               .replace("\tCacheType *string\n", "\tCacheType *string\n\tRedisEnableTLS *bool\n")
               .replace("\tCWSURL *string\n", "\tCWSURL *string\n\tPreviewLandingPath *string\n")
               .replace("type helper struct {\n\tNotASetting string\n", "type helper struct {\n\tNotASetting string\n\tAlsoNot int\n")
               + """
func (s *CacheSettings) SetDefaults() {
\tif s.RedisEnableTLS == nil {
\t\ts.RedisEnableTLS = new(false)
\t}
}

func (s *CloudSettings) SetDefaults() {
\tif s.PreviewLandingPath == nil {
\t\ts.PreviewLandingPath = new("")
\t}
}
""")

AUDIT_BASE = "package model\n\nconst (\n\tAuditEventMuteHealthFinding = \"muteHealthFinding\"\n)\n"
AUDIT_HEAD = AUDIT_BASE.replace(")\n", "".join(f"\t{e} = \"{e}\"\n" for e in V12_2_AUDIT_EVENTS) + ")\n")


def i18n(chrome: str, edge: str, firefox: str = "153") -> str:
    """The unsupported-browser strings of server/i18n/en.json."""
    return json.dumps([
        {"id": "web.error.unsupported_browser.min_browser_version.chrome", "translation": f"Version {chrome}+"},
        {"id": "web.error.unsupported_browser.min_browser_version.edge", "translation": f"Version {edge}+"},
        {"id": "web.error.unsupported_browser.min_browser_version.firefox", "translation": f"Version {firefox}+"},
        {"id": "web.error.unsupported_browser.min_os_version.mac", "translation": "macOS 15+"},
        {"id": "other.string", "translation": "Version 1+"},
    ])


def repo(files: dict):
    """A ``show(ref, path)`` over ``{ref: {path: text}}``."""
    return lambda ref, path: files.get(ref, {}).get(path)


V12_1 = {cf.CONFIG_PATH: CONFIG_BASE, cf.AUDIT_EVENTS_PATH: AUDIT_BASE, cf.SERVER_I18N_PATH: i18n("156", "156"),
         cf.SQLSTORE_PATH: "const (\n\tminimumRequiredPostgresVersion = 150000\n)\n"}
# #39021 moved the PostgreSQL minimum into a model constant without changing it.
V12_2 = {cf.CONFIG_PATH: CONFIG_HEAD + "\nconst (\n\tMinimumPostgresMajorVersion = 15\n)\n",
         cf.AUDIT_EVENTS_PATH: AUDIT_HEAD, cf.SERVER_I18N_PATH: i18n("156", "156"),
         cf.SQLSTORE_PATH: "const (\n\tminimumRequiredPostgresVersion = model.MinimumPostgresMajorVersion * 10000\n)\n"}


class CheckerLinesTest(unittest.TestCase):
    def test_should_keep_the_text_of_a_note_and_take_out_its_checker_lines(self):
        text, facts, dropped = cf.parse_checker_lines(NOTE_38637, "mattermost/mattermost#38637")
        self.assertTrue(text.startswith('Added a "brotli" option to the Web Server Mode setting.'))
        self.assertEqual(len(text.splitlines()), 1)
        self.assertEqual([(f["kind"], f["ident"]) for f in facts],
                         [("config", "ElasticsearchSettings.EnableFileIndexing"), ("config", "SSOSettings.AdditionalScopes")])
        self.assertEqual(len(dropped), 4)
        self.assertTrue(all(line.startswith("🆕") for line in dropped))

    def test_should_leave_no_text_for_a_note_made_only_of_checker_lines(self):
        text, facts, _ = cf.parse_checker_lines(NOTE_38885, "mattermost/mattermost#38885")
        self.assertEqual(text, "")
        self.assertEqual(sum(f["kind"] == "api" for f in facts), 4)
        self.assertEqual(sum(f["kind"] == "audit" for f in facts), 4)
        notify = next(f for f in facts if f["kind"] == "api" and f["method"] == "POST")
        self.assertEqual(notify["path"], "/api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/missing_values/notify")
        self.assertEqual(notify["handler"], "notifyPropertyFieldMissingValues")

    def test_should_keep_a_prose_line_that_names_an_endpoint_without_the_checker_shape(self):
        text, facts, _ = cf.parse_checker_lines(NOTE_39500, "mattermost/mattermost#39500")
        self.assertIn("Global Attributes listing", text)
        self.assertEqual([f["ident"] for f in facts],
                         ["POST /api/v4/properties/groups/access_control/attributes/search",
                          "AuditEventSearchGlobalAttributeListing"])

    def test_should_read_a_changed_default_line(self):
        _, facts, _ = cf.parse_checker_lines(
            "Changed the default value of ``LogSettings.EnableWebhookDebugging`` from ``true`` to ``false``.", "x#1")
        self.assertEqual((facts[0]["kind"], facts[0]["old"], facts[0]["new"]), ("config_default", "true", "false"))

    def test_should_drop_go_runtime_lines(self):
        text, facts, dropped = cf.parse_checker_lines("Go runtime updated from 1.25.8 to 1.26.1.", "x#1")
        self.assertEqual((text, facts, dropped), ("", [], ["Go runtime updated from 1.25.8 to 1.26.1."]))


class CodeFactsTest(unittest.TestCase):
    def setUp(self):
        self.show = repo({"v12.1.0": V12_1, "origin/release-12.2": V12_2})

    def test_should_read_added_settings_changed_defaults_and_audit_events_from_the_code(self):
        facts = cf.code_facts("v12.1.0", "origin/release-12.2", self.show)
        sources = [f["source"] for f in facts]
        self.assertEqual(sources, [
            "config:CacheSettings.RedisEnableTLS@added",
            "config:CloudSettings.PreviewLandingPath@added",
            "config-default:TeamSettings.MaxUsersPerTeam@0",
        ] + [f"audit:{event}@added" for event in V12_2_AUDIT_EVENTS])
        self.assertEqual(next(f for f in facts if f["field"] == "RedisEnableTLS")["default"], "false")

    def test_should_not_report_a_minimum_that_only_moved_into_a_constant(self):
        facts = cf.code_facts("v12.1.0", "origin/release-12.2", self.show)
        self.assertFalse([f for f in facts if f["kind"] == "min_version"])

    def test_should_report_raised_browser_minimums_as_one_bullet_per_version(self):
        base = {**V12_1, cf.SERVER_I18N_PATH: i18n("150", "150")}
        facts = cf.code_facts("a", "b", repo({"a": base, "b": V12_2}))
        minimums = [f for f in facts if f["kind"] == "min_version"]
        self.assertEqual([(f["ident"], f["old"], f["new"]) for f in minimums], [("Chrome", "150", "156"), ("Edge", "150", "156")])
        text = cf.render_facts(minimums, {id(f): f"N{i}" for i, f in enumerate(minimums, 1)})
        self.assertIn("#### Important Upgrade Notes\n - Updated the minimum supported Chrome and Edge versions to 156+. [[N1,N2]]", text)

    def test_should_report_a_raised_postgres_minimum(self):
        head = {**V12_2, cf.CONFIG_PATH: V12_2[cf.CONFIG_PATH].replace("MinimumPostgresMajorVersion = 15", "MinimumPostgresMajorVersion = 16")}
        facts = cf.code_facts("a", "b", repo({"a": V12_1, "b": head}))
        minimum = next(f for f in facts if f["kind"] == "min_version")
        self.assertEqual((minimum["ident"], minimum["new"]), ("PostgreSQL", "16"))
        text = cf.render_facts([minimum], {id(minimum): "N1"})
        self.assertIn("Updated the minimum supported PostgreSQL version to 16.", text)

    def test_should_read_nothing_without_both_refs(self):
        self.assertEqual(cf.code_facts("", "origin/release-12.2", self.show), [])

    def test_should_give_install_and_upgrade_defaults_separately(self):
        defaults = cf.config_defaults(CONFIG_BASE)
        self.assertEqual(defaults[("ServiceSettings", "EnableSVGs")], "false (new installs), true (upgrades)")
        self.assertEqual(defaults[("TeamSettings", "MaxUsersPerTeam")], "50")
        self.assertEqual(cf.show_default(defaults[("ServiceSettings", "EnableSVGs")]),
                         "``false`` on new installs and ``true`` on upgrade")
        self.assertEqual(cf.show_default('""'), "an empty string")

    def test_should_find_the_config_groups_a_struct_is_used_for(self):
        groups = cf.config_groups(CONFIG_BASE)
        self.assertEqual(groups["SSOSettings"], ["GitLabSettings", "OpenIdSettings"])
        self.assertEqual(groups["CloudSettings"], ["CloudSettings"])

    def test_should_say_when_a_checker_line_is_wrong_about_the_release(self):
        _, facts, _ = cf.parse_checker_lines(NOTE_38637, "mattermost/mattermost#38637")
        reasons = [cf.contradicted(f, "v12.1.0", "origin/release-12.2", self.show) for f in facts]
        self.assertEqual(reasons, ["already in the previous release", "already in the previous release"])
        _, audit, _ = cf.parse_checker_lines(NOTE_38885, "mattermost/mattermost#38885")
        self.assertEqual({cf.contradicted(f, "v12.1.0", "origin/release-12.2", self.show) for f in audit}, {None})


class DefaultClaimTest(unittest.TestCase):
    def setUp(self):
        self.show = repo({"v12.1.0": V12_1, "origin/release-12.2": V12_2})

    def test_should_reject_a_default_change_the_release_does_not_make(self):
        wrong = cf.default_fact("TeamSettings", "MaxUsersPerTeam", "50", "100", "x#1")
        self.assertIn("goes from ``50`` to ``0``", cf.contradicted(wrong, "v12.1.0", "origin/release-12.2", self.show))
        right = cf.default_fact("TeamSettings", "MaxUsersPerTeam", "``50``", "``0``", "x#1")
        self.assertIsNone(cf.contradicted(right, "v12.1.0", "origin/release-12.2", self.show))

    def test_should_count_a_default_change_as_stated_only_when_the_new_default_is_given(self):
        fact = cf.default_fact("TeamSettings", "MaxUsersPerTeam", "50", "0", "code")
        self.assertFalse(cf.mentioned(fact, "Set ``TeamSettings.MaxUsersPerTeam`` to 25 for this deployment."))
        self.assertTrue(cf.mentioned(fact, "Allowed 0 for ``TeamSettings.MaxUsersPerTeam``, and made 0 the default."))
        self.assertTrue(cf.mentioned(cf.default_fact("LogSettings", "EnableWebhookDebugging", "true", "false", "code"),
                                     "``LogSettings.EnableWebhookDebugging`` now defaults to false."))


class FindPrsTest(unittest.TestCase):
    def test_should_take_the_pr_from_the_commit_that_added_the_line(self):
        facts = [cf.audit_fact("Added", "AuditEventLocalAddPluginPublicKey", "audit:x"),
                 cf.min_version_fact("Chrome", "150", "156", "min-version:Chrome@156")]
        commits = {
            cf.AUDIT_EVENTS_PATH: [
                {"message": "Unrelated (#39000)", "patch": "+\tAuditEventOther = \"other\""},
                {"message": "Add local-mode mmctl plugin keys commands (#39502)\n\nbody",
                 "patch": "+\tAuditEventLocalAddPluginPublicKey = \"localAddPluginPublicKey\""},
            ],
            cf.SERVER_I18N_PATH: [{"message": "Automated cherry pick of #39641",
                                   "patch": "-    \"translation\": \"Version 150+\",\n+    \"translation\": \"Version 156+\","}],
        }
        cf.find_prs(facts, lambda path: commits.get(path, []))
        self.assertEqual([f.get("pr") for f in facts], [39502, 39641])


ADMIN = """import ElasticSearchSettings from './elasticsearch_settings';
import PluginManagement from 'components/admin_console/plugin_management';

const AdminDefinition = {
    environment: {
        subsections: {
            cache_settings: {
                isHidden: it.any(
                    it.not(it.licensedForFeature('Cluster')),
                ),
                schema: {
                    settings: [
                        {
                            key: 'CacheSettings.CacheType',
                            label: defineMessage({id: 'x', defaultMessage: 'Cache {type}'}),
                        },
                        {
                            key: 'CacheSettings.RedisEnableTLS',
                            isHidden: it.not(it.minLicenseTier(LicenseSkus.EnterpriseAdvanced)),
                        },
                    ],
                },
            },
            elasticsearch: {
                isHidden: it.any(it.not(it.licensedForFeature('Elasticsearch'))),
                schema: {
                    component: ElasticSearchSettings,
                },
            },
            plugins: {
                schema: {
                    component: PluginManagement,
                },
            },
            openid: {
                isHidden: it.not(it.licensedForFeature('OpenId')),
                schema: {settings: [{key: 'OpenIdSettings.AdditionalScopes'}]},
            },
            gitlab: {
                schema: {settings: [{key: 'GitLabSettings.AdditionalScopes'}]},
            },
            upsell: {
                isHidden: it.minLicenseTier(LicenseSkus.Enterprise),
                schema: {settings: [{key: 'TeamSettings.MaxUsersPerTeam'}]},
            },
        },
    },
};
"""


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.groups = cf.config_groups(CONFIG_HEAD)

    def plan(self, struct, field, files=()):
        def components(key):
            return cf.admin_components(key, lambda text: [p for p in files if key in files[p]], ADMIN)
        return cf.setting_plan(struct, field, self.groups, ADMIN, components)

    def test_should_take_the_highest_plan_any_enclosing_block_requires(self):
        self.assertEqual(self.plan("CacheSettings", "RedisEnableTLS")[0], "Enterprise Advanced")
        self.assertEqual(self.plan("CacheSettings", "CacheType")[0], "Enterprise")

    def test_should_find_a_setting_a_custom_component_edits_by_its_page(self):
        files = {f"{cf.ADMIN_CONSOLE_DIR}/elasticsearch_settings.tsx": "ElasticsearchSettings.EnableFileIndexing",
                 f"{cf.ADMIN_CONSOLE_DIR}/plugin_management/plugin_management.tsx": "PluginSettings.Enable"}
        self.assertEqual(self.plan("ElasticsearchSettings", "EnableFileIndexing", files),
                         ("Enterprise", "`ElasticsearchSettings.EnableFileIndexing` in the ElasticSearchSettings System Console page"))
        self.assertEqual(self.plan("PluginSettings", "Enable", files)[0], "All")

    def test_should_take_the_lowest_plan_of_a_struct_used_by_several_groups(self):
        self.assertEqual(self.plan("SSOSettings", "AdditionalScopes")[0], "All")

    def test_should_not_count_an_upsell_that_hides_a_setting_from_licensed_servers(self):
        self.assertEqual(self.plan("TeamSettings", "MaxUsersPerTeam")[0], "All")

    def test_should_put_a_setting_the_system_console_does_not_show_on_all_plans(self):
        self.assertEqual(self.plan("CloudSettings", "PreviewLandingPath"), ("All", "not shown in the System Console"))


class RenderTest(unittest.TestCase):
    def test_should_list_all_seven_v12_2_audit_events_one_bullet_each(self):
        facts = []
        for source, note in (("mattermost/mattermost#38885", NOTE_38885), ("mattermost/mattermost#39500", NOTE_39500),
                             ("mattermost/mattermost#39502", NOTE_39502)):
            facts += [f for f in cf.parse_checker_lines(note, source)[1] if f["kind"] == "audit"]
        text = cf.render_facts(facts, {id(f): f"N{i}" for i, f in enumerate(facts, 1)})
        section = text.split("### Audit Log Event Changes\n", 1)[1]
        bullets = [line for line in section.splitlines() if line.startswith(" - ")]
        self.assertEqual(len(bullets), 7)
        self.assertEqual([line.split("``")[1] for line in bullets], V12_2_AUDIT_EVENTS)
        self.assertTrue(all(line.endswith("audit log event. [[N%s]]" % line.rsplit("[[N", 1)[1][:-2]) for line in bullets))

    def test_should_write_full_endpoint_paths_under_api_changes(self):
        facts = [f for f in cf.parse_checker_lines(NOTE_38885, "x#1")[1] if f["kind"] == "api"]
        text = cf.render_facts(facts, {id(f): "N1" for f in facts})
        self.assertIn(" - Added ``GET /api/v4/properties/groups/{group_name}/{object_type}/fields/{field_id}/missing_values`` "
                      "(``getPropertyFieldMissingValues``) API endpoint. [[N1]]", text)
        self.assertEqual(text.count("/missing_values/notify``"), 1)

    def test_should_group_settings_by_plan_in_plan_order_with_removals_last(self):
        facts = [
            {**cf.config_fact("Added", "PluginSettings", "RestrictUnauthenticatedWebappPlugins", "a", "true"), "plan": "All"},
            cf.config_fact("Removed", "LdapSettings", "LoginButtonColor", "b"),
            {**cf.config_fact("Added", "CacheSettings", "RedisEnableTLS", "c", "false"), "plan": "Enterprise Advanced"},
            {**cf.default_fact("TeamSettings", "MaxUsersPerTeam", "50", "0", "d"), "plan": "All"},
        ]
        text = cf.render_facts(facts, {id(f): f"N{i}" for i, f in enumerate(facts, 1)})
        self.assertEqual(text.split("\n")[:3], ["### Upgrade Impact", "", "#### config.json"])
        lines = text.split("\n")[4:]
        self.assertEqual(lines[:6], [
            " - **Changes to Enterprise Advanced plan:**",
            "   - Under ``CacheSettings`` in ``config.json``, added ``RedisEnableTLS`` configuration setting. "
            "The default value is ``false``. [[N3]]",
            " - **Changes to All plans:**",
            "   - Under ``PluginSettings`` in ``config.json``, added ``RestrictUnauthenticatedWebappPlugins`` "
            "configuration setting. The default value is ``true``. [[N1]]",
            "   - Under ``TeamSettings`` in ``config.json``, changed the default value of ``MaxUsersPerTeam`` "
            "from ``50`` to ``0``. [[N4]]",
            " - Removed ``LdapSettings.LoginButtonColor`` configuration setting. [[N2]]",
        ])


class DuplicateTest(unittest.TestCase):
    def test_should_write_one_bullet_for_an_endpoint_two_prs_name(self):
        first = cf.api_fact("Removed", "PUT", "/api/v4/cloud/customer", "updateCloudCustomer", "mattermost/mattermost#39519")
        second = cf.api_fact("Removed", "PUT", "/api/v4/cloud/customer", "updateCloudCustomer", "mattermost/mattermost#39523")
        text = cf.render_facts([first, second], {id(first): "N1", id(second): "N2"})
        self.assertEqual(text.count("/api/v4/cloud/customer"), 1)
        self.assertIn("API endpoint. [[N1,N2]]", text)


class MentionedTest(unittest.TestCase):
    def test_should_recognise_a_fact_a_reviewer_or_developer_already_wrote(self):
        setting = cf.config_fact("Added", "CacheSettings", "RedisEnableTLS", "x")
        self.assertTrue(cf.mentioned(setting, "   - Under ``CacheSettings`` in ``config.json``, added ``RedisEnableTLS``."))
        self.assertTrue(cf.mentioned(setting, "Set ``CacheSettings.RedisEnableTLS`` to true."))
        self.assertFalse(cf.mentioned(setting, "Added ``RedisEnableTLS`` under ``ClusterSettings``."))
        minimum = cf.min_version_fact("Chrome", "150", "156", "x")
        self.assertTrue(cf.mentioned(minimum, "  - Updated minimum Edge and Chrome versions to 156+."))
        self.assertFalse(cf.mentioned(minimum, "Fixed an issue in Chrome 156."))


if __name__ == "__main__":
    unittest.main()

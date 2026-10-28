"""Calculated values, templates, the calendar and the changelog reader."""

import json
import unittest
from datetime import date

from release_docs import calendar, changelog, templates
from release_docs.changelog import Highlight
from release_docs.versions import (
    Version,
    changelog_url,
    download_url,
    esr_comms_dates,
    is_esr,
    long_date,
    next_esr_line,
    planned_next_esr_day,
    release_type,
    sbom_url,
    support_end,
)

from .fakes import FakeClaude, fixture

ESR = "v10.11, v11.7,v12.4"


class VersionsTest(unittest.TestCase):
    def test_is_esr_uses_the_changelog_helper_for_regular_esr_and_dot_releases(self):
        self.assertTrue(is_esr(Version.parse("v11.7.0"), ESR))
        self.assertTrue(is_esr(Version.parse("v11.7.14"), ESR))
        self.assertFalse(is_esr(Version.parse("v11.8.0"), ESR))
        self.assertFalse(is_esr(Version.parse("v12.0.1"), ESR))
        self.assertEqual(release_type(Version.parse("v12.0.0"), ESR), "major")
        self.assertEqual(release_type(Version.parse("v12.1.0"), ESR), "feature")

    def test_regular_support_ends_on_the_15th_three_months_later(self):
        self.assertEqual(support_end(date(2026, 10, 16), esr=False), date(2027, 1, 15))
        self.assertEqual(support_end(date(2025, 11, 14), esr=False), date(2026, 2, 15))
        self.assertEqual(support_end(date(2026, 11, 30), esr=False), date(2027, 2, 15))

    def test_esr_support_ends_twelve_months_later(self):
        self.assertEqual(support_end(date(2026, 5, 15), esr=True), date(2027, 5, 15))
        self.assertEqual(support_end(date(2025, 8, 15), esr=True), date(2026, 8, 15))
        self.assertEqual(support_end(date(2027, 2, 16), esr=True), date(2028, 2, 15))

    def test_next_esr_is_nine_months_later_and_cross_checked(self):
        self.assertEqual(planned_next_esr_day(date(2026, 5, 15)), date(2027, 2, 16))
        self.assertEqual(next_esr_line(Version.parse("v11.7.0"), ESR), (Version(12, 4), None))
        line, problem = next_esr_line(Version.parse("v12.4.0"), ESR)
        self.assertIsNone(line)
        self.assertIn("lists no ESR after v12.4", problem)
        line, problem = next_esr_line(Version.parse("v12.0.0"), "v12.0,v12.8")
        self.assertEqual(line, Version(12, 8))
        self.assertIn("nine months after v12.0 is v12.9", problem)

    def test_esr_comms_dates(self):
        self.assertEqual(esr_comms_dates(date(2027, 5, 15)), (date(2027, 2, 15), date(2027, 5, 15)))
        self.assertEqual(long_date(date(2027, 5, 15)), "May 15, 2027")

    def test_download_and_sbom_urls_per_edition(self):
        v = Version.parse("v12.0.1")
        self.assertEqual(download_url(v, "enterprise"), "https://releases.mattermost.com/12.0.1/mattermost-12.0.1-linux-amd64.tar.gz")
        self.assertEqual(download_url(v, "team"), "https://releases.mattermost.com/12.0.1/mattermost-team-12.0.1-linux-amd64.tar.gz")
        self.assertEqual(sbom_url(v, "enterprise"), "https://releases.mattermost.com/12.0.1/sbom-enterprise-v12.0.1.json")
        self.assertEqual(sbom_url(v, "team"), "https://github.com/mattermost/mattermost/releases/download/v12.0.1/sbom-mattermost-v12.0.1.json")

    def test_changelog_urls_by_release_type(self):
        self.assertTrue(changelog_url(Version.parse("v12.0.1"), ESR).endswith("mattermost-v12-changelog.html#release-v12-0-major-release"))
        self.assertTrue(changelog_url(Version.parse("v11.7.14"), ESR).endswith("#release-v11-7-extended-support-release"))
        self.assertTrue(changelog_url(Version.parse("v11.11.3"), ESR).endswith("#release-v11-11-feature-release"))


class TemplatesTest(unittest.TestCase):
    EXPECTED = {
        "version-archive.md": {"edition_name", "version", "esr_suffix", "changelog_url", "download_url", "sha256",
                               "signature_url", "sbom_url"},
        "notice.json": {"short", "display_date", "description_json", "changelog_page_url"},
        "github-release.txt": {"release_kind", "version", "highlights"},
        "announcement-post.md": {"short", "esr_label", "highlight_list", "changelog_url", "blog_url", "download_url"},
        "key-dates-post.md": {"releases"},
        "esr-comms.md": {"ending", "end_long", "first_send", "second_send", "current", "current_end_long",
                         "current_changelog_url"},
    }

    def test_every_template_has_exactly_its_placeholders(self):
        for name, expected in self.EXPECTED.items():
            self.assertEqual(templates.placeholders(templates.load(name)), expected, name)

    def test_fill_is_strict_both_ways(self):
        with self.assertRaises(KeyError):
            templates.fill("{{a}} {{b}}", {"a": 1})
        with self.assertRaises(KeyError):
            templates.fill("{{a}}", {"a": 1, "b": 2})
        self.assertEqual(templates.fill("{{ a }}-{{a}}", {"a": "x"}), "x-x")

    def test_notice_template_renders_valid_json(self):
        text = templates.render("notice.json", {"short": "12.2", "display_date": "2026-12-16",
                                                "description_json": json.dumps('Has "quotes"'), "changelog_page_url": "u"})
        self.assertEqual(json.loads(text)["localizedMessages"]["en"]["description"], 'Has "quotes"')


class CalendarTest(unittest.TestCase):
    def setUp(self):
        self.events = calendar.parse_ics(fixture("release-dates.ics"))

    def test_release_days_skip_mobile_desktop_and_dot_releases(self):
        self.assertEqual(calendar.release_day(self.events, Version.parse("v12.2.0")), date(2026, 12, 16))
        self.assertEqual(calendar.release_day(self.events, Version.parse("v12.3.1")), date(2027, 1, 15))
        self.assertIsNone(calendar.release_day(self.events, Version.parse("v12.9.0")))

    def test_folded_escaped_and_timed_titles(self):
        milestones = calendar.milestones(self.events)
        self.assertEqual(milestones[(12, 3)]["code_freeze"].start, date(2026, 11, 25))
        self.assertEqual(milestones[(12, 3)]["final_build"].start, date(2026, 12, 7))
        self.assertEqual(milestones[(12, 2)]["code_freeze"].time, "09:00 America/Toronto")
        self.assertEqual(calendar.format_day(milestones[(12, 2)]["release_day"]), "Wed, Dec 16, 2026 at 14:00 UTC")

    def test_next_two_releases(self):
        upcoming = calendar.next_releases(self.events, Version.parse("v12.1.0"))
        self.assertEqual([v.short for v, _ in upcoming], ["v12.2", "v12.3"])

    def test_jira_fix_version(self):
        self.assertEqual(calendar.fix_version(Version.parse("v12.2.0"), date(2026, 12, 16)), "v12.2 (December 2026)")


ENTRY = """## Release v12.2 - [Feature Release](https://docs.mattermost.com/x) \\{#release-v12-2-feature-release}

### Improvements

See [this blog post](https://mattermost.com/blog/mattermost-v12-2-is-now-available/) on the highlights.

#### User Interface
 - Pre-packaged Calls plugin version [v1.12.5](https://github.com/x).
 - Added Shared Drafts so teams co-write messages. See https://docs.mattermost.com/end-user-guide/drafts.
 - Increased the dialog title limit to 80 characters.

#### Administration
 - Added Audit Exports to S3 (https://docs.mattermost.com/admin/audit-exports).

### Bug Fixes
 - Fixed a crash.

## Release v12.1 - [Feature Release](https://docs.mattermost.com/x)
"""


class ChangelogTest(unittest.TestCase):
    def test_entry_and_improvement_bullets_without_plugin_bumps(self):
        entry = changelog.entry(ENTRY, Version.parse("v12.2.0"))
        self.assertNotIn("v12.1", entry.split("\n", 1)[1])
        bullets = changelog.improvement_bullets(entry)
        self.assertEqual(len(bullets), 3)
        self.assertTrue(bullets[0].startswith("Added Shared Drafts"))
        self.assertEqual(changelog.blog_url(entry, Version.parse("v12.2.0")),
                         "https://mattermost.com/blog/mattermost-v12-2-is-now-available/")
        self.assertIsNone(changelog.entry(ENTRY, Version.parse("v12.3.0")))

    def test_highlights_must_cite_a_bullet_and_only_its_links(self):
        bullets = changelog.improvement_bullets(changelog.entry(ENTRY, Version.parse("v12.2.0")))
        claude = FakeClaude({"highlights": [
            {"name": "Shared Drafts.", "source": 0, "url": "https://docs.mattermost.com/end-user-guide/drafts"},
            {"name": "Audit Exports", "source": 2, "url": "https://docs.mattermost.com/invented"},
            {"name": "Invented Feature", "source": 9, "url": ""},
        ]})
        picked, problem = changelog.pick_highlights(bullets, claude)
        self.assertIsNone(problem)
        self.assertEqual(picked, [
            Highlight("Shared Drafts", "https://docs.mattermost.com/end-user-guide/drafts", bullets[0]),
            Highlight("Audit Exports", "", bullets[2]),
        ])

    def test_no_highlights_is_a_reason_never_a_guess(self):
        self.assertEqual(changelog.pick_highlights([], FakeClaude({}))[1], "the changelog entry has no Improvements bullets")
        self.assertIn("ANTHROPIC_API_KEY", changelog.pick_highlights(["x"], None)[1])
        self.assertIn("could not", changelog.pick_highlights(["x"], FakeClaude(RuntimeError("down")))[1])
        self.assertIn("no highlights", changelog.pick_highlights(["x"], FakeClaude({"highlights": [{"name": "Y", "source": 4}]}))[1])

    def test_join_names(self):
        self.assertEqual(changelog.join_names(["A"]), "A")
        self.assertEqual(changelog.join_names(["A", "B"]), "A and B")
        self.assertEqual(changelog.join_names(["A", "B", "C"]), "A, B, and C")


if __name__ == "__main__":
    unittest.main()

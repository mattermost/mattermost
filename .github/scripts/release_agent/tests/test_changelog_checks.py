"""The checks on the changelog workflow's PR, its entry and the migrations it should mention."""

import unittest
from datetime import date

from release_agent import checks
from release_agent.tests.fakes import FakeGitHub
from release_agent.tests.test_checks import MM, RULES, context

HEAD = f"mattermost:changelog/v12.2.0"
FILE = "docs/main/product-overview/mattermost-v12-changelog.mdx"
MIGRATIONS = "server/channels/db/migrations/postgres"
LIVE = "https://docs.mattermost.com/product-overview/mattermost-v12-changelog"
BOT = "changelog-automation-docs[bot]"


def changelog_pr(number=39500, draft=False, merged=False, state=None, reviewers=(), login=BOT,
                 created_at="2026-10-26T10:00:00Z", sha="headsha", base="master"):
    return {"number": number, "title": "Changelog v12.2.0", "draft": draft, "state": state or ("closed" if merged else "open"),
            "merged_at": "2026-11-16T09:00:00Z" if merged else None, "created_at": created_at,
            "html_url": f"https://github.com/{MM}/pull/{number}", "user": {"login": login},
            "requested_reviewers": [{"login": r} for r in reviewers], "requested_teams": [], "head": {"sha": sha},
            "base": {"ref": base}}


def entry(release_day="**Release day: November 16, 2026**", schema=""):
    return (f"## Release v12.3 - Feature Release\n\n**Release day: 2026-12-16**\n\n"
            f"## Release v12.2 - Feature Release\n\n{release_day}\n\n### Improvements\n\n#### User Interface\n\n"
            f" - Fixed a thing.\n\n{schema}"
            f"## Release v12.1 - Feature Release\n\n**Release day: October 16, 2026**\n")


SCHEMA = "#### Database Schema Changes\n\n - Added a ``Foo`` table.\n\n"


def github(*prs, text=None, ref="headsha"):
    fake = FakeGitHub()
    fake.head_prs[HEAD] = list(prs)
    if text is not None:
        fake.files[(MM, ref, FILE)] = text
    return fake


def check(rule, fake, **kwargs):
    return checks.CHECKS[RULES[rule]["type"]][0](context(fake, **kwargs), RULES[rule])


class ChangelogDraftTest(unittest.TestCase):
    def test_found_by_head_branch(self):
        fake = github(changelog_pr(draft=True))
        result = check("changelog-draft", fake)
        self.assertEqual((result.status, result.summary), (checks.PASS, "The changelog PR mattermost#39500 exists (draft)"))
        self.assertEqual(result.proof_url, f"https://github.com/{MM}/pull/39500")
        self.assertEqual(fake.queries, [f"head:{HEAD}"])

    def test_none_yet(self):
        result = check("changelog-draft", github())
        self.assertEqual((result.status, result.summary), (checks.FAIL, "No changelog PR yet (changelog/v12.2.0)"))

    def test_two_prs_use_the_newest_and_list_the_other(self):
        fake = github(changelog_pr(39501, created_at="2026-10-28T10:00:00Z"),
                      changelog_pr(39500, state="closed", created_at="2026-10-26T10:00:00Z"))
        result = check("changelog-draft", fake)
        self.assertEqual(result.summary, "The changelog PR mattermost#39501 exists (open)")
        self.assertEqual([(i.label, i.note) for i in result.items],
                         [("mattermost#39500", "another changelog PR for this release, closed without merging")])

    def test_a_pr_retargeted_to_another_branch_does_not_count(self):
        result = check("changelog-draft", github(changelog_pr(base="release-12.2")))
        self.assertEqual((result.status, result.summary), (checks.FAIL, "No changelog PR yet (changelog/v12.2.0)"))

    def test_a_pr_by_someone_else_does_not_count(self):
        self.assertEqual(check("changelog-draft", github(changelog_pr(login="a-person"))).status, checks.FAIL)

    def test_a_pr_closed_without_merging_does_not_count(self):
        result = check("changelog-draft", github(changelog_pr(state="closed")))
        self.assertEqual((result.status, result.summary),
                         (checks.FAIL, "The changelog PR mattermost#39500 was closed without merging"))


class ChangelogReviewTest(unittest.TestCase):
    def test_a_draft_is_not_ready(self):
        result = check("changelog-review", github(changelog_pr(draft=True, reviewers=["a"])))
        self.assertEqual((result.status, result.summary), (checks.FAIL, "The changelog PR mattermost#39500 is still a draft"))

    def test_ready_with_no_reviewers_fails(self):
        result = check("changelog-review", github(changelog_pr()))
        self.assertEqual((result.status, result.summary), (checks.FAIL, "The changelog PR mattermost#39500 is ready but has no reviewers"))

    def test_a_requested_reviewer_is_enough(self):
        result = check("changelog-review", github(changelog_pr(reviewers=["amy"]), text=entry()))
        self.assertEqual((result.status, result.summary, result.items),
                         (checks.PASS, "The changelog PR mattermost#39500 is ready for review", []))

    def test_a_submitted_review_is_enough(self):
        fake = github(changelog_pr(), text=entry())
        fake.reviews_of[(MM, 39500)] = [{"state": "COMMENTED"}]
        self.assertEqual(check("changelog-review", fake).status, checks.PASS)

    def test_a_pending_review_is_not_one(self):
        fake = github(changelog_pr())
        fake.reviews_of[(MM, 39500)] = [{"state": "PENDING"}]
        self.assertEqual(check("changelog-review", fake).status, checks.FAIL)

    def test_release_day_tbd_is_flagged_without_failing(self):
        result = check("changelog-review", github(changelog_pr(reviewers=["amy"]), text=entry("**Release day: TBD**")))
        self.assertEqual(result.status, checks.PASS)
        self.assertEqual([i.note for i in result.items], ["the entry still says Release day: TBD"])
        self.assertNotIn("TBD", result.summary)

    def test_tbd_in_another_releases_entry_is_not_flagged(self):
        text = entry().replace("**Release day: 2026-12-16**", "**Release day: TBD**")
        self.assertEqual(check("changelog-review", github(changelog_pr(reviewers=["amy"]), text=text)).items, [])


class ChangelogMergedTest(unittest.TestCase):
    def merged(self, page=None, text=None, fetch_error=False):
        fake = github(changelog_pr(merged=True), text=entry() if text is None else text, ref="master")

        def fetch(url):
            self.assertEqual(url, LIVE)
            if fetch_error:
                raise OSError("no")
            return page or ""
        return check("changelog-merged", fake, fetch_page=fetch, today=date(2026, 11, 16))

    def test_open_pr_is_not_merged(self):
        result = check("changelog-merged", github(changelog_pr(reviewers=["a"])))
        self.assertEqual((result.status, result.summary), (checks.FAIL, "The changelog PR mattermost#39500 isn't merged yet (open)"))

    def test_merged_without_an_entry_on_master(self):
        result = self.merged(text="## Release v12.1 - Feature Release\n")
        self.assertEqual((result.status, result.summary), (checks.FAIL, "The changelog PR mattermost#39500 is merged, but master has no v12.2 entry"))

    def test_merged_but_not_live_yet(self):
        for page, error in (("## Release v12.1 - Feature Release", False), ("", True)):
            result = self.merged(page=page, fetch_error=error)
            self.assertEqual((result.status, result.summary),
                             (checks.FAIL, "The changelog PR mattermost#39500 is merged, not live on docs.mattermost.com yet"))

    def test_a_longer_version_on_the_page_is_not_this_release(self):
        self.assertEqual(self.merged(page="Release v12.20 - Feature Release").status, checks.FAIL)

    def test_a_mention_of_the_release_in_the_navigation_is_not_the_entry(self):
        self.assertEqual(self.merged(page="Related: Release v12.2 notes | Release v12.2.1").status, checks.FAIL)

    def test_the_heading_may_use_an_en_dash(self):
        self.assertEqual(self.merged(page="Release v12.2 – Feature Release").status, checks.PASS)

    def test_live(self):
        result = self.merged(page="Release v12.2 - Feature Release")
        self.assertEqual((result.status, result.proof_url), (checks.PASS, LIVE))
        self.assertEqual(result.summary, "The changelog PR mattermost#39500 is merged and v12.2 is live on docs.mattermost.com")


class ChangelogMigrationsTest(unittest.TestCase):
    def setUp(self):
        self.kwargs = {"branches": {(12, 1), (12, 2)}, "tags": {(12, 1)}}

    def fake(self, new, *prs, text=None, sql=None):
        fake = github(*prs, text=text)
        fake.trees[(MM, "v12.1.0", MIGRATIONS)] = {"000100_old.up.sql", "000100_old.down.sql"}
        fake.trees[(MM, "release-12.2", MIGRATIONS)] = {"000100_old.up.sql", "000100_old.down.sql", *new,
                                                       *(n.replace(".up.", ".down.") for n in new)}
        for name, body in (sql or {}).items():
            fake.files[(MM, "release-12.2", f"{MIGRATIONS}/{name}")] = body
        return fake

    def test_none_in_the_release_diff_passes(self):
        result = check("changelog-migrations", self.fake([]), **self.kwargs)
        self.assertEqual((result.status, result.summary), (checks.PASS, "No new migrations this release"))

    def test_compares_with_the_previous_release_branch_until_it_is_tagged(self):
        fake = self.fake([])
        fake.trees[(MM, "release-12.1", MIGRATIONS)] = {"000100_old.up.sql"}
        fake.trees[(MM, "release-12.2", MIGRATIONS)] = {"000100_old.up.sql"}
        result = check("changelog-migrations", fake, branches={(12, 1), (12, 2)}, tags=set())
        self.assertEqual(result.summary, "No new migrations this release")

    def test_skipped_before_the_branch_exists(self):
        self.assertEqual(check("changelog-migrations", self.fake([]), has_branch=False, **self.kwargs).status, checks.SKIPPED)

    def test_needs_the_changelog_pr(self):
        result = check("changelog-migrations", self.fake(["000101_add_foo.up.sql"]), **self.kwargs)
        self.assertEqual(result.status, checks.FAIL)

    def test_needs_a_schema_section(self):
        fake = self.fake(["000101_add_foo.up.sql"], changelog_pr(), text=entry())
        result = check("changelog-migrations", fake, **self.kwargs)
        self.assertEqual((result.status, result.summary),
                         (checks.FAIL, "1 new migration, but the changelog entry has no Database Schema Changes section"))

    def test_all_mentioned_by_table_name(self):
        fake = self.fake(["000101_add_foo.up.sql"], changelog_pr(), text=entry(schema=SCHEMA),
                         sql={"000101_add_foo.up.sql": "CREATE TABLE IF NOT EXISTS Foo (id varchar(26));"})
        result = check("changelog-migrations", fake, **self.kwargs)
        self.assertEqual((result.status, result.summary, result.items),
                         (checks.PASS, "The changelog entry covers 1 new migration", []))

    def test_a_migration_mentioned_by_column_name(self):
        schema = "#### Database Schema Changes\n\n - Added the ``Cluster`` column to ``Sessions``.\n\n"
        fake = self.fake(["000102_x.up.sql"], changelog_pr(), text=entry(schema=schema),
                         sql={"000102_x.up.sql": "ALTER TABLE Other ADD COLUMN IF NOT EXISTS Cluster text;"})
        self.assertEqual(check("changelog-migrations", fake, **self.kwargs).items, [])

    def test_types_and_views_are_names_too(self):
        from release_agent.checks import _identifiers
        self.assertEqual(_identifiers("ALTER TYPE permission_level ADD VALUE IF NOT EXISTS 'creator';"), {"permission_level"})
        self.assertEqual(_identifiers("DROP MATERIALIZED VIEW IF EXISTS AttributeView; CREATE MATERIALIZED VIEW AttributeView AS SELECT 1;"),
                         {"attributeview"})
        self.assertEqual(_identifiers('CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON public."Posts" (x);'), {"idx_a", "posts"})

    def test_mentioned_by_number(self):
        schema = "#### Database Schema Changes\n\n - Added migration 000103 to speed up lookups.\n\n"
        fake = self.fake(["000103_x.up.sql"], changelog_pr(), text=entry(schema=schema),
                         sql={"000103_x.up.sql": "CREATE INDEX idx_unrelated ON unrelated_table (a);"})
        self.assertEqual(check("changelog-migrations", fake, **self.kwargs).items, [])

    def test_one_missing_is_listed_and_still_passes(self):
        fake = self.fake(["000101_add_foo.up.sql", "000104_add_bar.up.sql"], changelog_pr(), text=entry(schema=SCHEMA),
                         sql={"000101_add_foo.up.sql": "CREATE TABLE foo (id text);",
                              "000104_add_bar.up.sql": "ALTER TABLE channels ADD COLUMN bar text;"})
        result = check("changelog-migrations", fake, **self.kwargs)
        self.assertEqual((result.status, result.summary),
                         (checks.PASS, "2 new migrations, 1 not mentioned in the changelog entry"))
        self.assertEqual([(i.label, i.note) for i in result.items], [("000104_add_bar", "not mentioned in Database Schema Changes")])
        self.assertNotIn("bar", result.summary)

    def test_a_number_inside_another_number_is_not_a_mention(self):
        schema = "#### Database Schema Changes\n\n - Raised the limit to 10105 rows.\n\n"
        fake = self.fake(["000105_x.up.sql"], changelog_pr(), text=entry(schema=schema), sql={"000105_x.up.sql": "SELECT 1;"})
        self.assertEqual(len(check("changelog-migrations", fake, **self.kwargs).items), 1)

    def test_a_merged_pr_is_read_from_master(self):
        fake = self.fake(["000101_add_foo.up.sql"], changelog_pr(merged=True), sql={"000101_add_foo.up.sql": "CREATE TABLE foo (id text);"})
        fake.files[(MM, "master", FILE)] = entry(schema=SCHEMA)
        self.assertEqual(check("changelog-migrations", fake, **self.kwargs).items, [])


if __name__ == "__main__":
    unittest.main()

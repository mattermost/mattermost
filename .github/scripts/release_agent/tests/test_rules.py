import copy
import json
import unittest

from release_agent import rules
from release_agent.playbook import title_matches
from release_agent.checks import CHECKS


class RulesFileTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = rules.load_yaml(rules.RULES_PATH)
        cls.schema = json.loads(rules.SCHEMA_PATH.read_text())
        cls.titles = rules.template_items(rules.load_yaml(rules.TEMPLATE_PATH))

    def test_rules_file_is_valid(self):
        self.assertEqual(rules.problems(self.rules, self.schema, self.titles), [])

    def test_every_playbook_item_is_in_the_template(self):
        for rule in self.rules["rules"]:
            if rule["playbook_item"] is not None:
                self.assertTrue(any(title_matches(title, rule["playbook_item"]) for title in self.titles), rule["task"])

    def test_template_matches_the_playbook(self):
        template = rules.load_yaml(rules.TEMPLATE_PATH)
        self.assertEqual([len(c["items"]) for c in template["checklists"]], [2, 16, 6, 2, 4, 1, 2, 13])
        self.assertEqual(len(self.titles), 46)

    def test_due_days_and_playbook_sections(self):
        sections = [(item["title"], checklist["title"]) for checklist in rules.load_yaml(rules.TEMPLATE_PATH)["checklists"]
                    for item in checklist["items"]]
        due = {rule["task"]: (rule["due"], next(section for title, section in sections if title_matches(title, rule["playbook_item"])))
               for rule in self.rules["rules"] if rule["playbook_item"]}
        self.assertEqual(due, {
            "open-release-items": ("feature_complete", "(T-16) Feature Complete"),
            "hub-on-release-branch": ("branch_cut", "(T-21 or earlier) Release Branch Cut"),
            "notice-txt": ("branch_cut", "(T-16) Feature Complete"),
            "resolved-tickets": ("final_build", "(T-16) Feature Complete"),
            # The changelog workflow opens its PR at RC-1, a working day after Feature Complete,
            # so these two are due a day later than their T-16 section.
            "changelog-draft": ("feature_complete+1", "(T-16) Feature Complete"),
            "changelog-migrations": ("feature_complete+1", "(T-16) Feature Complete"),
            "changelog-review": ("feature_complete+1", "(T-15) RC-1 Cut & QA Qualification Starts"),
            "changelog-merged": ("release_day", "(T-0) Self-Hosted Release"),
            "cherry-picks": ("final_build", "(T-16) Feature Complete"),
            "e2e-results": ("feature_complete+1", "(T-15) RC-1 Cut & QA Qualification Starts"),
            "final-tags": ("final_build", "(T-5) Final Release Cut"),
            "version-go-prs": ("final_build", "(T-5) Final Release Cut"),
            "loadtest-results": ("T-6", "(T-6) Code Freeze"),
            # Asks to other teams (asks.py), due in their item's section.
            "ces-support-packet": ("T-16", "(T-16) Feature Complete"),
            "docs-ask": ("T-16", "(T-16) Feature Complete"),
            "loadtest-ask": ("T-15", "(T-15) RC-1 Cut & QA Qualification Starts"),
            "manual-tests": ("T-15", "(T-15) RC-1 Cut & QA Qualification Starts"),
            # Monthly, whichever release is active; the item sits in the Code Freeze section.
            "contributors": ("first_working_day_of_month", "(T-6) Code Freeze"),
            "sre-freemium-pro": ("T-4", "(T-4) Cloud Freemium & Professional Releases"),
            "sre-enterprise": ("T-3", "(T-3) Cloud Enterprise Release"),
        })

    def test_every_check_has_a_rule(self):
        self.assertEqual({rule["type"] for rule in self.rules["rules"]} - {"ask"}, set(CHECKS))

    def test_load_rules(self):
        self.assertEqual(len(rules.load_rules()["rules"]), len(self.rules["rules"]))

    def problems_with(self, **changes):
        broken = copy.deepcopy(self.rules)
        broken["rules"][1].update(changes)
        return rules.problems(broken, self.schema, self.titles)

    def test_rejects_unknown_playbook_item(self):
        self.assertEqual(self.problems_with(playbook_item="Not a real item"),
                         ["new-regressions: playbook_item 'Not a real item' is not in the playbook template"])

    def test_playbook_item_may_keep_markdown(self):
        self.assertEqual(self.problems_with(playbook_item="Ensure that all Resolved tickets for the release get Closed."), [])
        self.assertEqual(self.problems_with(playbook_item="Cut the release branches using [this process](https://x). "
                                                          "Double-check that [model/version.go](https://y) has been updated."), [])

    def test_rejects_missing_field(self):
        broken = copy.deepcopy(self.rules)
        del broken["rules"][0]["on_fail"]
        self.assertIn("'on_fail' is a required property", rules.problems(broken, self.schema)[0])

    def test_rejects_unknown_type_and_bad_due(self):
        self.assertTrue(self.problems_with(type="nope"))
        self.assertTrue(self.problems_with(due="next tuesday"))
        self.assertEqual(self.problems_with(due="rc1+1"), ["new-regressions: due 'rc1+1' names no calendar milestone"])

    def test_rejects_mismatched_pass_when(self):
        self.assertEqual(self.problems_with(pass_when="found"),
                         ["new-regressions: a new_regressions check passes when 'all_have_fix_version', not 'found'"])

    def test_report_only_rules_never_fail(self):
        broken = copy.deepcopy(self.rules)
        broken["rules"][0]["on_fail"] = "needs_attention"
        self.assertTrue(rules.problems(broken, self.schema, self.titles))

    def test_rejects_bad_dev_leads(self):
        def problems(**leads):
            broken = copy.deepcopy(self.rules)
            broken["rules"][0]["query"]["dev_leads"] = leads
            return rules.problems(broken, self.schema, self.titles)
        self.assertEqual(problems(match_field="team", team_field="customfield_10800"), [])
        self.assertTrue(problems(match_field="team"))  # no team_field
        # The routes are the variable RELEASE_AGENT_DEV_LEADS: team names don't belong in this public file.
        self.assertTrue(problems(match_field="team", team_field="customfield_10800",
                                 routes=[{"teams": ["Calls"], "username": "jesse.hallam"}]))

    def test_changelog_rules_need_their_query(self):
        def problems(task, **changes):
            broken = copy.deepcopy(self.rules)
            rule = next(r for r in broken["rules"] if r["task"] == task)
            for key, value in changes.items():
                rule["query"].pop(key, None) if value is None else rule["query"].__setitem__(key, value)
            return rules.problems(broken, self.schema, self.titles)
        self.assertEqual(problems("changelog-review"), [])
        self.assertEqual(problems("changelog-review", state="soon"),
                         ["changelog-review: a changelog_pr check needs query.state to be one of exists, ready, merged"])
        self.assertEqual(problems("changelog-merged", live_url=None),
                         ["changelog-merged: a changelog_pr check needs query.live_url"])
        self.assertEqual(problems("changelog-migrations", migrations_path=None),
                         ["changelog-migrations: a changelog_migrations check needs query.migrations_path"])

    def test_the_changelog_rules_tick_the_four_changelog_items(self):
        items = {r["task"]: r["playbook_item"] for r in self.rules["rules"] if r["task"].startswith("changelog-") and r["playbook_item"]}
        self.assertEqual(sorted(items), ["changelog-draft", "changelog-merged", "changelog-migrations", "changelog-review"])
        for title in items.values():
            self.assertIn(title, self.titles)

    def test_a_duplicate_key_in_the_yaml_is_an_error(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rules.yml"
            path.write_text("rules:\n  - task: a\n    playbook_item: One\n    playbook_item: Two\n")
            with self.assertRaisesRegex(Exception, "duplicate key 'playbook_item'"):
                rules.load_yaml(path)
            path.write_text("base: &b {state: exists}\nrules:\n  - {<<: *b, state: ready}\n")
            self.assertEqual(rules.load_yaml(path)["rules"], [{"state": "ready"}])  # merge keys still work

    def test_rejects_a_holiday_that_is_not_a_calendar_date(self):
        broken = copy.deepcopy(self.rules)
        broken["holidays"] = ["2026-12-25", "2026-02-30"]
        self.assertEqual(rules.problems(broken, self.schema, self.titles), ["holidays: '2026-02-30' is not a calendar date"])

    def test_every_check_type_that_reads_a_query_key_requires_it(self):
        broken = copy.deepcopy(self.rules)
        notice = next(r for r in broken["rules"] if r["type"] == "notice_txt")
        notice["query"] = {}
        self.assertEqual(rules.problems(broken, self.schema, self.titles),
                         [f"notice-txt: a notice_txt check needs query.{key}" for key in ("repo", "author", "title", "milestone")])

    def test_migrations_path_must_be_a_non_empty_string(self):
        for value in (None, "", 7):
            broken = copy.deepcopy(self.rules)
            next(r for r in broken["rules"] if r["type"] == "changelog_migrations")["query"]["migrations_path"] = value
            self.assertTrue(rules.problems(broken, self.schema, self.titles), value)

    def test_rejects_duplicate_task(self):
        broken = copy.deepcopy(self.rules)
        broken["rules"].append(copy.deepcopy(broken["rules"][1]))
        self.assertIn("new-regressions: task is listed twice", rules.problems(broken, self.schema, self.titles))


if __name__ == "__main__":
    unittest.main()

import copy
import json
import unittest

from release_agent import rules
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
                self.assertIn(rule["playbook_item"], self.titles, rule["task"])

    def test_template_matches_the_playbook(self):
        template = rules.load_yaml(rules.TEMPLATE_PATH)
        self.assertEqual([len(c["items"]) for c in template["checklists"]], [2, 16, 6, 3, 4, 1, 3, 13])
        self.assertEqual(len(self.titles), 48)

    def test_due_days_and_playbook_sections(self):
        sections = {item["title"]: checklist["title"] for checklist in rules.load_yaml(rules.TEMPLATE_PATH)["checklists"]
                    for item in checklist["items"]}
        due = {rule["task"]: (rule["due"], sections[rule["playbook_item"]])
               for rule in self.rules["rules"] if rule["playbook_item"]}
        self.assertEqual(due, {
            "open-release-items": ("feature_complete", "(T-16) Feature Complete"),
            "hub-on-release-branch": ("branch_cut", "(T-21 or earlier) Release Branch Cut"),
            "notice-txt": ("branch_cut", "(T-16) Feature Complete"),
            "cherry-picks": ("final_build", "(T-16) Feature Complete"),
            "e2e-results": ("feature_complete+1", "(T-15) RC-1 Cut & QA Qualification Starts"),
            "final-tags": ("final_build", "(T-5) Final Release Cut"),
            "version-go-prs": ("final_build", "(T-5) Final Release Cut"),
        })

    def test_every_check_has_a_rule(self):
        self.assertEqual({rule["type"] for rule in self.rules["rules"]}, set(CHECKS))

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

    def test_rejects_duplicate_task(self):
        broken = copy.deepcopy(self.rules)
        broken["rules"].append(copy.deepcopy(broken["rules"][1]))
        self.assertIn("new-regressions: task is listed twice", rules.problems(broken, self.schema, self.titles))


if __name__ == "__main__":
    unittest.main()

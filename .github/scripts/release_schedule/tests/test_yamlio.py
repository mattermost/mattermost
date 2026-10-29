"""The YAML subset reader."""

import unittest
from datetime import date

from release_schedule import yamlio
from release_schedule.schedule import SCHEDULE_PATH

try:
    import yaml
except ImportError:
    yaml = None


class LoadTest(unittest.TestCase):
    def test_scalars(self):
        doc = yamlio.load(
            "a: 1\nb: true\nc: false\nd: null\ne: ~\nf: 2026-12-25\ng: v12.2\nh: 2026-05\n"
            "i: \"v12.2 (December 2026)\"\nj: 'it''s'\nk: plain text here\n"
        )
        self.assertEqual(doc, {"a": 1, "b": True, "c": False, "d": None, "e": None, "f": date(2026, 12, 25),
                               "g": "v12.2", "h": "2026-05", "i": "v12.2 (December 2026)", "j": "it's",
                               "k": "plain text here"})

    def test_comments(self):
        doc = yamlio.load("# top\na: 2026-11-10  # T-16\nb: \"x # not a comment\"  # but this is\nc: a#b\n")
        self.assertEqual(doc, {"a": date(2026, 11, 10), "b": "x # not a comment", "c": "a#b"})

    def test_flow_collections(self):
        doc = yamlio.load('a: [2026-12-25, v12.4, "x, y"]\nb: []\nc: {date: 2026-01-01, name: "New Year\'s Day"}\n')
        self.assertEqual(doc, {"a": [date(2026, 12, 25), "v12.4", "x, y"], "b": [],
                               "c": {"date": date(2026, 1, 1), "name": "New Year's Day"}})

    def test_block_collections(self):
        doc = yamlio.load(
            "releases:\n"
            "  - version: v12.2\n"
            "    milestones:\n"
            "      rc1: 2026-11-24\n"
            "    desktop: null\n"
            "  - version: v12.3\n"
            "list:\n"
            "- a\n"
            "- b\n"
            "nested:\n"
            "  -\n"
            "    x: 1\n"
        )
        self.assertEqual(doc, {
            "releases": [{"version": "v12.2", "milestones": {"rc1": date(2026, 11, 24)}, "desktop": None},
                         {"version": "v12.3"}],
            "list": ["a", "b"],
            "nested": [{"x": 1}],
        })

    def test_empty_value_is_null(self):
        self.assertEqual(yamlio.load("a:\nb: 1\n"), {"a": None, "b": 1})

    def test_errors(self):
        for text, message in [
            ("a: 1\na: 2\n", "duplicate key"),
            ("a: &anchor 1\n", "unsupported"),
            ("a: |\n  text\n", "unsupported"),
            ("a: [1,\n  2]\n", "one line"),
            ("a: 2026-02-30\n", "day is out of range"),
            ("a: 1\n    b: 2\n", "indentation"),
            ("just a scalar line\nkey: 1\n", "expected 'key: value'"),
            ("a: \"open\n", "double-quoted"),
        ]:
            with self.subTest(text=text), self.assertRaisesRegex(yamlio.YAMLError, message):
                yamlio.load(text)

    def test_quote(self):
        for text in ['plain', 'with "quotes"', "it's", "a: b # c", "ünï"]:
            self.assertEqual(yamlio.load(f"k: {yamlio.quote(text)}\n"), {"k": text})


@unittest.skipIf(yaml is None, "PyYAML is not installed")
class MatchesPyYAMLTest(unittest.TestCase):
    def test_schedule_yml(self):
        text = SCHEDULE_PATH.read_text(encoding="utf-8")
        self.assertEqual(yamlio.load(text), yaml.safe_load(text))


if __name__ == "__main__":
    unittest.main()

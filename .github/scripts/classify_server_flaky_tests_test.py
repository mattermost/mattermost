#!/usr/bin/env python3

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from classify_server_flaky_tests import classify_flaky_tests


def classify_report(xml: str):
    with TemporaryDirectory() as temp_dir:
        path = Path(temp_dir) / "report.xml"
        path.write_text(xml, encoding="utf-8")
        return classify_flaky_tests(path)


def testcase(name: str, classname: str, failed: bool = False) -> str:
    if failed:
        return f'<testcase classname="{classname}" name="{name}"><failure>failed</failure></testcase>'
    return f'<testcase classname="{classname}" name="{name}"></testcase>'


class ClassifyServerFlakyTestsTest(unittest.TestCase):
    def test_excludes_one_failure_then_pass(self) -> None:
        flaky_tests = classify_report(
            "<testsuite>"
            + testcase("TestOneRetry", "pkg/example", failed=True)
            + testcase("TestOneRetry", "pkg/example")
            + "</testsuite>"
        )

        self.assertEqual(flaky_tests, [])

    def test_includes_two_failures_then_pass(self) -> None:
        flaky_tests = classify_report(
            "<testsuite>"
            + testcase("TestTwoRetries", "pkg/example", failed=True)
            + testcase("TestTwoRetries", "pkg/example", failed=True)
            + testcase("TestTwoRetries", "pkg/example")
            + "</testsuite>"
        )

        self.assertEqual(len(flaky_tests), 1)
        self.assertEqual(flaky_tests[0].key.name, "TestTwoRetries")
        self.assertEqual(flaky_tests[0].failed_attempts, 2)

    def test_includes_three_failures_then_pass(self) -> None:
        flaky_tests = classify_report(
            "<testsuite>"
            + testcase("TestThreeRetries", "pkg/example", failed=True)
            + testcase("TestThreeRetries", "pkg/example", failed=True)
            + testcase("TestThreeRetries", "pkg/example", failed=True)
            + testcase("TestThreeRetries", "pkg/example")
            + "</testsuite>"
        )

        self.assertEqual(len(flaky_tests), 1)
        self.assertEqual(flaky_tests[0].key.name, "TestThreeRetries")
        self.assertEqual(flaky_tests[0].failed_attempts, 3)

    def test_excludes_four_failed_attempts(self) -> None:
        flaky_tests = classify_report(
            "<testsuite>"
            + testcase("TestPersistentFailure", "pkg/example", failed=True)
            + testcase("TestPersistentFailure", "pkg/example", failed=True)
            + testcase("TestPersistentFailure", "pkg/example", failed=True)
            + testcase("TestPersistentFailure", "pkg/example", failed=True)
            + "</testsuite>"
        )

        self.assertEqual(flaky_tests, [])

    def test_excludes_pass_only(self) -> None:
        flaky_tests = classify_report("<testsuite>" + testcase("TestPass", "pkg/example") + "</testsuite>")

        self.assertEqual(flaky_tests, [])

    def test_groups_same_test_name_by_classname(self) -> None:
        flaky_tests = classify_report(
            "<testsuite>"
            + testcase("TestDuplicateName", "pkg/one", failed=True)
            + testcase("TestDuplicateName", "pkg/one", failed=True)
            + testcase("TestDuplicateName", "pkg/one")
            + testcase("TestDuplicateName", "pkg/two", failed=True)
            + testcase("TestDuplicateName", "pkg/two")
            + "</testsuite>"
        )

        self.assertEqual(len(flaky_tests), 1)
        self.assertEqual(flaky_tests[0].key.classname, "pkg/one")

    def test_supports_flaky_failure_elements(self) -> None:
        flaky_tests = classify_report(
            """
            <testsuite>
              <testcase classname="pkg/example" name="TestFlakyFailure">
                <flakyFailure>first failed attempt</flakyFailure>
                <flakyFailure>second failed attempt</flakyFailure>
              </testcase>
            </testsuite>
            """
        )

        self.assertEqual(len(flaky_tests), 1)
        self.assertEqual(flaky_tests[0].failed_attempts, 2)


if __name__ == "__main__":
    unittest.main()

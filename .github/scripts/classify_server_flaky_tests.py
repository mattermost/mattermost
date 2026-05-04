#!/usr/bin/env python3
"""Classify high-confidence flaky server tests from a JUnit XML report."""

from __future__ import annotations

import argparse
import os
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


FAILURE_TAGS = {"failure", "error"}
FLAKY_FAILURE_TAGS = {"flakyfailure", "flakyerror"}
SKIPPED_TAGS = {"skipped"}


@dataclass(frozen=True)
class TestKey:
    classname: str
    name: str
    file: str


@dataclass(frozen=True)
class Attempt:
    failed: bool
    skipped: bool
    flaky_failures: int


@dataclass(frozen=True)
class FlakyTest:
    key: TestKey
    failed_attempts: int


def local_name(tag: str) -> str:
    """Return a namespace-free, lower-case XML tag name."""
    return tag.rsplit("}", maxsplit=1)[-1].lower()


def testcase_key(testcase: ET.Element) -> TestKey:
    return TestKey(
        classname=testcase.attrib.get("classname", ""),
        name=testcase.attrib.get("name", ""),
        file=testcase.attrib.get("file", ""),
    )


def testcase_attempt(testcase: ET.Element) -> Attempt:
    child_tags = [local_name(child.tag) for child in testcase]
    return Attempt(
        failed=any(tag in FAILURE_TAGS for tag in child_tags),
        skipped=any(tag in SKIPPED_TAGS for tag in child_tags),
        flaky_failures=sum(1 for tag in child_tags if tag in FLAKY_FAILURE_TAGS),
    )


def parse_attempts(report_path: Path) -> dict[TestKey, list[Attempt]]:
    root = ET.parse(report_path).getroot()
    attempts: dict[TestKey, list[Attempt]] = defaultdict(list)
    for testcase in root.iter():
        if local_name(testcase.tag) != "testcase":
            continue
        attempts[testcase_key(testcase)].append(testcase_attempt(testcase))
    return attempts


def classify_flaky_tests(report_path: Path) -> list[FlakyTest]:
    flaky_tests: list[FlakyTest] = []
    for key, attempts in parse_attempts(report_path).items():
        flaky_failure_count = sum(attempt.flaky_failures for attempt in attempts)
        if flaky_failure_count:
            final_attempt = attempts[-1]
            if 2 <= flaky_failure_count <= 3 and not final_attempt.failed and not final_attempt.skipped:
                flaky_tests.append(FlakyTest(key=key, failed_attempts=flaky_failure_count))
            continue

        final_attempt = attempts[-1]
        failed_attempts = sum(1 for attempt in attempts[:-1] if attempt.failed)
        if 2 <= failed_attempts <= 3 and not final_attempt.failed and not final_attempt.skipped:
            flaky_tests.append(FlakyTest(key=key, failed_attempts=failed_attempts))

    return sorted(flaky_tests, key=lambda item: (item.key.classname, item.key.name, item.key.file))


def escape_markdown_cell(value: str) -> str:
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ")


def build_markdown(flaky_tests: Iterable[FlakyTest]) -> str:
    rows = [
        "| Test | Class | Failed attempts before pass |",
        "| --- | --- | ---: |",
    ]
    for flaky_test in flaky_tests:
        rows.append(
            "| {test} | {classname} | {attempts} |".format(
                test=escape_markdown_cell(flaky_test.key.name or "(unknown)"),
                classname=escape_markdown_cell(flaky_test.key.classname or "(unknown)"),
                attempts=flaky_test.failed_attempts,
            )
        )
    return "\n".join(rows)


def write_github_output(name: str, value: str) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        print(f"{name}={value}")
        return

    with open(output_path, "a", encoding="utf-8") as output:
        if "\n" in value:
            delimiter = f"EOF_{name}"
            output.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")
        else:
            output.write(f"{name}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("report_path", type=Path)
    args = parser.parse_args()

    flaky_tests = classify_flaky_tests(args.report_path)
    write_github_output("has_flaky", "true" if flaky_tests else "false")
    write_github_output("flaky_markdown", build_markdown(flaky_tests) if flaky_tests else "")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

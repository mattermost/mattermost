"""Replay of v12.1's approved cherry-picks.

fixtures/v12_1_cherry_picks.json holds the 17 PRs (16 in mattermost, 1 in enterprise, its
title left out) that ended up with ``CherryPick/Done`` and the v12.1.0 milestone, as GitHub
had them on Oct 29, 2026. Jira isn't readable from CI, so each PR stands in for a Submitted
v12.1 ticket linking to it: the key in its title, or a made-up one.
"""

import copy
import json
import re
import unittest
from pathlib import Path

from release_cherrypick import output
from release_cherrypick.labeller import Labeller, find_fix_version
from release_cherrypick.tests.fakes import FakeGitHub, FakeJira, ticket

PRS = json.loads((Path(__file__).parent / "fixtures" / "v12_1_cherry_picks.json").read_text())
VERSIONS = [{"id": "121", "name": "v12.1 (November 2026)", "released": False}]
V121 = find_fix_version(VERSIONS, 12, 1)


def tickets():
    found = {}
    for index, pr in enumerate(PRS):
        match = re.search(r"MM-\d+", pr["title"])
        key = match.group(0) if match else f"MM-9{index:04d}"
        found[key] = pr
    return found


def jira():
    by_key = tickets()
    return FakeJira([ticket(key, ("v12.1 (November 2026)",)) for key in by_key],
                    {key: [pr["html_url"]] for key, pr in by_key.items()}, VERSIONS)


def github(before: bool):
    pulls = []
    for pr in PRS:
        pr = copy.deepcopy(pr)
        if before:
            pr["labels"] = [label for label in pr["labels"] if not label["name"].startswith("CherryPick/")]
            pr["milestone"] = None
        pulls.append((pr["repo"], pr))
    fake = FakeGitHub(pulls, branches=("release-12.1",))
    fake.milestone_titles["mattermost/enterprise"]["v12.1.0"] = 51
    return fake


class ReplayV121Test(unittest.TestCase):
    def test_before_labelling_a_dry_run_plans_what_the_prs_actually_got(self):
        fake = github(before=True)
        report = Labeller(jira(), fake, live=False).run_version(V121)
        self.assertEqual(fake.writes, [])
        planned = {(c.repo, c.number): (c.label, c.milestone) for c in report.labelled}
        actual = {(pr["repo"], pr["number"]): ("would_add" if {"CherryPick/Approved", "CherryPick/Done"} & {l["name"] for l in pr["labels"]} else "",
                                               "would_set" if pr["milestone"]["title"] == "v12.1.0" else "")
                  for pr in PRS}
        self.assertEqual(planned, actual)
        self.assertEqual(len(planned), 17)
        self.assertEqual((report.no_pr, report.outside, report.conflicts, report.skipped, report.errors), ([], [], [], [], []))
        self.assertNotIn("left out", output.summary([report], False))

    def test_after_labelling_a_dry_run_has_nothing_to_do(self):
        fake = github(before=False)
        report = Labeller(jira(), fake, live=False).run_version(V121)
        self.assertEqual((len(report.labelled), len(report.already_done), fake.writes), (0, 17, []))


if __name__ == "__main__":
    unittest.main()

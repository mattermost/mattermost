"""The release docs workflows and the changelog write app's key.

The key is a secret of the `release-write` environment, which only master can use. Every job that
mints a write-app token declares that environment and runs only with ref master; tag pushes,
release events and PR edits go through release-docs-trigger.yml, which holds no secret and only
starts the task on master. No workflow in this public repo asks an app for actions or names
delivery-platform: only the private mattermost/release-automation starts delivery-platform
workflows. Every workflow in the repo is checked, not only these: a write-app token minted by
any other job fails the test."""

import re
import unittest
from pathlib import Path

import yaml

WORKFLOWS = Path(__file__).resolve().parents[3] / "workflows"
ENVIRONMENT = "release-write"
MASTER = "github.ref == 'refs/heads/master'"


def load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def triggers(workflow: dict) -> set:
    """PyYAML (YAML 1.1) reads the key `on` as True."""
    return set(workflow.get("on", workflow.get(True)) or {})


def uncommented(path: Path) -> str:
    return "\n".join(line for line in path.read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("#"))


def release_docs_workflows() -> dict:
    return {path.name: load(path) for path in sorted(WORKFLOWS.glob("release-docs-*.yml"))}


# generate-changelog.yml is moved into release-write by mattermost/mattermost#40201, which adds
# test_changelog_automation.py with the same check. Until that is on this branch, master's copy
# still mints outside the environment; once it is, the file is checked here too.
PENDING_ELSEWHERE = {"generate-changelog.yml": WORKFLOWS.parent / "scripts" / "test_changelog_automation.py"}


def all_workflows() -> dict:
    return {path.name: load(path) for path in sorted(WORKFLOWS.glob("*.y*ml"))
            if not (path.name in PENDING_ELSEWHERE and not PENDING_ELSEWHERE[path.name].exists())}


def mints_write_token(job: dict) -> bool:
    """Whether the job can reach the write app's key: anywhere in it (a step's ``private-key``, an
    ``env:``, the ``secrets:`` passed to a reusable workflow)."""
    return "CHANGELOG_WRITE_PRIVATE_KEY" in str(job) or job.get("secrets") == "inherit"


def _split_top(text: str, operator: str) -> list[str]:
    parts, depth, last, i = [], 0, 0, 0
    while i < len(text):
        depth += {"(": 1, ")": -1}.get(text[i], 0)
        if depth == 0 and text.startswith(operator, i):
            parts.append(text[last:i])
            last = i = i + len(operator)
            continue
        i += 1
    return [part.strip() for part in parts + [text[last:]]]


def _wrapped(text: str) -> bool:
    depth = 0
    for i, char in enumerate(text):
        depth += {"(": 1, ")": -1}.get(char, 0)
        if depth == 0:
            return i == len(text) - 1
    return False


def requires_master(condition) -> bool:
    """Whether a job ``if:`` holds only with ref master: the ref test is a top-level ``&&`` term
    (inside an ``||``, or as ``!=``, it requires nothing)."""
    condition = str(condition or "").strip().removeprefix("${{").removesuffix("}}").strip()
    while condition.startswith("(") and _wrapped(condition):
        condition = condition[1:-1].strip()
    return any(term == MASTER or (term.startswith("(") and _wrapped(term) and requires_master(term))
               for term in _split_top(condition, "&&"))


def problems(workflows: dict) -> list:
    found = []
    for name, workflow in workflows.items():
        for job_id, job in (workflow.get("jobs") or {}).items():
            if not mints_write_token(job):
                continue
            if job.get("uses"):
                # A job calling a reusable workflow can't declare an environment, and an environment
                # secret is never passed in from the caller: the callee's own release-write job reads
                # it. So the callee must be a workflow of this repo, checked here like any other.
                callee = job["uses"].removeprefix("./.github/workflows/")
                if job["uses"] == callee or callee not in workflows:
                    found.append(f"{name} {job_id}: passes the write key to {job['uses']}, which this check doesn't cover")
            elif job.get("environment") != ENVIRONMENT:
                found.append(f"{name} {job_id}: mints a write-app token outside {ENVIRONMENT}")
            if not requires_master(job.get("if")):
                found.append(f"{name} {job_id}: mints a write-app token without requiring ref master")
            for step in job.get("steps") or []:
                inputs = step.get("with") or {}
                if "CHANGELOG_WRITE_PRIVATE_KEY" in str(inputs.get("private-key", "")):
                    named = {k: v for k, v in inputs.items() if k.startswith("permission-")}
                    if not inputs.get("repositories") or not named:
                        found.append(f"{name} {job_id} {step.get('id', '')}: a write token must name its repositories "
                                     "and permissions")
    return found


class WriteKeyTest(unittest.TestCase):
    def test_write_tokens_are_minted_only_in_release_write_on_master(self):
        self.assertEqual(problems(all_workflows()), [])

    def test_every_workflow_is_checked(self):
        checked = set(all_workflows())
        self.assertTrue({"release-docs-task.yml", "changelog-link-check.yml", "docs-writer-merged-pr.yml"} <= checked)
        pending = {name for name, test in PENDING_ELSEWHERE.items() if not test.exists()}
        self.assertEqual(checked | pending, {path.name for path in WORKFLOWS.glob("*.y*ml")})

    def test_master_must_be_required_not_just_named(self):
        for condition in ("github.event_name == 'release' || github.ref == 'refs/heads/master'",
                          "github.ref != 'refs/heads/master'", None):
            self.assertFalse(requires_master(condition), condition)
        for condition in (MASTER, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master'",
                          "(github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && "
                          "github.ref == 'refs/heads/master'"):
            self.assertTrue(requires_master(condition), condition)

    def test_any_other_job_that_can_reach_the_key_fails(self):
        key = "${{ secrets.CHANGELOG_WRITE_PRIVATE_KEY }}"
        task = {"jobs": {"run": {"environment": ENVIRONMENT, "if": MASTER,
                                 "steps": [{"with": {"private-key": key, "repositories": "mattermost",
                                                     "permission-contents": "write"}}]}}}
        workflows = {
            "task.yml": task,
            "env.yml": {"jobs": {"x": {"if": MASTER, "env": {"KEY": key}, "steps": []}}},
            "or.yml": {"jobs": {"x": {"environment": ENVIRONMENT, "if": f"github.event_name == 'release' || {MASTER}",
                                      "env": {"KEY": key}, "steps": []}}},
            "caller.yml": {"jobs": {"ok": {"if": f"github.event_name == 'workflow_dispatch' && {MASTER}",
                                           "uses": "./.github/workflows/task.yml", "secrets": "inherit"},
                                    "elsewhere": {"if": MASTER, "uses": "org/repo/.github/workflows/w.yml@v1",
                                                  "secrets": "inherit"},
                                    "release": {"uses": "./.github/workflows/task.yml", "secrets": {"KEY": key}}}},
            "fine.yml": {"jobs": {"x": {"steps": [{"run": "echo no key here"}]}}},
        }
        self.assertEqual(problems(workflows), [
            "env.yml x: mints a write-app token outside release-write",
            "or.yml x: mints a write-app token without requiring ref master",
            "caller.yml elsewhere: passes the write key to org/repo/.github/workflows/w.yml@v1, which this check doesn't cover",
            "caller.yml release: mints a write-app token without requiring ref master",
        ])
    def test_the_check_finds_each_problem(self):
        job = {"if": "true", "steps": [{"id": "write", "with": {"private-key": "${{ secrets.CHANGELOG_WRITE_PRIVATE_KEY }}"}}]}
        self.assertEqual(problems({"x.yml": {"jobs": {"run": job}}}), [
            "x.yml run: mints a write-app token outside release-write",
            "x.yml run: mints a write-app token without requiring ref master",
            "x.yml run write: a write token must name its repositories and permissions",
        ])

    def test_no_public_workflow_asks_for_actions_or_delivery_platform(self):
        for path in sorted(WORKFLOWS.glob("*.y*ml")):
            code = uncommented(path)
            self.assertNotIn("delivery-platform", code, path.name)
            self.assertIsNone(re.search(r"(?m)^\s+permission-actions:", code), path.name)

    def test_events_whose_ref_isnt_master_only_reach_the_trigger(self):
        for name, workflow in release_docs_workflows().items():
            if not triggers(workflow) & {"release", "push", "pull_request"}:
                continue
            for job_id, job in workflow["jobs"].items():
                uses = job.get("uses", "")
                if uses.endswith("release-docs-task.yml"):
                    self.assertIn(MASTER, job.get("if", ""), f"{name} {job_id}")
                    self.assertTrue(re.search(r"github\.event_name == 'workflow_dispatch'", job["if"]), f"{name} {job_id}")
                elif uses.endswith("release-docs-trigger.yml"):
                    self.assertNotIn("secrets", job, f"{name} {job_id}: the trigger holds no secret")
                    self.assertEqual(job["with"]["workflow"], name, f"{name} {job_id}: starts itself on master")

    def test_the_trigger_holds_no_secret_and_starts_the_task_on_master(self):
        source = uncommented(WORKFLOWS / "release-docs-trigger.yml")
        self.assertNotIn("secrets.", source)
        self.assertNotIn("environment:", source)
        trigger = load(WORKFLOWS / "release-docs-trigger.yml")["jobs"]["trigger"]
        self.assertEqual(trigger["permissions"], {"contents": "read", "actions": "write"})
        self.assertIn('--ref master', source)
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", source, "the code never comes from a PR")


if __name__ == "__main__":
    unittest.main()

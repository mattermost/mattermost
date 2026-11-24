"""The release docs workflows and the changelog write app's key.

The key is a secret of the `release-write` environment, which only master can use. Every job that
mints a write-app token declares that environment and runs only with ref master; tag pushes,
release events and PR edits go through release-docs-trigger.yml, which holds no secret and only
starts the task on master. No workflow in this public repo asks an app for actions or names
delivery-platform: only the private mattermost/release-automation starts delivery-platform
workflows. (test_changelog_automation.py checks generate-changelog.yml the same way.)"""

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


def mints_write_token(job: dict) -> bool:
    return any("CHANGELOG_WRITE_PRIVATE_KEY" in str((step.get("with") or {}).get("private-key", ""))
               for step in job.get("steps") or [])


def problems(workflows: dict) -> list:
    found = []
    for name, workflow in workflows.items():
        for job_id, job in (workflow.get("jobs") or {}).items():
            if not mints_write_token(job):
                continue
            if job.get("environment") != ENVIRONMENT:
                found.append(f"{name} {job_id}: mints a write-app token outside {ENVIRONMENT}")
            if MASTER not in str(job.get("if", "")):
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
        self.assertEqual(problems(release_docs_workflows()), [])

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

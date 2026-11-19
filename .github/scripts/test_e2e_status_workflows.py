#!/usr/bin/env python3
"""Status ownership wiring regressions for this repository's E2E workflows.

What this guards: the parts of the E2E status pipeline that live in this repository's YAML
and that the toolkit actions cannot see from inside their own tests: which jobs hold the
SHA-scoped publication lock, which secrets and permissions reach triage and the lane result,
which steps run on cancellation, the order in which the lane result publishes, triages, posts
and gates, and that the PR lane list has exactly one source.

What it does not guard: the behaviour of e2e-status and e2e-triage (owner rules, aggregate
projection, report verification, triage verdicts). Those are tested in the toolkit repository.

Run: python3 -m unittest discover -s .github/scripts -p 'test_e2e_status_workflows.py' -v
"""
import json
import re
import os
import pathlib
import subprocess
import tempfile
import unittest

import yaml

GITHUB = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = GITHUB / 'workflows'
LANE_RESULT = 'e2e-tests-lane-result'
TRUSTED_READER = './.e2e-trusted/.github/actions/e2e-status-lanes'
READER_FORBIDDEN_REFS = {'${{ inputs.commit_sha }}', '${{ needs.resolve-pr.outputs.head_sha }}',
                        '${{ github.event.pull_request.head.sha }}', '${{ github.event.repository.default_branch }}'}
LOCK = {'group': 'e2e-status-publish-${{ inputs.commit_sha }}', 'cancel-in-progress': False, 'queue': 'max'}
# actions: read lets triage read the run's failed jobs before it asks for an automatic re-run.
PERMISSIONS = {'contents': 'read', 'statuses': 'write', 'pull-requests': 'read', 'actions': 'read'}


def workflow(name):
    """The parsed .github/workflows/e2e-tests-<name>.yml."""
    return yaml.safe_load((WORKFLOWS / f'e2e-tests-{name}.yml').read_text())


def lane_result_workflow():
    """The parsed lane result workflow (e2e-tests-lane-result.yml)."""
    return yaml.safe_load((WORKFLOWS / f'{LANE_RESULT}.yml').read_text())


def step(job, name):
    """The step of job whose name is name."""
    return next(s for s in job['steps'] if s.get('name') == name)


class StatusPublicationContract(unittest.TestCase):
    """How every E2E lane claims, publishes, triages and gates its commit status."""
    def test_every_pr_lane_gives_triage_the_model_key(self):
        """Every PR lane gives triage the model key."""
        # A lane without the key gets history rules only: its failures never reach the judge.
        jobs = workflow('ci')['jobs']
        lanes = {name: job for name, job in jobs.items() if str(job.get('uses', '')).startswith('./.github/workflows/e2e-tests-')}
        self.assertIn('e2e-playwright-subpath', lanes)
        for name, job in lanes.items():
            with self.subTest(lane=name):
                self.assertEqual(job.get('secrets', {}).get('ANTHROPIC_API_KEY'), '${{ secrets.ANTHROPIC_API_KEY }}')
        for suite in ('cypress', 'playwright'):
            with self.subTest(template=suite):
                lane = workflow(f'{suite}-template')['jobs']['lane-result']
                self.assertEqual(lane['secrets']['ANTHROPIC_API_KEY'], '${{ secrets.ANTHROPIC_API_KEY }}')

    def test_manual_and_automatic_dispatches_share_lane_keys(self):
        """Manual and automatic dispatches share lane keys."""
        for suite in ('cypress', 'playwright'):
            with self.subTest(suite=suite):
                concurrency = workflow(suite)['concurrency']
                key = concurrency['group']
                self.assertIn(f'e2e-lane-{suite}', key)
                self.assertIn('inputs.pr_number', key)
                self.assertIn('inputs.server_edition', key)
                self.assertNotIn('github.ref', key)
                self.assertNotIn('github.sha', key)
                self.assertFalse(concurrency['cancel-in-progress'])
        source = (WORKFLOWS / 'e2e-tests-ci.yml').read_text()
        self.assertIn('commits/${INPUT_COMMIT_SHA}" --jq', source)
        self.assertNotIn('COMMIT_SHA=${INPUT_COMMIT_SHA}', source)

    def test_lanes_of_one_run_never_share_a_lane_key(self):
        """Lanes of one run never share a lane key."""
        # GitHub keeps one pending run per group and cancels it when another joins, so two lanes
        # of one run in the same group lose one lane before it starts.
        jobs = workflow('ci')['jobs']
        for suite in ('cypress', 'playwright'):
            key_inputs = sorted(set(re.findall(r'inputs\.(\w+)', workflow(suite)['concurrency']['group'])))
            callers = {name: job.get('with', {}) for name, job in jobs.items()
                       if job.get('uses') == f'./.github/workflows/e2e-tests-{suite}.yml'}
            self.assertGreater(len(callers), 1)
            seen = {}
            for name, inputs in callers.items():
                key = tuple(str(inputs.get(i, '')) for i in key_inputs)
                with self.subTest(suite=suite, lane=name):
                    self.assertNotIn(key, seen, f'{name} shares its lane key with {seen.get(key)}')
                seen[key] = name

    def test_all_writers_share_a_sha_mutex_and_keep_queued_publishers(self):
        """All writers share a SHA mutex and keep queued publishers."""
        self.assertEqual(lane_result_workflow()['jobs']['lane-result']['concurrency'], LOCK)
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            with self.subTest(suite=suite):
                self.assertEqual(jobs['prepare-run']['concurrency'], LOCK)
                self.assertEqual(workflow(suite)['jobs']['skip']['concurrency'], LOCK)
                self.assertNotIn('concurrency', jobs['report'], 'report writes no status; the lane result owns publication')
                self.assertNotIn('concurrency', jobs['workers'], 'workers run independently across suites and editions')

    def test_explicit_verifiers_share_the_same_publication_lock(self):
        """Explicit verifiers share the same publication lock."""
        cases = [('override-status', 'override-status', 'needs.resolve-pr.outputs.head_sha'),
                 ('verified-label', 'approve-e2e', 'github.event.pull_request.head.sha')]
        for file, job_name, sha in cases:
            job = workflow(file)['jobs'][job_name]
            self.assertEqual(job['concurrency'], {
                'group': 'e2e-status-publish-${{ ' + sha + ' }}',
                'cancel-in-progress': False, 'queue': 'max',
            })
            script = next(s['run'] for s in job['steps'] if '/statuses/${COMMIT_SHA}' in s.get('run', ''))
            self.assertIn('if [ "$CURRENT_STATE" != "failure" ]; then', script)
            self.assertIn('-f target_url="$CURRENT_URL"', script)
            summary = step(job, 'ci/refresh-verified-summary')
            self.assertEqual(summary['with']['operation'], 'summarize')
            self.assertIn(sha, summary['with']['composite-identity'])
        manual = workflow('override-status')['jobs']
        self.assertEqual(manual['override-status']['needs'], 'resolve-pr')
        self.assertNotIn('statuses', manual['resolve-pr']['permissions'])

    def test_shared_unconditional_writers_are_disabled(self):
        """Shared unconditional writers are disabled."""
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            self.assertEqual(step(jobs['dispatch-begin'], 'ci/dispatch-begin')['with']['post-pending-commit-status'], 'false')
            self.assertEqual(step(jobs['report'], 'ci/run-summary')['with']['update-commit-status'], 'false')
            self.assertEqual(step(jobs['prepare-run'], 'ci/claim-status')['with']['state'], 'pending')
            self.assertEqual(step(workflow(suite)['jobs']['skip'], 'ci/post-skip-status')['with']['operation'], 'claim')
            for file in [suite, f'{suite}-template']:
                self.assertNotIn('/statuses/', (WORKFLOWS / f'e2e-tests-{file}.yml').read_text())
        self.assertNotIn('/statuses/', (WORKFLOWS / f'{LANE_RESULT}.yml').read_text())

    def test_cancellation_preserves_diagnostics_without_status_publication(self):
        """Cancellation preserves diagnostics without status publication."""
        lane_steps = lane_result_workflow()['jobs']['lane-result']['steps']
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            report = jobs['report']
            self.assertEqual(report['if'], 'always()')
            self.assertEqual(step(report, 'ci/run-summary')['if'], 'always()')
            uploads = [s for s in jobs['workers']['steps'] if 'actions/upload-artifact@' in s.get('uses', '')]
            self.assertTrue(uploads)
            self.assertTrue(all(s['if'] == 'always()' for s in uploads))
        for name in ('ci/publish-result', 'ci/e2e-triage', 'ci/refresh-lane-summary'):
            condition = next(s for s in lane_steps if s.get('name') == name)['if']
            with self.subTest(step=name):
                self.assertIn('!cancelled()', condition)
                self.assertNotIn('always()', condition)

    def test_a_worker_its_time_limit_cancels_still_gets_a_lane_result(self):
        """A worker or dispatch its time limit cancels still gets a lane result; a cancelled run does not."""
        # A job past its timeout ends "cancelled" without cancelling the run. Skipping lane-result on that left the
        # lane and e2e-test/triage pending, with no marker for e2e-tests-rerun.yml (runs 42240760729, 44122660650).
        for suite in ('cypress', 'playwright', 'playwright-rolling-upgrades'):
            with self.subTest(suite=suite):
                condition = workflow(f'{suite}-template')['jobs']['lane-result']['if']
                self.assertEqual(condition, '${{ !cancelled() }}')
                self.assertNotIn('needs.workers.result', condition)
                self.assertNotIn('needs.dispatch-begin.result', condition)

    def test_lane_result_is_called_last_with_explicit_inputs_and_least_privilege(self):
        """The lane result is called last, with explicit inputs and least privilege."""
        for suite in ('cypress', 'playwright'):
            caller = workflow(f'{suite}-template')['jobs']['lane-result']
            with self.subTest(suite=suite):
                self.assertEqual(caller['uses'], f'./.github/workflows/{LANE_RESULT}.yml')
                self.assertEqual(caller['needs'], ['prepare-run', 'dispatch-begin', 'workers', 'report'])
                self.assertEqual(caller['permissions'], PERMISSIONS)
                self.assertEqual(set(caller['secrets']), {'ANTHROPIC_API_KEY', 'REPORT_WEBHOOK_URL'})
                self.assertEqual(caller['with']['execution_success'], "${{ needs.prepare-run.result == 'success' && needs.dispatch-begin.result == 'success' && needs.workers.result == 'success' }}")
                self.assertEqual(caller['with']['summary_ok'], "${{ needs.report.outputs.summary_ok == 'true' }}")
                self.assertEqual(caller['with']['description'], '${{ needs.report.outputs.commit_status_description }}')
                self.assertEqual(caller['with']['report_url'], '${{ needs.report.outputs.report_url }}')
                self.assertEqual(caller['with']['commit_sha'], '${{ inputs.commit_sha }}')
                self.assertEqual(caller['with']['context_name'], '${{ inputs.context_name }}')
                self.assertEqual(caller['with']['webhook_payload'], '${{ needs.report.outputs.webhook_payload }}')
        wf = lane_result_workflow()
        self.assertEqual(wf['jobs']['lane-result']['permissions'], PERMISSIONS, 'the called job may not ask for more than the callers grant')
        self.assertEqual(wf['permissions'], {})
        # PyYAML reads the bare `on:` key as boolean True (YAML 1.1).
        trigger = wf.get('on', wf.get(True))
        self.assertEqual(set(trigger['workflow_call']['secrets']), {'ANTHROPIC_API_KEY', 'REPORT_WEBHOOK_URL'})

    def test_lane_result_does_not_nest_further(self):
        """The lane result calls no further reusable workflow."""
        # caller -> template -> lane result is already three reusable levels deep.
        for job in lane_result_workflow()['jobs'].values():
            self.assertNotIn('uses', job, 'the lane result must not call another reusable workflow')

    def test_missing_results_are_red_and_success_also_refreshes_summary(self):
        """Missing results are red, and a success also refreshes the summary."""
        lane = lane_result_workflow()['jobs']['lane-result']
        result = step(lane, 'ci/publish-result')
        self.assertEqual(result['with']['state'], "${{ inputs.summary_ok && 'success' || 'failure' }}")
        self.assertEqual(result['with']['verify-reports'], 'true')
        self.assertEqual(result['with']['execution-success'], '${{ inputs.execution_success }}')
        # The toolkit maps use-staging to its staging URL; the workflow never hard-codes a host.
        self.assertEqual(result['with']['use-staging'], "${{ vars.E2E_USE_STAGING_TEST_IO_URL != 'false' }}")
        self.assertNotIn('tsio-base-url', result['with'])
        self.assertIn('unavailable or incomplete', result['with']['description'])
        self.assertEqual(result['with']['target-url'], '${{ inputs.report_url }}')
        triage = step(lane, 'ci/e2e-triage')
        self.assertEqual(result['with']['use-staging'], triage['with']['use-staging'])
        # Triage enforces on every red lane, also one red outside its tests: assert-results lets such a lane
        # pass only on an orchestration-based verdict (see test_result_assertion_cannot_clear_upstream_or_report_failures).
        self.assertNotIn('inputs.execution_success', triage['with']['mode'])
        self.assertNotIn('reports-complete', triage['with']['mode'])
        # A re-run that kept the first attempt's identity never enforces (see the comment on mode).
        self.assertIn('fromJSON(inputs.composite_identity_json).gh_run_attempt == github.run_attempt', triage['with']['mode'])
        self.assertTrue(triage['with']['mode'].endswith("|| 'report-only' }}"))
        self.assertIn("vars.E2E_TRIAGE_MODE || 'enforce'", triage['with']['mode'])
        self.assertIn("steps.result.outputs.state != 'success'", triage['if'])
        self.assertEqual(triage['with']['triage-lanes'], '${{ steps.lanes.outputs.triage-lanes }}')
        self.assertEqual(triage['with']['triage-status-context'], '${{ steps.lanes.outputs.triage-context }}')
        refresh = step(lane, 'ci/refresh-lane-summary')
        self.assertNotIn('summary', refresh['if'])
        self.assertEqual(refresh['with']['triage-lanes'], '${{ steps.lanes.outputs.lanes }}')
        for suite, root in (('cypress', 'e2e-tests/cypress'), ('playwright', 'e2e-tests/playwright/specs')):
            with self.subTest(suite=suite):
                self.assertEqual(workflow(f'{suite}-template')['jobs']['lane-result']['with']['test_root'], root)

    def test_result_assertion_cannot_clear_upstream_or_report_failures(self):
        """The result assertion cannot clear upstream or report failures."""
        assertion = step(lane_result_workflow()['jobs']['lane-result'], 'ci/assert-results')
        self.assertEqual(assertion['env']['EXECUTION_SUCCESS'], '${{ inputs.execution_success }}')
        self.assertEqual(assertion['env']['REPORTS_COMPLETE'], '${{ steps.result.outputs.reports-complete }}')
        self.assertEqual(assertion['env']['RAW_STATE'], '${{ steps.result.outputs.state }}')
        self.assertEqual(assertion['env']['TRIAGE_MODE'], '${{ steps.triage.outputs.effective-mode }}')
        self.assertEqual(assertion['env']['TRIAGE_OUTCOME'], '${{ steps.triage.outcome }}')
        self.assertEqual(assertion['env']['TRIAGE_PUBLISHED'], '${{ steps.triage.outputs.published }}')
        self.assertEqual(assertion['env']['TRIAGE_VERDICT'], '${{ steps.triage.outputs.verdict }}')
        self.assertEqual(assertion['env']['TRIAGE_BASIS'], '${{ steps.triage.outputs.basis }}')
        cases = [
            # Even a green orchestration result and AI verdict cannot clear upload failures.
            ('false', 'false', 'success', 'enforce', 'SUCCESS', False),
            ('false', 'true', 'success', 'enforce', 'SUCCESS', False),
            ('true', 'false', 'success', 'enforce', 'SUCCESS', False),
            ('true', '', 'success', 'enforce', 'SUCCESS', False),
            ('', 'true', 'success', 'enforce', 'SUCCESS', False),
            ('true', 'true', 'success', '', '', True),
            ('true', 'true', 'failure', 'enforce', 'SUCCESS', True),
            ('true', 'true', 'failure', 'report-only', 'SUCCESS', False),
            ('true', 'true', 'failure', '', 'SUCCESS', False),
            ('true', 'true', 'failure', 'enforce', 'FAILURE', False),
            ('true', 'true', 'failure', 'enforce', '', False),
        ]
        for execution, complete, state, mode, verdict, passes in cases:
            with self.subTest(execution=execution, complete=complete, state=state, mode=mode, verdict=verdict):
                result = subprocess.run(['bash', '-e', '-c', assertion['run']], env={
                    'EXECUTION_SUCCESS': execution, 'REPORTS_COMPLETE': complete,
                    'RAW_STATE': state, 'TRIAGE_MODE': mode, 'TRIAGE_VERDICT': verdict,
                    'TRIAGE_OUTCOME': 'success', 'TRIAGE_PUBLISHED': 'true',
                }, capture_output=True)
                self.assertEqual(result.returncode == 0, passes, result.stderr)
        # A lane red outside its tests passes only when triage's green rests on TSIO's orchestration: every
        # dispatched spec ran and passed there. A verdict from the tests or the lane's jobs never clears it.
        outside = [
            ('false', 'true', 'orchestration', 'enforce', 'SUCCESS', True),
            ('true', 'false', 'orchestration', 'enforce', 'SUCCESS', True),
            ('false', 'false', 'orchestration', 'enforce', 'SUCCESS', True),
            ('false', 'true', 'orchestration', 'report-only', 'SUCCESS', False),
            ('false', 'true', 'orchestration', 'enforce', 'FAILURE', False),
            ('false', 'true', 'tests', 'enforce', 'SUCCESS', False),
            ('false', 'true', 'lane', 'enforce', 'SUCCESS', False),
            ('false', 'true', '', 'enforce', 'SUCCESS', False),
        ]
        for execution, complete, basis, mode, verdict, passes in outside:
            with self.subTest(execution=execution, complete=complete, basis=basis, mode=mode, verdict=verdict):
                result = subprocess.run(['bash', '-e', '-c', assertion['run']], env={
                    'EXECUTION_SUCCESS': execution, 'REPORTS_COMPLETE': complete, 'RAW_STATE': 'failure',
                    'TRIAGE_MODE': mode, 'TRIAGE_VERDICT': verdict, 'TRIAGE_BASIS': basis,
                    'TRIAGE_OUTCOME': 'success', 'TRIAGE_PUBLISHED': 'true',
                }, capture_output=True)
                self.assertEqual(result.returncode == 0, passes, result.stderr)
        for outcome, published in [('failure', 'true'), ('success', 'false'), ('success', ''), ('', 'true')]:
            with self.subTest(outcome=outcome, published=published):
                result = subprocess.run(['bash', '-e', '-c', assertion['run']], env={
                    'EXECUTION_SUCCESS': 'true', 'REPORTS_COMPLETE': 'true', 'RAW_STATE': 'failure',
                    'TRIAGE_MODE': 'enforce', 'TRIAGE_VERDICT': 'SUCCESS',
                    'TRIAGE_OUTCOME': outcome, 'TRIAGE_PUBLISHED': published,
                }, capture_output=True)
                self.assertNotEqual(result.returncode, 0)

    def test_webhook_posts_after_the_status_and_triage_as_before(self):
        """The webhook posts after the status and triage, as before."""
        names = [s.get('name') for s in lane_result_workflow()['jobs']['lane-result']['steps']]
        order = ['ci/publish-result', 'ci/e2e-triage', 'ci/refresh-lane-summary', 'ci/publish-webhook', 'ci/assert-results']
        self.assertEqual([n for n in names if n in order], order)

    def test_report_job_only_summarises(self):
        """The report job only summarises."""
        for suite in ('cypress', 'playwright'):
            report = workflow(f'{suite}-template')['jobs']['report']
            with self.subTest(suite=suite):
                self.assertEqual(report['outputs'].keys(), {'commit_status_description', 'webhook_payload', 'report_url', 'summary_ok'})
                self.assertEqual(report['outputs']['summary_ok'], "${{ steps.summary.outcome == 'success' }}")
                names = [s.get('name') for s in report['steps']]
                self.assertEqual(names, ['ci/checkout-repo', 'ci/run-summary'])
                self.assertEqual(step(report, 'ci/run-summary')['if'], 'always()')
                self.assertNotIn('statuses', report['permissions'], 'the summary runs with update-commit-status: false')
                self.assertEqual(step(report, 'ci/run-summary')['with']['update-commit-status'], 'false')

    def test_upgrade_lanes_publish_through_the_lane_result(self):
        """The upgrade lanes publish, triage and gate through the lane result, as the other lanes do.

        Its status is verified against the reports that arrived, so a re-run whose workers found no work
        cannot publish success with a report missing. The report job only summarises.
        """
        jobs = workflow('playwright-rolling-upgrades-template')['jobs']
        # The run claims its status first, under the publication lock, so the lane result can publish over it.
        self.assertEqual(jobs['prepare-run']['concurrency'], LOCK)
        claim = step(jobs['prepare-run'], 'ci/claim-status')
        self.assertEqual(claim['with']['operation'], 'claim')
        self.assertEqual(step(jobs['prepare-run'], 'ci/status-lanes')['uses'], TRUSTED_READER)
        self.assertEqual(step(jobs['dispatch-begin'], 'ci/dispatch-begin')['with']['post-pending-commit-status'], 'false')
        report = jobs['report']
        self.assertEqual(report['outputs'].keys(), {'commit_status_description', 'webhook_payload', 'report_url', 'summary_ok'})
        self.assertEqual([s.get('name') for s in report['steps']], ['ci/checkout-repo', 'ci/run-summary'])
        self.assertNotIn('statuses', report['permissions'], 'the summary runs with update-commit-status: false')
        self.assertEqual(step(report, 'ci/run-summary')['with']['update-commit-status'], 'false')
        caller = jobs['lane-result']
        self.assertEqual(caller['uses'], f'./.github/workflows/{LANE_RESULT}.yml')
        self.assertEqual(caller['needs'], ['prepare-run', 'dispatch-begin', 'workers', 'report'])
        self.assertEqual(caller['permissions'], PERMISSIONS)
        self.assertEqual(caller['if'], '${{ !cancelled() }}')
        # No model key: upgrade lanes are triaged by rules only, as before.
        self.assertEqual(set(caller['secrets']), {'REPORT_WEBHOOK_URL'})
        self.assertEqual(caller['with']['execution_success'], "${{ needs.prepare-run.result == 'success' && needs.dispatch-begin.result == 'success' && needs.workers.result == 'success' }}")
        self.assertEqual(caller['with']['summary_ok'], "${{ needs.report.outputs.summary_ok == 'true' }}")
        self.assertEqual(caller['with']['test_root'], 'e2e-tests/playwright/specs')
        self.assertNotIn('history_lane', caller['with'], "the lane's own history is master's upgrade lane")

    def test_lane_result_holds_the_lock_for_a_bounded_time(self):
        """The lane result holds the lock for a bounded time."""
        self.assertEqual(lane_result_workflow()['jobs']['lane-result']['timeout-minutes'], 45)

    def test_a_slow_worker_fails_before_its_job_is_cancelled(self):
        """A slow worker fails before its job is cancelled."""
        # A step timeout fails the worker with its log and debug artifacts; a job timeout cancels it with neither.
        for name in ('cypress-template', 'playwright-template'):
            with self.subTest(workflow=name):
                workers = workflow(name)['jobs']['workers']
                self.assertLess(step(workers, 'ci/dispatch-run')['timeout-minutes'], workers['timeout-minutes'] - 5)


class TestcontainersWorkers(unittest.TestCase):
    """Testcontainers settings that keep a worker's server alive across its separate Playwright processes."""
    def test_ryuk_is_disabled_wherever_workers_reuse_the_stack(self):
        """Ryuk would reap a server the next process needs; the upgrade swap's server is not even withReuse()."""
        for name in ('playwright-template', 'playwright-rolling-upgrades-template'):
            with self.subTest(workflow=name):
                env = workflow(name)['jobs']['workers']['env']
                self.assertEqual(env['PW_TESTCONTAINERS_REUSE'], 'true')
                self.assertEqual(env['TESTCONTAINERS_RYUK_DISABLED'], 'true')


def fake_bin(tmp, **scripts):
    """A PATH directory holding the given fake commands, for running a step's script offline."""
    bin_dir = pathlib.Path(tmp) / 'bin'
    bin_dir.mkdir()
    for name, body in scripts.items():
        path = bin_dir / name
        path.write_text('#!/usr/bin/env bash\n' + body)
        path.chmod(0o755)
    return f"{bin_dir}{os.pathsep}{os.environ['PATH']}"


class InfrastructureRetries(unittest.TestCase):
    """Waits and retries around infrastructure steps only: they never re-run tests or change what a lane's result is."""

    def test_publication_is_retried_once_with_the_same_inputs(self):
        """A failed publication is retried once, with the same inputs, and the retry decides the job."""
        lane = lane_result_workflow()['jobs']['lane-result']
        first, retry = step(lane, 'ci/publish-result'), step(lane, 'ci/publish-result-retry')
        self.assertEqual(first['id'], 'publish')
        self.assertTrue(first['continue-on-error'])
        self.assertNotIn('continue-on-error', retry)
        self.assertEqual(first['uses'], retry['uses'])
        self.assertEqual(first['with'], retry['with'])
        for name in ('ci/wait-for-github-api', 'ci/publish-result-retry'):
            with self.subTest(step=name):
                self.assertEqual(step(lane, name)['if'], "${{ !cancelled() && steps.publish.outcome == 'failure' }}")
        names = [s.get('name') for s in lane['steps']]
        order = ['ci/publish-result', 'ci/wait-for-github-api', 'ci/publish-result-retry', 'ci/publish-result-outputs', 'ci/e2e-triage']
        self.assertEqual([n for n in names if n in order], order)

    def test_downstream_steps_read_the_attempt_that_ran_last(self):
        """Triage and the assertion read the outputs of whichever attempt ran last, under the id they always used."""
        merged = step(lane_result_workflow()['jobs']['lane-result'], 'ci/publish-result-outputs')
        self.assertEqual(merged['id'], 'result')
        self.assertEqual(merged['if'], '${{ !cancelled() }}')
        for key, output in (('STATE', 'state'), ('REPORTS_COMPLETE', 'reports-complete'), ('PUBLISHED', 'published')):
            self.assertEqual(merged['env'][key], f'${{{{ steps.publish.outputs.{output} || steps.publish-retry.outputs.{output} }}}}')
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp) / 'out'
            output.touch()
            subprocess.run(['bash', '-e', '-c', merged['run']], check=True, env={
                'STATE': 'failure', 'REPORTS_COMPLETE': 'false', 'PUBLISHED': 'true', 'GITHUB_OUTPUT': str(output)})
            self.assertEqual(output.read_text(), 'state=failure\nreports-complete=false\npublished=true\n')

    def test_summary_refresh_is_skipped_only_when_publication_already_did_it(self):
        """The refresh is skipped only for a green lane that published: its publication refreshed and triage did not run."""
        lane = lane_result_workflow()['jobs']['lane-result']
        self.assertEqual(step(lane, 'ci/refresh-lane-summary')['if'],
                         "${{ !cancelled() && !(steps.result.outputs.state == 'success' && steps.result.outputs.published == 'true') }}")
        self.assertIn("steps.result.outputs.state != 'success'", step(lane, 'ci/e2e-triage')['if'])

    def run_api_wait(self, rate_limit, now=1_000_000):
        """Runs ci/wait-for-github-api with a fake gh answering rate_limit (None: the call fails); returns its sleep."""
        wait = step(lane_result_workflow()['jobs']['lane-result'], 'ci/wait-for-github-api')
        gh = f'echo "{rate_limit}"' if rate_limit is not None else 'exit 1'
        with tempfile.TemporaryDirectory() as tmp:
            path = fake_bin(tmp, gh=gh, sleep='echo "slept $1"', date=f'[ "$1" = +%s ] && echo {now} || /bin/date "$@"')
            result = subprocess.run(['bash', '-e', '-c', wait['run']], capture_output=True, text=True, env={
                'PATH': path, 'MAX_WAIT_SECONDS': wait['env']['MAX_WAIT_SECONDS'], 'BACKOFF_SECONDS': wait['env']['BACKOFF_SECONDS']})
        self.assertEqual(result.returncode, 0, result.stderr)
        return int(re.search(r'slept (\d+)', result.stdout).group(1))

    def test_api_wait_honours_the_quota_reset_within_its_budget(self):
        """The wait lasts until the quota resets when that is within budget, else it is the short backoff."""
        self.assertEqual(self.run_api_wait('0 1000300'), 305)
        self.assertEqual(self.run_api_wait('0 1000010'), 60)
        self.assertEqual(self.run_api_wait('0 1003000'), 60)
        self.assertEqual(self.run_api_wait('4000 1000300'), 60)
        self.assertEqual(self.run_api_wait(None), 60)

class ServerImageCheck(unittest.TestCase):
    """The server image gate: its own workflow, run once per edition before that edition's lanes, never in E2E itself."""
    GATE = WORKFLOWS / 'server-image-check.yml'
    GATE_USES = './.github/workflows/server-image-check.yml'
    LANE_USES = ('./.github/workflows/e2e-tests-cypress.yml', './.github/workflows/e2e-tests-playwright.yml')
    E2E = ('cypress', 'playwright', 'playwright-rolling-upgrades', 'cypress-template', 'playwright-template',
           'playwright-rolling-upgrades-template', 'lane-result')
    CALLERS = (('ci', 'mattermostdevelopment', '${{ needs.resolve-pr.outputs.SERVER_IMAGE_TAG }}', 'PR'),
               ('on-merge', 'mattermostdevelopment', '${{ inputs.server_image_tag }}',
                '${{ needs.generate-build-variables.outputs.report_type }}'),
               ('on-release', 'mattermost', '${{ inputs.server_image_tag }}', 'RELEASE_CUT'))
    # Callers whose gate alerts the report channel on failure, with the branch each passes.
    ALERTING_CALLERS = {'on-merge': '${{ needs.generate-build-variables.outputs.ref_branch }}',
                        'on-release': '${{ needs.validate.outputs.ref_branch }}'}
    WEBHOOK = '${{ secrets.MM_E2E_REPORT_WEBHOOK_URL }}'

    def gate_job(self):
        """The gate's only job."""
        gate = yaml.safe_load(self.GATE.read_text())
        self.assertEqual(list(gate[True]), ['workflow_call'])
        self.assertEqual(list(gate['jobs']), ['check'])
        return gate['jobs']['check']

    def test_gate_is_its_own_self_contained_workflow_with_pinned_limits(self):
        """It polls for 5 minutes, its job is cut off at 10, and nothing can lengthen either or let it fail softly."""
        job = self.gate_job()
        self.assertEqual(job['timeout-minutes'], 10)
        self.assertEqual(job['permissions'], {'statuses': 'write'})
        self.assertEqual([s['name'] for s in job['steps']], ['ci/check-server-image', 'ci/notify-server-image-unavailable'])
        check = job['steps'][0]
        self.assertNotIn('continue-on-error', check)
        self.assertNotIn('timeout-minutes', check)
        self.assertNotIn('uses', check)
        self.assertEqual((check['env']['POLL_MINUTES'], check['env']['INTERVAL_SECONDS']), ('5', '30'))
        inputs = yaml.safe_load(self.GATE.read_text())[True]['workflow_call']['inputs']
        self.assertEqual(sorted(inputs), ['commit_sha', 'ref_branch', 'report_type', 'server_edition', 'server_image_repo',
                                          'server_image_tag', 'should_run'])
        self.assertEqual(inputs['should_run']['default'], 'true')

    def test_skip_only_pr_passes_without_probing(self):
        """should_run 'false' skips the only step, so the job passes without a request or a status; only the PR
        caller sets it, and only when no enterprise lane will boot a server."""
        self.assertEqual(self.gate_job()['steps'][0]['if'], "inputs.should_run != 'false'")
        outputs = 'needs.check-changes.outputs'
        gate = workflow('ci')['jobs']['server-image-enterprise']
        self.assertEqual(gate['needs'], ['resolve-pr', 'check-changes'])
        self.assertEqual(gate['with']['should_run'],
                         f"${{{{ ({outputs}.should_run != 'false' || {outputs}.should_run_rolling_upgrades == 'true' || "
                         f"{outputs}.should_run_subpath == 'true') && 'true' || 'false' }}}}")
        playwright = workflow('playwright')['jobs']
        self.assertEqual(playwright['playwright-full']['if'], "inputs.should_run != 'false'")
        self.assertEqual(playwright['playwright-rolling-upgrades']['if'], "inputs.run_rolling_upgrades == 'true'")
        self.assertEqual(workflow('cypress')['jobs']['cypress-full']['if'], "inputs.should_run != 'false'")
        lanes = workflow('ci')['jobs']
        self.assertIn(f"{outputs}.should_run_subpath == 'true'", lanes['e2e-playwright-subpath']['if'])
        self.assertEqual(lanes['e2e-playwright']['with']['run_rolling_upgrades'], f'${{{{ {outputs}.should_run_rolling_upgrades }}}}')
        for caller in ('ci', 'on-merge', 'on-release'):
            self.assertNotIn('should_run', workflow(caller)['jobs']['server-image-fips']['with'])
        for caller in ('on-merge', 'on-release'):
            self.assertNotIn('should_run', workflow(caller)['jobs']['server-image-enterprise']['with'])

    def test_every_lane_needs_its_editions_gate(self):
        """Each caller checks every edition it tests, with the lane's own image inputs, and each lane needs that check."""
        for caller, repo, tag, report_type in self.CALLERS:
            with self.subTest(caller=caller):
                jobs = workflow(caller)['jobs']
                gates = {name: job for name, job in jobs.items() if job.get('uses') == self.GATE_USES}
                self.assertEqual(sorted(gates), ['server-image-enterprise', 'server-image-fips'])
                for edition in ('enterprise', 'fips'):
                    gate = gates[f'server-image-{edition}']
                    self.assertEqual(gate['permissions'], {'statuses': 'write'})
                    expected = {'commit_sha': '${{ inputs.commit_sha }}', 'server_edition': edition,
                                'server_image_tag': tag, 'report_type': report_type}
                    if caller == 'ci':
                        expected['commit_sha'] = '${{ needs.resolve-pr.outputs.COMMIT_SHA }}'
                    if repo != 'mattermostdevelopment':
                        expected['server_image_repo'] = repo
                    if caller in self.ALERTING_CALLERS:
                        expected['ref_branch'] = self.ALERTING_CALLERS[caller]
                    self.assertEqual({k: v for k, v in gate['with'].items() if k != 'should_run'}, expected)
                lanes = {name: job for name, job in jobs.items() if job.get('uses') in self.LANE_USES}
                self.assertEqual(len(lanes), 5)
                for name, lane in lanes.items():
                    edition = lane['with'].get('server_edition', 'enterprise')
                    gate = gates[f'server-image-{edition}']
                    self.assertIn(f'server-image-{edition}', lane['needs'], name)
                    self.assertEqual(lane['with']['server_image_tag'], tag, name)
                    self.assertEqual(lane['with'].get('server_image_repo', 'mattermostdevelopment'), repo, name)
                    if edition == 'fips':
                        self.assertEqual(lane['if'], gate['if'], name)

    def test_e2e_workflows_do_not_check_the_image(self):
        """The lane wrappers, templates and lane result neither wait for nor call the image check."""
        for name in self.E2E:
            with self.subTest(workflow=name):
                text = (WORKFLOWS / f'e2e-tests-{name}.yml').read_text()
                for marker in ('server-image-check', 'wait-for-server-image', '/manifests/'):
                    self.assertNotIn(marker, text)
        self.assertFalse((WORKFLOWS / 'wait-for-server-image.yml').exists())
        self.assertFalse((GITHUB / 'actions' / 'wait-for-server-image').exists())

    def run_check(self, *codes, edition='fips', repo='mattermostdevelopment', tag='abc1234_def5678',
                  report_type='PR', gh='exit 0', commit='a' * 40):
        """Runs the gate's step against a fake registry (one answer per poll) and a fake gh, on a clock that
        reaches the 5-minute deadline at the last poll. Returns the process, its summary, the manifest URLs
        it asked for and the gh calls it made."""
        check = self.gate_job()['steps'][0]
        with tempfile.TemporaryDirectory() as tmp:
            state = pathlib.Path(tmp)
            (state / 'codes').write_text('\n'.join(codes) + '\n')
            minutes = int(check['env']['POLL_MINUTES'])
            clock = [0] + [30 * i for i in range(1, len(codes))] + [minutes * 60]
            (state / 'clock').write_text('\n'.join(map(str, clock)) + '\n')
            pop = lambda name: f'v=$(head -n1 {state / name}); sed -i 1d {state / name}; '
            curl = ('case "$*" in *token\\?*) echo \'{"token":"t"}\';; '
                    f'*) echo "${{@: -1}}" >> {state / "urls"}; {pop("codes")}'
                    '[ "$v" = 000 ] && { printf 000; exit 7; }; printf "$v";; esac')
            gh_script = f'printf "%s\\n" "$@" >> {state / "gh"}; echo --- >> {state / "gh"}; {gh}'
            env = {k: v for k, v in check['env'].items() if '${{' not in v}
            env.update({'PATH': fake_bin(tmp, curl=curl, gh=gh_script, sleep=':', date=f'{pop("clock")}echo "$v"'),
                        'COMMIT_SHA': commit, 'SERVER_EDITION': edition, 'SERVER_IMAGE_REPO': repo,
                        'SERVER_IMAGE_TAG': tag, 'REPORT_TYPE': report_type, 'GH_TOKEN': 't',
                        'REPOSITORY': 'mattermost/mattermost', 'RUN_URL': 'https://example.test/run',
                        'GITHUB_STEP_SUMMARY': str(state / 'summary'), 'GITHUB_OUTPUT': str(state / 'output')})
            result = subprocess.run(['bash', '-c', check['run']], capture_output=True, text=True, env=env)
            read = lambda name: (state / name).read_text() if (state / name).exists() else ''
            self.outputs = dict(line.split('=', 1) for line in read('output').splitlines())
            calls = [c.strip().split('\n') for c in read('gh').split('---') if c.strip()]
            return result, read('summary'), read('urls').split(), calls

    @staticmethod
    def posted(call):
        """The fields of one gh status POST."""
        return dict(arg.split('=', 1) for arg in call if '=' in arg)

    def test_gate_checks_exactly_the_image_each_lane_pulls(self):
        """The image name comes from the same edition/namespace/tag mapping as the lane's own build step."""
        for edition in ('enterprise', 'fips', 'team'):
            for repo in ('mattermostdevelopment', 'mattermost'):
                with self.subTest(edition=edition, repo=repo):
                    result, _, urls, _ = self.run_check('200', edition=edition, repo=repo, tag='abc1234')
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    for suite in ('cypress', 'playwright'):
                        image = build_outputs(suite, edition, '', 'PR', repo=repo, tag='abc1234')['server_image']
                        name, tag = image.split(':')
                        self.assertEqual(urls, [f'https://registry-1.docker.io/v2/{name}/manifests/{tag}'])

    def test_published_image_passes_and_says_so_on_its_own_status(self):
        """A published image passes at once and publishes server-image/<edition>, suffixed as the lanes are."""
        for report_type, suffix in (('PR', ''), ('MASTER', '/master'), ('RELEASE', '/release'), ('RELEASE_CUT', '/release-cut')):
            with self.subTest(report_type=report_type):
                result, _, urls, calls = self.run_check('404', '200', report_type=report_type)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(len(urls), 2)
                self.assertEqual(len(calls), 1)
                self.assertIn(f'repos/mattermost/mattermost/statuses/{"a" * 40}', calls[0])
                self.assertEqual(self.posted(calls[0]), {
                    'state': 'success', 'context': f'server-image/fips{suffix}', 'target_url': 'https://example.test/run',
                    'description': 'mattermostdevelopment/mattermost-enterprise-fips-edition:abc1234_def5678 is published'})

    def test_missing_image_fails_loudly_after_five_minutes(self):
        """Still missing at the deadline: the job fails, naming the image, the wait and where the fix belongs."""
        result, summary, urls, calls = self.run_check('404', '404', '404')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(urls), 3)
        image = 'mattermostdevelopment/mattermost-enterprise-fips-edition:abc1234_def5678'
        error = next(line for line in result.stdout.splitlines() if line.startswith('::error title=Server image not available::'))
        for text in (image, 'still missing after 5m 0s', '3 checks', 'limit 5 min', 'No E2E lane for this edition started',
                     'The pipeline that builds and pushes this image', 'E2E will not wait longer'):
            self.assertIn(text, error)
            self.assertIn(text, summary)
        status = self.posted(calls[0])
        self.assertEqual((status['state'], status['context']), ('failure', 'server-image/fips'))
        self.assertIn(image, status['description'])
        self.assertLessEqual(len(status['description']), 140)

    def test_registry_outage_is_not_a_missing_image(self):
        """An unreachable or erroring registry at the deadline warns and passes; the last answer decides."""
        for codes in (('000',), ('500',), ('429',), ('401',), ('404', '500'), ('404', '000')):
            with self.subTest(codes=codes):
                result, _, _, calls = self.run_check(*codes)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('::warning title=Server image not verified::', result.stdout)
                self.assertEqual(self.posted(calls[0])['state'], 'success')
                self.assertIn('not verified', self.posted(calls[0])['description'])
        self.assertEqual(self.run_check('500', '404')[0].returncode, 1)

    def test_status_publication_never_decides_the_gate(self):
        """A failed or stalled status write warns; the image alone decides whether the lanes start."""
        self.assertIn('timeout --kill-after=10s 30s gh api', self.gate_job()['steps'][0]['run'])
        published = self.run_check('200', gh='exit 1')[0]
        self.assertEqual(published.returncode, 0, published.stdout + published.stderr)
        self.assertIn('::warning::Could not publish the server-image/fips status', published.stdout)
        self.assertEqual(self.run_check('404', gh='exit 1')[0].returncode, 1)

    def test_invalid_inputs_fail_before_any_request(self):
        """An unknown edition or a malformed namespace, tag or commit fails without polling or publishing."""
        for kwargs in ({'edition': 'other'}, {'repo': 'Bad/Repo'}, {'tag': 'a tag'}, {'commit': 'main'}):
            with self.subTest(**kwargs):
                result, _, urls, calls = self.run_check('200', **kwargs)
                self.assertEqual(result.returncode, 1)
                self.assertEqual((urls, calls), ([], []))

    def test_failure_alert_is_best_effort_and_never_on_prs(self):
        """A failed check alerts the report channel only outside PRs, never on a pass, skip or cancel, and the
        alert can neither fail the gate nor outlast its job limit."""
        notify = self.gate_job()['steps'][1]
        self.assertEqual(notify['if'], "failure() && inputs.report_type != 'PR' && env.REPORT_WEBHOOK_URL != ''")
        self.assertIs(notify['continue-on-error'], True)
        self.assertEqual(notify['timeout-minutes'], 1)
        self.assertIn('--max-time 20', notify['run'])
        self.assertEqual(notify['env']['REPORT_WEBHOOK_URL'], '${{ secrets.REPORT_WEBHOOK_URL }}')
        self.assertNotIn('${{', notify['run'])
        secrets = yaml.safe_load(self.GATE.read_text())[True]['workflow_call']['secrets']
        self.assertEqual(secrets['REPORT_WEBHOOK_URL']['required'], False)

    def test_only_trunk_and_release_gates_get_the_webhook(self):
        """Merge and release-cut gates get the same webhook secret as their lanes; the PR gates get none."""
        for caller, ref_branch in self.ALERTING_CALLERS.items():
            jobs = workflow(caller)['jobs']
            lane_secrets = {job['secrets']['REPORT_WEBHOOK_URL'] for job in jobs.values()
                            if job.get('uses') in self.LANE_USES}
            self.assertEqual(lane_secrets, {self.WEBHOOK}, caller)
            for edition in ('enterprise', 'fips'):
                gate = jobs[f'server-image-{edition}']
                self.assertEqual(gate['secrets'], {'REPORT_WEBHOOK_URL': self.WEBHOOK}, (caller, edition))
                self.assertEqual(gate['with']['ref_branch'], ref_branch, (caller, edition))
                self.assertNotEqual(gate['with']['report_type'], 'PR', (caller, edition))
        for edition in ('enterprise', 'fips'):
            gate = workflow('ci')['jobs'][f'server-image-{edition}']
            self.assertNotIn('secrets', gate)
            self.assertEqual(gate['with']['report_type'], 'PR')

    def test_failed_check_hands_the_alert_its_image_and_wait(self):
        """The check step's outputs name the image and status context, and say how long it waited when missing."""
        self.run_check('404', '404', report_type='MASTER')
        self.assertEqual(self.outputs, {
            'image': 'mattermostdevelopment/mattermost-enterprise-fips-edition:abc1234_def5678',
            'context': 'server-image/fips/master', 'detail': 'Still missing after 5m 0s (2 checks, limit 5 min).'})
        self.run_check('200', report_type='RELEASE_CUT', repo='mattermost', edition='enterprise')
        self.assertEqual(self.outputs, {'image': 'mattermost/mattermost-enterprise-edition:abc1234_def5678',
                                        'context': 'server-image/enterprise/release-cut'})

    def run_notify(self, curl='exit 0', **env):
        """Runs the alert step with a fake curl. Returns the process and the webhook payload it posted."""
        notify = self.gate_job()['steps'][1]
        with tempfile.TemporaryDirectory() as tmp:
            calls = pathlib.Path(tmp) / 'curl'
            values = {'REPORT_WEBHOOK_URL': 'https://hooks.example.test/x', 'COMMIT_SHA': 'a' * 40,
                      'SERVER_EDITION': 'fips', 'SERVER_IMAGE_REPO': 'mattermostdevelopment',
                      'SERVER_IMAGE_TAG': 'abc1234_def5678', 'REPORT_TYPE': 'MASTER', 'REF_BRANCH': 'master',
                      'IMAGE': 'mattermostdevelopment/mattermost-enterprise-fips-edition:abc1234_def5678',
                      'CONTEXT': 'server-image/fips/master', 'DETAIL': 'Still missing after 5m 0s (11 checks, limit 5 min).',
                      'REPOSITORY': 'mattermost/mattermost', 'RUN_URL': 'https://example.test/run'}
            values.update(env)
            values['PATH'] = fake_bin(tmp, curl=f'printf "%s\\n" "$@" > {calls}; {curl}')
            result = subprocess.run(['bash', '-c', notify['run']], capture_output=True, text=True, env=values)
            args = calls.read_text().split('\n') if calls.exists() else []
            payload = json.loads(args[args.index('-d') + 1]) if '-d' in args else None
            if payload is not None:
                self.assertEqual(args[-2], 'https://hooks.example.test/x')
            return result, payload

    def test_alert_says_what_is_missing_where_and_who_fixes_it(self):
        """The alert uses the lane result's webhook layout and names the image, edition, commit, run and the fix."""
        result, payload = self.run_notify()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((payload['username'], payload['attachments'][0]['color']), ('E2E Test', '#F44336'))
        text = payload['attachments'][0]['text']
        self.assertTrue(text.startswith('**Server image not available - server-image/fips/master**\n\n:git_merge: '), text)
        for part in (f'[aaaaaaa](https://github.com/mattermost/mattermost/commit/{"a" * 40}) on `master`',
                     ':docker: `mattermostdevelopment/mattermost-enterprise-fips-edition:abc1234_def5678`',
                     'Edition `fips`: no E2E lane for it started.', 'Still missing after 5m 0s',
                     'Fix the pipeline that builds and pushes this image', 'E2E does not wait for it',
                     '[run](https://example.test/run)'):
            self.assertIn(part, text)
        cut = self.run_notify(REPORT_TYPE='RELEASE_CUT', REF_BRANCH='release-11.4')[1]['attachments'][0]['text']
        self.assertIn(':github_round: [aaaaaaa]', cut)
        self.assertIn('on `release-11.4`', cut)
        early = self.run_notify(IMAGE='', CONTEXT='', DETAIL='')[1]['attachments'][0]['text']
        self.assertIn('**Server image not available - server-image/fips**', early)
        self.assertIn('The image check failed before it could confirm the image.', early)
        self.assertNotEqual(self.run_notify(curl='exit 22')[0].returncode, 0)


def build_outputs(suite, edition, deploy, report_type, repo='mattermostdevelopment', tag='abc1234'):
    """Runs the lane's own build step and returns its outputs (context, server image, ...)."""
    run = next(s['run'] for s in workflow(suite)['jobs']['generate-build-variables']['steps'] if s.get('id') == 'build-vars')
    if '${{' in run:
        raise RuntimeError(f'{suite} build step must not depend on expressions')
    with tempfile.TemporaryDirectory() as tmp:
        output = pathlib.Path(tmp) / 'github-output'
        output.touch()
        env = {'PATH': os.environ['PATH'], 'GITHUB_OUTPUT': str(output), 'COMMIT_SHA': 'a' * 40, 'RUN_ID': '1',
               'RUN_ATTEMPT': '1', 'PR_NUMBER': '1', 'INPUT_REF_BRANCH': '', 'INPUT_SERVER_IMAGE_ALIASES': '',
               'INPUT_SERVER_IMAGE_REPO': repo, 'INPUT_SERVER_IMAGE_TAG': tag,
               'INPUT_REPORT_TYPE': report_type, 'INPUT_SERVER_EDITION': edition, 'INPUT_SERVER_DEPLOY': deploy}
        result = subprocess.run(['bash', '-e', '-c', run], env=env, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return dict(line.split('=', 1) for line in output.read_text().splitlines() if '=' in line)


def build_context(suite, edition, deploy, report_type):
    """The context the lane's own build step would publish."""
    return build_outputs(suite, edition, deploy, report_type)['context_name']


class PrLaneContexts(unittest.TestCase):
    """The PR lanes are the contexts the PR callers in e2e-tests-ci.yml build. They are derived here from those
    callers' inputs and each suite's own build step, then compared with the list. Nothing is copied from the list."""
    @staticmethod
    def pr_callers():
        """The PR E2E callers in e2e-tests-ci.yml, as (job, suite, edition, deploy, report type)."""
        callers = []
        for name, job in workflow('ci')['jobs'].items():
            uses = str(job.get('uses', ''))
            if uses not in ('./.github/workflows/e2e-tests-cypress.yml', './.github/workflows/e2e-tests-playwright.yml'):
                continue
            with_ = job.get('with', {})
            if with_.get('report_type') != 'PR':
                continue
            suite = 'cypress' if 'cypress' in uses else 'playwright'
            callers.append((name, suite, with_.get('server_edition', ''), with_.get('server_deploy', ''), with_['report_type']))
        return callers

    def test_pr_callers_cover_the_expected_lanes(self):
        """PR callers cover the expected lanes."""
        # Guards the derivation itself: enterprise and fips for both suites, plus the playwright subpath run.
        derived = sorted((suite, edition or 'enterprise', deploy) for _, suite, edition, deploy, _ in self.pr_callers())
        self.assertEqual(derived, [('cypress', 'enterprise', ''), ('cypress', 'fips', ''),
                                   ('playwright', 'enterprise', ''), ('playwright', 'enterprise', 'subpath'),
                                   ('playwright', 'fips', '')])

    def test_pr_lanes_are_exactly_the_listed_lanes(self):
        """PR lanes are exactly the listed lanes."""
        config = json.loads((GITHUB / 'e2e-status-lanes.json').read_text())
        expected = sorted({build_context(suite, edition, deploy, report) for _, suite, edition, deploy, report in self.pr_callers()})
        self.assertEqual(sorted(config['lanes']), expected)
        self.assertEqual(len(config['lanes']), len(set(config['lanes'])), 'a lane may be listed once')

    def test_the_aggregate_is_the_triage_context(self):
        """The aggregate is the triage context."""
        self.assertEqual(json.loads((GITHUB / 'e2e-status-lanes.json').read_text())['aggregate_context'], 'e2e-test/triage')

    def test_each_lane_publishes_the_context_it_is_listed_under(self):
        """Each lane publishes the context it is listed under."""
        for suite, job_name, skip_name in (('cypress', 'cypress-full', 'skip'), ('playwright', 'playwright-full', 'skip')):
            wf = workflow(suite)
            with self.subTest(suite=suite):
                self.assertEqual(wf['jobs'][job_name]['with']['context_name'], '${{ needs.generate-build-variables.outputs.context_name }}')
                self.assertEqual(step(wf['jobs'][skip_name], 'ci/post-skip-status')['with']['status-context'],
                                 '${{ needs.generate-build-variables.outputs.context_name }}')


class LaneListSingleSource(unittest.TestCase):
    """The PR lanes that feed the triage aggregate are listed once, in .github/e2e-status-lanes.json."""
    def test_aggregate_is_not_one_of_its_own_lanes(self):
        """The aggregate is not one of its own lanes."""
        config = json.loads((GITHUB / 'e2e-status-lanes.json').read_text())
        self.assertTrue(config['lanes'])
        self.assertNotIn(config['aggregate_context'], config['lanes'])

    def test_triage_inputs_are_read_from_the_lane_reader(self):
        """Triage inputs are read from the lane reader."""
        for path in sorted(WORKFLOWS.glob('e2e-tests-*.yml')):
            for name, job in yaml.safe_load(path.read_text())['jobs'].items():
                for s in job.get('steps', []):
                    for key in ('triage-lanes', 'triage-status-context'):
                        value = (s.get('with') or {}).get(key)
                        if value is None:
                            continue
                        with self.subTest(file=path.name, job=name, step=s.get('name'), key=key):
                            self.assertTrue(str(value).startswith('${{ steps.lanes.outputs.'), value)

    def test_trusted_reader_follows_the_workflow_sha_checkout(self):
        """The trusted reader follows the workflow SHA checkout."""
        # Every reader takes the list from this workflow's own ref (github.sha): the tree the caller's YAML
        # runs from. Never from the tested commit or the PR head, which a PR or a dispatch can choose.
        for path in sorted(WORKFLOWS.glob('e2e-tests-*.yml')):
            for name, job in yaml.safe_load(path.read_text())['jobs'].items():
                steps = job.get('steps', [])
                for i, s in enumerate(steps):
                    if 'e2e-status-lanes' not in str(s.get('uses', '')):
                        continue
                    with self.subTest(file=path.name, job=name):
                        self.assertEqual(s['uses'], TRUSTED_READER)
                        checkout = steps[i - 1]
                        self.assertTrue(str(checkout.get('uses', '')).startswith('actions/checkout@'), checkout)
                        self.assertEqual(checkout['with'], {
                            'persist-credentials': False, 'ref': '${{ github.sha }}',
                            'sparse-checkout': '.github', 'path': '.e2e-trusted', 'fetch-depth': 1,
                        })
                        self.assertNotIn(checkout['with']['ref'], READER_FORBIDDEN_REFS)

    def test_no_lane_reader_takes_the_list_from_a_commit_or_pr_head(self):
        """No lane reader takes the list from a commit or PR head."""
        # Only the trusted copy is a reader. No reader step may follow a checkout of the tested commit or the PR head.
        for path in sorted(WORKFLOWS.glob('e2e-tests-*.yml')):
            raw = path.read_text()
            with self.subTest(file=path.name):
                self.assertNotIn('uses: ./.github/actions/e2e-status-lanes', raw)
            for name, job in yaml.safe_load(raw)['jobs'].items():
                steps = job.get('steps', [])
                for i, s in enumerate(steps):
                    if 'e2e-status-lanes' not in str(s.get('uses', '')):
                        continue
                    with self.subTest(file=path.name, job=name):
                        self.assertNotIn(steps[i - 1]['with']['ref'], READER_FORBIDDEN_REFS)

    def test_test_code_checkout_stays_on_the_tested_commit(self):
        """The test-code checkout stays on the tested commit."""
        # The lane list is read from the trusted checkout; the test-code checkout keeps its ref.
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            with self.subTest(suite=suite):
                self.assertEqual(jobs['prepare-run']['steps'][0]['with']['ref'], '${{ inputs.commit_sha }}')
                self.assertEqual(step(workflow(suite)['jobs']['skip'], 'ci/checkout-repo')['with']['ref'], '${{ inputs.commit_sha }}')


class LaneListValidation(unittest.TestCase):
    """Runs the composite's own script against a fixture list. The aggregate must stay an e2e-test/ context
    and no lane may equal it or break the naming rule that keeps the aggregate and lanes apart."""
    @staticmethod
    def run_reader(lanes_json, context='e2e-test/cypress-full/enterprise'):
        """Runs the lane reader's script against lanes_json for context.

        Returns the completed process and the text it wrote to GITHUB_OUTPUT.
        """
        script = yaml.safe_load((GITHUB / 'actions' / 'e2e-status-lanes' / 'action.yml').read_text())['runs']['steps'][0]['run']
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'e2e-status-lanes.json').write_text(lanes_json)
            action_dir = root / 'actions' / 'e2e-status-lanes'
            action_dir.mkdir(parents=True)
            output = root / 'github-output'
            output.touch()
            result = subprocess.run(['bash', '-e', '-c', script], capture_output=True, text=True, env={
                'PATH': os.environ['PATH'], 'ACTION_DIR': str(action_dir), 'CONTEXT_NAME': context,
                'GITHUB_OUTPUT': str(output),
            })
            return result, output.read_text()

    def test_valid_list_publishes_the_aggregate_and_member_triage_outputs(self):
        """A valid list publishes the aggregate and the member triage outputs."""
        result, out = self.run_reader(json.dumps({'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/cypress-full/enterprise', 'e2e-test/playwright-full/enterprise/subpath']}))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('triage-context=e2e-test/triage', out)
        self.assertIn('lanes=e2e-test/cypress-full/enterprise,e2e-test/playwright-full/enterprise/subpath', out)

    def test_non_member_context_gets_no_triage_outputs(self):
        """A non-member context gets no triage outputs."""
        result, out = self.run_reader(json.dumps({'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/cypress-full/enterprise']}), context='e2e-test/cypress-full/master')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('triage-context=\n', out)

    def test_malformed_lists_fail(self):
        """Malformed lists fail."""
        bad = {
            'aggregate_context is one of its lanes': {'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/triage']},
            'lane outside the e2e-test namespace': {'aggregate_context': 'e2e-test/triage', 'lanes': ['master/cypress']},
            'lane with a comma (would split the output list)': {'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/a,e2e-test/b']},
            'lane with whitespace or upper case': {'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/Bad Lane']},
            'aggregate outside the namespace': {'aggregate_context': 'triage', 'lanes': ['e2e-test/cypress-full/enterprise']},
            'empty lanes': {'aggregate_context': 'e2e-test/triage', 'lanes': []},
            'lanes not an array': {'aggregate_context': 'e2e-test/triage', 'lanes': 'e2e-test/cypress-full/enterprise'},
        }
        for case, value in bad.items():
            with self.subTest(case=case):
                result, _ = self.run_reader(json.dumps(value))
                self.assertNotEqual(result.returncode, 0)

    def test_missing_list_fails(self):
        """A missing list fails."""
        script = yaml.safe_load((GITHUB / 'actions' / 'e2e-status-lanes' / 'action.yml').read_text())['runs']['steps'][0]['run']
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(['bash', '-e', '-c', script], capture_output=True, text=True, env={
                'PATH': os.environ['PATH'], 'ACTION_DIR': os.path.join(tmp, 'a', 'b'), 'CONTEXT_NAME': '', 'GITHUB_OUTPUT': os.path.join(tmp, 'o'),
            })
        self.assertNotEqual(result.returncode, 0)


class ExplicitWritersCoverEveryPrLane(unittest.TestCase):
    """override-status and verified-label write the full-suite contexts they are given. Those must be exactly the
    lanes in the list: the reader output feeds them, and the subpath lane is among them."""
    CASES = [('override-status', 'override-status', 'Override failed full test statuses'),
             ('verified-label', 'approve-e2e', 'ci/override-failed-statuses')]
    FAKE_GH = "#!/bin/sh\ncase \" $* \" in *\" --jq \"*) exit 0;; esac\necho '[]'\n"

    def written_contexts(self, job_name, step_name, file, lanes_csv):
        """Runs a writer step up to its per-context loop with the given lanes.

        Returns the completed process and the contexts the loop would write.
        """
        job = workflow(file)['jobs'][job_name]
        script = step(job, step_name)['run']
        # Run everything up to the per-context loop: the list derivation and the rolling-upgrade discovery. The loop body
        # holds a regex that macOS bash 3.2 cannot parse (the pre-existing SC1072 note), so it is replaced by an
        # equivalent echo over the same array.
        loop = 'for CONTEXT_NAME in "${FULL_TEST_CONTEXTS[@]}"; do'
        self.assertEqual(script.count(loop), 1)
        script = script[:script.index(loop)] + 'for CONTEXT_NAME in "${FULL_TEST_CONTEXTS[@]}"; do echo "Checking: $CONTEXT_NAME"; done\n'
        with tempfile.TemporaryDirectory() as tmp:
            bin_dir = pathlib.Path(tmp) / 'bin'
            bin_dir.mkdir()
            gh = bin_dir / 'gh'
            gh.write_text(self.FAKE_GH)
            gh.chmod(0o755)
            output = pathlib.Path(tmp) / 'github-output'
            output.touch()
            result = subprocess.run(['bash', '-e', '-c', script], capture_output=True, text=True, env={
                'PATH': f"{bin_dir}{os.pathsep}{os.environ['PATH']}", 'GH_TOKEN': 'test', 'COMMIT_SHA': 'a' * 40,
                'GITHUB_REPOSITORY': 'example/repo', 'LANES': lanes_csv, 'GITHUB_OUTPUT': str(output),
            })
        contexts = [line[len('Checking: '):] for line in result.stdout.splitlines() if line.startswith('Checking: ')]
        return result, contexts

    def test_writers_check_exactly_the_listed_lanes(self):
        """Writers check exactly the listed lanes."""
        config = json.loads((GITHUB / 'e2e-status-lanes.json').read_text())
        _, out = LaneListValidation.run_reader(json.dumps(config))
        lanes_csv = next(line.split('=', 1)[1] for line in out.splitlines() if line.startswith('lanes='))
        for file, job_name, step_name in self.CASES:
            with self.subTest(file=file):
                result, contexts = self.written_contexts(job_name, step_name, file, lanes_csv)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(contexts, config['lanes'])
                self.assertIn('e2e-test/playwright-full/enterprise/subpath', contexts)

    def test_reader_runs_before_the_writer_uses_its_output(self):
        """The reader runs before the writer uses its output."""
        for file, job_name, step_name in self.CASES:
            steps = workflow(file)['jobs'][job_name]['steps']
            names = [s.get('name') for s in steps]
            with self.subTest(file=file):
                reader = next(i for i, s in enumerate(steps) if s.get('uses') == TRUSTED_READER)
                self.assertLess(reader, names.index(step_name))
                self.assertEqual(step(workflow(file)['jobs'][job_name], step_name)['env']['LANES'], '${{ steps.lanes.outputs.lanes }}')


if __name__ == '__main__':
    unittest.main()

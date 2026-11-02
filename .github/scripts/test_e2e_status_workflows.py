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
PERMISSIONS = {'contents': 'read', 'statuses': 'write', 'pull-requests': 'read'}


def workflow(name):
    return yaml.safe_load((WORKFLOWS / f'e2e-tests-{name}.yml').read_text())


def lane_result_workflow():
    return yaml.safe_load((WORKFLOWS / f'{LANE_RESULT}.yml').read_text())


def step(job, name):
    return next(s for s in job['steps'] if s.get('name') == name)


class StatusPublicationContract(unittest.TestCase):
    def test_every_pr_lane_gives_triage_the_model_key(self):
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
        self.assertEqual(lane_result_workflow()['jobs']['lane-result']['concurrency'], LOCK)
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            with self.subTest(suite=suite):
                self.assertEqual(jobs['prepare-run']['concurrency'], LOCK)
                self.assertEqual(workflow(suite)['jobs']['skip']['concurrency'], LOCK)
                self.assertNotIn('concurrency', jobs['report'], 'report writes no status; the lane result owns publication')
                self.assertNotIn('concurrency', jobs['workers'], 'workers run independently across suites and editions')

    def test_explicit_verifiers_share_the_same_publication_lock(self):
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
        lane_steps = lane_result_workflow()['jobs']['lane-result']['steps']
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            report = jobs['report']
            self.assertEqual(report['if'], 'always()')
            self.assertEqual(step(report, 'ci/run-summary')['if'], 'always()')
            caller = jobs['lane-result']['if']
            self.assertIn('!cancelled()', caller)
            self.assertIn("needs.workers.result != 'cancelled'", caller)
            self.assertIn("needs.dispatch-begin.result != 'cancelled'", caller)
            uploads = [s for s in jobs['workers']['steps'] if 'actions/upload-artifact@' in s.get('uses', '')]
            self.assertTrue(uploads)
            self.assertTrue(all(s['if'] == 'always()' for s in uploads))
        for name in ('ci/publish-result', 'ci/e2e-triage', 'ci/refresh-lane-summary'):
            condition = next(s for s in lane_steps if s.get('name') == name)['if']
            with self.subTest(step=name):
                self.assertIn('!cancelled()', condition)
                self.assertNotIn('always()', condition)

    def test_lane_result_is_called_last_with_explicit_inputs_and_least_privilege(self):
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
        # caller -> template -> lane result is already three reusable levels deep.
        for job in lane_result_workflow()['jobs'].values():
            self.assertNotIn('uses', job, 'the lane result must not call another reusable workflow')

    def test_missing_results_are_red_and_success_also_refreshes_summary(self):
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
        self.assertIn('inputs.execution_success', triage['with']['mode'])
        self.assertIn("steps.result.outputs.reports-complete == 'true'", triage['with']['mode'])
        self.assertTrue(triage['with']['mode'].endswith("|| 'report-only' }}"))
        self.assertIn("vars.E2E_TRIAGE_MODE || 'report-only'", triage['with']['mode'])
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
        assertion = step(lane_result_workflow()['jobs']['lane-result'], 'ci/assert-results')
        self.assertEqual(assertion['env']['EXECUTION_SUCCESS'], '${{ inputs.execution_success }}')
        self.assertEqual(assertion['env']['REPORTS_COMPLETE'], '${{ steps.result.outputs.reports-complete }}')
        self.assertEqual(assertion['env']['RAW_STATE'], '${{ steps.result.outputs.state }}')
        self.assertEqual(assertion['env']['TRIAGE_MODE'], '${{ steps.triage.outputs.effective-mode }}')
        self.assertEqual(assertion['env']['TRIAGE_OUTCOME'], '${{ steps.triage.outcome }}')
        self.assertEqual(assertion['env']['TRIAGE_PUBLISHED'], '${{ steps.triage.outputs.published }}')
        self.assertEqual(assertion['env']['TRIAGE_VERDICT'], '${{ steps.triage.outputs.verdict }}')
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
        for outcome, published in [('failure', 'true'), ('success', 'false'), ('success', ''), ('', 'true')]:
            with self.subTest(outcome=outcome, published=published):
                result = subprocess.run(['bash', '-e', '-c', assertion['run']], env={
                    'EXECUTION_SUCCESS': 'true', 'REPORTS_COMPLETE': 'true', 'RAW_STATE': 'failure',
                    'TRIAGE_MODE': 'enforce', 'TRIAGE_VERDICT': 'SUCCESS',
                    'TRIAGE_OUTCOME': outcome, 'TRIAGE_PUBLISHED': published,
                }, capture_output=True)
                self.assertNotEqual(result.returncode, 0)

    def test_webhook_posts_after_the_status_and_triage_as_before(self):
        names = [s.get('name') for s in lane_result_workflow()['jobs']['lane-result']['steps']]
        order = ['ci/publish-result', 'ci/e2e-triage', 'ci/refresh-lane-summary', 'ci/publish-webhook', 'ci/assert-results']
        self.assertEqual([n for n in names if n in order], order)

    def test_report_job_only_summarises(self):
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

    def test_lane_result_holds_the_lock_for_a_bounded_time(self):
        self.assertEqual(lane_result_workflow()['jobs']['lane-result']['timeout-minutes'], 45)

    def test_a_slow_worker_fails_before_its_job_is_cancelled(self):
        # A cancelled worker skips lane-result, so triage never runs and its check stays waiting.
        for name in ('cypress-template', 'playwright-template'):
            with self.subTest(workflow=name):
                workers = workflow(name)['jobs']['workers']
                self.assertLess(step(workers, 'ci/dispatch-run')['timeout-minutes'], workers['timeout-minutes'] - 5)


def build_context(suite, edition, deploy, report_type):
    # Runs the lane's own build step, so the context is the one the workflow would publish.
    run = next(s['run'] for s in workflow(suite)['jobs']['generate-build-variables']['steps'] if s.get('id') == 'build-vars')
    if '${{' in run:
        raise RuntimeError(f'{suite} build step must not depend on expressions')
    with tempfile.TemporaryDirectory() as tmp:
        output = pathlib.Path(tmp) / 'github-output'
        output.touch()
        env = {'PATH': os.environ['PATH'], 'GITHUB_OUTPUT': str(output), 'COMMIT_SHA': 'a' * 40, 'RUN_ID': '1',
               'RUN_ATTEMPT': '1', 'PR_NUMBER': '1', 'INPUT_REF_BRANCH': '', 'INPUT_SERVER_IMAGE_ALIASES': '',
               'INPUT_SERVER_IMAGE_REPO': 'mattermostdevelopment', 'INPUT_SERVER_IMAGE_TAG': 'abc1234',
               'INPUT_REPORT_TYPE': report_type, 'INPUT_SERVER_EDITION': edition, 'INPUT_SERVER_DEPLOY': deploy}
        result = subprocess.run(['bash', '-e', '-c', run], env=env, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        outputs = dict(line.split('=', 1) for line in output.read_text().splitlines() if '=' in line)
    return outputs['context_name']


class PrLaneContexts(unittest.TestCase):
    # The PR lanes are the contexts the PR callers in e2e-tests-ci.yml build. They are derived here from those
    # callers' inputs and each suite's own build step, then compared with the list. Nothing is copied from the list.
    @staticmethod
    def pr_callers():
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
        # Guards the derivation itself: enterprise and fips for both suites, plus the playwright subpath run.
        derived = sorted((suite, edition or 'enterprise', deploy) for _, suite, edition, deploy, _ in self.pr_callers())
        self.assertEqual(derived, [('cypress', 'enterprise', ''), ('cypress', 'fips', ''),
                                   ('playwright', 'enterprise', ''), ('playwright', 'enterprise', 'subpath'),
                                   ('playwright', 'fips', '')])

    def test_pr_lanes_are_exactly_the_listed_lanes(self):
        config = json.loads((GITHUB / 'e2e-status-lanes.json').read_text())
        expected = sorted({build_context(suite, edition, deploy, report) for _, suite, edition, deploy, report in self.pr_callers()})
        self.assertEqual(sorted(config['lanes']), expected)
        self.assertEqual(len(config['lanes']), len(set(config['lanes'])), 'a lane may be listed once')

    def test_the_aggregate_is_the_triage_context(self):
        self.assertEqual(json.loads((GITHUB / 'e2e-status-lanes.json').read_text())['aggregate_context'], 'e2e-test/triage')

    def test_each_lane_publishes_the_context_it_is_listed_under(self):
        for suite, job_name, skip_name in (('cypress', 'cypress-full', 'skip'), ('playwright', 'playwright-full', 'skip')):
            wf = workflow(suite)
            with self.subTest(suite=suite):
                self.assertEqual(wf['jobs'][job_name]['with']['context_name'], '${{ needs.generate-build-variables.outputs.context_name }}')
                self.assertEqual(step(wf['jobs'][skip_name], 'ci/post-skip-status')['with']['status-context'],
                                 '${{ needs.generate-build-variables.outputs.context_name }}')


class LaneListSingleSource(unittest.TestCase):
    # The PR lanes that feed the triage aggregate are listed once, in .github/e2e-status-lanes.json.
    def test_aggregate_is_not_one_of_its_own_lanes(self):
        config = json.loads((GITHUB / 'e2e-status-lanes.json').read_text())
        self.assertTrue(config['lanes'])
        self.assertNotIn(config['aggregate_context'], config['lanes'])

    def test_triage_inputs_are_read_from_the_lane_reader(self):
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
        # The lane list is read from the trusted checkout; the test-code checkout keeps its ref.
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            with self.subTest(suite=suite):
                self.assertEqual(jobs['prepare-run']['steps'][0]['with']['ref'], '${{ inputs.commit_sha }}')
                self.assertEqual(step(workflow(suite)['jobs']['skip'], 'ci/checkout-repo')['with']['ref'], '${{ inputs.commit_sha }}')


class LaneListValidation(unittest.TestCase):
    # Runs the composite's own script against a fixture list. The aggregate must stay an e2e-test/ context
    # and no lane may equal it or break the naming rule that keeps the aggregate and lanes apart.
    @staticmethod
    def run_reader(lanes_json, context='e2e-test/cypress-full/enterprise'):
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
        result, out = self.run_reader(json.dumps({'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/cypress-full/enterprise', 'e2e-test/playwright-full/enterprise/subpath']}))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('triage-context=e2e-test/triage', out)
        self.assertIn('lanes=e2e-test/cypress-full/enterprise,e2e-test/playwright-full/enterprise/subpath', out)

    def test_non_member_context_gets_no_triage_outputs(self):
        result, out = self.run_reader(json.dumps({'aggregate_context': 'e2e-test/triage', 'lanes': ['e2e-test/cypress-full/enterprise']}), context='e2e-test/cypress-full/master')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('triage-context=\n', out)

    def test_malformed_lists_fail(self):
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
        script = yaml.safe_load((GITHUB / 'actions' / 'e2e-status-lanes' / 'action.yml').read_text())['runs']['steps'][0]['run']
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(['bash', '-e', '-c', script], capture_output=True, text=True, env={
                'PATH': os.environ['PATH'], 'ACTION_DIR': os.path.join(tmp, 'a', 'b'), 'CONTEXT_NAME': '', 'GITHUB_OUTPUT': os.path.join(tmp, 'o'),
            })
        self.assertNotEqual(result.returncode, 0)


class ExplicitWritersCoverEveryPrLane(unittest.TestCase):
    # override-status and verified-label write the full-suite contexts they are given. Those must be exactly the
    # lanes in the list: the reader output feeds them, and the subpath lane is among them.
    CASES = [('override-status', 'override-status', 'Override failed full test statuses'),
             ('verified-label', 'approve-e2e', 'ci/override-failed-statuses')]
    FAKE_GH = "#!/bin/sh\ncase \" $* \" in *\" --jq \"*) exit 0;; esac\necho '[]'\n"

    def written_contexts(self, job_name, step_name, file, lanes_csv):
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
        for file, job_name, step_name in self.CASES:
            steps = workflow(file)['jobs'][job_name]['steps']
            names = [s.get('name') for s in steps]
            with self.subTest(file=file):
                reader = next(i for i, s in enumerate(steps) if s.get('uses') == TRUSTED_READER)
                self.assertLess(reader, names.index(step_name))
                self.assertEqual(step(workflow(file)['jobs'][job_name], step_name)['env']['LANES'], '${{ steps.lanes.outputs.lanes }}')


if __name__ == '__main__':
    unittest.main()

#!/usr/bin/env python3
"""Status ownership wiring regressions. Run with Python 3 and PyYAML."""
import pathlib
import unittest

import yaml

WORKFLOWS = pathlib.Path(__file__).resolve().parents[1] / 'workflows'


def workflow(name):
    return yaml.safe_load((WORKFLOWS / f'e2e-tests-{name}.yml').read_text())


def step(job, name):
    return next(s for s in job['steps'] if s.get('name') == name)


class StatusPublicationContract(unittest.TestCase):
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

    def test_all_writers_share_a_sha_mutex_and_keep_queued_publishers(self):
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            for name, job in [('prepare-run', jobs['prepare-run']), ('report', jobs['report']), ('skip', workflow(suite)['jobs']['skip'])]:
                with self.subTest(suite=suite, job=name):
                    self.assertEqual(job['concurrency'], {
                        'group': 'e2e-status-publish-${{ inputs.commit_sha }}',
                        'cancel-in-progress': False, 'queue': 'max',
                    })
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

    def test_cancellation_preserves_diagnostics_without_status_publication(self):
        for suite in ('cypress', 'playwright'):
            jobs = workflow(f'{suite}-template')['jobs']
            report = jobs['report']
            self.assertEqual(report['if'], 'always()')
            self.assertEqual(step(report, 'ci/run-summary')['if'], 'always()')
            for name in ('ci/publish-result', 'ci/e2e-triage', 'ci/refresh-lane-summary'):
                condition = step(report, name)['if']
                self.assertIn('!cancelled()', condition)
                self.assertIn("needs.workers.result != 'cancelled'", condition)
                self.assertIn("needs.dispatch-begin.result != 'cancelled'", condition)
                self.assertNotIn('always()', condition)
            uploads = [s for s in jobs['workers']['steps'] if 'actions/upload-artifact@' in s.get('uses', '')]
            self.assertTrue(uploads)
            self.assertTrue(all(s['if'] == 'always()' for s in uploads))

    def test_missing_results_are_red_and_success_also_refreshes_summary(self):
        for suite in ('cypress', 'playwright'):
            report = workflow(f'{suite}-template')['jobs']['report']
            result = step(report, 'ci/publish-result')
            self.assertEqual(result['with']['state'], "${{ steps.summary.outcome == 'success' && 'success' || 'failure' }}")
            self.assertIn('unavailable or incomplete', result['with']['description'])
            self.assertNotIn('summary.outcome', step(report, 'ci/refresh-lane-summary')['if'])
            self.assertIn("vars.E2E_TRIAGE_MODE || 'enforce'", step(report, 'ci/e2e-triage')['with']['mode'])
            self.assertIn('inputs.context_name', step(report, 'ci/e2e-triage')['with']['triage-lanes'])


if __name__ == '__main__':
    unittest.main()

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Demo spec for the E2E AI flake-triage pipeline (mattermost-test-system-io#101
 * + mattermost-test-automation-toolkit#3).
 *
 * Armed only when the repo variable E2E_TRIAGE_DEMO is set to `fail`, which the
 * playwright template forwards to workers. Normal runs skip it, so merging this
 * file has no effect on the suite.
 *
 * Demo flow:
 *  1. Set the repo variable E2E_TRIAGE_DEMO=fail and rerun E2E on this PR.
 *  2. The summary action reds `e2e-test/playwright-full/enterprise`.
 *  3. The ai-triage job classifies the failure. Because this PR added the
 *     failing spec itself, the diff overlaps the failure and policy refuses to
 *     waive it (fail closed) — the check stays red, annotated as a
 *     product/test bug, and the verdict is written to the TSIO ledger.
 *  4. A maintainer comments `/e2e-triage-override FLAKY_INFRA demo of the human
 *     correction path` — the check goes green with E2E/Override and the
 *     correction is recorded for the accuracy metrics.
 *  5. Unset the variable.
 */
test('MM-T99999 E2E triage demo: controlled failure', async () => {
    if (process.env.E2E_TRIAGE_DEMO !== 'fail') {
        // Unarmed: recorded as skipped, invisible to pass rates.
        test.skip(true, 'arm with repo variable E2E_TRIAGE_DEMO=fail to demo the triage gate');
        return;
    }

    // Deterministic, obviously-synthetic failure: the point is a red
    // e2e-test/* row to triage, not a product assertion.
    expect(
        'demo failure armed via E2E_TRIAGE_DEMO',
        'This failure is intentional — the E2E_TRIAGE_DEMO repo variable is set to `fail`. ' +
            'The ai-triage job classifies it and a maintainer corrects it via /e2e-triage-override.',
    ).toBe('disarm by clearing the E2E_TRIAGE_DEMO repo variable');
});

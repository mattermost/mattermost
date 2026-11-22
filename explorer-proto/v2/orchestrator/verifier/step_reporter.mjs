// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the verifier names the output file in PILOT_STEP_OUT */

// Playwright reporter for the deterministic verifier: records every `expect` step in order (source line, matcher name,
// whether it failed) so the verifier can show which awaited expects ran before the failing one. No locator text, no
// URL and no page content is recorded.
import fs from 'node:fs';

export default class StepReporter {
    rows = [];

    onStepEnd(test, result, step) {
        if (step.category !== 'expect') {
            return;
        }
        this.rows.push({
            line: step.location?.line ?? null,
            matcher: /^Expect "([A-Za-z.]+)"/.exec(step.title)?.[1] ?? 'unknown',
            error: Boolean(step.error),
        });
    }

    onEnd() {
        if (process.env.PILOT_STEP_OUT) {
            fs.writeFileSync(process.env.PILOT_STEP_OUT, `${JSON.stringify(this.rows)}\n`);
        }
    }
}

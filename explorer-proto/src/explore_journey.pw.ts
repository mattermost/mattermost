// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {readJourneyCharter} from './journey_charter.ts';
import {SetupFailure} from './journey_fixture.ts';
import {runSearch} from './journey_search.ts';
import {writeJourneyTrace} from './journey_trace.ts';
import {allowedOrigin} from './manifest.ts';
import {journeyName, outDir} from './paths.ts';
import {closeGuardedSessions} from './session.ts';

test.afterEach(closeGuardedSessions);

test('explore a journey charter by heuristic best-first search over fresh fixtures', async ({pw}) => {
    const journey = journeyName();
    if (!journey) {
        throw new Error('explore_journey.pw.ts needs PILOT_JOURNEY (cli.ts explore --journey=<name>).');
    }
    const charter = readJourneyCharter(journey);
    test.setTimeout((charter.budget.wall_clock_seconds + 600) * 1000);

    const origin = allowedOrigin();
    try {
        const result = await runSearch(pw, charter, origin, {outDir: outDir()});
        writeJourneyTrace(outDir(), charter, result);
        // The run itself does not fail when no journey qualifies: the trace + report is the deliverable.
        let verdict = result.qualified ? 'QUALIFIED' : 'NOT qualified';
        if (result.outcomes) {
            verdict = `verdict ${result.outcomes.verdict}`;
        }
        // eslint-disable-next-line no-console
        console.log(
            `journey ${journey}: ${verdict} (${result.counters.actions} actions, ${result.counters.replays} replays, ${result.counters.states} states, depth ${result.counters.deepest}, ${result.wallClockSeconds}s); ${result.stoppedReason}`,
        );
        if (result.outcomes?.setupFailure) {
            throw new SetupFailure(`${result.outcomes.setupFailure.phase}: ${result.outcomes.setupFailure.message}`);
        }
    } catch (error) {
        if (error instanceof SetupFailure) {
            throw new Error(`SETUP FAILURE: ${error.message}`);
        }
        throw error;
    }
});

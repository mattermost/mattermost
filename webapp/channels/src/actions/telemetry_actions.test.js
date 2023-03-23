// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isTelemetryEnabled, shouldTrackPerformance} from 'actions/telemetry_actions';

describe('Actions.Telemetry', () => {
    test('isTelemetryEnabled', async () => {
        const state = {
            entities: {
                general: {
                    config: {
                        DiagnosticsEnabled: 'false',
                    },
                },
            },
        };

        expect(isTelemetryEnabled(state)).toBeFalsy();

        state.entities.general.config.DiagnosticsEnabled = 'true';

        expect(isTelemetryEnabled(state)).toBeTruthy();
    });

    test('shouldTrackPerformance', async () => {
        const state = {
            entities: {
                general: {
                    config: {
                        DiagnosticsEnabled: 'false',
                        EnableDeveloper: 'false',
                    },
                },
            },
        };

        expect(shouldTrackPerformance(state)).toBeFalsy();

        state.entities.general.config.DiagnosticsEnabled = 'true';

        expect(shouldTrackPerformance(state)).toBeTruthy();

        state.entities.general.config.DiagnosticsEnabled = 'false';
        state.entities.general.config.EnableDeveloper = 'true';

        expect(shouldTrackPerformance(state)).toBeTruthy();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import RemoteUserHour from './remote_user_hour';

describe('components/advanced_text_editor/RemoteUserHour', () => {
    const baseProps = {
        displayName: 'Test User',
        timestamp: 1639440000000, // 2021-12-14 00:00:00
        teammateTimezone: {
            useAutomaticTimezone: true,
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
    };

    test('should not render when EnableLateTimeWarnings is false', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        EnableLateTimeWarnings: 'false',
                    },
                },
            },
        };

        renderWithContext(<RemoteUserHour {...baseProps}/>, state);

        expect(screen.queryByText(/The time for/)).not.toBeInTheDocument();
    });

    test('should render when EnableLateTimeWarnings is true', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        EnableLateTimeWarnings: 'true',
                    },
                },
            },
        };

        renderWithContext(<RemoteUserHour {...baseProps}/>, state);

        expect(screen.getByText(/The time for/)).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    test('should render timestamp in user timezone', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        EnableLateTimeWarnings: 'true',
                    },
                },
            },
        };

        renderWithContext(<RemoteUserHour {...baseProps}/>, state);

        // Verify timestamp is rendered (exact time will depend on timezone)
        expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });
});

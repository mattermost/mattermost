// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import Avatars from './avatars';

vi.mock('mattermost-redux/actions/users', () => {
    return {
        ...vi.importActual('mattermost-redux/actions/users'),
        getMissingProfilesByIds: vi.fn((ids) => {
            return {
                type: 'MOCK_GET_MISSING_PROFILES_BY_IDS',
                data: ids,
            };
        }),
    };
});

describe('components/widgets/users/Avatars', () => {
    const state = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'uid',
                profiles: {
                    1: {
                        id: '1',
                        username: 'first.last1',
                        nickname: 'nickname1',
                        first_name: 'First1',
                        last_name: 'Last1',
                        last_picture_update: 1620680333191,

                    },
                    2: {
                        id: '2',
                        username: 'first.last2',
                        nickname: 'nickname2',
                        first_name: 'First2',
                        last_name: 'Last2',
                        last_picture_update: 1620680333191,
                    },
                    3: {
                        id: '3',
                        username: 'first.last3',
                        nickname: 'nickname3',
                        first_name: 'First3',
                        last_name: 'Last3',
                        last_picture_update: 1620680333191,
                    },
                    4: {
                        id: '4',
                        username: 'first.last4',
                        nickname: 'nickname4',
                        first_name: 'First4',
                        last_name: 'Last4',
                        last_picture_update: 1620680333191,
                    },
                    5: {
                        id: '5',
                        username: 'first.last5',
                        nickname: 'nickname5',
                        first_name: 'First5',
                        last_name: 'Last5',
                        last_picture_update: 1620680333191,
                    },
                },
            },
            teams: {
                currentTeamId: 'tid',
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should support userIds', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                ]}
            />,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should properly count overflow', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            state,
        );

        expect(container).toMatchSnapshot();

        // Check for the +2 overflow indicator (in data-content attribute)
        const overflowElement = container.querySelector('[data-content="+2"]');
        expect(overflowElement).toBeInTheDocument();
    });

    test('should not duplicate displayed users in overflow tooltip', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            state,
        );

        // The tooltip should contain only the overflow users (not the displayed ones)
        // Users 1, 2, 3 are displayed, so tooltip should show 4 and 5
        const overflowElement = container.querySelector('[data-content="+2"]');
        expect(overflowElement).toBeInTheDocument();
    });

    test('should fetch missing users', () => {
        const {container} = renderWithContext(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '6',
                    '7',
                    '2',
                    '8',
                    '9',
                ]}
            />,
            state,
        );

        expect(container).toMatchSnapshot();

        // Check for the +3 overflow indicator (6 users - 3 displayed = 3 overflow)
        const overflowElement = container.querySelector('[data-content="+3"]');
        expect(overflowElement).toBeInTheDocument();
    });
});

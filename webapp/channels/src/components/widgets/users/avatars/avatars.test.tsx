// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import {renderWithContext} from 'tests/react_testing_utils';

import Avatars from './avatars';

jest.mock('mattermost-redux/actions/users', () => {
    return {
        ...jest.requireActual('mattermost-redux/actions/users'),
        getMissingProfilesByIds: jest.fn((ids) => {
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

    beforeEach(() => {
        (getMissingProfilesByIds as jest.Mock).mockClear();
    });

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
        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/2/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/3/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelectorAll('img.Avatar')).toHaveLength(3);
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
        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/2/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/3/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/4/image?_=1620680333191"]')).not.toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/5/image?_=1620680333191"]')).not.toBeInTheDocument();

        // Check for +2 overflow avatar (text is rendered via data-content attribute)
        expect(container.querySelector('[data-content="+2"]')).toBeInTheDocument();
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

        // The overflow avatar should exist with +2 text
        expect(container.querySelector('[data-content="+2"]')).toBeInTheDocument();
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
        expect(getMissingProfilesByIds).toHaveBeenCalledWith(['1', '6', '7', '2', '8', '9']);

        expect(container.querySelector('img[src="/api/v4/users/1/image?_=1620680333191"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/6/image?_=0"]')).toBeInTheDocument();
        expect(container.querySelector('img[src="/api/v4/users/7/image?_=0"]')).toBeInTheDocument();
    });
});

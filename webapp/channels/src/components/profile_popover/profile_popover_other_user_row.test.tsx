// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProfilePopoverOtherUserRow from './profile_popover_other_user_row';

describe('components/ProfilePopoverOtherUserRow', () => {
    const baseProps = {
        user: TestHelper.getUserMock({id: 'user1'}),
        fullname: 'User One',
        currentUserId: 'currentUser',
        haveOverrideProp: false,
        handleShowDirectChannel: jest.fn(),
        returnFocus: jest.fn(),
        handleCloseModals: jest.fn(),
        hide: jest.fn(),
    };

    const initialState = {
        entities: {
            general: {
                config: {
                    FeatureFlagEnableSharedChannelsDMs: 'false',
                },
            },
        },
    } as unknown as GlobalState;

    test('should show message button for regular users', () => {
        renderWithContext(
            <ProfilePopoverOtherUserRow
                {...baseProps}
            />,
            initialState,
        );

        expect(screen.getByText('Message')).toBeInTheDocument();
    });

    test('should show message button for remote users when EnableSharedChannelsDMs is enabled', () => {
        const remoteUser = {
            ...baseProps.user,
            remote_id: 'remote1',
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    config: {
                        ...initialState.entities?.general?.config,
                        FeatureFlagEnableSharedChannelsDMs: 'true',
                    },
                },
            },
        };

        renderWithContext(
            <ProfilePopoverOtherUserRow
                {...baseProps}
                user={remoteUser}
            />,
            state,
        );

        expect(screen.getByText('Message')).toBeInTheDocument();
    });

    test('should hide message button for remote users when EnableSharedChannelsDMs is disabled', () => {
        const remoteUser = {
            ...baseProps.user,
            remote_id: 'remote1',
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    config: {
                        ...initialState.entities?.general?.config,
                        FeatureFlagEnableSharedChannelsDMs: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ProfilePopoverOtherUserRow
                {...baseProps}
                user={remoteUser}
            />,
            state,
        );

        expect(screen.queryByText('Message')).not.toBeInTheDocument();
    });

    test('should show message button for local users when EnableSharedChannelsDMs is disabled', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    config: {
                        ...initialState.entities?.general?.config,
                        FeatureFlagEnableSharedChannelsDMs: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ProfilePopoverOtherUserRow
                {...baseProps}
            />,
            state,
        );

        expect(screen.getByText('Message')).toBeInTheDocument();
    });
});

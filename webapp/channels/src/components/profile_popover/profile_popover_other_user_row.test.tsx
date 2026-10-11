// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {canUserDirectMessage} from 'actions/user_actions';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProfilePopoverOtherUserRow from './profile_popover_other_user_row';

jest.mock('actions/user_actions', () => ({
    canUserDirectMessage: jest.fn(),
}));

const mockCanUserDirectMessage = canUserDirectMessage as jest.MockedFunction<typeof canUserDirectMessage>;

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

    beforeEach(() => {
        mockCanUserDirectMessage.mockClear();
        mockCanUserDirectMessage.mockReturnValue(jest.fn().mockResolvedValue({data: {can_dm: true}}));
    });

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

    test('should show message button for remote users when EnableSharedChannelsDMs is enabled', async () => {
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

        await waitFor(() => {
            expect(screen.getByText('Message')).toBeInTheDocument();
        });
        expect(mockCanUserDirectMessage).toHaveBeenCalledWith('currentUser', 'user1');
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
        expect(mockCanUserDirectMessage).not.toHaveBeenCalled();
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
        expect(mockCanUserDirectMessage).not.toHaveBeenCalled();
    });

    describe('DM/GM permission policies', () => {
        const dmId = 'currentUser__user1';

        function makeState(decisions: Record<string, boolean>, hasDM = false) {
            const entries = Object.fromEntries(Object.entries(decisions).map(([action, allowed]) => [action, {allowed, evaluated: true, generation: 1}]));
            return {
                entities: {
                    general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                    users: {currentUserId: 'currentUser'},
                    channels: {
                        channels: hasDM ? {[dmId]: TestHelper.getChannelMock({id: dmId, name: dmId, type: 'D', team_id: ''})} : {},
                        channelsInTeam: {'': new Set(hasDM ? [dmId] : [])},
                    },
                    renderPermissions: {byResource: {permission: {'': entries}}},
                },
            } as unknown as GlobalState;
        }

        test('should not offer messaging at all while Read is denied', () => {
            renderWithContext(
                <ProfilePopoverOtherUserRow {...baseProps}/>,
                makeState({dm_gm_read_access: false}),
            );

            expect(screen.queryByText('Message')).not.toBeInTheDocument();
        });

        test('should disable messaging someone without a DM while Start is denied', () => {
            renderWithContext(
                <ProfilePopoverOtherUserRow {...baseProps}/>,
                makeState({dm_gm_start: false}),
            );

            const button = screen.getByRole('button', {name: `Cannot message ${baseProps.user.username}. You can't start new direct messages.`});
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('title', 'You can\'t start new direct messages');
        });

        test('should still message someone with an existing DM while Start is denied', () => {
            renderWithContext(
                <ProfilePopoverOtherUserRow {...baseProps}/>,
                makeState({dm_gm_start: false}, true),
            );

            expect(screen.getByRole('button', {name: `Send message to ${baseProps.user.username}`})).toBeEnabled();
        });
    });
});

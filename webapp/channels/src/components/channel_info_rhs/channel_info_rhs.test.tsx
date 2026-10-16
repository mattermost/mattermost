// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ChannelInfoRHS from './channel_info_rhs';

const mockAboutArea = jest.fn();
jest.mock('./about_area', () => (props: any) => {
    mockAboutArea(props);
    return <div>{'test-about-area'}</div>;
});

describe('channel_info_rhs', () => {
    const OriginalProps = {
        channel: {display_name: 'my channel title', type: 'O'} as Channel,
        isArchived: false,
        channelStats: {} as ChannelStats,
        currentUser: {} as UserProfile,
        currentTeam: {} as Team,
        isFavorite: false,
        isMuted: false,
        isInvitingPeople: false,
        isMobile: false,
        isInManagedCategory: false,
        canManageMembers: true,
        canManageProperties: true,
        channelMembers: [],
        actions: {
            closeRightHandSide: jest.fn(),
            unfavoriteChannel: jest.fn(),
            favoriteChannel: jest.fn(),
            unmuteChannel: jest.fn(),
            muteChannel: jest.fn(),
            openModal: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {}})),
        },
    };
    let props = {...OriginalProps};

    beforeEach(() => {
        props = {...OriginalProps};
        mockAboutArea.mockClear();
    });

    describe('about area', () => {
        test('should be editable', async () => {
            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(mockAboutArea).toHaveBeenCalledWith(
                expect.objectContaining({
                    canEditChannelProperties: true,
                }),
            );
        });
        test('should not be editable in archived channel', async () => {
            props.isArchived = true;

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(mockAboutArea).toHaveBeenCalledWith(
                expect.objectContaining({
                    canEditChannelProperties: false,
                }),
            );
        });
    });

    // Unarchiving is authorised on manage_team, so the management decision has to be
    // asked for directly; an archived channel mounts no composer to prefetch it.
    describe('unarchive', () => {
        const archivedChannel = {id: 'channel_id', name: 'archived-channel', team_id: 'team_id', display_name: 'Archived', type: 'O', delete_at: 1} as Channel;

        const stateWithManagementDecision = (allowed: boolean) => ({
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                users: {currentUserId: 'user_id', profiles: {user_id: {id: 'user_id', roles: 'system_user system_admin'}}},
                roles: {roles: {system_admin: {permissions: ['manage_team']}}},
                renderPermissions: {
                    byResource: {
                        channel: {
                            [archivedChannel.id]: {channel_management_access: {allowed, evaluated: true, generation: 1}},
                        },
                    },
                },
            },
        });

        test('offers Unarchive when channel_management_access allows', () => {
            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                    channel={archivedChannel}
                    isArchived={true}
                />,
                stateWithManagementDecision(true),
            );

            expect(screen.getByText('Unarchive')).toBeInTheDocument();
        });

        test('hides Unarchive when channel_management_access denies', () => {
            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                    channel={archivedChannel}
                    isArchived={true}
                />,
                stateWithManagementDecision(false),
            );

            expect(screen.queryByText('Unarchive')).not.toBeInTheDocument();
        });
    });

    test('editChannelName opens Rename Channel modal', () => {
        props.currentTeam = {name: 'team-1'} as Team;
        renderWithContext(
            <ChannelInfoRHS
                {...props}
            />,
        );

        // Invoke the handler passed into the mocked AboutArea
        const lastArgs = mockAboutArea.mock.calls[mockAboutArea.mock.calls.length - 1][0];
        lastArgs.actions.editChannelName();

        expect(props.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.RENAME_CHANNEL,
                dialogProps: expect.objectContaining({
                    channel: props.channel,
                    teamName: 'team-1',
                }),
            }),
        );
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {act, renderWithContext} from 'tests/vitest_react_testing_utils';

import ChannelInfoRHS from './channel_info_rhs';

const mockAboutArea = vi.fn();
vi.mock('./about_area', () => ({
    __esModule: true,
    default: (props: any) => {
        mockAboutArea(props);
        return <div>{'test-about-area'}</div>;
    },
}));

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
        canManageMembers: true,
        canManageProperties: true,
        channelMembers: [],
        actions: {
            closeRightHandSide: vi.fn(),
            unfavoriteChannel: vi.fn(),
            favoriteChannel: vi.fn(),
            unmuteChannel: vi.fn(),
            muteChannel: vi.fn(),
            openModal: vi.fn(),
            showChannelFiles: vi.fn(),
            showPinnedPosts: vi.fn(),
            showChannelMembers: vi.fn(),
            getChannelStats: vi.fn().mockImplementation(() => Promise.resolve({data: {}})),
        },
    };
    let props = {...OriginalProps};

    beforeEach(() => {
        props = {...OriginalProps};
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
});

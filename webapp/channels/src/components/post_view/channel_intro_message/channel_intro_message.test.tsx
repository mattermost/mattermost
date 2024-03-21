// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelIntroMessage from './channel_intro_message';

describe('components/post_view/ChannelIntroMessages', () => {
    const channel = {
        create_at: 1508265709607,
        creator_id: 'creator_id',
        delete_at: 0,
        display_name: 'test channel',
        header: 'test',
        id: 'channel_id',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'team-id',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const user1 = {id: 'user1', roles: 'system_user'};
    const users = [
        {id: 'user1', roles: 'system_user'},
        {id: 'guest1', roles: 'system_guest'},
        {id: 'test-user-id', roles: 'system_user'},
    ] as UserProfile[];

    const baseProps = {
        currentUserId: 'test-user-id',
        channel,
        fullWidth: true,
        locale: 'en',
        channelProfiles: [],
        isReadOnly: false,
        isFavorite: false,
        enableUserCreation: false,
        teamIsGroupConstrained: false,
        creatorName: 'creatorName',
        currentUser: users[0],
        stats: {},
        usersLimit: 10,
        isMobileView: false,
        actions: {
            getTotalUsersStats: jest.fn().mockResolvedValue([]),
            favoriteChannel: jest.fn().mockResolvedValue([]),
            unfavoriteChannel: jest.fn().mockResolvedValue([]),
        },
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                profiles: {
                    user1: TestHelper.getUserMock({
                        id: 'user1',
                        username: 'my teammate',
                    }),
                },
            },

            roles: {
                roles: {},
            },
            channels: {roles: {channel_id: ['system_user']},
                currentChannelId: 'channel_id',
                myMembers: {},
            },
            teams: {
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
        },

        plugins: {
            components: {},
        },
    } as any;

    describe('test Open Channel', () => {
        test('should match component state, without boards', () => {
            renderWithContext(
                <ChannelIntroMessage{...baseProps}/>, initialState,
            );

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText('This is the start of test channel. Any team member can join and read this channel.')).toBeInTheDocument();
        });
    });

    describe('test Group Channel', () => {
        const groupChannel = {
            ...channel,
            type: Constants.GM_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: groupChannel,
        };

        test('should match component state, no profiles', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            expect(screen.queryByText('test channel')).not.toBeInTheDocument();
            expect(screen.queryByText('Any member can join and read this channel.')).not.toBeInTheDocument();

            // there are no profiles in the dom, channel type is GM_CHANNEL, teammate text should be displayed
            expect(screen.getByText('This is the start of your group message history with these teammates. ', {exact: false})).toBeInTheDocument();

            expect(screen.getByText('This is the start of your', {exact: false})).toHaveClass('channel-intro__text');
        });

        test('should match component state, with profiles', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    channelProfiles={users}
                />, initialState,
            );

            expect(screen.getByText('This is the start of your group message history with these teammates. ', {exact: false})).toBeInTheDocument();

            const headerDialog = screen.getByLabelText('Set header dialog');
            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set header');
            expect(headerDialog).toHaveClass('action-button');

            // one for user1 and one for guest

            const image = screen.getAllByAltText('user profile image');
            expect(image).toHaveLength(2);
            expect(image[0]).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image[0]).toHaveAttribute('loading', 'lazy');

            expect(image[1]).toHaveAttribute('src', '/api/v4/users/guest1/image?_=0');
            expect(image[1]).toHaveAttribute('loading', 'lazy');

            const notificationPreferencesButton = screen.getByText('Notifications');
            expect(notificationPreferencesButton).toBeInTheDocument();
        });
    });

    describe('test DIRECT Channel', () => {
        const directChannel = {
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state, without teammate', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            const message = screen.getByText('This is the start of your direct message history with this teammate. Messages and files shared here are not shown to anyone else.', {exact: false});
            expect(message).toBeInTheDocument();
            expect(message).toHaveClass('channel-intro__text');
        });

        test('should match component state, with teammate', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    teammate={user1 as UserProfile}
                    teammateName='my teammate'
                />, initialState,
            );
            expect(screen.getByText('This is the start of your direct message history with my teammate.', {exact: false})).toBeInTheDocument();

            const teammate = screen.getByLabelText('my teammate');

            expect(teammate).toBeInTheDocument();
            expect(teammate).toHaveTextContent('my teammate');
            expect(teammate).toHaveClass('user-popover style--none');

            const image = screen.getByRole('img');

            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image).toHaveAttribute('loading', 'lazy');

            const headerDialog = screen.getByLabelText('Set header dialog');

            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set header');
            expect(headerDialog).toHaveClass('action-button');
        });
    });

    describe('test DEFAULT Channel', () => {
        const directChannel = {
            ...channel,
            name: Constants.DEFAULT_CHANNEL,
            type: Constants.OPEN_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state, readonly', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    isReadOnly={true}
                />, initialState,
            );

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText('Messages can only be posted by admins. Everyone automatically becomes a permanent member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
        });

        test('should match component state without any permission', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    teamIsGroupConstrained={true}
                />, initialState,
            );

            //no permission is given, invite link should not be in the dom
            expect(screen.queryByText('Add other groups to this team')).not.toBeInTheDocument();

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');
            expect(screen.getByText('Post messages here that you want everyone to see. Everyone automatically becomes a member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
        });
    });

    describe('test OFF TOPIC Channel', () => {
        const directChannel = {
            ...channel,
            type: Constants.OPEN_CHANNEL as ChannelType,
            name: Constants.OFFTOPIC_CHANNEL,
            display_name: Constants.OFFTOPIC_CHANNEL,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );
            screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.');
            expect(screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.')).toHaveClass('channel-intro__text');
        });
    });
});

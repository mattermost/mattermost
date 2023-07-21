// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel, ChannelType} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import React from 'react';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';
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
    ] as UserProfile[];

    const baseProps = {
        currentUserId: 'test-user-id',
        channel,
        fullWidth: true,
        locale: 'en',
        channelProfiles: [],
        enableUserCreation: false,
        teamIsGroupConstrained: false,
        creatorName: 'creatorName',
        stats: {},
        usersLimit: 10,
        actions: {
            getTotalUsersStats: jest.fn().mockResolvedValue([]),
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
            renderWithIntlAndStore(
                <ChannelIntroMessage{...baseProps}/>, initialState,
            );

            const beginningHeading = screen.getByText('Beginning of test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText(`This is the start of the test channel channel, created by ${baseProps.creatorName} on October 17, 2017.`));
            expect(screen.getByText('Any member can join and read this channel.')).toBeInTheDocument();
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
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            expect(screen.queryByText('Beginning of test channel')).not.toBeInTheDocument();
            expect(screen.queryByText('Any member can join and read this channel.')).not.toBeInTheDocument();

            // there are no profiles in the dom, channel type is GM_CHANNEL, teammate text should be displayed
            expect(screen.getByText('This is the start of your group message history with these teammates. Messages and files shared here are not shown to people outside this area.')).toBeInTheDocument();

            expect(screen.getByText('This is the start of your', {exact: false})).toHaveClass('channel-intro-text');
        });

        test('should match component state, with profiles', () => {
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                    channelProfiles={users}
                />, initialState,
            );

            expect(screen.getByText('This is the start of your group message history with test channel', {exact: false})).toBeInTheDocument();

            const headerDialog = screen.getByLabelText('Set a Header dialog');
            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set a Header');
            expect(headerDialog).toHaveClass('style--none intro-links color--link channelIntroButton');

            // one for user1 and one for guest

            const image = screen.getAllByAltText('user profile image');
            expect(image).toHaveLength(2);
            expect(image[0]).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image[0]).toHaveAttribute('loading', 'lazy');

            expect(image[1]).toHaveAttribute('src', '/api/v4/users/guest1/image?_=0');
            expect(image[1]).toHaveAttribute('loading', 'lazy');

            const editIcon = screen.getByTitle('Edit Icon');

            expect(editIcon).toBeInTheDocument();
            expect(editIcon).toHaveClass('icon-pencil-outline');
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
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            const message = screen.getByText('This is the start of your direct message history with this teammate', {exact: false});
            expect(message).toBeInTheDocument();
            expect(message).toHaveClass('channel-intro-text');
        });

        test('should match component state, with teammate', () => {
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                    teammate={user1 as UserProfile}
                    teammateName='my teammate'
                />, initialState,
            );
            expect(screen.getByText('This is the start of your direct message history with my teammate', {exact: false})).toBeInTheDocument();

            const teammate = screen.getByLabelText('my teammate');

            expect(teammate).toBeInTheDocument();
            expect(teammate).toHaveTextContent('my teammate');
            expect(teammate).toHaveClass('user-popover style--none');

            const image = screen.getByRole('img');

            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image).toHaveAttribute('loading', 'lazy');

            const headerDialog = screen.getByLabelText('Set a Header dialog');

            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set a Header');
            expect(headerDialog).toHaveClass('style--none intro-links color--link channelIntroButton');

            const editIcon = screen.getByTitle('Edit Icon');

            expect(editIcon).toBeInTheDocument();
            expect(editIcon).toHaveClass('icon-pencil-outline');
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
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                    isReadOnly={true}
                />, initialState,
            );

            const beginningHeading = screen.getByText('Beginning of test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText('Welcome to test channel!')).toBeInTheDocument();
            expect(screen.getByText('Messages can only be posted by system admins. Everyone automatically becomes a permanent member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
        });

        test('should match component state without any permission', () => {
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                    teamIsGroupConstrained={true}
                />, initialState,
            );

            //no permission is given, invite link should not be in the dom
            expect(screen.queryByText('Add other groups to this team')).not.toBeInTheDocument();

            const beginningHeading = screen.getByText('Beginning of test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');
            expect(screen.getByText('Welcome to test channel!')).toBeInTheDocument();
            expect(screen.getByText('Post messages here that you want everyone to see. Everyone automatically becomes a permanent member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
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
            renderWithIntlAndStore(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );
            expect(screen.getByText('Beginning of off-topic')).toBeInTheDocument();
            screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.');
            expect(screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.')).toHaveClass('channel-intro__content');

            // stats.total_users_count is not specified, loading icon should be in the dom
            screen.getByTitle('Loading Icon');
        });
    });
});

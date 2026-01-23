// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    test('should render channel header text when header exists for a channel', () => {
        const channel = TestHelper.getChannelMock({header: 'Test Header'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
    });

    test('should render channel header of bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('Tranquility')).toBeInTheDocument();
    });

    test('should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null if its a bot DM channels and its description is empty', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should show add header button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Add a channel header')).toBeInTheDocument();
    });

    test('should show add header button for GM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Add a channel header')).toBeInTheDocument();
    });

    test('should not show add header button when user lacks permission and channel doesn not have header', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const state = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                roles: {
                    roles: {
                        channel_user: {
                            permissions: [],
                        },
                    },
                },
            },
        };

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByText('Add a channel header')).not.toBeInTheDocument();
    });

    test('should show add header button when user has permission and channel does not have header', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const state = {
            entities: {
                channels: {
                    myMembers: {
                        [channel.id]: {channel_id: channel.id, roles: 'channel_role'},
                    },
                    roles: {
                        [channel.id]: new Set(['channel_role']),
                    },
                },
                teams: {
                    myMembers: {
                        [defaultTeamId]: {team_id: defaultTeamId, roles: 'team_role'},
                    },
                },
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: {
                            id: 'user_id',
                            roles: 'system_role',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission']},
                        team_role: {permissions: ['test_team_permission']},
                        channel_role: {permissions: ['manage_public_channel_properties']},
                    },
                },
            },
        };

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByText('Add a channel header')).toBeInTheDocument();
    });
});

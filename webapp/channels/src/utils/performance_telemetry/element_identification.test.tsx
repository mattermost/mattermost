// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import type {AutoSizerProps} from 'react-virtualized-auto-sizer';

import {Permissions} from 'mattermost-redux/constants';

import ChannelController from 'components/channel_layout/channel_controller';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {identifyElementRegion} from './element_identification';

jest.mock('react-virtualized-auto-sizer', () => (props: AutoSizerProps) => props.children({height: 100, width: 100}));

describe('identifyElementRegion', () => {
    test('should be able to identify various elements in the app', async () => {
        const team = TestHelper.getTeamMock({
            id: 'test-team-id',
            display_name: 'Test Team',
            name: 'test-team',
        });
        const channel = TestHelper.getChannelMock({
            id: 'test-channel-id',
            team_id: team.id,
            display_name: 'Test Channel',
            header: 'This is the channel header',
            name: 'test-channel',
        });
        const channelsCategory = TestHelper.getCategoryMock({
            team_id: team.id,
            channel_ids: [channel.id],
        });
        const user = TestHelper.getUserMock({
            id: 'test-user-id',
            roles: 'system_admin system_user',
            timezone: {
                useAutomaticTimezone: 'true',
                automaticTimezone: 'America/New_York',
                manualTimezone: '',
            },
        });
        const post = TestHelper.getPostMock({
            id: 'test-post-id',
            channel_id: channel.id,
            user_id: user.id,
            message: 'This is a test post',
            type: '',
        });

        const history = createMemoryHistory({
            initialEntries: [
                {pathname: `/${team.name}/channels/${channel.name}`},
            ],
        });

        renderWithContext(
            <ChannelController shouldRenderCenterChannel={true}/>,
            {
                entities: {
                    channelCategories: {
                        byId: {
                            [channelsCategory.id]: channelsCategory,
                        },
                        orderByTeam: {
                            [team.id]: [channelsCategory.id],
                        },
                    },
                    channels: {
                        currentChannelId: channel.id,
                        channels: {
                            [channel.id]: channel,
                        },
                        channelsInTeam: {
                            [team.id]: new Set([channel.id]),
                        },
                        messageCounts: {
                            [channel.id]: {},
                        },
                        myMembers: {
                            [channel.id]: TestHelper.getChannelMembershipMock({
                                channel_id: channel.id,
                                user_id: user.id,
                                roles: 'system_admin',
                            }),
                        },
                    },
                    posts: {
                        posts: {
                            [post.id]: post,
                        },
                        postsInChannel: {
                            [channel.id]: [
                                {oldest: true, order: [post.id], recent: true},
                            ],
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: TestHelper.getRoleMock({
                                permissions: [Permissions.CREATE_POST],
                            }),
                        },
                    },
                    teams: {
                        currentTeamId: team.id,
                        myMembers: {
                            [team.id]: TestHelper.getTeamMembershipMock({
                                team_id: team.id,
                                user_id: user.id,
                            }),
                        },
                        teams: {
                            [team.id]: team,
                        },
                    },
                    users: {
                        currentUserId: user.id,
                        profiles: {
                            [user.id]: user,
                        },
                    },
                },
                views: {
                    channel: {
                        lastChannelViewTime: {
                            [channel.id]: 0,
                        },
                    },
                },
            },
            {
                history,
            },
        );

        await waitFor(() => {
            expect(identifyElementRegion(screen.getAllByText(channel.display_name)[0])).toEqual('channel_sidebar');
        });

        expect(identifyElementRegion(screen.getAllByText(channel.display_name)[1])).toEqual('channel_header');
        expect(identifyElementRegion(screen.getAllByText(channel.header)[0])).toEqual('channel_header');

        await waitFor(() => {
            expect(identifyElementRegion(screen.getByText(post.message))).toEqual('post');
        });

        expect(identifyElementRegion(screen.getByPlaceholderText('Write to ' + channel.display_name))).toEqual('post_textbox');
    });
});

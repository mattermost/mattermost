// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import type {Props as AutoSizerProps} from 'react-virtualized-auto-sizer';

import {Permissions} from 'mattermost-redux/constants';

import ChannelController from 'components/channel_layout/channel_controller';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {identifyElementRegion} from './element_identification';

jest.mock('react-virtualized-auto-sizer', () => (props: AutoSizerProps) => props.children({height: 100, width: 100, scaledHeight: 100, scaledWidth: 100}));

describe('identifyElementRegion', () => {
    // This test has become increasingly unreliable since we upgraded to React 18, so disable it for the time being
    // eslint-disable-next-line no-only-tests/no-only-tests
    test.skip('should be able to identify various elements in the app', async () => {
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

        const lhsChannel = await screen.findByLabelText(`${channel.display_name.toLowerCase()} public channel`);
        const channelHeaderText = await screen.findByText(channel.header);
        const postTextbox = await screen.findByPlaceholderText('Write to ' + channel.display_name);
        const postText = await screen.findByText(post.message);

        expect(lhsChannel).toBeInTheDocument();
        expect(identifyElementRegion(lhsChannel)).toEqual('channel_sidebar');

        const channelHeaderTitle = document.getElementById('channelHeaderTitle');
        expect(channelHeaderTitle).toBeInTheDocument();

        expect(channelHeaderText).toBeInTheDocument();
        expect(identifyElementRegion(channelHeaderText)).toEqual('channel_header');

        expect(postText).toBeInTheDocument();
        expect(identifyElementRegion(postText)).toEqual('post');

        expect(postTextbox).toBeInTheDocument();
        expect(identifyElementRegion(postTextbox!)).toEqual('post_textbox');
    });
});

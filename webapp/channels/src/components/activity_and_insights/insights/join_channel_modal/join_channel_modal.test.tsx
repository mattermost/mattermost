// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostType} from '@mattermost/types/posts';
import {ReactWrapper} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import JoinChannelModal from './join_channel_modal';

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

describe('components/activity_and_insights/insights/join_channel_modal', () => {
    const props = {
        thread: {
            channel_id: 'channel1',
            channel_display_name: 'nostrum',
            channel_name: 'channel1',
            participants: [
                'user1',
            ],
            user_information: {
                id: 'user1',
                last_picture_update: 0,
                first_name: 'Kathryn',
                last_name: 'Mills',
            },
            post: {
                id: 'post1',
                create_at: 1653488972484,
                update_at: 1653489070820,
                edit_at: 0,
                delete_at: 0,
                is_pinned: false,
                user_id: 'user1',
                channel_id: 'channel1',
                root_id: '',
                original_id: '',
                message: 'ducimus sed aut sunt corrupti necessitatibus quasi.\nreiciendis ipsa consequuntur fugiat a eaque.',
                type: '' as PostType,
                props: {},
                hashtags: '',
                pending_post_id: '',
                reply_count: 18,
                last_reply_at: 0,
                participants: null,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                    reactions: [],
                },
            },
        },
        onExited: jest.fn(),
        currentTeamId: 'team_id1',
    };

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            channels: {
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team_id1',
                        name: 'channel1',
                    },
                },
                myMembers: {},
            },
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                    },
                    user1: {
                        id: 'user1',
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            groups: {
                groups: {},
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
        },
    };

    test('should match snapshot', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <JoinChannelModal
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.text().includes('You\'ll need to join the nostrum channel to see this thread. Do you want to join nostrum now?')).toBe(true);
    });
});

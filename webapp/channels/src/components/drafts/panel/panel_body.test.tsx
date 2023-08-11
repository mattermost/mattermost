// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {PostPriority} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import type {PostDraft} from 'types/store/draft';
import * as utils from 'utils/utils';

import PanelBody from './panel_body';

describe('components/drafts/panel/panel_body', () => {
    const baseProps = {
        channelId: 'channel_id',
        displayName: 'display_name',
        fileInfos: [] as PostDraft['fileInfos'],
        message: 'message',
        status: 'status' as UserStatus['status'],
        uploadsInProgress: [] as PostDraft['uploadsInProgress'],
        userId: 'user_id' as UserProfile['id'],
        username: 'username' as UserProfile['username'],
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            posts: {
                posts: {
                    root_id: {id: 'root_id', channel_id: 'channel_id'},
                },
            },
            channels: {
                currentChannelId: 'channel_id',
                channels: {
                    channel_id: {id: 'channel_id', team_id: 'team_id'},
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
            users: {
                currentUserId: 'userid1',
                profiles: {userid1: {id: 'userid1', username: 'username1', roles: 'system_user'}},
                profilesInChannel: {},
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: {
                        id: 'team_id',
                        name: 'team-id',
                        display_name: 'Team ID',
                    },
                },
            },
        },
    };

    it('should match snapshot', () => {
        const store = mockStore(initialState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <PanelBody
                    {...baseProps}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for requested_ack', () => {
        const store = mockStore(initialState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <PanelBody
                    {...baseProps}
                    priority={{
                        priority: '',
                        requested_ack: true,
                    }}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for priority', () => {
        const store = mockStore(initialState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <PanelBody
                    {...baseProps}
                    priority={{
                        priority: PostPriority.IMPORTANT,
                        requested_ack: false,
                    }}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should have called handleFormattedTextClick', () => {
        const handleClickSpy = jest.spyOn(utils, 'handleFormattedTextClick');
        const store = mockStore(initialState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <PanelBody
                    {...baseProps}
                />
            </Provider>,
        );

        wrapper.find('div.post__content').simulate('click');
        expect(handleClickSpy).toHaveBeenCalledTimes(1);
        expect(wrapper).toMatchSnapshot();
    });
});

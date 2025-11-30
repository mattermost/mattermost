// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {PostPriority} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import * as utils from 'utils/utils';

import type {PostDraft} from 'types/store/draft';

import PanelBody from './panel_body';

describe('components/drafts/panel/panel_body', () => {
    const baseProps: ComponentProps<typeof PanelBody> = {
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
        views: {
            rhs: {
                isSidebarExpanded: false,
                isSidebarOpen: false,
            },
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <PanelBody
                {...baseProps}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for requested_ack', () => {
        const {container} = renderWithContext(
            <PanelBody
                {...baseProps}
                priority={{
                    priority: '',
                    requested_ack: true,
                }}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for priority', () => {
        const {container} = renderWithContext(
            <PanelBody
                {...baseProps}
                priority={{
                    priority: PostPriority.IMPORTANT,
                    requested_ack: false,
                }}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should have called handleFormattedTextClick', () => {
        const handleClickSpy = vi.spyOn(utils, 'handleFormattedTextClick');

        renderWithContext(
            <PanelBody
                {...baseProps}
            />,
            initialState,
        );

        const postContent = screen.getByText('message');
        fireEvent.click(postContent);
        expect(handleClickSpy).toHaveBeenCalledTimes(1);
    });
});

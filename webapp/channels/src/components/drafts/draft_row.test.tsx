// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {PostType} from '@mattermost/types/posts';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';

import type {PostDraft} from 'types/store/draft';

import DraftRow from './draft_row';

jest.mock('components/advanced_text_editor/use_priority', () => () => ({onSubmitCheck: jest.fn()}));
jest.mock('components/advanced_text_editor/use_submit', () => () => [jest.fn()]);
jest.mock('components/drafts/draft_actions', () => () => <div>{'Draft Actions'}</div>);
jest.mock('components/drafts/draft_title', () => () => <div>{'Draft Title'}</div>);
jest.mock('components/drafts/panel/panel_body', () => () => <div>{'Panel Body'}</div>);
jest.mock('components/drafts/draft_actions/schedule_post_actions/scheduled_post_actions', () => () => (
    <div>{'Scheduled Post Actions'}</div>
));
jest.mock('components/edit_scheduled_post', () => () => <div>{'Edit Scheduled Post'}</div>);
jest.mock('components/drafts/placeholder_scheduled_post_title/placeholder_scheduled_posts_title', () => () => (
    <div>{'Placeholder Scheduled Post Title'}</div>
));
jest.mock('mattermost-redux/actions/posts', () => ({
    getPost: () => jest.fn(),
}));
jest.mock('mattermost-redux/actions/scheduled_posts', () => ({
    deleteScheduledPost: () => jest.fn(),
    updateScheduledPost: () => jest.fn(),
}));
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: () => true,
}));
jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/channels'),
    isDeactivatedDirectChannel: () => false,
}));

describe('components/drafts/drafts_row', () => {
    const channelId = 'channel_id';
    const teamId = 'team_id';
    const channel = {
        id: channelId,
        team_id: teamId,
        name: 'channel-name',
        display_name: 'Channel Name',
        type: 'O' as ChannelType,
        delete_at: 0,
    };
    const initialState = {
        entities: {
            channels: {channels: {[channelId]: channel}},
            teams: {
                currentTeamId: teamId,
                teams: {[teamId]: {id: teamId, name: 'team-name'}},
            },
            general: {
                config: {
                    MaxPostSize: '16383',
                    BurnOnReadDurationSeconds: '600',
                },
                license: {},
            },
            posts: {posts: {}},
        },
        websocket: {connectionId: 'connection_id'},
    };

    const baseProps: ComponentProps<typeof DraftRow> = {
        item: {
            message: 'draft message',
            updateAt: 1234,
            createAt: 1234,
            fileInfos: [],
            uploadsInProgress: [],
            channelId,
            rootId: '',
            type: 'standard' as PostType,
        } as PostDraft,
        user: {id: 'user_id', username: 'username'} as UserProfile,
        status: 'online' as UserStatus['status'],
        displayName: 'test',
        isRemote: false,

    };

    it('should match snapshot for channel draft', () => {
        const {container} = renderWithContext(
            <DraftRow
                {...baseProps}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread draft', () => {
        const props = {
            ...baseProps,
            item: {
                ...baseProps.item,
                rootId: 'some_id',
            } as PostDraft,
        };

        const {container} = renderWithContext(
            <DraftRow
                {...props}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});

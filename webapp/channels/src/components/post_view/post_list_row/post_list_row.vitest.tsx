// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {CloudUsage} from '@mattermost/types/cloud';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {PostListRowListIds} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostListRow from './post_list_row';

// Mock complex connected components
vi.mock('components/post', () => ({
    __esModule: true,
    default: ({post}: {post: {id: string}}) => <div data-testid='post-component'>{'Post: '}{post?.id}</div>,
}));

vi.mock('components/post_view/combined_user_activity_post', () => ({
    __esModule: true,
    default: ({combinedId}: {combinedId: string}) => <div data-testid='combined-user-activity-post'>{'Combined: '}{combinedId}</div>,
}));

vi.mock('components/post_view/channel_intro_message', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-intro-message'>{'Channel Intro Message'}</div>,
}));

describe('components/post_view/post_list_row', () => {
    const defaultProps = {
        listId: '1234',
        loadOlderPosts: vi.fn(),
        loadNewerPosts: vi.fn(),
        togglePostMenu: vi.fn(),
        isLastPost: false,
        shortcutReactToLastPostEmittedFrom: 'NO_WHERE',
        loadingNewerPosts: false,
        loadingOlderPosts: false,
        isCurrentUserLastPostGroupFirstPost: false,
        actions: {
            emitShortcutReactToLastPostFrom: vi.fn(),
        },
        channelLimitExceeded: false,
        limitsLoaded: false,
        limits: {},
        usage: {} as CloudUsage,
        post: TestHelper.getPostMock({id: 'post_id_1'}),
        currentUserId: 'user_id_1',
        newMessagesSeparatorActions: [],
        channelId: 'channel_id_1',
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'user_id_1',
                profiles: {},
            },
            channels: {
                currentChannelId: 'channel_id_1',
                channels: {},
            },
            teams: {
                currentTeamId: 'team_id_1',
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                posts: {},
            },
        },
    } as any;

    test('should render more messages loading indicator', () => {
        const listId = PostListRowListIds.OLDER_MESSAGES_LOADER;
        const props = {
            ...defaultProps,
            listId,
            loadingOlderPosts: true,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render manual load messages trigger', () => {
        const listId = PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER;
        const loadOlderPosts = vi.fn();
        const props = {
            ...defaultProps,
            listId,
            loadOlderPosts,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
        const button = screen.getByRole('button');
        button.click();
        expect(loadOlderPosts).toHaveBeenCalledTimes(1);
    });

    test('should render channel intro message', () => {
        const listId = PostListRowListIds.CHANNEL_INTRO_MESSAGE;
        const props = {
            ...defaultProps,
            channel: {
                id: '123',
                name: 'test-channel-1',
                display_name: 'Test Channel 1',
                type: ('P' as ChannelType),
                team_id: 'team-1',
                header: '',
                purpose: '',
                creator_id: '',
                scheme_id: '',
                group_constrained: false,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                last_post_at: 0,
                last_root_post_at: 0,
            },
            fullWidth: true,
            listId,
        };

        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();

        // ChannelIntroMessage component should be rendered (mocked)
        expect(screen.getByTestId('channel-intro-message')).toBeInTheDocument();
    });

    test('should render new messages line', () => {
        const listId = PostListRowListIds.START_OF_NEW_MESSAGES + '1553106600000';
        const props = {
            ...defaultProps,
            listId,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByText('New Messages')).toBeInTheDocument();
    });

    test('should render date line', () => {
        const listId = `${PostListRowListIds.DATE_LINE}1553106600000`;
        const props = {
            ...defaultProps,
            listId,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render combined post', () => {
        const props = {
            ...defaultProps,
            shouldHighlight: false,
            listId: `${PostListUtils.COMBINED_USER_ACTIVITY}1234-5678`,
            previousListId: 'abcd',
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render post', () => {
        const props = {
            ...defaultProps,
            shouldHighlight: false,
            listId: 'post_id_1',
            previousListId: 'abcd',
        };
        const stateWithPost = {
            ...initialState,
            entities: {
                ...initialState.entities,
                posts: {
                    posts: {
                        post_id_1: TestHelper.getPostMock({id: 'post_id_1'}),
                    },
                },
            },
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            stateWithPost,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have class hideAnimation for OLDER_MESSAGES_LOADER if loadingOlderPosts is false', () => {
        const listId = PostListRowListIds.OLDER_MESSAGES_LOADER;
        const props = {
            ...defaultProps,
            listId,
            loadingOlderPosts: false,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have class hideAnimation for NEWER_MESSAGES_LOADER if loadingNewerPosts is false', () => {
        const listId = PostListRowListIds.NEWER_MESSAGES_LOADER;
        const props = {
            ...defaultProps,
            listId,
            loadingNewerPosts: false,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {CloudUsage} from '@mattermost/types/cloud';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {PostListRowListIds} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostListRow from './post_list_row';

jest.mock('components/post', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid='post'>{`Post: ${props.post?.id}`}</div>,
}));

jest.mock('components/post_view/channel_intro_message/', () => ({
    __esModule: true,
    default: () => <div data-testid='channel-intro-message'>{'ChannelIntroMessage'}</div>,
}));

jest.mock('components/post_view/combined_user_activity_post', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid='combined-user-activity'>{`CombinedUserActivityPost: ${props.combinedId}`}</div>,
}));

jest.mock('components/post_view/date_separator', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid='date-separator'>{`DateSeparator: ${props.date}`}</div>,
}));

jest.mock('components/post_view/new_message_separator/new_message_separator', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid='new-message-separator'>{`NewMessageSeparator: ${props.separatorId}`}</div>,
}));

jest.mock('components/center_message_lock', () => ({
    __esModule: true,
    default: () => <div data-testid='center-message-lock'>{'CenterMessageLock'}</div>,
}));

describe('components/post_view/post_list_row', () => {
    const defaultProps = {
        listId: '1234',
        loadOlderPosts: jest.fn(),
        loadNewerPosts: jest.fn(),
        togglePostMenu: jest.fn(),
        isLastPost: false,
        shortcutReactToLastPostEmittedFrom: 'NO_WHERE',
        loadingNewerPosts: false,
        loadingOlderPosts: false,
        isCurrentUserLastPostGroupFirstPost: false,
        actions: {
            emitShortcutReactToLastPostFrom: jest.fn(),
        },
        channelLimitExceeded: false,
        limitsLoaded: false,
        limits: {},
        usage: {} as CloudUsage,
        post: TestHelper.getPostMock({id: 'post_id_1'}),
        currentUserId: 'user_id_1',
        newMessagesSeparatorActions: [],
        channelId: 'channel_id_1',
        isChannelAutotranslated: false,
    };

    test('should render more messages loading indicator', () => {
        const listId = PostListRowListIds.OLDER_MESSAGES_LOADER;
        const props = {
            ...defaultProps,
            listId,
            loadingOlderPosts: true,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render manual load messages trigger', async () => {
        const listId = PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER;
        const loadOlderPosts = jest.fn();
        const props = {
            ...defaultProps,
            listId,
            loadOlderPosts,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
        );
        expect(container).toMatchSnapshot();
        await userEvent.click(screen.getByRole('button'));
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
        );
        expect(container).toMatchSnapshot();
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
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('new-message-separator')).toBeInTheDocument();
    });

    test('should render date line', () => {
        const listId = `${PostListRowListIds.DATE_LINE}1553106600000`;
        const props = {
            ...defaultProps,
            listId,
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('date-separator')).toBeInTheDocument();
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
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('combined-user-activity')).toBeInTheDocument();
    });

    test('should render post', () => {
        const props = {
            ...defaultProps,
            shouldHighlight: false,
            listId: '1234',
            previousListId: 'abcd',
        };
        const {container} = renderWithContext(
            <PostListRow {...props}/>,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('post')).toBeInTheDocument();
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
        );
        expect(container).toMatchSnapshot();
    });
});

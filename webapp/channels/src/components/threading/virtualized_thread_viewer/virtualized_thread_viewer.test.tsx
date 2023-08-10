// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import VirtualizedThreadViewer from './virtualized_thread_viewer';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

describe('components/threading/VirtualizedThreadViewer', () => {
    const post: Post = TestHelper.getPostMock({
        channel_id: 'channel_id',
        create_at: 1502715365009,
        update_at: 1502715372443,
        is_following: true,
        reply_count: 3,
    });

    const channel: Channel = TestHelper.getChannelMock({
        display_name: '',
        name: '',
        header: '',
        purpose: '',
        creator_id: '',
        scheme_id: '',
        teammate_id: '',
        status: '',
    });

    const actions = {
        removePost: jest.fn(),
        selectPostCard: jest.fn(),
        getPostThread: jest.fn(),
        getThread: jest.fn(),
        updateThreadRead: jest.fn(),
        updateThreadLastOpened: jest.fn(),
        fetchRHSAppsBindings: jest.fn(),
    };

    const directTeammate: UserProfile = TestHelper.getUserMock();

    const baseProps = {
        selected: post,
        channel,
        currentUserId: 'user_id',
        currentTeamId: 'team_id',
        previewCollapsed: 'false',
        previewEnabled: true,
        socketConnectionStatus: true,
        actions,
        directTeammate,
        isCollapsedThreadsEnabled: false,
        posts: [post],
        lastPost: post,
        onCardClick: () => {},
        onCardClickPost: () => {},
        replyListIds: [],
        teamId: '',
        useRelativeTimestamp: true,
        isThreadView: true,
    };
    test('should scroll to the bottom when the current user makes a new post in the thread', () => {
        const scrollToBottom = jest.fn();

        const wrapper = shallow(
            <VirtualizedThreadViewer {...baseProps}/>,
        );
        const instance = wrapper.instance() as VirtualizedThreadViewer;
        instance.scrollToBottom = scrollToBottom;

        expect(scrollToBottom).not.toHaveBeenCalled();
        wrapper.setProps({
            lastPost:
                {
                    id: 'newpost',
                    root_id: post.id,
                    user_id: 'user_id',
                },
        });

        expect(scrollToBottom).toHaveBeenCalled();
    });

    test('should not scroll to the bottom when another user makes a new post in the thread', () => {
        const scrollToBottom = jest.fn();

        const wrapper = shallow(
            <VirtualizedThreadViewer {...baseProps}/>,
        );
        const instance = wrapper.instance() as VirtualizedThreadViewer;
        instance.scrollToBottom = scrollToBottom;

        expect(scrollToBottom).not.toHaveBeenCalled();

        wrapper.setProps({
            lastPost:
                {
                    id: 'newpost',
                    root_id: post.id,
                    user_id: 'other_user_id',
                },
        });

        expect(scrollToBottom).not.toHaveBeenCalled();
    });

    test('should not scroll to the bottom when there is a highlighted reply', () => {
        const scrollToBottom = jest.fn();

        const wrapper = shallow(
            <VirtualizedThreadViewer
                {...baseProps}
            />,
        );

        const instance = wrapper.instance() as VirtualizedThreadViewer;
        instance.scrollToBottom = scrollToBottom;

        wrapper.setProps({
            lastPost:
                {
                    id: 'newpost',
                    root_id: post.id,
                    user_id: 'user_id',
                },
            highlightedPostId: '42',
        });

        expect(scrollToBottom).not.toHaveBeenCalled();
    });
});

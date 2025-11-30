// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostSearchResultsItem from './post_search_results_item';

jest.mock('components/post', () => {
    return function PostComponent({post}: {post: any}) {
        return <div>{post.message}</div>;
    };
});

describe('PostSearchResultsItem', () => {
    const team = TestHelper.getTeamMock({id: 'team1'});
    const channel = TestHelper.getChannelMock({id: 'channel1', team_id: team.id});
    const user = TestHelper.getUserMock({id: 'user1'});

    const baseProps = {
        a11yIndex: 0,
        isFlaggedPosts: false,
        isMentionSearch: false,
        isPinnedPosts: false,
        matches: [],
        searchTerm: 'test search',
    };

    const baseState = {
        entities: {
            teams: {
                currentTeamId: team.id,
                teams: {
                    [team.id]: team,
                },
            },
            channels: {
                currentChannelId: channel.id,
                channels: {
                    [channel.id]: channel,
                },
            },
            users: {
                currentUserId: user.id,
                profiles: {
                    [user.id]: user,
                },
            },
            posts: {
                posts: {},
            },
        },
    };

    test('should render regular post without page indicator', () => {
        const post = TestHelper.getPostMock({
            id: 'post1',
            channel_id: channel.id,
            user_id: user.id,
            message: 'This is a regular post',
            type: '',
        });

        renderWithContext(
            <PostSearchResultsItem
                {...baseProps}
                post={post}
            />,
            baseState,
        );

        expect(screen.getByTestId('search-item-container')).toBeInTheDocument();
        expect(screen.queryByText('Wiki Page')).not.toBeInTheDocument();
        expect(screen.getByText('This is a regular post')).toBeInTheDocument();
    });

    test('should render page post with page indicator', () => {
        const pagePost = TestHelper.getPostMock({
            id: 'page1',
            channel_id: channel.id,
            user_id: user.id,
            message: 'This is a wiki page',
            type: PostTypes.PAGE,
        });

        renderWithContext(
            <PostSearchResultsItem
                {...baseProps}
                post={pagePost}
            />,
            baseState,
        );

        expect(screen.getByTestId('search-item-container')).toBeInTheDocument();
        expect(screen.getByText('Wiki Page')).toBeInTheDocument();
        expect(screen.getByText('This is a wiki page')).toBeInTheDocument();
    });

    test('should render page indicator with correct icon', () => {
        const pagePost = TestHelper.getPostMock({
            id: 'page1',
            channel_id: channel.id,
            user_id: user.id,
            message: 'This is a wiki page',
            type: PostTypes.PAGE,
        });

        const {container} = renderWithContext(
            <PostSearchResultsItem
                {...baseProps}
                post={pagePost}
            />,
            baseState,
        );

        const pageIndicator = container.querySelector('.search-item__page-indicator');
        expect(pageIndicator).toBeInTheDocument();

        const icon = pageIndicator?.querySelector('i.icon-file-document-outline');
        expect(icon).toBeInTheDocument();
    });

    test('should not render page indicator for system posts', () => {
        const systemPost = TestHelper.getPostMock({
            id: 'system1',
            channel_id: channel.id,
            user_id: user.id,
            message: '',
            type: 'system_join_channel',
        });

        renderWithContext(
            <PostSearchResultsItem
                {...baseProps}
                post={systemPost}
            />,
            baseState,
        );

        expect(screen.queryByText('Wiki Page')).not.toBeInTheDocument();
    });

    test('should pass correct props to PostComponent', () => {
        const post = TestHelper.getPostMock({
            id: 'post1',
            channel_id: channel.id,
            user_id: user.id,
            message: 'Test post',
        });

        const matches = ['test', 'match'];
        const searchTerm = 'test search';

        renderWithContext(
            <PostSearchResultsItem
                {...baseProps}
                post={post}
                matches={matches}
                searchTerm={searchTerm}
                isMentionSearch={false}
            />,
            baseState,
        );

        expect(screen.getByText('Test post')).toBeInTheDocument();
    });
});

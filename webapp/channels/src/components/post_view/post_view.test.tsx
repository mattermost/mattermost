// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostList from './post_list';
import PostView from './post_view';

jest.mock('./post_list', () => {
    const MockPostList = jest.fn(() => <div data-testid='post-list-mock'/>);
    return {__esModule: true, default: MockPostList};
});

describe('components/post_view/post_view', () => {
    const baseProps = {
        lastViewedAt: 12345678,
        isFirstLoad: false,
        channelLoading: false,
        channelId: '1234',
        focusedPostId: '12345',
        unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
    };
    jest.useFakeTimers();

    let rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16) as unknown as number);
    beforeEach(() => {
        rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16) as unknown as number);
        (PostList as unknown as jest.Mock).mockClear();
    });

    afterEach(() => {
        rafSpy.mockRestore();
    });

    test('should match snapshot for channel loading', () => {
        const {container} = renderWithContext(<PostView {...{...baseProps, channelLoading: true}}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for loaderForChangeOfPostsChunk', () => {
        const {container} = renderWithContext(<PostView {...baseProps}/>);

        // Get changeUnreadChunkTimeStamp from PostList's last call props
        const postListCalls = (PostList as unknown as jest.Mock).mock.calls;
        const lastCallProps = postListCalls[postListCalls.length - 1][0];

        act(() => {
            lastCallProps.changeUnreadChunkTimeStamp(Date.now());
        });

        // loaderForChangeOfPostsChunk is now true, should show loading
        expect(container).toMatchSnapshot();
    });

    test('unreadChunkTimeStamp should be set for first load of channel', () => {
        renderWithContext(<PostView {...{...baseProps, isFirstLoad: true}}/>);

        // Verify PostList received the correct unreadChunkTimeStamp prop
        const postListCalls = (PostList as unknown as jest.Mock).mock.calls;
        const lastCallProps = postListCalls[postListCalls.length - 1][0];
        expect(lastCallProps.unreadChunkTimeStamp).toEqual(baseProps.lastViewedAt);
    });

    test('changeUnreadChunkTimeStamp', () => {
        renderWithContext(<PostView {...{...baseProps, isFirstLoad: true}}/>);

        // Verify initial unreadChunkTimeStamp
        let postListCalls = (PostList as unknown as jest.Mock).mock.calls;
        let lastCallProps = postListCalls[postListCalls.length - 1][0];
        expect(lastCallProps.unreadChunkTimeStamp).toEqual(baseProps.lastViewedAt);

        // Call changeUnreadChunkTimeStamp
        act(() => {
            lastCallProps.changeUnreadChunkTimeStamp('1234678');
        });

        // loaderForChangeOfPostsChunk should be true now (loading screen shown)
        expect(screen.queryByTestId('post-list-mock')).not.toBeInTheDocument();

        // Run pending timers (rAF callback)
        act(() => {
            jest.runOnlyPendingTimers();
        });

        // loaderForChangeOfPostsChunk should be false now, PostList shown again
        expect(screen.getByTestId('post-list-mock')).toBeInTheDocument();

        // Verify PostList received updated unreadChunkTimeStamp
        postListCalls = (PostList as unknown as jest.Mock).mock.calls;
        lastCallProps = postListCalls[postListCalls.length - 1][0];
        expect(lastCallProps.unreadChunkTimeStamp).toEqual('1234678');
    });
});

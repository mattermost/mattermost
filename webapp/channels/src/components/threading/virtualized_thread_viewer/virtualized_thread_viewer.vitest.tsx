// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {act, renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import VirtualizedThreadViewer from './virtualized_thread_viewer';

// Mock the DynamicVirtualizedList to capture scroll calls
const mockScrollToItem = vi.fn();
vi.mock('components/dynamic_virtualized_list', () => ({
    DynamicVirtualizedList: React.forwardRef((_props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
            scrollToItem: mockScrollToItem,
        }));

        // Don't render children - we're only testing scroll behavior
        return <div data-testid='mock-virtualized-list'/>;
    }),
}));

// Mock AutoSizer to render children with fixed dimensions
vi.mock('react-virtualized-auto-sizer', () => ({
    default: ({children}: {children: (size: {width: number; height: number}) => React.ReactNode}) => (
        <div>{children({width: 500, height: 500})}</div>
    ),
}));

type Props = ComponentProps<typeof VirtualizedThreadViewer>;
function getBasePropsAndState(): [Props, DeepPartial<GlobalState>] {
    const channel = TestHelper.getChannelMock();
    const currentUser = TestHelper.getUserMock({roles: 'role'});
    const post = TestHelper.getPostMock({
        channel_id: channel.id,
        reply_count: 0,
    });

    const directTeammate: UserProfile = TestHelper.getUserMock();
    const props: Props = {
        selected: post,
        currentUserId: 'user_id',
        directTeammate,
        lastPost: post,
        onCardClick: () => {},
        replyListIds: ['create-comment'],
        useRelativeTimestamp: true,
        isMobileView: false,
        isThreadView: false,
        newMessagesSeparatorActions: [],
        measureRhsOpened: vi.fn(),
    };

    const state: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            posts: {
                posts: {
                    [post.id]: post,
                },
            },
            channels: {
                channels: {
                    [channel.id]: channel,
                },
            },
            roles: {
                roles: {
                    role: {
                        id: 'role',
                        name: 'role',
                        permissions: [Permissions.CREATE_POST, Permissions.USE_CHANNEL_MENTIONS],
                    },
                },
            },
        },
    };
    return [props, state];
}

describe('components/threading/VirtualizedThreadViewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should scroll to the bottom when the current user makes a new post in the thread', async () => {
        const [baseProps, state] = getBasePropsAndState();

        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            state,
        );

        // Clear initial scroll calls from mount
        mockScrollToItem.mockClear();

        // Simulate new post from current user
        await act(async () => {
            rerender(
                <VirtualizedThreadViewer
                    {...baseProps}
                    lastPost={{
                        id: 'newpost',
                        root_id: baseProps.selected.id,
                        user_id: 'user_id', // current user
                    } as any}
                />,
            );
        });

        // scrollToBottom calls scrollToItem(0, 'end', undefined)
        expect(mockScrollToItem).toHaveBeenCalledWith(0, 'end', undefined);
    });

    test('should not scroll to the bottom when another user makes a new post in the thread', async () => {
        const [baseProps, state] = getBasePropsAndState();

        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            state,
        );

        // Clear initial scroll calls from mount
        mockScrollToItem.mockClear();

        // Simulate new post from another user
        await act(async () => {
            rerender(
                <VirtualizedThreadViewer
                    {...baseProps}
                    lastPost={{
                        id: 'newpost',
                        root_id: baseProps.selected.id,
                        user_id: 'other_user_id', // different user
                    } as any}
                />,
            );
        });

        // Should not scroll since it's from another user
        expect(mockScrollToItem).not.toHaveBeenCalled();
    });

    test('should not scroll to the bottom when there is a highlighted reply', async () => {
        const [baseProps, state] = getBasePropsAndState();

        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            state,
        );

        // Clear initial scroll calls from mount
        mockScrollToItem.mockClear();

        // Simulate new post from current user BUT with highlighted post
        await act(async () => {
            rerender(
                <VirtualizedThreadViewer
                    {...baseProps}
                    lastPost={{
                        id: 'newpost',
                        root_id: baseProps.selected.id,
                        user_id: 'user_id',
                    } as any}
                    highlightedPostId='42'
                />,
            );
        });

        // When there's a highlightedPostId, scrollToHighlightedPost is called instead of scrollToBottom
        // scrollToHighlightedPost scrolls to the highlighted post's index, not to bottom (0, 'end')
        const scrollToBottomCalls = mockScrollToItem.mock.calls.filter(
            (call) => call[0] === 0 && call[1] === 'end',
        );
        expect(scrollToBottomCalls).toHaveLength(0);
    });
});

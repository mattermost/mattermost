// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import VirtualizedThreadViewer from './virtualized_thread_viewer';

const mockScrollToItem = jest.fn();

jest.mock('components/dynamic_virtualized_list', () => {
    const ReactMock = require('react');
    return {
        DynamicVirtualizedList: ReactMock.forwardRef((props: any, ref: any) => {
            ReactMock.useImperativeHandle(ref, () => ({
                scrollToItem: mockScrollToItem,
            }));
            return <div data-testid='virtualized-list'/>;
        }),
    };
});

jest.mock('./create_comment', () => () => <div data-testid='create-comment'/>);
jest.mock('./thread_viewer_row', () => () => <div data-testid='thread-viewer-row'/>);
jest.mock('components/new_replies_banner', () => () => null);
jest.mock('components/post_view/floating_timestamp', () => () => null);

// Mocks below are used only by the ThreadViewerRow describe at the bottom. They
// are declared module-level so jest hoists them ahead of imports inside
// jest.isolateModules.
jest.mock('components/post', () => (props: any) => (
    <div
        data-testid='post-component'
        data-post-id={props.postId}
    />
));
jest.mock('components/root_post_divider/root_post_divider', () => (props: any) => (
    <div
        data-testid='root-post-divider'
        data-post-id={props.postId}
    />
));
jest.mock('components/rhs_post_properties_panel', () => (props: any) => (
    <div
        data-testid='rhs-post-properties-panel'
        data-post-id={props.postId}
        data-channel-id={props.channelId}
    />
));

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
        measureRhsOpened: jest.fn(),
        isChannelAutotranslated: false,
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
    const [baseProps, baseState] = getBasePropsAndState();

    beforeEach(() => {
        mockScrollToItem.mockClear();
    });

    test('should scroll to the bottom when the current user makes a new post in the thread', () => {
        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            baseState,
        );

        mockScrollToItem.mockClear();

        rerender(
            <VirtualizedThreadViewer
                {...baseProps}
                lastPost={TestHelper.getPostMock({
                    id: 'newpost',
                    root_id: baseProps.selected.id,
                    user_id: 'user_id',
                })}
            />,
        );

        expect(mockScrollToItem).toHaveBeenCalledWith(0, 'end', undefined);
    });

    test('should not scroll to the bottom when another user makes a new post in the thread', () => {
        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            baseState,
        );

        mockScrollToItem.mockClear();

        rerender(
            <VirtualizedThreadViewer
                {...baseProps}
                lastPost={TestHelper.getPostMock({
                    id: 'newpost',
                    root_id: baseProps.selected.id,
                    user_id: 'other_user_id',
                })}
            />,
        );

        expect(mockScrollToItem).not.toHaveBeenCalled();
    });

    test('should not scroll to the bottom when there is a highlighted reply', () => {
        const {rerender} = renderWithContext(
            <VirtualizedThreadViewer {...baseProps}/>,
            baseState,
        );

        mockScrollToItem.mockClear();

        rerender(
            <VirtualizedThreadViewer
                {...baseProps}
                lastPost={TestHelper.getPostMock({
                    id: 'newpost',
                    root_id: baseProps.selected.id,
                    user_id: 'user_id',
                })}
                highlightedPostId='42'
            />,
        );

        expect(mockScrollToItem).not.toHaveBeenCalledWith(0, 'end', undefined);
    });
});

describe('components/threading/ThreadViewerRow', () => {
    // Use the real module instead of the hoisted mock for VTV's renderRow.
    const ThreadViewerRow = jest.requireActual('./thread_viewer_row').default;

    const post = TestHelper.getPostMock({
        id: 'root_post_id',
        channel_id: 'channel_id_xyz',
    });

    const state: DeepPartial<GlobalState> = {
        entities: {
            posts: {
                posts: {
                    [post.id]: post,
                },
            },
        },
    };

    const baseProps = {
        a11yIndex: 0,
        isRootPost: true,
        isDeletedPost: false,
        isLastPost: false,
        listId: post.id,
        onCardClick: jest.fn(),
        previousPostId: '',
        threadId: post.id,
        newMessagesSeparatorActions: [],
        isChannelAutotranslated: false,
    };

    test('mounts the rhs post properties panel between the post component and the root divider on the root post', () => {
        const {container, queryByTestId} = renderWithContext(
            <ThreadViewerRow {...baseProps}/>,
            state,
        );

        const postEl = queryByTestId('post-component');
        const panel = queryByTestId('rhs-post-properties-panel');
        const divider = queryByTestId('root-post-divider');

        expect(postEl).toBeInTheDocument();
        expect(panel).toBeInTheDocument();
        expect(divider).toBeInTheDocument();

        // Panel receives the post's channel_id
        expect(panel).toHaveAttribute('data-post-id', post.id);
        expect(panel).toHaveAttribute('data-channel-id', post.channel_id);

        // Order in the DOM: post -> panel -> divider
        const order = Array.from(container.querySelectorAll('[data-testid]')).
            map((el) => el.getAttribute('data-testid'));
        const iPost = order.indexOf('post-component');
        const iPanel = order.indexOf('rhs-post-properties-panel');
        const iDivider = order.indexOf('root-post-divider');
        expect(iPost).toBeLessThan(iPanel);
        expect(iPanel).toBeLessThan(iDivider);
    });

    test('does not render the root divider on a deleted root post but still renders the panel', () => {
        const {queryByTestId} = renderWithContext(
            <ThreadViewerRow
                {...baseProps}
                isDeletedPost={true}
            />,
            state,
        );

        expect(queryByTestId('post-component')).toBeInTheDocument();
        expect(queryByTestId('rhs-post-properties-panel')).toBeInTheDocument();
        expect(queryByTestId('root-post-divider')).not.toBeInTheDocument();
    });
});

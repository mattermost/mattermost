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

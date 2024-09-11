// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

import VirtualizedThreadViewer from './virtualized_thread_viewer';

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
    const [baseProps] = getBasePropsAndState();
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
                    root_id: baseProps.selected.id,
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
                    root_id: baseProps.selected.id,
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
                    root_id: baseProps.selected.id,
                    user_id: 'user_id',
                },
            highlightedPostId: '42',
        });

        expect(scrollToBottom).not.toHaveBeenCalled();
    });
});


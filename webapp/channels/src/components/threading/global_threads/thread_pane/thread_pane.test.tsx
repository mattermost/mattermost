// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {shallow} from 'enzyme';
import React, {ComponentProps} from 'react';

import {setThreadFollow} from 'mattermost-redux/actions/threads';

import Button from 'components/threading/common/button';
import FollowButton from 'components/threading/common/follow_button';
import Header from 'components/widgets/header';

import TestHelper from 'packages/mattermost-redux/test/test_helper';

import ThreadPane from './thread_pane';

jest.mock('mattermost-redux/actions/threads');

const mockRouting = {
    currentUserId: 'uid',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
    select: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/threading/global_threads/thread_pane', () => {
    let props: ComponentProps<typeof ThreadPane>;
    let mockThread: typeof props['thread'];

    beforeEach(() => {
        mockThread = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            post: {
                user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            },
        } as typeof props['thread'];

        props = {
            thread: mockThread,
        };

        const user1 = TestHelper.fakeUserWithId('uid');
        const profiles: Record<string, UserProfile> = {};
        profiles[user1.id] = user1;

        mockState = {
            entities: {
                general: {
                    config: {},
                },
                preferences: {
                    myPreferences: {},
                },
                posts: {
                    postsInThread: {'1y8hpek81byspd4enyk9mp1ncw': []},
                    posts: {
                        '1y8hpek81byspd4enyk9mp1ncw': {
                            id: '1y8hpek81byspd4enyk9mp1ncw',
                            user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                            channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
                            create_at: 1610486901110,
                            edit_at: 1611786714912,
                        },
                    },
                },
                channels: {
                    channels: {
                        pnzsh7kwt7rmzgj8yb479sc9yw: {
                            id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
                            display_name: 'Team name',
                        },
                    },
                },
                users: {
                    profiles,
                    currentUserId: 'uid',
                },
            },
        };
    });

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ThreadPane {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should support follow', () => {
        props.thread.is_following = false;
        const wrapper = shallow(
            <ThreadPane {...props}/>,
        );
        wrapper.find(Header).shallow().find(FollowButton).shallow().simulate('click');
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, true);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should support unfollow', () => {
        props.thread.is_following = true;
        const wrapper = shallow(
            <ThreadPane {...props}/>,
        );

        wrapper.find(Header).shallow().find(FollowButton).shallow().simulate('click');
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, false);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should support openInChannel', () => {
        const wrapper = shallow(
            <ThreadPane {...props}/>,
        );

        wrapper.find(Header).shallow().find('h3').find(Button).simulate('click');
        expect(mockRouting.goToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should support go back to list', () => {
        const wrapper = shallow(
            <ThreadPane {...props}/>,
        );

        wrapper.find(Header).shallow().find(Button).find('.back').simulate('click');
        expect(mockRouting.select).toHaveBeenCalledWith();
    });
});

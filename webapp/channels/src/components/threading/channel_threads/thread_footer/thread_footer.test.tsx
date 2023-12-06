// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import type {UserThread} from '@mattermost/types/threads';

import Timestamp from 'components/timestamp';
import SimpleTooltip from 'components/widgets/simple_tooltip';
import Avatars from 'components/widgets/users/avatars';

import {fakeDate} from 'tests/helpers/date';
import {mockStore} from 'tests/test_store';

import ThreadFooter from './thread_footer';

import FollowButton from '../../common/follow_button';

describe('components/threading/channel_threads/thread_footer', () => {
    const baseState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'uid',
                profiles: {
                    1: {
                        id: '1',
                        username: 'first.last1',
                        nickname: 'nickname1',
                        first_name: 'First1',
                        last_name: 'Last1',
                    },
                    2: {
                        id: '2',
                        username: 'first.last2',
                        nickname: 'nickname2',
                        first_name: 'First2',
                        last_name: 'Last2',
                    },
                    3: {
                        id: '3',
                        username: 'first.last3',
                        nickname: 'nickname3',
                        first_name: 'First3',
                        last_name: 'Last3',
                    },
                    4: {
                        id: '4',
                        username: 'first.last4',
                        nickname: 'nickname4',
                        first_name: 'First4',
                        last_name: 'Last4',
                    },
                    5: {
                        id: '5',
                        username: 'first.last5',
                        nickname: 'nickname5',
                        first_name: 'First5',
                        last_name: 'Last5',
                    },
                },
            },

            teams: {
                currentTeamId: 'tid',
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                posts: {
                    postthreadid: {
                        id: 'postthreadid',
                        reply_count: 9,
                        last_reply_at: 1554161504000,
                        is_following: true,
                        channel_id: 'cid',
                        user_id: '1',
                    },
                    singlemessageid: {
                        id: 'singlemessageid',
                        reply_count: 0,
                        last_reply_at: 0,
                        is_following: true,
                        channel_id: 'cid',
                        user_id: '1',
                    },
                },
            },

            threads: {
                threads: {
                    postthreadid: {
                        id: 'postthreadid',
                        participants: [
                            {id: '1'},
                            {id: '2'},
                            {id: '3'},
                            {id: '4'},
                            {id: '5'},
                        ],
                        reply_count: 9,
                        unread_replies: 0,
                        unread_mentions: 0,
                        last_reply_at: 1554161504000,
                        last_viewed_at: 1554161505000,
                        is_following: true,
                        post: {
                            channel_id: 'cid',
                            user_id: '1',
                        },
                    },
                },
            },
        },
    };

    let resetFakeDate: () => void;
    let state: any;
    let thread: UserThread;
    let props: ComponentProps<typeof ThreadFooter>;

    beforeEach(() => {
        resetFakeDate = fakeDate(new Date('2020-05-03T13:20:00Z'));
        state = {...baseState};
        thread = state.entities.threads.threads.postthreadid;
        props = {threadId: thread.id};
    });

    afterEach(() => {
        resetFakeDate();
    });

    test('should report total number of replies', () => {
        const {mountOptions} = mockStore(state);

        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.exists('.dot-unreads')).toBe(false);
        expect(wrapper.exists('FormattedMessage[id="threading.numReplies"]')).toBe(true);
    });

    test('should show unread indicator', () => {
        thread.unread_replies = 2;

        const {mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SimpleTooltip).find('.dot-unreads').exists()).toBe(true);
    });

    test('should not show unread indicator if not following', () => {
        thread.unread_replies = 2;
        thread.is_following = false;

        const {mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );

        expect(wrapper.find(SimpleTooltip).find('.dot-unreads').exists()).toBe(false);
    });

    test('should have avatars', () => {
        const {mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );
        expect(wrapper.find(Avatars).props()).toHaveProperty('userIds', ['5', '4', '3', '2', '1']);
    });

    test('should have a timestamp', () => {
        const {mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );
        expect(wrapper.find(Timestamp).props()).toHaveProperty('value', thread.last_reply_at);
    });

    test('should have a reply button', () => {
        const {store, mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );
        wrapper.find('button.separated').first().simulate('click');
        expect(store.getActions()).toEqual([
            {
                type: 'SELECT_POST',
                channelId: 'cid',
                postId: 'postthreadid',
                timestamp: 1588512000000,
            },
        ]);
    });

    test('should have a follow button', () => {
        thread.is_following = false;

        const {store, mountOptions} = mockStore(state);
        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );

        expect(wrapper.exists(FollowButton)).toBe(true);
        expect(wrapper.find(FollowButton).props()).toHaveProperty('isFollowing', thread.is_following);

        wrapper.find('button.separated').last().simulate('click');
        expect(store.getActions()).toEqual([
            {
                type: 'FOLLOW_CHANGED_THREAD',
                data: {
                    following: true,
                    id: 'postthreadid',
                    team_id: 'tid',
                },
            },
        ]);
    });

    test('should have an unfollow button', () => {
        thread.is_following = true;
        const {store, mountOptions} = mockStore(state);

        const wrapper = mount(
            <ThreadFooter
                {...props}
            />,
            mountOptions,
        );
        expect(wrapper.exists(FollowButton)).toBe(true);
        expect(wrapper.find(FollowButton).props()).toHaveProperty('isFollowing', thread.is_following);

        wrapper.find('button.separated').last().simulate('click');
        expect(store.getActions()).toEqual([
            {
                type: 'FOLLOW_CHANGED_THREAD',
                data: {
                    following: false,
                    id: 'postthreadid',
                    team_id: 'tid',
                },
            },
        ]);
    });

    test('should match snapshot when a single message is followed', () => {
        const {mountOptions} = mockStore(state);

        const wrapper = mount(
            <ThreadFooter
                threadId='singlemessageid'
            />,
            mountOptions,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.exists(FollowButton)).toBe(true);
        expect(wrapper.find(FollowButton).props()).toHaveProperty('isFollowing', true);
    });
});

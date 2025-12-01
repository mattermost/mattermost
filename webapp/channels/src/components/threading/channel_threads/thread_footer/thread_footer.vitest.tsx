// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ThreadFooter from './thread_footer';

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
    let state: typeof baseState;
    let thread: UserThread;
    let props: ComponentProps<typeof ThreadFooter>;

    beforeEach(() => {
        resetFakeDate = fakeDate(new Date('2020-05-03T13:20:00Z'));
        state = JSON.parse(JSON.stringify(baseState));
        thread = state.entities.threads.threads.postthreadid as unknown as UserThread;
        props = {threadId: thread.id};
    });

    afterEach(() => {
        resetFakeDate();
    });

    test('should report total number of replies', () => {
        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );
        expect(container).toMatchSnapshot();

        // Check that unread indicator is not shown
        expect(container.querySelector('.dot-unreads')).not.toBeInTheDocument();
    });

    test('should show unread indicator', () => {
        state.entities.threads.threads.postthreadid.unread_replies = 2;

        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('.dot-unreads')).toBeInTheDocument();
    });

    test('should not show unread indicator if not following', () => {
        state.entities.threads.threads.postthreadid.unread_replies = 2;
        state.entities.threads.threads.postthreadid.is_following = false;

        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        expect(container.querySelector('.dot-unreads')).not.toBeInTheDocument();
    });

    test('should match snapshot when a single message is followed', () => {
        const {container} = renderWithContext(
            <ThreadFooter
                threadId='singlemessageid'
            />,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    test('should have avatars', () => {
        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        // Check avatars are rendered
        expect(container.querySelector('.Avatar')).toBeInTheDocument();
    });

    test('should have a timestamp', () => {
        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        // Check timestamp is rendered
        expect(container.querySelector('time')).toBeInTheDocument();
    });

    test('should have a reply button', () => {
        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        // Check reply button is rendered
        expect(container.querySelector('button.separated')).toBeInTheDocument();
    });

    test('should have a follow button', () => {
        state.entities.threads.threads.postthreadid.is_following = false;

        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        // Check follow button exists
        expect(container.querySelector('button')).toBeInTheDocument();
    });

    test('should have an unfollow button', () => {
        state.entities.threads.threads.postthreadid.is_following = true;

        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
        );

        // Check unfollow button exists
        expect(container.querySelector('button')).toBeInTheDocument();
    });
});

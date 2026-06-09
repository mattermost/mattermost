// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ThreadFooter from './thread_footer';

let capturedAvatarsProps: any = {};
jest.mock('components/widgets/users/avatars', () => (props: any) => {
    capturedAvatarsProps = props;
    return <div data-testid='mock-avatars'/>;
});

let capturedTimestampProps: any = {};
jest.mock('components/timestamp', () => (props: any) => {
    capturedTimestampProps = props;
    return <span data-testid='mock-timestamp'/>;
});

let capturedFollowButtonProps: any = {};
jest.mock('../../common/follow_button', () => (props: any) => {
    capturedFollowButtonProps = props;
    return (
        <button
            className='separated'
            data-testid='mock-follow-button'
            onClick={props.onClick}
        >
            {'Follow'}
        </button>
    );
});

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
        state = JSON.parse(JSON.stringify(baseState));
        thread = state.entities.threads.threads.postthreadid;
        props = {threadId: thread.id};
        capturedAvatarsProps = {};
        capturedTimestampProps = {};
        capturedFollowButtonProps = {};
    });

    afterEach(() => {
        resetFakeDate();
    });

    test('should report total number of replies', () => {
        const {baseElement, container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();
        expect(container.querySelector('.dot-unreads')).not.toBeInTheDocument();
        expect(screen.getByText('9 replies')).toBeInTheDocument();
    });

    test('should show unread indicator', () => {
        thread.unread_replies = 2;

        const {baseElement, container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );

        expect(baseElement).toMatchSnapshot();
        expect(container.querySelector('.dot-unreads')).toBeInTheDocument();
    });

    test('should not show unread indicator if not following', () => {
        thread.unread_replies = 2;
        thread.is_following = false;

        const {container} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );

        expect(container.querySelector('.dot-unreads')).not.toBeInTheDocument();
    });

    test('should have avatars', () => {
        renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );
        expect(capturedAvatarsProps).toHaveProperty('userIds', ['5', '4', '3', '2', '1']);
    });

    test('should have a timestamp', () => {
        renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );
        expect(capturedTimestampProps).toHaveProperty('value', thread.last_reply_at);
    });

    test('should have a reply button', async () => {
        const {container, store} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );
        await userEvent.click(container.querySelector('button.separated')!);
        expect((store as any).getActions()).toEqual([
            {
                type: 'SELECT_POST',
                channelId: 'cid',
                postId: 'postthreadid',
                timestamp: 1588512000000,
            },
        ]);
    });

    test('should have a follow button', async () => {
        thread.is_following = false;

        const {container, store} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );

        expect(screen.getByTestId('mock-follow-button')).toBeInTheDocument();
        expect(capturedFollowButtonProps).toHaveProperty('isFollowing', thread.is_following);

        const buttons = container.querySelectorAll('button.separated');
        await userEvent.click(buttons[buttons.length - 1]);
        expect((store as any).getActions()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'FOLLOW_CHANGED_THREAD',
                    data: {
                        following: true,
                        id: 'postthreadid',
                        team_id: 'tid',
                    },
                }),
            ]),
        );
    });

    test('should have an unfollow button', async () => {
        thread.is_following = true;
        const {container, store} = renderWithContext(
            <ThreadFooter
                {...props}
            />,
            state,
            {useMockedStore: true},
        );
        expect(screen.getByTestId('mock-follow-button')).toBeInTheDocument();
        expect(capturedFollowButtonProps).toHaveProperty('isFollowing', thread.is_following);

        const buttons = container.querySelectorAll('button.separated');
        await userEvent.click(buttons[buttons.length - 1]);
        expect((store as any).getActions()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'FOLLOW_CHANGED_THREAD',
                    data: {
                        following: false,
                        id: 'postthreadid',
                        team_id: 'tid',
                    },
                }),
            ]),
        );
    });

    test('should match snapshot when a single message is followed', () => {
        const {baseElement} = renderWithContext(
            <ThreadFooter
                threadId='singlemessageid'
            />,
            state,
            {useMockedStore: true},
        );

        expect(baseElement).toMatchSnapshot();
        expect(screen.getByTestId('mock-follow-button')).toBeInTheDocument();
        expect(capturedFollowButtonProps).toHaveProperty('isFollowing', true);
    });
});

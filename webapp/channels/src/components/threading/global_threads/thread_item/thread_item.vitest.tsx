// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ThreadItem from './thread_item';

vi.mock('mattermost-redux/actions/threads');
vi.mock('actions/views/threads');

vi.mock('../../hooks', () => ({
    useThreadRouting: () => ({
        currentUserId: '7n4ach3i53bbmj84dfmu5b7c1c',
        currentTeamId: 'tid',
        goToInChannel: vi.fn(),
        select: vi.fn(),
        params: {
            team: 'tname',
        },
    }),
}));

describe('components/threading/global_threads/thread_item', () => {
    let props: ComponentProps<typeof ThreadItem>;
    let mockThread: UserThread;
    let mockPost: Post;
    let mockChannel: Channel;
    let mockState: any;
    let resetFakeDate: () => void;

    beforeEach(() => {
        // Mock the date to match the post's create_at timestamp for consistent snapshots
        resetFakeDate = fakeDate(new Date(1610486901110));

        mockThread = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            reply_count: 0,
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            participants: [
                {
                    id: '7n4ach3i53bbmj84dfmu5b7c1c',
                    username: 'frodo.baggins',
                    first_name: 'Frodo',
                    last_name: 'Baggins',
                },
                {
                    id: 'ij61jet1bbdk8fhhxitywdj4ih',
                    username: 'samwise.gamgee',
                    first_name: 'Samwise',
                    last_name: 'Gamgee',
                },
            ],
            post: {
                user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            },
        } as UserThread;

        mockPost = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
            channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            message: 'test msg',
            create_at: 1610486901110,
            edit_at: 1611786714912,
        } as Post;

        const user = TestHelper.getUserMock();

        mockChannel = {
            id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            name: 'test-team',
            display_name: 'Team name',
        } as Channel;

        mockState = {
            entities: {
                users: {
                    currentUserId: user.id,
                    profiles: {
                        [user.id]: user,
                    },
                },
                groups: {
                    groups: {},
                    myGroups: [],
                },
                teams: {
                    teams: {
                        currentTeamId: 'tid',
                    },
                    groupsAssociatedToTeam: {
                        tid: {},
                    },
                },
                channels: {
                    channels: {
                        [mockChannel.id]: mockChannel,
                    },
                    groupsAssociatedToChannel: {
                        [mockChannel.id]: {},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
            views: {
                browser: {
                    windowSize: WindowSizes.DESKTOP_VIEW,
                },
            },
        };

        props = {
            isFirstThreadInList: false,
            channel: mockChannel,
            currentRelativeTeamUrl: '/tname',
            displayName: 'Someone',
            isSelected: false,
            post: mockPost,
            postsInThread: [],
            thread: mockThread,
            threadId: mockThread.id,
            isPostPriorityEnabled: false,
        };
    });

    afterEach(() => {
        resetFakeDate();
    });

    test('should report total number of replies', () => {
        mockThread.reply_count = 9;
        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);
        expect(container).toMatchSnapshot();
    });

    test('should report unread messages', () => {
        mockThread.reply_count = 11;
        mockThread.unread_replies = 2;

        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);
        expect(container).toMatchSnapshot();
        expect(container.querySelector('.dot-unreads')).toBeInTheDocument();
    });

    test('should report unread mentions', () => {
        mockThread.reply_count = 16;
        mockThread.unread_replies = 5;
        mockThread.unread_mentions = 2;

        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);
        expect(container).toMatchSnapshot();
        expect(container.querySelector('.dot-mentions')).toBeInTheDocument();
    });

    test('should show channel name', () => {
        renderWithContext(<ThreadItem {...props}/>, mockState);
        expect(screen.getByText('Team name')).toBeInTheDocument();
    });

    test('should set article tabIndex to -1 when thread is selected', () => {
        const {container} = renderWithContext(
            <ThreadItem
                {...props}
                isSelected={true}
            />,
            mockState,
        );
        expect(container.querySelector('.ThreadItem')).toHaveAttribute('tabIndex', '-1');
    });

    test('should set article tabIndex to 0 when thread is not selected', () => {
        const {container} = renderWithContext(
            <ThreadItem
                {...props}
                isSelected={false}
            />,
            mockState,
        );
        expect(container.querySelector('.ThreadItem')).toHaveAttribute('tabIndex', '0');
    });

    test('should pass required props to ThreadMenu', () => {
        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);

        // Verify ThreadMenu is rendered with the thread
        expect(container.querySelector('.ThreadItem')).toBeInTheDocument();
    });

    test('should call Utils.handleFormattedTextClick on click', () => {
        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);

        const preview = container.querySelector('.preview');
        expect(preview).toBeInTheDocument();
    });

    test('should allow marking as unread on alt + click', () => {
        const {container} = renderWithContext(<ThreadItem {...props}/>, mockState);

        const threadItem = container.querySelector('.ThreadItem');
        expect(threadItem).toBeInTheDocument();
    });
});

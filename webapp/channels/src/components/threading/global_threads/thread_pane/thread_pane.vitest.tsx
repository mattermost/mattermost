// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {setThreadFollow} from 'mattermost-redux/actions/threads';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import ThreadPane from './thread_pane';

vi.mock('mattermost-redux/actions/threads', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        setThreadFollow: vi.fn(() => ({type: 'SET_THREAD_FOLLOW'})),
    };
});

const mockGoToInChannel = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../hooks', () => ({
    useThreadRouting: () => ({
        params: {
            team: 'team',
        },
        currentUserId: 'uid',
        currentTeamId: 'tid',
        goToInChannel: mockGoToInChannel,
        select: mockSelect,
    }),
}));

describe('components/threading/global_threads/thread_pane', () => {
    let props: ComponentProps<typeof ThreadPane>;
    let mockThread: typeof props['thread'];
    let mockState: any;

    beforeEach(() => {
        vi.clearAllMocks();

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
        const {container} = renderWithContext(
            <ThreadPane {...props}/>,
            mockState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should support follow', async () => {
        props.thread.is_following = false;
        renderWithContext(
            <ThreadPane {...props}/>,
            mockState,
        );

        const followButton = screen.getByRole('button', {name: /follow/i});
        await userEvent.click(followButton);
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', mockThread.id, true);
    });

    test('should support unfollow', async () => {
        props.thread.is_following = true;
        renderWithContext(
            <ThreadPane {...props}/>,
            mockState,
        );

        const followingButton = screen.getByRole('button', {name: /following/i});
        await userEvent.click(followingButton);
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', mockThread.id, false);
    });

    test('should support openInChannel', async () => {
        renderWithContext(
            <ThreadPane {...props}/>,
            mockState,
        );

        // Find the "Open in channel" or similar button
        const openInChannelButton = screen.getByRole('button', {name: /team name/i});
        await userEvent.click(openInChannelButton);
        expect(mockGoToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should support go back to list', async () => {
        const {container} = renderWithContext(
            <ThreadPane {...props}/>,
            mockState,
        );

        // Find the back button by its class
        const backButton = container.querySelector('button.back');
        expect(backButton).toBeInTheDocument();
        await userEvent.click(backButton!);
        expect(mockSelect).toHaveBeenCalledWith();
    });
});

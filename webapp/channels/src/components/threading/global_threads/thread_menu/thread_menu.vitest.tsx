// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {setThreadFollow, updateThreadRead, markLastPostInThreadAsUnread} from 'mattermost-redux/actions/threads';

import {
    flagPost as savePost,
    unflagPost as unsavePost,
} from 'actions/post_actions';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';

import ThreadMenu from './thread_menu';

vi.mock('mattermost-redux/actions/threads', () => ({
    setThreadFollow: vi.fn(() => ({type: 'SET_THREAD_FOLLOW'})),
    updateThreadRead: vi.fn(() => ({type: 'UPDATE_THREAD_READ'})),
    markLastPostInThreadAsUnread: vi.fn(() => ({type: 'MARK_LAST_POST_IN_THREAD_AS_UNREAD'})),
}));
vi.mock('actions/views/threads', () => ({
    manuallyMarkThreadAsUnread: vi.fn(() => ({type: 'MANUALLY_MARK_THREAD_AS_UNREAD'})),
}));
vi.mock('actions/post_actions', () => ({
    flagPost: vi.fn(() => ({type: 'FLAG_POST'})),
    unflagPost: vi.fn(() => ({type: 'UNFLAG_POST'})),
}));
vi.mock('utils/utils');
vi.mock('hooks/useReadout', () => ({
    useReadout: () => vi.fn(),
}));

vi.mock('../../hooks', () => ({
    useThreadRouting: () => ({
        params: {
            team: 'team-name-1',
        },
        currentUserId: 'uid',
        currentTeamId: 'tid',
        goToInChannel: vi.fn(),
    }),
}));

describe('components/threading/common/thread_menu', () => {
    let props: ComponentProps<typeof ThreadMenu>;
    let mockState: Partial<GlobalState>;

    beforeEach(() => {
        vi.clearAllMocks();

        props = {
            threadId: '1y8hpek81byspd4enyk9mp1ncw',
            unreadTimestamp: 1610486901110,
            hasUnreads: false,
            isFollowing: false,
            children: (
                <button>{'test'}</button>
            ),
        };

        mockState = {
            entities: {
                preferences: {
                    myPreferences: {},
                },
            },
        } as Partial<GlobalState>;
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mockState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot after opening', async () => {
        const {container} = renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));
        expect(container).toMatchSnapshot();
    });

    test('should allow following', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={false}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const followItem = screen.getByText('Follow thread');
        await userEvent.click(followItem);
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', true);
    });

    test('should allow unfollowing', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={true}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const unfollowItem = screen.getByText('Unfollow thread');
        await userEvent.click(unfollowItem);
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', false);
    });

    test('should allow marking as unread', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={false}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const markAsUnreadItem = screen.getByText('Mark as unread');
        await userEvent.click(markAsUnreadItem);
        expect(updateThreadRead).not.toHaveBeenCalled();
        expect(markLastPostInThreadAsUnread).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw');
        expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1610486901110);
    });

    test('should allow saving', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const saveItem = screen.getByText('Save');
        await userEvent.click(saveItem);
        expect(savePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should allow unsaving', async () => {
        const stateWithSavedPost = {
            entities: {
                preferences: {
                    myPreferences: {
                        'flagged_post--1y8hpek81byspd4enyk9mp1ncw': {
                            user_id: 'uid',
                            category: 'flagged_post',
                            name: '1y8hpek81byspd4enyk9mp1ncw',
                            value: 'true',
                        },
                    },
                },
            },
        };

        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            stateWithSavedPost,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const unsaveItem = screen.getByText('Unsave');
        await userEvent.click(unsaveItem);
        expect(unsavePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should allow opening in channel', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const openInChannelItem = screen.getByText('Open in channel');
        expect(openInChannelItem).toBeInTheDocument();
    });

    test('should allow marking as read', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={true}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const markAsReadItem = screen.getByText('Mark as read');
        await userEvent.click(markAsReadItem);
        expect(updateThreadRead).toHaveBeenCalled();
    });

    test('should allow link copying', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mockState,
        );
        await userEvent.click(screen.getByRole('button', {name: 'test'}));

        const copyLinkItem = screen.getByText('Copy link');
        expect(copyLinkItem).toBeInTheDocument();
    });
});

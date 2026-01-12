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

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {copyToClipboard} from 'utils/utils';

import ThreadMenu from '../thread_menu';

jest.mock('mattermost-redux/actions/threads');
jest.mock('actions/views/threads');
jest.mock('actions/post_actions');
jest.mock('utils/utils');
jest.mock('hooks/useReadout', () => ({
    useReadout: () => jest.fn(),
}));

const mockRouting = {
    params: {
        team: 'team-name-1',
    },
    currentUserId: 'uid',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/threading/common/thread_menu', () => {
    let props: ComponentProps<typeof ThreadMenu>;

    const baseState = {
        entities: {
            preferences: {myPreferences: {}},
            teams: {currentTeamId: 'tid'},
            general: {config: {}},
            users: {currentUserId: 'uid'},
        },
        views: {
            browser: {
                windowSize: 'desktopView',
            },
        },
    };

    beforeEach(() => {
        props = {
            threadId: '1y8hpek81byspd4enyk9mp1ncw',
            unreadTimestamp: 1610486901110,
            hasUnreads: false,
            isFollowing: false,
        };
    });

    test('should render thread menu button', () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            baseState,
        );
        expect(screen.getByRole('button', {name: 'More Actions'})).toBeInTheDocument();
    });

    test('should open menu when button is clicked', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        expect(screen.getByRole('menuitem', {name: /Follow thread/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Open in channel/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Mark as unread/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Save/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Copy link/})).toBeInTheDocument();
    });

    test('should allow following', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={false}
            />,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const followButton = await screen.findByRole('menuitem', {name: /Follow thread/});
        await userEvent.click(followButton);

        await waitFor(() => {
            expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', true);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
        });
    });

    test('should allow unfollowing', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={true}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const unfollowButton = screen.getByRole('menuitem', {name: /Unfollow thread/});
        await userEvent.click(unfollowButton);

        await waitFor(() => {
            expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', false);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
        });
    });

    test('should allow opening in channel', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const openInChannelButton = screen.getByRole('menuitem', {name: /Open in channel/});
        await userEvent.click(openInChannelButton);

        await waitFor(() => {
            expect(mockRouting.goToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    test('should allow marking as read', async () => {
        const resetFakeDate = fakeDate(new Date(1612582579566));
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={true}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const markAsReadButton = screen.getByRole('menuitem', {name: /Mark as read/});
        await userEvent.click(markAsReadButton);

        await waitFor(() => {
            expect(markLastPostInThreadAsUnread).not.toHaveBeenCalled();
            expect(updateThreadRead).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', 1612582579566);
            expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1612582579566);
            expect(mockDispatch).toHaveBeenCalledTimes(2);
        });
        resetFakeDate();
    });

    test('should allow marking as unread', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={false}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const markAsUnreadButton = screen.getByRole('menuitem', {name: /Mark as unread/});
        await userEvent.click(markAsUnreadButton);

        await waitFor(() => {
            expect(updateThreadRead).not.toHaveBeenCalled();
            expect(markLastPostInThreadAsUnread).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw');
            expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1610486901110);
            expect(mockDispatch).toHaveBeenCalledTimes(2);
        });
    });

    test('should allow saving', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const saveButton = screen.getByRole('menuitem', {name: /Save/});
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(savePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
            expect(mockDispatch).toHaveBeenCalledTimes(1);
        });
    });
    test('should allow unsaving', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            mergeObjects(baseState, {
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
            }),
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const unsaveButton = screen.getByRole('menuitem', {name: /Unsave/});
        await userEvent.click(unsaveButton);

        await waitFor(() => {
            expect(unsavePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
            expect(mockDispatch).toHaveBeenCalledTimes(1);
        });
    });

    test('should allow link copying', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
            baseState,
        );

        const menuButton = screen.getByRole('button', {name: 'More Actions'});
        await userEvent.click(menuButton);

        const copyLinkButton = screen.getByRole('menuitem', {name: /Copy link/});
        await userEvent.click(copyLinkButton);

        await waitFor(() => {
            expect(copyToClipboard).toHaveBeenCalledWith('http://localhost:8065/team-name-1/pl/1y8hpek81byspd4enyk9mp1ncw');
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });
});


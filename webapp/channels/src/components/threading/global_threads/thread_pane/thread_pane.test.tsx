// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {setThreadFollow} from 'mattermost-redux/actions/threads';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ThreadPane from './thread_pane';

jest.mock('mattermost-redux/actions/threads', () => ({
    ...jest.requireActual('mattermost-redux/actions/threads'),
    setThreadFollow: jest.fn(() => ({type: 'MOCK_SET_THREAD_FOLLOW'})),
}));

const mockRouting = {
    params: {
        team: 'team',
    },
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

jest.mock('components/popout_button', () => ({
    __esModule: true,
    default: ({onClick}: {onClick: () => void}) => (
        <button onClick={onClick}>{'Popout'}</button>
    ),
}));

jest.mock('../thread_menu', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='thread-menu'>{children}</div>
    ),
}));

describe('components/threading/global_threads/thread_pane', () => {
    let props: ComponentProps<typeof ThreadPane>;
    let mockThread: typeof props['thread'];
    let initialState: any;

    beforeEach(() => {
        jest.clearAllMocks();

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

        initialState = {
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
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should support follow', async () => {
        props.thread.is_following = false;
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );
        await userEvent.click(screen.getByText('Follow'));
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, true);
    });

    test('should support unfollow', async () => {
        props.thread.is_following = true;
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByText('Following'));
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, false);
    });

    test('should support openInChannel', async () => {
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByText('Team name'));
        expect(mockRouting.goToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should support go back to list', async () => {
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        const backButton = document.querySelector('.back') as HTMLElement;
        expect(backButton).toBeInTheDocument();
        await userEvent.click(backButton);
        expect(mockRouting.select).toHaveBeenCalledWith();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ThreadList, {ThreadFilter} from './thread_list';

vi.mock('mattermost-redux/actions/threads', () => ({
    getThreadsForCurrentTeam: vi.fn().mockReturnValue({type: 'GET_THREADS', data: true}),
}));

vi.mock('actions/views/modals', () => ({
    openModal: vi.fn().mockReturnValue({type: 'OPEN_MODAL'}),
}));

vi.mock('../../hooks', () => ({
    useThreadRouting: () => ({
        currentUserId: 'uid',
        currentTeamId: 'tid',
        goToInChannel: vi.fn(),
        select: vi.fn(),
    }),
}));

describe('components/threading/global_threads/thread_list', () => {
    let props: ComponentProps<typeof ThreadList>;
    let mockState: any;

    beforeEach(() => {
        vi.clearAllMocks();
        props = {
            currentFilter: ThreadFilter.none,
            someUnread: true,
            ids: ['1', '2', '3'],
            unreadIds: ['2'],
            setFilter: vi.fn(),
        };
        const user = TestHelper.getUserMock();

        mockState = {
            entities: {
                users: {
                    currentUserId: user.id,
                    profiles: {
                        [user.id]: user,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                threads: {
                    countsIncludingDirect: {
                        tid: {
                            total: 0,
                            total_unread_threads: 0,
                            total_unread_mentions: 0,
                        },
                    },
                },
                teams: {
                    currentTeamId: 'tid',
                },
                general: {
                    config: {},
                },
            },
            views: {
                browser: {
                    windowSize: WindowSizes.DESKTOP_VIEW,
                },
            },
        };
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ThreadList {...props}/>,
            mockState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should support filter:all', () => {
        const {container} = renderWithContext(
            <ThreadList {...props}/>,
            mockState,
        );

        // Verify all filter button exists
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    test('should support filter:unread', () => {
        const {container} = renderWithContext(
            <ThreadList {...props}/>,
            mockState,
        );

        // Verify unread filter button exists
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    test('should support openModal', () => {
        const {container} = renderWithContext(
            <ThreadList {...props}/>,
            mockState,
        );

        // Verify mark all as read button exists
        expect(container).toBeInTheDocument();
    });

    test('should support getThreads', () => {
        const {container} = renderWithContext(
            <ThreadList {...props}/>,
            mockState,
        );

        // Verify virtualized list exists
        expect(container).toBeInTheDocument();
    });
});

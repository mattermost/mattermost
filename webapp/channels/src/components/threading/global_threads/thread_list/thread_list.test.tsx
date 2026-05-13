// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {getThreadsForCurrentTeam} from 'mattermost-redux/actions/threads';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ThreadList, {ThreadFilter} from './thread_list';

jest.mock('mattermost-redux/actions/threads');
jest.mock('actions/views/modals');

const mockRouting = {
    currentUserId: 'uid',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
    select: jest.fn(),
    clear: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

let capturedVTLProps: any = {};
jest.mock('./virtualized_thread_list', () => {
    return function MockVirtualizedThreadList(props: any) {
        capturedVTLProps = props;
        return <div data-testid='virtualized-thread-list'/>;
    };
});

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/threading/global_threads/thread_list', () => {
    let props: ComponentProps<typeof ThreadList>;

    beforeEach(() => {
        props = {
            currentFilter: ThreadFilter.none,
            someUnread: true,
            ids: ['1', '2', '3'],
            unreadIds: ['2'],
            setFilter: jest.fn(),
        };
        const user = TestHelper.getUserMock();
        const profiles = {
            [user.id]: user,
        };

        mockState = {
            entities: {
                users: {
                    currentUserId: user.id,
                    profiles,
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
            },
            views: {
                browser: {
                    windowSize: WindowSizes.DESKTOP_VIEW,
                },
            },
        };

        capturedVTLProps = {};
        mockDispatch.mockClear();
    });

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ThreadList {...props}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should support filter:all', async () => {
        renderWithContext(
            <ThreadList {...props}/>,
        );

        await userEvent.click(screen.getByRole('tab', {name: 'Followed threads'}));
        expect(props.setFilter).toHaveBeenCalledWith('');
    });

    test('should support filter:unread', async () => {
        renderWithContext(
            <ThreadList {...props}/>,
        );

        await userEvent.click(screen.getByRole('tab', {name: 'Unreads'}));
        expect(props.setFilter).toHaveBeenCalledWith('unread');
    });

    test('should support openModal', async () => {
        renderWithContext(
            <ThreadList {...props}/>,
        );

        await userEvent.click(screen.getByLabelText('Mark all threads as read'));
        expect(openModal).toHaveBeenCalledTimes(1);
    });

    test('should support getThreads', async () => {
        renderWithContext(
            <ThreadList {...props}/>,
        );

        const handleLoadMoreItems = capturedVTLProps.loadMoreItems;
        const loadMoreItems = await handleLoadMoreItems(2, 3);

        expect(loadMoreItems).toEqual({data: true});
        expect(getThreadsForCurrentTeam).toHaveBeenCalledWith({unread: false, before: '2'});
    });
});

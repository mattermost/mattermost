// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getIsRhsOpen} from 'selectors/rhs';

import {act, renderWithContext} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import GlobalThreads from './global_threads';

// Only the network-backed thunks are stubbed; the RHS suppression logic under test is real.
jest.mock('mattermost-redux/actions/threads', () => ({
    getThreadCounts: jest.fn(() => ({type: 'MOCK_GET_THREAD_COUNTS'})),
    getThreadsForCurrentTeam: jest.fn(() => ({type: 'MOCK_GET_THREADS_FOR_CURRENT_TEAM'})),
}));

jest.mock('actions/user_actions', () => ({
    loadProfilesForSidebar: jest.fn(),
}));

describe('components/threading/global_threads', () => {
    const baseState = {
        entities: {
            general: {
                config: {},
            },
            teams: {
                currentTeamId: 'team1',
                teams: {team1: TestHelper.getTeamMock({id: 'team1', name: 'team1'})},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: TestHelper.getUserMock({id: 'user1'})},
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                posts: {},
            },
        },
        views: {
            rhs: {
                isSidebarOpen: true,
                pluggableId: 'the_rhs_component_id',
            },
            rhsSuppressed: false,
        },
    };

    const renderGlobalThreads = async (rhsState: string) => {
        const rendered = renderWithContext(
            <GlobalThreads/>,
            {
                ...baseState,
                views: {
                    ...baseState.views,
                    rhs: {
                        ...baseState.views.rhs,
                        rhsState,
                    },
                },
            },
        );

        // Let the initial thread loading settle before asserting.
        await act(async () => {});

        return rendered;
    };

    test.each([
        RHSStates.PLUGIN,
        RHSStates.MENTION,
        RHSStates.SEARCH,
        RHSStates.FLAG,
    ])('should leave the RHS open on mount when it shows %s', async (rhsState) => {
        const {store} = await renderGlobalThreads(rhsState);

        expect(getIsRhsOpen(store.getState())).toBe(true);
    });

    test.each([
        RHSStates.PIN,
        RHSStates.CHANNEL_INFO,
        RHSStates.CHANNEL_FILES,
        RHSStates.CHANNEL_MEMBERS,
    ])('should suppress the RHS on mount when it shows %s', async (rhsState) => {
        const {store} = await renderGlobalThreads(rhsState);

        expect(getIsRhsOpen(store.getState())).toBe(false);
    });

    test('should unsuppress the RHS when navigating away', async () => {
        const {store, unmount} = await renderGlobalThreads(RHSStates.PIN);

        expect(getIsRhsOpen(store.getState())).toBe(false);

        unmount();

        expect(getIsRhsOpen(store.getState())).toBe(true);
    });
});

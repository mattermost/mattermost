// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Store} from 'redux';

import {ThreadTypes} from 'mattermost-redux/action_types';
import {getThreadsForCurrentTeam} from 'mattermost-redux/actions/threads';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {toggleRHSPlugin} from 'actions/views/rhs';
import {getIsRhsOpen, getPluggableId, getRhsState} from 'selectors/rhs';

import AppBarPluginComponent from 'components/app_bar/app_bar_plugin_component';

import {renderWithContext, runPostRenderAct, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {LhsPage} from 'types/store/lhs';
import type {ChannelHeaderButtonAction, RightHandSidebarComponent} from 'types/store/plugins';

import GlobalThreads from './global_threads';

// Only the network-backed thunks are stubbed; the RHS suppression logic under test is real.
jest.mock('mattermost-redux/actions/threads', () => ({
    ...jest.requireActual('mattermost-redux/actions/threads'),
    getThreadCounts: jest.fn(() => ({type: 'MOCK_GET_THREAD_COUNTS'})),
    getThreadsForCurrentTeam: jest.fn(() => ({type: 'MOCK_GET_THREADS_FOR_CURRENT_TEAM'})),
}));

jest.mock('actions/user_actions', () => ({
    ...jest.requireActual('actions/user_actions'),
    loadProfilesForSidebar: jest.fn(),
}));

describe('components/threading/global_threads', () => {
    const pluginId = 'com.mattermost.test-plugin';
    const rhsComponentId = 'the_rhs_component_id';

    const channel = TestHelper.getChannelMock({id: 'channel1'});

    const rhsComponents: RightHandSidebarComponent[] = [{
        id: rhsComponentId,
        pluginId,
        component: () => null,
        title: 'Test Plugin',
    }];

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                myMembers: {[channel.id]: TestHelper.getChannelMembershipMock({channel_id: channel.id, user_id: 'user1'})},
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
            },
            rhsSuppressed: false,
        },
        plugins: {
            components: {
                RightHandSidebarComponent: rhsComponents,
            },
        },
    };

    const stateWithRhsState = (rhsState: string) => ({
        ...baseState,
        views: {
            ...baseState.views,
            rhs: {
                ...baseState.views.rhs,
                rhsState,
                pluggableId: rhsState === RHSStates.PLUGIN ? rhsComponentId : '',
            },
        },
    });

    let store: Store;

    const renderGlobalThreads = async (rhsState: string, children?: React.ReactNode) => {
        const rendered = renderWithContext(
            <>
                <GlobalThreads/>
                {children}
            </>,
            stateWithRhsState(rhsState),
        );
        store = rendered.store;

        await runPostRenderAct();

        return rendered;
    };

    test('should select the Threads page and clear the current channel on mount', async () => {
        await renderGlobalThreads(RHSStates.PLUGIN);

        expect(store.getState().views.lhs.currentStaticPageId).toBe(LhsPage.Threads);
        expect(getCurrentChannelId(store.getState())).toBe('');
    });

    test.each([
        RHSStates.PLUGIN,
        RHSStates.MENTION,
        RHSStates.SEARCH,
        RHSStates.FLAG,
    ])('should leave the RHS open on mount when it shows %s', async (rhsState) => {
        await renderGlobalThreads(rhsState);

        expect(store.getState().views.rhsSuppressed).toBe(false);
        expect(getIsRhsOpen(store.getState())).toBe(true);
    });

    test.each([
        RHSStates.PIN,
        RHSStates.CHANNEL_INFO,
        RHSStates.CHANNEL_FILES,
        RHSStates.CHANNEL_MEMBERS,
        RHSStates.EDIT_HISTORY,
    ])('should suppress the RHS on mount when it shows %s', async (rhsState) => {
        await renderGlobalThreads(rhsState);

        expect(store.getState().views.rhsSuppressed).toBe(true);
        expect(getIsRhsOpen(store.getState())).toBe(false);
    });

    test('should unsuppress the RHS when navigating away', async () => {
        const {unmount} = await renderGlobalThreads(RHSStates.PIN);

        expect(getIsRhsOpen(store.getState())).toBe(false);

        unmount();

        expect(getIsRhsOpen(store.getState())).toBe(true);
    });

    test('should open a plugin RHS from the App Bar while showing the Threads view', async () => {
        const channelHeaderButton: ChannelHeaderButtonAction = {
            id: 'the_channel_header_button_id',
            pluginId,
            icon: <i className='icon icon-test'/>,
            dropdownText: 'Test Plugin',
            tooltipText: 'Test Plugin',
            action: () => store.dispatch(toggleRHSPlugin(rhsComponentId)),
        };

        await renderGlobalThreads(
            RHSStates.PIN,
            <AppBarPluginComponent component={channelHeaderButton}/>,
        );

        expect(getIsRhsOpen(store.getState())).toBe(false);

        await userEvent.click(screen.getByRole('button'));

        expect(getIsRhsOpen(store.getState())).toBe(true);
        expect(getRhsState(store.getState())).toBe(RHSStates.PLUGIN);
        expect(getPluggableId(store.getState())).toBe(rhsComponentId);
    });

    describe('unreads filter', () => {
        const counts = {total: 1, total_unread_threads: 0, total_unread_mentions: 0, total_unread_urgent_mentions: 0};

        const unreadsState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                threads: {
                    threads: {
                        thread1: {id: 'thread1', is_following: true, last_reply_at: 100, unread_replies: 0, unread_mentions: 0},
                    },
                    threadsInTeam: {team1: ['thread1']},
                    unreadThreadsInTeam: {team1: []},
                    counts: {team1: counts},
                    countsIncludingDirect: {team1: counts},
                },
            },
            storage: {
                storage: {
                    'globalThreads_filter:user1:team1': {value: 'unread', timestamp: new Date()},
                },
            },
        };

        const receiveUnreadCount = (totalUnreadThreads: number) => {
            store.dispatch({
                type: ThreadTypes.RECEIVED_THREAD_COUNTS,
                data: {...counts, total_unread_threads: totalUnreadThreads, team_id: 'team1'},
            });
        };

        test('should refetch unread threads when the unread count changes while the list is empty', async () => {
            store = renderWithContext(<GlobalThreads/>, unreadsState).store;
            await runPostRenderAct();

            jest.mocked(getThreadsForCurrentTeam).mockClear();

            receiveUnreadCount(1);
            await runPostRenderAct();

            expect(getThreadsForCurrentTeam).toHaveBeenCalledWith({unread: true});
        });

        test('should not link to an undefined thread when no unread threads are loaded', async () => {
            store = renderWithContext(<GlobalThreads/>, unreadsState).store;
            await runPostRenderAct();

            receiveUnreadCount(1);
            await runPostRenderAct();

            expect(screen.getByRole('link', {name: '1 thread'}).getAttribute('href')).not.toContain('undefined');
        });
    });
});

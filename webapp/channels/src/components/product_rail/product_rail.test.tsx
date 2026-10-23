// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';

import ProductRail from './product_rail';

jest.mock('mattermost-redux/actions/threads', () => ({
    getThreadCounts: () => ({type: 'MOCK_GET_THREAD_COUNTS'}),
}));

const team = TestHelper.getTeamMock({id: 'team1', name: 'team-one'});
const user = TestHelper.getUserMock({id: 'user1'});

function getState({
    enabled = true,
    products = [],
    collapsedThreads = true,
}: {enabled?: boolean; products?: ProductComponent[]; collapsedThreads?: boolean} = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    FeatureFlagProductRail: enabled ? 'true' : 'false',
                    CollapsedThreads: collapsedThreads ? CollapsedThreads.ALWAYS_ON : CollapsedThreads.DISABLED,
                },
            },
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
                myMembers: {[team.id]: TestHelper.getTeamMembershipMock({team_id: team.id, user_id: user.id})},
            },
            users: {
                currentUserId: user.id,
                profiles: {[user.id]: user},
            },
            threads: {
                countsIncludingDirect: {
                    [team.id]: {
                        total: 3,
                        total_unread_threads: 1,
                        total_unread_mentions: 2,
                        total_unread_urgent_mentions: 0,
                    },
                },
            },
        },
        plugins: {
            components: {
                Product: products,
            },
        },
    };
}

function renderAt(pathname: string, state: DeepPartial<GlobalState>) {
    return renderWithContext(<ProductRail/>, state, {history: createMemoryHistory({initialEntries: [pathname]})});
}

describe('ProductRail', () => {
    test('should render nothing when the feature flag is off', () => {
        renderAt('/team-one/channels/town-square', getState({enabled: false}));

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    test('should link Channels and Threads to the current team', () => {
        renderAt('/team-one/channels/town-square', getState());

        expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one');
        expect(screen.getByRole('link', {name: /Threads/})).toHaveAttribute('href', '/team-one/threads');
    });

    test('should hide Threads when collapsed reply threads are off', () => {
        renderAt('/team-one/channels/town-square', getState({collapsedThreads: false}));

        expect(screen.queryByRole('link', {name: /Threads/})).not.toBeInTheDocument();
    });

    test('should mark Channels active in a channel and Threads active in threads', () => {
        const {unmount} = renderAt('/team-one/channels/town-square', getState());

        expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', {name: /Threads/})).not.toHaveAttribute('aria-current');

        unmount();
        renderAt('/team-one/threads', getState());

        expect(screen.getByRole('link', {name: /Channels/})).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('link', {name: /Threads/})).toHaveAttribute('aria-current', 'page');
    });

    test('should show the unread thread mention count on Threads', () => {
        renderAt('/team-one/channels/town-square', getState());

        expect(screen.getByRole('link', {name: /Threads/})).toHaveTextContent('2');
    });

    test('should render one item per product and mark the current product active', () => {
        const boards = {...TestHelper.makeProduct('Boards'), baseURL: '/boards', switcherLinkURL: '/boards'};
        const playbooks = {...TestHelper.makeProduct('Playbooks'), baseURL: '/playbooks', switcherLinkURL: '/playbooks'};

        renderAt('/boards/board/abc', getState({products: [boards, playbooks]}));

        expect(screen.getByRole('link', {name: 'Boards'})).toHaveAttribute('href', '/boards');
        expect(screen.getByRole('link', {name: 'Boards'})).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', {name: 'Playbooks'})).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('link', {name: /Channels/})).not.toHaveAttribute('aria-current');
    });

    test('should point a team-scoped product at the current team', () => {
        const spaces = {...TestHelper.makeProduct('Spaces'), baseURL: '/spaces', switcherLinkURL: '/spaces', isTeamScoped: true};

        renderAt('/team-one/channels/town-square', getState({products: [spaces]}));

        expect(screen.getByRole('link', {name: 'Spaces'})).toHaveAttribute('href', '/team-one/spaces');
    });
});

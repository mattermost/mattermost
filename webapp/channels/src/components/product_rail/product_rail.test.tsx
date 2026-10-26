// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {PreferenceTypes} from 'mattermost-redux/action_types';

import type {ChannelKindRegistration} from 'selectors/views/product_rail';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';
import type {ProductRailSection} from 'types/store/views';

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

const townSquare = TestHelper.getChannelMock({id: 'town', name: 'town-square', display_name: 'Town Square', team_id: team.id});
const roadmap = TestHelper.getChannelMock({id: 'roadmap', name: 'roadmap', display_name: 'Roadmap', team_id: team.id});
const bugs = TestHelper.getChannelMock({id: 'bugs', name: 'bugs', display_name: 'Bugs', team_id: team.id});

// A boards plugin's registration: roadmap and bugs are boards.
const boardKind: ChannelKindRegistration = {
    id: 'board-kind',
    pluginId: 'boards',
    kind: 'board',
    matcher: (_state, channel) => channel.id === roadmap.id || channel.id === bugs.id,
};

function getBoardsState(currentChannelId: string, section: ProductRailSection = 'channels'): DeepPartial<GlobalState> {
    const channels = [townSquare, roadmap, bugs];
    const member = (channelId: string, mentions: number) => TestHelper.getChannelMembershipMock({
        channel_id: channelId,
        user_id: user.id,
        mention_count: mentions,
        mention_count_root: mentions,
        msg_count: 0,
        msg_count_root: 0,
    }, {});

    const state = getState();
    return {
        ...state,
        entities: {
            ...state.entities,
            channels: {
                currentChannelId,
                channels: Object.fromEntries(channels.map((channel) => [channel.id, channel])),
                channelsInTeam: {[team.id]: new Set(channels.map((channel) => channel.id))},
                myMembers: {
                    [townSquare.id]: member(townSquare.id, 1),
                    [roadmap.id]: member(roadmap.id, 4),
                    [bugs.id]: member(bugs.id, 0),
                },
                messageCounts: Object.fromEntries(channels.map((channel) => [channel.id, {total: 5, root: 5}])),
            },
        },
        plugins: {

            // ChannelKind registrations come with the Boards plugin API, which the state type
            // doesn't know about yet.
            components: {
                Product: [],
                ChannelKind: [boardKind],
            } as unknown as GlobalState['plugins']['components'],
        },
        views: {
            productRail: {section, lastPathByTeam: {}, lastPathsLoaded: false},
        },
    };
}

function renderAt(pathname: string, state: DeepPartial<GlobalState>) {
    return renderWithContext(<ProductRail/>, state, {history: createMemoryHistory({initialEntries: [pathname]})});
}

describe('ProductRail', () => {
    // Where each item was is saved to localStorage, which would otherwise carry between tests.
    beforeEach(() => {
        localStorage.clear();
    });

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

        // The current product's item points back at where the user is in it.
        expect(screen.getByRole('link', {name: 'Boards'})).toHaveAttribute('href', '/boards/board/abc');
        expect(screen.getByRole('link', {name: 'Boards'})).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', {name: 'Playbooks'})).toHaveAttribute('href', '/playbooks');
        expect(screen.getByRole('link', {name: 'Playbooks'})).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('link', {name: /Channels/})).not.toHaveAttribute('aria-current');
    });

    test('should point a team-scoped product at the current team', () => {
        const spaces = {...TestHelper.makeProduct('Spaces'), baseURL: '/spaces', switcherLinkURL: '/spaces', isTeamScoped: true};

        renderAt('/team-one/channels/town-square', getState({products: [spaces]}));

        expect(screen.getByRole('link', {name: 'Spaces'})).toHaveAttribute('href', '/team-one/spaces');
    });

    describe('with a plugin registering boards', () => {
        test('should not show Boards without a board registration', () => {
            renderAt('/team-one/channels/town-square', getState());

            expect(screen.queryByRole('link', {name: /Boards/})).not.toBeInTheDocument();
        });

        test('should show Boards and open the first board by name', () => {
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
        });

        test('should mark Channels active in a channel', () => {
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Boards/})).not.toHaveAttribute('aria-current');
        });

        test('should mark Boards active in a board, and return Channels to the default channel', () => {
            renderAt('/team-one/channels/roadmap', getBoardsState(roadmap.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Channels/})).not.toHaveAttribute('aria-current');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should split mention counts between Channels and Boards', () => {
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('1');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveTextContent('4');
        });
    });

    describe('order and boards in Channels', () => {
        test('should list Threads, Channels, Boards and Docs with no dividers', () => {
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            const items = [...document.querySelectorAll('.ProductRail > *')].map((item) => item.id);
            expect(items).toEqual([
                'product-rail-item-threads',
                'product-rail-item-channels',
                'product-rail-item-boards',
                'product-rail-item-docs',
            ]);
        });

        test('should stay in Channels on a board while Channels lists boards too, and count their mentions', () => {
            const state = getBoardsState(roadmap.id);
            const withBoardsShown = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        myPreferences: {
                            'sidebar_settings--show_boards_in_channels': {category: 'sidebar_settings', name: 'show_boards_in_channels', user_id: user.id, value: 'true'},
                        },
                    },
                },
            };

            renderAt('/team-one/channels/roadmap', withBoardsShown);

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('5');
            expect(screen.getByRole('link', {name: /Boards/})).not.toHaveAttribute('aria-current');
        });

        test('should stay in Channels on a board when Show boards is turned off', () => {
            const state = getBoardsState(roadmap.id);
            const showBoards = (value: string) => ({
                'sidebar_settings--show_boards_in_channels': {category: 'sidebar_settings', name: 'show_boards_in_channels', user_id: user.id, value},
            });
            const {store} = renderAt('/team-one/channels/roadmap', {
                ...state,
                entities: {...state.entities, preferences: {myPreferences: showBoards('true')}},
            });
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');

            act(() => {
                store.dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: Object.values(showBoards('false'))});
            });

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Boards/})).not.toHaveAttribute('aria-current');
        });
    });

    describe('returning to where each item was', () => {
        test('should point Boards at the open board and Channels at the default channel', () => {
            renderAt('/team-one/channels/roadmap', getBoardsState(roadmap.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/roadmap');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should point Threads at the open thread', () => {
            renderAt('/team-one/threads/thread1', getState());

            expect(screen.getByRole('link', {name: /Threads/})).toHaveAttribute('href', '/team-one/threads/thread1');
        });

        test('should leave a permalinked post out of the remembered channel', () => {
            renderAt('/team-one/channels/town-square/post1', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should not file a channel under Boards while the open channel still lags the URL', () => {
            // The URL has moved to town-square, but the open channel is still the roadmap board.
            renderAt('/team-one/channels/town-square', getBoardsState(roadmap.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
        });

        test('should restore where each item was from an earlier session', () => {
            localStorage.setItem(`product_rail_last_paths_${user.id}`, JSON.stringify({
                boards: {[team.id]: '/team-one/channels/bugs'},
                threads: {[team.id]: '/team-one/threads/thread2'},
            }));

            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(screen.getByRole('link', {name: /Threads/})).toHaveAttribute('href', '/team-one/threads/thread2');
        });

        test('should ignore saved paths of the wrong shape', () => {
            localStorage.setItem(`product_rail_last_paths_${user.id}`, 'null');
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));
            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
        });

        test('should keep only well-formed saved paths', () => {
            localStorage.setItem(`product_rail_last_paths_${user.id}`, JSON.stringify({
                boards: {[team.id]: 42},
                threads: 'not an object',
                channels: {[team.id]: '/team-one/channels/town-square'},
            }));

            renderAt('/team-one/threads', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should save where the user is for the next session', () => {
            renderAt('/team-one/channels/roadmap', getBoardsState(roadmap.id));

            const saved = JSON.parse(localStorage.getItem(`product_rail_last_paths_${user.id}`) ?? '{}');
            expect(saved.boards).toEqual({[team.id]: '/team-one/channels/roadmap'});
        });
    });
});

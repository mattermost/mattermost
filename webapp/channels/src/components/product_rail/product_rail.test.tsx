// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {ChannelTypes, PreferenceTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import type {ChannelKindRegistration} from 'selectors/views/product_rail';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';
import type {ProductRailSection} from 'types/store/views';

import ProductRail, {moveRailItem} from './product_rail';

jest.mock('mattermost-redux/actions/threads', () => ({
    getThreadCounts: () => ({type: 'MOCK_GET_THREAD_COUNTS'}),
}));

const mockSavePreferences = jest.fn((...args: unknown[]) => ({type: 'MOCK_SAVE_PREFERENCES', args}));
jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
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

const railProduct = (name: string, pluginId: string): ProductComponent => ({...TestHelper.makeProduct(name), pluginId, baseURL: `/${pluginId}`, switcherLinkURL: `/${pluginId}`});
const agents = railProduct('Agents', 'mattermost-ai');
const playbooks = railProduct('Playbooks', 'playbooks');

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

// The store of the last render, for reading back the rail's preferences as saved.
let lastStore: ReturnType<typeof renderWithContext>['store'];

function renderAt(pathname: string, state: DeepPartial<GlobalState>) {
    const result = renderWithContext(<ProductRail/>, state, {history: createMemoryHistory({initialEntries: [pathname]})});
    lastStore = result.store;
    return result;
}

const savedHiddenItems = () => lastStore.getState().entities.preferences.myPreferences['sidebar_settings--product_rail_hidden_items']?.value;

describe('ProductRail', () => {
    // Where each item was is saved to localStorage, which would otherwise carry between tests.
    beforeEach(() => {
        localStorage.clear();
        mockSavePreferences.mockClear();
        jest.spyOn(Client4, 'savePreferences').mockResolvedValue({status: 'OK'});
    });

    test('should render nothing when the feature flag is off', () => {
        renderAt('/team-one/channels/town-square', getState({enabled: false}));

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    test('should render nothing on backstage pages', () => {
        renderAt('/team-one/integrations', getState());
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

        renderAt('/team-one/emoji/add', getState());
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    test('should link Channels to the team\'s default channel, leaving Threads to the channel sidebar', () => {
        renderAt('/team-one/channels/town-square', getState());

        // Not the team's root, which can redirect into Threads.
        expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        expect(screen.queryByRole('link', {name: /Threads/})).not.toBeInTheDocument();
    });

    test('should mark Channels active in a channel and in Threads, which is part of it', () => {
        const {unmount} = renderAt('/team-one/channels/town-square', getState());

        expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');

        unmount();
        renderAt('/team-one/threads', getState());

        expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
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

    describe('with a plugin registering a rail section', () => {
        const handbook = TestHelper.getChannelMock({id: 'handbook', name: 'handbook', display_name: 'Handbook', team_id: team.id});
        const docsSection = {
            id: 'docs-section',
            pluginId: 'conflux',
            label: 'Docs',
            icon: <span>{'docs-icon'}</span>,
            matcher: (_state: GlobalState, channel: {id: string}) => channel.id === handbook.id,
        };

        function getDocsState(currentChannelId: string, section: ProductRailSection = 'channels', lastPathByTeam = {}): DeepPartial<GlobalState> {
            const state = getBoardsState(currentChannelId, section);
            const channels = state.entities!.channels!;
            return {
                ...state,
                entities: {
                    ...state.entities,
                    channels: {
                        ...channels,
                        channels: {...channels.channels, [handbook.id]: handbook},
                        myMembers: {
                            ...channels.myMembers,
                            [handbook.id]: TestHelper.getChannelMembershipMock({channel_id: handbook.id, user_id: user.id, mention_count: 7, mention_count_root: 7, msg_count: 0, msg_count_root: 0}, {}),
                        },
                        messageCounts: {...channels.messageCounts, [handbook.id]: {total: 5, root: 5}},
                    },
                },
                plugins: {
                    components: {
                        Product: [],
                        ChannelKind: [],
                        ProductRailChannelSection: [docsSection],
                    } as unknown as GlobalState['plugins']['components'],
                },
                views: {
                    productRail: {section, lastPathByTeam, lastPathsLoaded: false},
                },
            };
        }

        test('should move a section\'s channel opened from Boards to its own section', () => {
            const state = getDocsState(handbook.id, 'boards');
            const {store} = renderAt('/team-one/channels/handbook', {
                ...state,
                plugins: {components: {...state.plugins!.components, ChannelKind: [boardKind]} as unknown as GlobalState['plugins']['components']},
            });

            expect(store.getState().views.productRail.section).toBe('plugin:conflux');
        });

        test('should show the section after Channels, opening its first channel, and no Boards without boards', () => {
            renderAt('/team-one/channels/town-square', getDocsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Docs/})).toHaveAttribute('href', '/team-one/channels/handbook');
            expect(screen.queryByRole('link', {name: /Boards/})).not.toBeInTheDocument();
        });

        test('should count the section\'s mentions on it and on Channels, which lists its channels too', () => {
            renderAt('/team-one/channels/town-square', getDocsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Docs/})).toHaveTextContent('7');

            // Town square's 1, the roadmap's 4 (not a board here) and the handbook's 7.
            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('12');
        });

        test('should stay in Channels for a section\'s channel opened there, as Channels lists it too', () => {
            const {store} = renderAt('/team-one/channels/handbook', getDocsState(handbook.id));

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(store.getState().views.productRail.section).toBe('channels');
        });

        test('should reopen the section saved from the last session, keeping the sub-path to return to', () => {
            localStorage.setItem(`product_rail_section_${user.id}`, 'plugin:conflux');
            const {store} = renderAt('/team-one/channels/handbook/pages/abc', getDocsState(handbook.id));

            expect(screen.getByRole('link', {name: /Docs/})).toHaveAttribute('aria-current', 'page');
            expect(store.getState().views.productRail.section).toBe('plugin:conflux');
            expect(store.getState().views.productRail.lastPathByTeam['plugin:conflux'][team.id]).toBe('/team-one/channels/handbook/pages/abc');
        });

        test('should keep the saved section on reload while the plugin doesn\'t yet know the open channel is its own', () => {
            localStorage.setItem(`product_rail_section_${user.id}`, 'plugin:conflux');
            const state = getDocsState(handbook.id);
            const {store} = renderAt('/team-one/channels/handbook/pages/abc', {
                ...state,
                plugins: {components: {...state.plugins!.components, ProductRailChannelSection: [{...docsSection, matcher: () => false}]} as unknown as GlobalState['plugins']['components']},
            });

            expect(store.getState().views.productRail.section).toBe('plugin:conflux');
        });

        test('should return the section to the page last viewed under it', () => {
            renderAt('/team-one/channels/town-square', getDocsState(townSquare.id, 'channels', {'plugin:conflux': {[team.id]: '/team-one/channels/handbook/pages/xyz'}}));

            expect(screen.getByRole('link', {name: /Docs/})).toHaveAttribute('href', '/team-one/channels/handbook/pages/xyz');
        });
    });

    describe('direct and group messages', () => {
        // A direct message with 2 unread mentions, from Threads.
        function withDirectMessage(state: DeepPartial<GlobalState>): DeepPartial<GlobalState> {
            const dm = TestHelper.getChannelMock({id: 'dm', name: 'user1__user2', type: 'D', team_id: ''});
            const channels = state.entities!.channels!;
            return {
                ...state,
                entities: {
                    ...state.entities,
                    channels: {
                        ...channels,
                        channels: {...channels.channels, [dm.id]: dm},
                        myMembers: {...channels.myMembers, [dm.id]: TestHelper.getChannelMembershipMock({channel_id: dm.id, user_id: user.id, mention_count: 2, mention_count_root: 2, msg_count: 0, msg_count_root: 0}, {})},
                        messageCounts: {...channels.messageCounts, [dm.id]: {total: 2, root: 2}},
                    },
                },
            };
        }

        test('should count their mentions on Channels, with boards split off', () => {
            renderAt('/team-one/threads', withDirectMessage(getBoardsState(townSquare.id)));

            // Town square's 1 and the direct message's 2; the boards' stay on Boards.
            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('3');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveTextContent('4');
        });

        test('should keep them on Channels even when a board plugin claims them', () => {
            const state = withDirectMessage(getBoardsState(townSquare.id));
            renderAt('/team-one/threads', {
                ...state,
                plugins: {
                    components: {
                        Product: [],
                        ChannelKind: [{...boardKind, matcher: (_state: GlobalState, channel: {id: string}) => channel.id === 'dm' || channel.id === roadmap.id || channel.id === bugs.id}],
                    } as unknown as GlobalState['plugins']['components'],
                },
            });

            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('3');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveTextContent('4');
        });

        test('should count their mentions on Channels, without boards', () => {
            const state = getBoardsState(townSquare.id);
            renderAt('/team-one/threads', withDirectMessage({
                ...state,
                plugins: {components: {Product: [], ChannelKind: []} as unknown as GlobalState['plugins']['components']},
            }));

            // Town square's 1, the boards' (now plain channels) 4 and the direct message's 2.
            expect(screen.getByRole('link', {name: /Channels/})).toHaveTextContent('7');
        });
    });

    describe('modified clicks', () => {
        test('should leave the sidebar alone when Boards is opened in a new tab', () => {
            const {store} = renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id, 'channels'));

            fireEvent.click(screen.getByRole('link', {name: /Boards/}), {metaKey: true});
            expect(store.getState().views.productRail.section).toBe('channels');

            fireEvent.click(screen.getByRole('link', {name: /Boards/}), {ctrlKey: true});
            expect(store.getState().views.productRail.section).toBe('channels');

            fireEvent.click(screen.getByRole('link', {name: /Boards/}));
            expect(store.getState().views.productRail.section).toBe('boards');
        });
    });

    describe('Threads in Channels and Boards', () => {
        test('should stay in Boards when Threads is opened from the Boards sidebar, with Boards leading out to a board', () => {
            const {store} = renderAt('/team-one/threads', getBoardsState(townSquare.id, 'boards'));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(screen.getByRole('link', {name: /Channels/})).not.toHaveAttribute('aria-current');
            expect(store.getState().views.productRail.section).toBe('boards');
        });

        test('should stay in Channels when Threads is opened from the Channels sidebar', () => {
            const {store} = renderAt('/team-one/threads', getBoardsState(townSquare.id, 'channels'));

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(store.getState().views.productRail.section).toBe('channels');
        });
    });

    describe('order and boards in Channels', () => {
        test('should list Channels and Boards with no dividers', () => {
            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            const items = [...document.querySelectorAll('.ProductRail .ProductRail__item')].map((item) => item.id);
            expect(items).toEqual([
                'product-rail-item-channels',
                'product-rail-item-boards',
            ]);
        });

        test('should follow Boards with Agents and Playbooks, then list other products', () => {
            const product = (name: string, pluginId: string) => ({...TestHelper.makeProduct(name), pluginId, baseURL: `/${pluginId}`, switcherLinkURL: `/${pluginId}`});
            const state = getBoardsState(townSquare.id);
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: [product('Calls', 'calls'), product('Playbooks', 'playbooks'), product('Agents', 'mattermost-ai')],
                    },
                },
            });

            const items = [...document.querySelectorAll('.ProductRail .ProductRail__item')].map((item) => item.id);
            expect(items).toEqual([
                'product-rail-item-channels',
                'product-rail-item-boards',
                'product-rail-item-mattermost-ai',
                'product-rail-item-playbooks',
                'product-rail-item-calls',
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

        test('should lead Channels out of Threads, to a channel', () => {
            renderAt('/team-one/threads/thread1', getState());

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('aria-current', 'page');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should set aside a Threads path an earlier build saved for Channels or Boards', () => {
            localStorage.setItem(`product_rail_last_paths_${user.id}`, JSON.stringify({
                channels: {[team.id]: '/team-one/threads/thread2'},
                boards: {[team.id]: '/team-one/threads'},
            }));

            renderAt('/mattermost-ai', {...getBoardsState(townSquare.id), plugins: {components: {Product: [agents], ChannelKind: [boardKind]} as unknown as GlobalState['plugins']['components']}});

            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
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
                product: {[team.id]: '/team-one/somewhere'},
            }));

            renderAt('/team-one/channels/town-square', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
        });

        test('should not return to a channel that was renamed or left since', () => {
            localStorage.setItem(`product_rail_last_paths_${user.id}`, JSON.stringify({
                boards: {[team.id]: '/team-one/channels/old-board-name'},
                channels: {[team.id]: '/team-one/channels/left-channel/post1'},
            }));

            renderAt('/team-one/threads', getBoardsState(townSquare.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
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

            // On a board, so Boards is filed under and Channels keeps its saved path.
            renderAt('/team-one/channels/bugs', getBoardsState(bugs.id));

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/bugs');
            expect(screen.getByRole('link', {name: /Channels/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should save where the user is for the next session', () => {
            renderAt('/team-one/channels/roadmap', getBoardsState(roadmap.id));

            const saved = JSON.parse(localStorage.getItem(`product_rail_last_paths_${user.id}`) ?? '{}');
            expect(saved.boards).toEqual({[team.id]: '/team-one/channels/roadmap'});
        });
    });

    describe('with the team sidebar hidden', () => {
        // A second team, so there's a team sidebar to bring back.
        function withTwoTeams(state: DeepPartial<GlobalState>): DeepPartial<GlobalState> {
            const team2 = TestHelper.getTeamMock({id: 'team2', name: 'team-two'});
            const teams = state.entities!.teams!;
            return {
                ...state,
                entities: {
                    ...state.entities,
                    teams: {
                        ...teams,
                        teams: {...teams.teams, [team2.id]: team2},
                        myMembers: {...teams.myMembers, [team2.id]: TestHelper.getTeamMembershipMock({team_id: team2.id, user_id: user.id})},
                    },
                },
            };
        }

        test('should bring the team sidebar back from the bottom of the rail', async () => {
            renderAt('/team-one/channels/town-square', withTwoTeams(getState()));

            await userEvent.click(screen.getByRole('button', {name: 'Show team sidebar'}));

            expect(mockSavePreferences).toHaveBeenCalledWith(user.id, [expect.objectContaining({
                name: 'hide_team_sidebar',
                value: 'false',
            })]);
        });

        test('should offer no way back to a team sidebar a user with one team never has', () => {
            renderAt('/team-one/channels/town-square', getState());

            expect(screen.queryByRole('button', {name: 'Show team sidebar'})).not.toBeInTheDocument();
        });

        test('should leave the team sidebar\'s button to it while it shows', () => {
            const state = getState();
            renderAt('/team-one/channels/town-square', {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        myPreferences: {
                            'sidebar_settings--hide_team_sidebar': {category: 'sidebar_settings', name: 'hide_team_sidebar', user_id: user.id, value: 'false'},
                        },
                    },
                },
            });

            expect(screen.queryByRole('button', {name: 'Show team sidebar'})).not.toBeInTheDocument();
        });
    });

    describe('Boards with no board to open', () => {
        // A board kind is registered, but no channel in the team is a board.
        function getNoBoardsState(): DeepPartial<GlobalState> {
            const state = getBoardsState(townSquare.id, 'channels');
            return {
                ...state,
                plugins: {
                    components: {
                        Product: [agents],
                        ChannelKind: [{...boardKind, matcher: () => false}],
                    } as unknown as GlobalState['plugins']['components'],
                },
            };
        }

        test('should stay in place in a channel, just switching the sidebar', () => {
            renderAt('/team-one/channels/town-square', getNoBoardsState());

            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('href', '/team-one/channels/town-square');
        });

        test('should open the channel Channels would from another product, keeping the Boards sidebar', async () => {
            const history = createMemoryHistory({initialEntries: ['/mattermost-ai']});
            const {store} = renderWithContext(<ProductRail/>, getNoBoardsState(), {history});

            const boardsLink = screen.getByRole('link', {name: /Boards/});
            expect(boardsLink).toHaveAttribute('href', '/team-one/channels/town-square');

            await userEvent.click(boardsLink);

            expect(history.location.pathname).toBe('/team-one/channels/town-square');
            expect(store.getState().views.productRail.section).toBe('boards');
            expect(screen.getByRole('link', {name: /Boards/})).toHaveAttribute('aria-current', 'page');
        });
    });

    describe('Boards before the team\'s boards are known', () => {
        test('should open the first board once the boards load', async () => {
            const historyReplace = (global as unknown as {historyMock: {replace: jest.Mock}}).historyMock.replace;
            historyReplace.mockClear();

            // The boards plugin can't tell boards apart until its own state has loaded.
            let boardsKnown = false;
            const state = getBoardsState(townSquare.id);
            const {store} = renderAt('/mattermost-ai', {
                ...state,
                plugins: {
                    components: {
                        Product: [agents],
                        ChannelKind: [{...boardKind, matcher: (_state: GlobalState, channel: {id: string}) => boardsKnown && channel.id === roadmap.id}],
                    } as unknown as GlobalState['plugins']['components'],
                },
            });

            await userEvent.click(screen.getByRole('link', {name: /Boards/}));
            expect(historyReplace).not.toHaveBeenCalled();

            boardsKnown = true;
            act(() => {
                store.dispatch({type: ChannelTypes.RECEIVED_CHANNEL, data: {...roadmap}});
            });

            expect(historyReplace).toHaveBeenCalledWith('/team-one/channels/roadmap');
        });
    });

    describe('Boards with no board to open, leaving before the channel loads', () => {
        test('should move the sidebar to Channels on a later, ordinary visit to that channel', async () => {
            // Bugs is still the open channel, so the fallback channel hasn't loaded yet when the user leaves.
            const state = getBoardsState(bugs.id, 'channels');
            const history = createMemoryHistory({initialEntries: ['/mattermost-ai']});
            const {store} = renderWithContext(<ProductRail/>, {
                ...state,
                plugins: {
                    components: {
                        Product: [agents],
                        ChannelKind: [{...boardKind, matcher: () => false}],
                    } as unknown as GlobalState['plugins']['components'],
                },
            }, {history});

            await userEvent.click(screen.getByRole('link', {name: /Boards/}));
            expect(history.location.pathname).toBe('/team-one/channels/town-square');
            act(() => {
                history.push('/mattermost-ai');
            });

            // Later, town square opens from an ordinary link.
            act(() => {
                store.dispatch({type: ChannelTypes.SELECT_CHANNEL, data: townSquare.id});
                history.push('/team-one/channels/town-square');
            });

            expect(store.getState().views.productRail.section).toBe('channels');
        });
    });

    describe('Boards before the team\'s boards are known, leaving first', () => {
        test('should not open the first board after the user leaves for a page outside the rail', async () => {
            const historyReplace = (global as unknown as {historyMock: {replace: jest.Mock}}).historyMock.replace;
            historyReplace.mockClear();

            let boardsKnown = false;
            const state = getBoardsState(townSquare.id);
            const history = createMemoryHistory({initialEntries: ['/mattermost-ai']});
            const {store} = renderWithContext(<ProductRail/>, {
                ...state,
                plugins: {
                    components: {
                        Product: [agents],
                        ChannelKind: [{...boardKind, matcher: (_state: GlobalState, channel: {id: string}) => boardsKnown && channel.id === roadmap.id}],
                    } as unknown as GlobalState['plugins']['components'],
                },
            }, {history});

            await userEvent.click(screen.getByRole('link', {name: /Boards/}));
            act(() => {
                history.push('/team-one/integrations');
            });

            boardsKnown = true;
            act(() => {
                store.dispatch({type: ChannelTypes.RECEIVED_CHANNEL, data: {...roadmap}});
                history.push('/team-one/channels/town-square');
            });

            expect(historyReplace).not.toHaveBeenCalled();
        });
    });

    describe('hiding items', () => {
        function getHiddenState(hidden: string[], currentChannelId = townSquare.id): DeepPartial<GlobalState> {
            const state = getBoardsState(currentChannelId);
            return {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        myPreferences: {
                            'sidebar_settings--product_rail_hidden_items': {category: 'sidebar_settings', name: 'product_rail_hidden_items', user_id: user.id, value: JSON.stringify(hidden)},
                        },
                    },
                },
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: [agents, playbooks],
                    },
                },
            };
        }

        const railItemIds = () => [...document.querySelectorAll('.ProductRail .ProductRail__item')].map((item) => item.id);

        test('should list hidden items in the More menu at the end of the rail', async () => {
            renderAt('/team-one/channels/town-square', getHiddenState(['boards', 'mattermost-ai']));

            expect(railItemIds()).toEqual([
                'product-rail-item-channels',
                'product-rail-item-playbooks',
                'product-rail-item-more',
            ]);

            await userEvent.click(screen.getByRole('button', {name: /More products/}));

            expect(screen.getByRole('menuitem', {name: /Boards/})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: /Agents/})).toBeInTheDocument();
        });

        test('should read out the activity on the More item', () => {
            // Boards, unpinned, has 4 mentions.
            renderAt('/team-one/channels/town-square', getHiddenState(['boards']));

            expect(screen.getByRole('button', {name: 'More products, 4 mentions'})).toBeInTheDocument();
        });

        test('should show no More item while nothing is hidden', () => {
            renderAt('/team-one/channels/town-square', getHiddenState([]));

            expect(screen.queryByRole('button', {name: /More products/})).not.toBeInTheDocument();
        });

        test('should keep a hidden item in the rail while it is open', () => {
            renderAt('/mattermost-ai', getHiddenState(['mattermost-ai']));

            expect(screen.getByRole('link', {name: /Agents/})).toHaveAttribute('aria-current', 'page');
            expect(screen.queryByRole('button', {name: /More products/})).not.toBeInTheDocument();
        });

        test('should open a hidden item from the More menu', async () => {
            const historyPush = (global as unknown as {historyMock: {push: jest.Mock}}).historyMock.push;
            historyPush.mockClear();
            renderAt('/team-one/channels/town-square', getHiddenState(['mattermost-ai']));

            await userEvent.click(screen.getByRole('button', {name: /More products/}));
            await userEvent.click(screen.getByRole('menuitem', {name: /Agents/}));

            // Menu items run their click handler once the menu has finished closing.
            await waitFor(() => {
                expect(historyPush).toHaveBeenCalledWith('/mattermost-ai');
            });
        });

        test('should unpin an item from its right-click menu', async () => {
            renderAt('/team-one/channels/town-square', getHiddenState(['boards']));

            fireEvent.contextMenu(screen.getByRole('link', {name: /Agents/}));
            await userEvent.click(await screen.findByRole('menuitem', {name: 'Unpin'}));

            await waitFor(() => expect(savedHiddenItems()).toBe(JSON.stringify(['boards', 'mattermost-ai:/mattermost-ai'])));
        });

        test('should pin an open unpinned item back on the rail', async () => {
            renderAt('/mattermost-ai', getHiddenState(['boards', 'mattermost-ai']));

            fireEvent.contextMenu(screen.getByRole('link', {name: /Agents/}));
            await userEvent.click(await screen.findByRole('menuitem', {name: 'Pin'}));

            await waitFor(() => expect(savedHiddenItems()).toBe(JSON.stringify(['boards'])));
        });

        test('should pin an item from its row in the More menu without opening it', async () => {
            const historyPush = (global as unknown as {historyMock: {push: jest.Mock}}).historyMock.push;
            historyPush.mockClear();
            renderAt('/team-one/channels/town-square', getHiddenState(['boards', 'mattermost-ai']));

            await userEvent.click(screen.getByRole('button', {name: /More products/}));
            await userEvent.click(screen.getByRole('button', {name: 'Pin Agents', hidden: true}));

            await waitFor(() => expect(savedHiddenItems()).toBe(JSON.stringify(['boards'])));
            expect(historyPush).not.toHaveBeenCalled();
        });

        test('should reach a row\'s pin button with the keyboard and pin without opening the product', async () => {
            const historyPush = (global as unknown as {historyMock: {push: jest.Mock}}).historyMock.push;
            historyPush.mockClear();
            renderAt('/team-one/channels/town-square', getHiddenState(['boards', 'mattermost-ai']));

            screen.getByRole('button', {name: /More products/}).focus();
            await userEvent.keyboard('{Enter}');
            const boardsRow = await screen.findByRole('menuitem', {name: /Boards/});
            await waitFor(() => expect(boardsRow).toHaveFocus());

            await userEvent.keyboard('{ArrowRight}');
            expect(screen.getByRole('button', {name: 'Pin Boards', hidden: true})).toHaveFocus();
            await userEvent.keyboard('{ArrowLeft}');
            expect(boardsRow).toHaveFocus();

            await userEvent.keyboard('{ArrowRight}{Enter}');

            await waitFor(() => expect(savedHiddenItems()).toBe(JSON.stringify(['mattermost-ai'])));
            expect(historyPush).not.toHaveBeenCalled();
        });

        test('should move focus to the item on the rail when pinning the last one in More by keyboard', async () => {
            const {store} = renderAt('/team-one/channels/town-square', getHiddenState(['boards']));

            screen.getByRole('button', {name: /More products/}).focus();
            await userEvent.keyboard('{Enter}');
            await waitFor(() => expect(screen.getByRole('menuitem', {name: /Boards/})).toHaveFocus());
            await userEvent.keyboard('{ArrowRight}{Enter}');

            // The save is mocked, so the preference arrives as the server would echo it.
            act(() => {
                store.dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [{category: 'sidebar_settings', name: 'product_rail_hidden_items', user_id: user.id, value: '[]'}]});
            });

            expect(screen.queryByRole('button', {name: /More products/})).not.toBeInTheDocument();
            await waitFor(() => expect(screen.getByRole('link', {name: /Boards/})).toHaveFocus());
        });

        test('should keep a plugin\'s other products unpinned when pinning one unpinned by its bare plugin id', async () => {
            const state = getHiddenState(['mattermost-ai']);
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: [
                            {...railProduct('Agents One', 'mattermost-ai'), baseURL: '/agents-one', switcherLinkURL: '/agents-one'},
                            {...railProduct('Agents Two', 'mattermost-ai'), baseURL: '/agents-two', switcherLinkURL: '/agents-two'},
                        ],
                    },
                },
            });

            await userEvent.click(screen.getByRole('button', {name: /More products/}));
            await userEvent.click(screen.getByRole('button', {name: 'Pin Agents One', hidden: true}));

            await waitFor(() => expect(savedHiddenItems()).toBe(JSON.stringify(['mattermost-ai:/agents-two'])));
        });

        test('should describe how to drag an item on its link, which takes focus', () => {
            renderAt('/team-one/channels/town-square', getHiddenState([]));

            const link = screen.getByRole('link', {name: /Agents/});
            const descriptionId = link.getAttribute('aria-describedby');
            expect(descriptionId).toBeTruthy();
            expect(document.getElementById(descriptionId!)).toHaveTextContent(/space/i);
        });

        test('should offer no right-click menu on Channels', () => {
            renderAt('/team-one/channels/town-square', getHiddenState([]));

            expect(fireEvent.contextMenu(screen.getByRole('link', {name: /Channels/}))).toBe(true);
            expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
        });

        test.each([
            ['malformed', '{"boards": true'],
            ['not a list', '{"boards": true}'],
        ])('should hide nothing when the preference is %s', (_case, value) => {
            const state = getHiddenState([]);
            renderAt('/team-one/channels/town-square', {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        myPreferences: {
                            'sidebar_settings--product_rail_hidden_items': {category: 'sidebar_settings', name: 'product_rail_hidden_items', user_id: user.id, value},
                        },
                    },
                },
            });

            expect(screen.getByRole('link', {name: /Boards/})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /More products/})).not.toBeInTheDocument();
        });
    });

    describe('reordering items', () => {
        function getOrderState({order, hidden = []}: {order?: string[]; hidden?: string[]}): DeepPartial<GlobalState> {
            const state = getBoardsState(townSquare.id);
            const preference = (name: string, value: string[]) => ({category: 'sidebar_settings', name, user_id: user.id, value: JSON.stringify(value)});
            return {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        myPreferences: {
                            ...(order ? {'sidebar_settings--product_rail_order': preference('product_rail_order', order)} : {}),
                            'sidebar_settings--product_rail_hidden_items': preference('product_rail_hidden_items', hidden),
                        },
                    },
                },
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: [agents, playbooks],
                    },
                },
            };
        }

        const railItemIds = () => [...document.querySelectorAll('.ProductRail .ProductRail__item')].map((item) => item.id.replace('product-rail-item-', ''));

        test('should list items in the saved order, then any it does not name in their default order', () => {
            renderAt('/team-one/channels/town-square', getOrderState({order: ['playbooks', 'boards', 'threads']}));

            // An item the rail no longer has, such as Threads from an earlier build, is skipped.
            expect(railItemIds()).toEqual(['playbooks', 'boards', 'channels', 'mattermost-ai']);
        });

        test.each([
            ['up past a neighbour', ['threads', 'channels', 'mattermost-ai', 'playbooks'], 2, 1, ['threads', 'mattermost-ai', 'channels', 'boards', 'playbooks']],
            ['to the end', ['threads', 'channels', 'mattermost-ai', 'playbooks'], 0, 3, ['channels', 'boards', 'mattermost-ai', 'playbooks', 'threads']],
            ['to the top', ['threads', 'channels', 'mattermost-ai', 'playbooks'], 3, 0, ['playbooks', 'threads', 'channels', 'boards', 'mattermost-ai']],
        ])('should move an item %s, keeping items in More in place', (_case, railIds, from, to, expected) => {
            // Boards is in More: in the full order, but not on the rail.
            const orderedIds = ['threads', 'channels', 'boards', 'mattermost-ai', 'playbooks'];

            expect(moveRailItem(orderedIds, railIds as string[], from as number, to as number)).toEqual(expected);
        });

        test.each([
            ['in one order', false],
            ['in the other order', true],
        ])('should keep apart two products from the same plugin, registered %s', (_case, reversed) => {
            const agentsOne = {...railProduct('Agents One', 'mattermost-ai'), baseURL: '/agents-one', switcherLinkURL: '/agents-one'};
            const agentsTwo = {...railProduct('Agents Two', 'mattermost-ai'), baseURL: '/agents-two', switcherLinkURL: '/agents-two'};
            const state = getOrderState({hidden: ['mattermost-ai:/agents-two']});
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: reversed ? [agentsTwo, agentsOne] : [agentsOne, agentsTwo],
                    },
                },
            });

            expect(railItemIds()).toEqual(['channels', 'boards', 'mattermost-ai:/agents-one', 'more']);
        });

        test('should not let a plugin\'s remaining product take on another\'s preferences', () => {
            // Unpinned while the plugin had two products; the other one is still pinned.
            const state = getOrderState({hidden: ['mattermost-ai:/agents-one']});
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {
                    components: {
                        ...state.plugins!.components,
                        Product: [{...railProduct('Agents Two', 'mattermost-ai'), baseURL: '/agents-two', switcherLinkURL: '/agents-two'}],
                    },
                },
            });

            expect(railItemIds()).toEqual(['channels', 'boards', 'mattermost-ai']);
        });

        test('should keep a product unpinned when its plugin adds another product', () => {
            // Agents One was unpinned while it was the plugin's only product.
            const state = getOrderState({hidden: ['mattermost-ai:/agents-one']});
            const agentsOne = {...railProduct('Agents One', 'mattermost-ai'), baseURL: '/agents-one', switcherLinkURL: '/agents-one'};
            const agentsTwo = {...railProduct('Agents Two', 'mattermost-ai'), baseURL: '/agents-two', switcherLinkURL: '/agents-two'};
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {components: {...state.plugins!.components, Product: [agentsOne, agentsTwo]}},
            });

            expect(railItemIds()).toEqual(['channels', 'boards', 'mattermost-ai:/agents-two', 'more']);
        });

        test('should keep a product\'s place when its plugin adds another product', () => {
            const state = getOrderState({order: ['mattermost-ai:/agents-one', 'threads']});
            const agentsOne = {...railProduct('Agents One', 'mattermost-ai'), baseURL: '/agents-one', switcherLinkURL: '/agents-one'};
            const agentsTwo = {...railProduct('Agents Two', 'mattermost-ai'), baseURL: '/agents-two', switcherLinkURL: '/agents-two'};
            renderAt('/team-one/channels/town-square', {
                ...state,
                plugins: {components: {...state.plugins!.components, Product: [agentsTwo, agentsOne]}},
            });

            expect(railItemIds()).toEqual(['mattermost-ai:/agents-one', 'channels', 'boards', 'mattermost-ai:/agents-two']);
        });

        test('should still honour a bare plugin id saved by earlier builds', () => {
            renderAt('/team-one/channels/town-square', getOrderState({order: ['playbooks', 'threads'], hidden: ['mattermost-ai']}));

            expect(railItemIds()).toEqual(['playbooks', 'channels', 'boards', 'more']);
        });

        test('should not move an item dropped where it was', () => {
            expect(moveRailItem(['threads', 'channels'], ['threads', 'channels'], 1, 1)).toBeNull();
        });
    });
});

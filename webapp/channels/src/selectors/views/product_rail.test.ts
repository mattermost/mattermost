// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import localStorageStore from 'stores/local_storage_store';

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductRailSection} from 'types/store/views';

import {filterChannelIdsForSection, getBoardChannelIds, getProductRailFilter, getProductRailSection, getProductRailTeamIdToRestore, isProductRailShown, isTeamSidebarHidden, toFullListIndex} from './product_rail';
import type {ChannelKindRegistration} from './product_rail';

const channel = TestHelper.getChannelMock({id: 'channel'});
const board = TestHelper.getChannelMock({id: 'board'});

const boardKind: ChannelKindRegistration = {
    id: 'board-kind',
    pluginId: 'boards',
    kind: 'board',
    matcher: (_state, c) => c.id === board.id,
};

function getState({enabled = true, registrations = [boardKind], section = 'channels'}: {
    enabled?: boolean;
    registrations?: ChannelKindRegistration[];
    section?: ProductRailSection;
} = {}): GlobalState {
    const state: DeepPartial<GlobalState> = {
        entities: {
            general: {config: {FeatureFlagProductRail: enabled ? 'true' : 'false'}},
            channels: {channels: {[channel.id]: channel, [board.id]: board}},
            preferences: {myPreferences: {}},
        },
        plugins: {components: {ChannelKind: registrations} as unknown as GlobalState['plugins']['components']},
        views: {productRail: {section, lastPathByTeam: {}, lastPathsLoaded: false}, browser: {windowSize: 'desktopView'}},
    };
    return state as GlobalState;
}

describe('getBoardChannelIds', () => {
    test('should return the channels a board matcher accepts', () => {
        expect(getBoardChannelIds(getState())).toEqual(new Set([board.id]));
    });

    test('should return nothing without a board registration', () => {
        expect(getBoardChannelIds(getState({registrations: []}))).toEqual(new Set());
    });
});

describe('getProductRailSection', () => {
    test('should return the section while the rail is on and boards are registered', () => {
        expect(getProductRailSection(getState({section: 'boards'}))).toBe('boards');
    });

    test('should return null while the rail is off', () => {
        expect(getProductRailSection(getState({enabled: false}))).toBeNull();
    });

    test('should return null on mobile, where the rail is hidden', () => {
        const state = getState({section: 'boards'});
        expect(getProductRailSection({...state, views: {...state.views, browser: {windowSize: 'mobileView'}}} as GlobalState)).toBeNull();
    });

    test('should return null without a board registration', () => {
        expect(getProductRailSection(getState({registrations: []}))).toBeNull();
    });
});

describe('filterChannelIdsForSection', () => {
    const boardIds = new Set([board.id]);
    const ids = [channel.id, board.id];

    test('should keep everything without a section', () => {
        expect(filterChannelIdsForSection(ids, null, boardIds)).toBe(ids);
    });

    test('should keep only boards in Boards', () => {
        expect(filterChannelIdsForSection(ids, 'boards', boardIds)).toEqual([board.id]);
    });

    test('should leave out boards in Channels', () => {
        expect(filterChannelIdsForSection(ids, 'channels', boardIds)).toEqual([channel.id]);
    });
});

describe('toFullListIndex', () => {
    // b and d are hidden; a, c and e are shown.
    const full = ['a', 'b', 'c', 'd', 'e'];
    const visible = ['a', 'c', 'e'];

    test('should place an item dropped before a shown item right before it', () => {
        // e dropped at the top goes before a.
        expect(toFullListIndex(visible, full, 'e', 0)).toBe(0);

        // a dropped between c and e goes right before e, past the hidden d.
        expect(toFullListIndex(visible, full, 'a', 1)).toBe(3);
    });

    test('should place an item dropped last right after the last shown item', () => {
        expect(toFullListIndex(visible, full, 'a', 2)).toBe(4);
    });

    test('should keep an item where it was when dropped back in place', () => {
        // c is shown second and dropped second: it stays after the hidden b.
        expect(toFullListIndex(visible, full, 'c', 1)).toBe(2);
        expect(toFullListIndex(visible, full, 'e', 2)).toBe(4);
    });

    test('should place an item first when nothing else is shown', () => {
        expect(toFullListIndex(['a'], full, 'a', 0)).toBe(0);
    });
});

describe('getProductRailFilter', () => {
    test('should narrow Channels to channels by default', () => {
        expect(getProductRailFilter(getState({section: 'channels'}))).toBe('channels');
    });

    test('should not narrow Channels while it lists boards too', () => {
        const state = getState({section: 'channels'});
        const withBoardsShown = {
            ...state,
            entities: {
                ...state.entities,
                preferences: {
                    myPreferences: {
                        'sidebar_settings--show_boards_in_channels': {category: 'sidebar_settings', name: 'show_boards_in_channels', user_id: 'user', value: 'true'},
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getProductRailFilter(withBoardsShown)).toBeNull();
        expect(getProductRailFilter({...withBoardsShown, views: {...withBoardsShown.views, productRail: {...withBoardsShown.views.productRail, section: 'boards'}}})).toBe('boards');
    });
});

describe('isTeamSidebarHidden', () => {
    const withTeamSidebarHidden = (windowSize: string) => {
        const state = getState();
        return {
            ...state,
            entities: {
                ...state.entities,
                preferences: {
                    myPreferences: {
                        'sidebar_settings--hide_team_sidebar': {category: 'sidebar_settings', name: 'hide_team_sidebar', user_id: 'user', value: 'true'},
                    },
                },
            },
            views: {...state.views, browser: {windowSize}},
        } as unknown as GlobalState;
    };

    test('should follow the preference on desktop', () => {
        expect(isTeamSidebarHidden(withTeamSidebarHidden('desktopView'))).toBe(true);
    });

    test('should keep the team sidebar on mobile, where the rail\'s team menu is hidden', () => {
        expect(isTeamSidebarHidden(withTeamSidebarHidden('mobileView'))).toBe(false);
    });
});

describe('isProductRailShown', () => {
    const withView = (state: GlobalState, {teamId = 'team1', windowSize = 'desktopView'} = {}) => ({
        ...state,
        entities: {...state.entities, teams: {...state.entities.teams, currentTeamId: teamId}},
        views: {...state.views, browser: {windowSize}},
    } as unknown as GlobalState);

    test('should be shown with the flag on, a team and a desktop width', () => {
        expect(isProductRailShown(withView(getState()))).toBe(true);
    });

    test('should be hidden with the flag off, without a team, or on mobile', () => {
        expect(isProductRailShown(withView(getState({enabled: false})))).toBe(false);
        expect(isProductRailShown(withView(getState(), {teamId: ''}))).toBe(false);
        expect(isProductRailShown(withView(getState(), {windowSize: 'mobileView'}))).toBe(false);
    });
});

describe('getProductRailTeamIdToRestore', () => {
    const alpha = TestHelper.getTeamMock({id: 'alpha', display_name: 'Alpha'});
    const beta = TestHelper.getTeamMock({id: 'beta', display_name: 'Beta'});
    const left = TestHelper.getTeamMock({id: 'left', display_name: 'Left'});

    const withTeams = (currentTeamId = '') => {
        const state = getState();
        return {
            ...state,
            entities: {
                ...state.entities,
                users: {currentUserId: 'user', profiles: {user: TestHelper.getUserMock({id: 'user', locale: 'en'})}},
                teams: {
                    currentTeamId,
                    teams: {alpha, beta, left},
                    myMembers: {alpha: {team_id: 'alpha'}, beta: {team_id: 'beta'}},
                },
            },
        } as unknown as GlobalState;
    };

    afterEach(() => {
        localStorage.clear();
    });

    test('should restore nothing while a team is selected', () => {
        localStorageStore.setPreviousTeamId('user', 'beta');
        expect(getProductRailTeamIdToRestore(withTeams('alpha'))).toBe('');
    });

    test('should restore the team the user was last in', () => {
        localStorageStore.setPreviousTeamId('user', 'beta');
        expect(getProductRailTeamIdToRestore(withTeams())).toBe('beta');
    });

    test('should fall back to the first of the user\'s teams for a team they\'ve left, or none', () => {
        localStorageStore.setPreviousTeamId('user', 'left');
        expect(getProductRailTeamIdToRestore(withTeams())).toBe('alpha');
    });

    test('should fall back to the first team when storage can\'t be read', () => {
        const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(getProductRailTeamIdToRestore(withTeams())).toBe('alpha');
        getItem.mockRestore();
    });

    test('should restore nothing where the rail never shows', () => {
        localStorageStore.setPreviousTeamId('user', 'beta');
        const state = withTeams();
        expect(getProductRailTeamIdToRestore({...state, views: {...state.views, browser: {windowSize: 'mobileView'}}} as GlobalState)).toBe('');
        expect(getProductRailTeamIdToRestore({
            ...state,
            entities: {...state.entities, general: {...state.entities.general, config: {FeatureFlagProductRail: 'false'}}},
        } as GlobalState)).toBe('');
    });
});

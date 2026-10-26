// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductRailSection} from 'types/store/views';

import {filterChannelIdsForSection, getBoardChannelIds, getProductRailSection, toFullListIndex} from './product_rail';
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
        },
        plugins: {components: {ChannelKind: registrations} as unknown as GlobalState['plugins']['components']},
        views: {productRail: {section, lastPathByTeam: {}, lastPathsLoaded: false}},
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

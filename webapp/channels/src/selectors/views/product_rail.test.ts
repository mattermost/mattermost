// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ChannelKindRegistration} from 'types/store/plugins';
import type {ProductRailSection} from 'types/store/views';

import {filterChannelIdsForSection, getBoardChannelIds, getProductRailSection} from './product_rail';

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
        plugins: {components: {ChannelKind: registrations}},
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

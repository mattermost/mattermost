// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelKindRegistration} from 'types/store/plugins';

import {clearLoggedChannelKindErrors, getChannelKind} from './channel_kind';

function stateWith(registrations: Array<Partial<ChannelKindRegistration>>): GlobalState {
    return {plugins: {components: {ChannelKind: registrations}}} as unknown as GlobalState;
}

const board = {id: 'board1'} as Channel;
const channel = {id: 'town-square'} as Channel;

describe('getChannelKind', () => {
    afterEach(() => clearLoggedChannelKindErrors());

    test('is the kind of the first registration whose matcher accepts the channel', () => {
        const state = stateWith([
            {pluginId: 'a', kind: 'board', matcher: (_state, c) => c.id === 'board1'},
            {pluginId: 'b', kind: 'board', matcher: () => true},
        ]);
        expect(getChannelKind(state, board)).toBe('board');
    });

    test('is channel for a channel no registration matches, or no channel', () => {
        const state = stateWith([{pluginId: 'a', kind: 'board', matcher: (_state, c) => c.id === 'board1'}]);
        expect(getChannelKind(state, channel)).toBe('channel');
        expect(getChannelKind(state, undefined)).toBe('channel');
        expect(getChannelKind(stateWith([]), board)).toBe('channel');
    });

    test('runs the matchers once per channel for a given state', () => {
        const matcher = jest.fn((_state: GlobalState, c: Channel) => c.id === 'board1');
        const state = stateWith([{pluginId: 'a', kind: 'board', matcher}]);

        expect(getChannelKind(state, board)).toBe('board');
        expect(getChannelKind(state, {id: 'board1'})).toBe('board');
        expect(getChannelKind(state, channel)).toBe('channel');
        expect(matcher).toHaveBeenCalledTimes(2);

        expect(getChannelKind({...state}, board)).toBe('board');
        expect(matcher).toHaveBeenCalledTimes(3);
    });

    test('passes the matcher the stored channel when given only its id', () => {
        const stored = {id: 'board1', type: 'P'} as Channel;
        const matcher = jest.fn((_state: GlobalState, c: Channel) => c.type === 'P');
        const state = {
            ...stateWith([{pluginId: 'a', kind: 'board', matcher}]),
            entities: {channels: {channels: {board1: stored}}},
        } as unknown as GlobalState;

        expect(getChannelKind(state, {id: 'board1'})).toBe('board');
        expect(matcher).toHaveBeenCalledWith(state, stored);
    });

    test('treats a matcher that throws as no match, and logs it once', () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const broken = () => {
            throw new Error('boom');
        };
        const state = stateWith([
            {pluginId: 'broken', kind: 'board', matcher: broken},
            {pluginId: 'ok', kind: 'board', matcher: (_state, c) => c.id === 'board1'},
        ]);

        expect(getChannelKind(state, board)).toBe('board');
        expect(getChannelKind(state, board)).toBe('board');
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });
});

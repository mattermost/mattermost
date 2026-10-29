// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ChannelSidebarSubItem, ChannelSidebarSubItemsRegistration} from 'types/store/plugins';

import {
    areChannelSidebarSubItemsEqual,
    clearLoggedChannelSidebarSubItemsErrors,
    getChannelSidebarSubItems,
} from './channel_sidebar_sub_items';
import type {ResolvedChannelSidebarSubItem} from './channel_sidebar_sub_items';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(regs?: ChannelSidebarSubItemsRegistration[]): GlobalState {
    return {
        plugins: {
            components: {
                ChannelSidebarSubItems: regs,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(
    items: ChannelSidebarSubItem[] | null | undefined,
    partial: Partial<ChannelSidebarSubItemsRegistration> = {},
): ChannelSidebarSubItemsRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        getItems: () => items,
        ...partial,
    };
}

function makeItem(partial: Partial<ChannelSidebarSubItem> = {}): ChannelSidebarSubItem {
    return {id: 'a', label: 'Item A', subpath: 'views/a', ...partial};
}

describe('selectors/getChannelSidebarSubItems', () => {
    beforeEach(() => {
        clearLoggedChannelSidebarSubItemsErrors();
    });

    it('returns an empty array when there are no registrations', () => {
        expect(getChannelSidebarSubItems(makeState([]), makeChannel())).toEqual([]);
        expect(getChannelSidebarSubItems(makeState(undefined), makeChannel())).toEqual([]);
    });

    it('returns the same frozen empty array every time there is nothing to show', () => {
        const noRegs = getChannelSidebarSubItems(makeState([]), makeChannel());
        const noItems = getChannelSidebarSubItems(makeState([makeRegistration(null)]), makeChannel());
        const dm = getChannelSidebarSubItems(makeState([makeRegistration([makeItem()])]), makeChannel({type: 'D'}));

        expect(noRegs).toBe(noItems);
        expect(noRegs).toBe(dm);
        expect(Object.isFrozen(noRegs)).toBe(true);
    });

    it('returns an empty array for a null or undefined getItems result', () => {
        const state = makeState([
            makeRegistration(null, {id: 'r1', pluginId: 'a'}),
            makeRegistration(undefined, {id: 'r2', pluginId: 'b'}),
        ]);
        expect(getChannelSidebarSubItems(state, makeChannel())).toEqual([]);
    });

    it('returns an empty array for non-array getItems results', () => {
        const state = makeState([makeRegistration({} as unknown as ChannelSidebarSubItem[])]);
        expect(getChannelSidebarSubItems(state, makeChannel())).toEqual([]);
    });

    it('returns an empty array for DM, GM and undefined channels without calling getItems', () => {
        const getItems = jest.fn(() => [makeItem()]);
        const state = makeState([makeRegistration([], {getItems})]);

        expect(getChannelSidebarSubItems(state, makeChannel({type: 'D'}))).toEqual([]);
        expect(getChannelSidebarSubItems(state, makeChannel({type: 'G'}))).toEqual([]);
        expect(getChannelSidebarSubItems(state, undefined)).toEqual([]);
        expect(getItems).not.toHaveBeenCalled();
    });

    it('includes items for public and private channels', () => {
        const state = makeState([makeRegistration([makeItem()])]);
        expect(getChannelSidebarSubItems(state, makeChannel({type: 'O'}))).toHaveLength(1);
        expect(getChannelSidebarSubItems(state, makeChannel({type: 'P'}))).toHaveLength(1);
    });

    it('passes the full state and the channel to getItems', () => {
        const channel = makeChannel();
        const getItems = jest.fn(() => []);
        const state = makeState([makeRegistration([], {getItems})]);
        getChannelSidebarSubItems(state, channel);
        expect(getItems).toHaveBeenCalledWith(state, channel);
    });

    it('resolves items with a plugin-scoped key', () => {
        const state = makeState([makeRegistration([makeItem({iconName: 'folder-outline'})])]);
        expect(getChannelSidebarSubItems(state, makeChannel())).toEqual([{
            key: 'test-plugin:a',
            pluginId: 'test-plugin',
            id: 'a',
            label: 'Item A',
            subpath: 'views/a',
            iconName: 'folder-outline',
        }]);
    });

    it('concatenates items across registrations in registration order', () => {
        const state = makeState([
            makeRegistration([makeItem({id: '1'}), makeItem({id: '2'})], {id: 'r1', pluginId: 'alpha'}),
            makeRegistration([makeItem({id: '3'})], {id: 'r2', pluginId: 'alpha'}),
            makeRegistration([makeItem({id: '4'})], {id: 'r3', pluginId: 'beta'}),
        ]);
        expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.key)).toEqual([
            'alpha:1',
            'alpha:2',
            'alpha:3',
            'beta:4',
        ]);
    });

    it('treats a throwing getItems as no items and still includes other registrations', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const state = makeState([
            makeRegistration([], {
                id: 'bad',
                pluginId: 'bad-plugin',
                getItems: () => {
                    throw new Error('boom');
                },
            }),
            makeRegistration([makeItem()], {id: 'good', pluginId: 'good-plugin'}),
        ]);

        expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.key)).toEqual(['good-plugin:a']);
        consoleSpy.mockRestore();
    });

    it('logs a throwing getItems once per plugin until cleared', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const state = makeState([makeRegistration([], {
            pluginId: 'bad-plugin',
            getItems: () => {
                throw new Error('boom');
            },
        })]);
        const channel = makeChannel();

        getChannelSidebarSubItems(state, channel);
        getChannelSidebarSubItems(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ChannelSidebarSubItems: getItems for plugin 'bad-plugin' threw"), expect.any(Error));

        clearLoggedChannelSidebarSubItemsErrors('bad-plugin');
        getChannelSidebarSubItems(state, channel);
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });

    it('drops invalid items and keeps valid ones', () => {
        const invalid = [
            null,
            'string',
            {id: 'no-label', subpath: 'views/x'},
            {id: 'empty-label', label: '', subpath: 'views/x'},
            {id: 'no-subpath', label: 'L'},
            {id: 'empty-subpath', label: 'L', subpath: ''},
            {id: 'slash-only', label: 'L', subpath: '///'},
            {id: '', label: 'L', subpath: 'views/x'},
            {id: 5, label: 'L', subpath: 'views/x'},
            {id: 'num-label', label: 5, subpath: 'views/x'},
            {id: 'num-subpath', label: 'L', subpath: 5},
        ] as unknown as ChannelSidebarSubItem[];
        const state = makeState([makeRegistration([...invalid, makeItem({id: 'ok'})])]);

        expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.id)).toEqual(['ok']);
    });

    it('strips leading slashes from subpath', () => {
        const state = makeState([makeRegistration([makeItem({subpath: '/views/a'}), makeItem({id: 'b', subpath: '//views/b/'})])]);
        expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.subpath)).toEqual(['views/a', 'views/b/']);
    });

    it('drops duplicate keys and keeps the first', () => {
        const state = makeState([
            makeRegistration([makeItem({label: 'First'}), makeItem({label: 'Second', subpath: 'views/other'})], {id: 'r1', pluginId: 'alpha'}),
            makeRegistration([makeItem({label: 'Other plugin'})], {id: 'r2', pluginId: 'beta'}),
        ]);
        const items = getChannelSidebarSubItems(state, makeChannel());

        expect(items.map((i) => [i.key, i.label])).toEqual([
            ['alpha:a', 'First'],
            ['beta:a', 'Other plugin'],
        ]);
    });

    it('keeps a valid iconName and removes an unknown one without dropping the item', () => {
        const state = makeState([makeRegistration([
            makeItem({id: 'valid', iconName: 'folder-outline'}),
            makeItem({id: 'invalid', iconName: 'not-a-real-icon' as ChannelSidebarSubItem['iconName']}),
            makeItem({id: 'none'}),
        ])]);
        const items = getChannelSidebarSubItems(state, makeChannel());

        expect(items.map((i) => i.id)).toEqual(['valid', 'invalid', 'none']);
        expect(items[0].iconName).toBe('folder-outline');
        expect(items[1]).not.toHaveProperty('iconName');
        expect(items[2]).not.toHaveProperty('iconName');
    });
});

describe('selectors/areChannelSidebarSubItemsEqual', () => {
    function resolved(partial: Partial<ResolvedChannelSidebarSubItem> = {}): ResolvedChannelSidebarSubItem {
        return {key: 'p:a', pluginId: 'p', id: 'a', label: 'A', subpath: 'views/a', ...partial};
    }

    it('is true for the same reference and for structurally equal lists', () => {
        const list = [resolved()];
        expect(areChannelSidebarSubItemsEqual(list, list)).toBe(true);
        expect(areChannelSidebarSubItemsEqual([resolved()], [resolved()])).toBe(true);
        expect(areChannelSidebarSubItemsEqual([], [])).toBe(true);
    });

    it('is false when lengths differ', () => {
        expect(areChannelSidebarSubItemsEqual([resolved()], [])).toBe(false);
    });

    it.each([
        ['key', {key: 'p:b'}],
        ['label', {label: 'B'}],
        ['subpath', {subpath: 'views/b'}],
        ['iconName', {iconName: 'folder-outline' as const}],
    ])('is false when %s differs', (_name, change) => {
        expect(areChannelSidebarSubItemsEqual([resolved()], [resolved(change)])).toBe(false);
    });
});

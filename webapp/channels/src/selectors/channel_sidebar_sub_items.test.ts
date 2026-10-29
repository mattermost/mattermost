// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {
    ChannelSidebarSubItem,
    ChannelSidebarSubItemAction,
    ChannelSidebarSubItemsRegistration,
} from 'types/store/plugins';

import {
    areChannelSidebarSubItemsEqual,
    canDropChannelSidebarSubItem,
    clearLoggedChannelSidebarSubItemsErrors,
    dropChannelSidebarSubItem,
    getChannelSidebarSubItemActions,
    getChannelSidebarSubItemAncestorKeys,
    getChannelSidebarSubItems,
    getChannelSidebarSubItemsRegistration,
    isChannelSidebarSubItemDescendant,
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
            registrationId: 'reg-1',
            id: 'a',
            label: 'Item A',
            subpath: 'views/a',
            iconName: 'folder-outline',
            depth: 0,
            hasChildren: false,
            draggable: false,
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

    describe('nesting', () => {
        const resolve = (items: ChannelSidebarSubItem[], partial: Partial<ChannelSidebarSubItemsRegistration> = {}) => {
            return getChannelSidebarSubItems(makeState([makeRegistration(items, partial)]), makeChannel());
        };

        it('sets registrationId from the registration id', () => {
            const state = makeState([
                makeRegistration([makeItem({id: '1'})], {id: 'r1', pluginId: 'alpha'}),
                makeRegistration([makeItem({id: '2'})], {id: 'r2', pluginId: 'beta'}),
            ]);
            expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.registrationId)).toEqual(['r1', 'r2']);
        });

        it('resolves parentId into parentKey, depth and hasChildren', () => {
            const items = resolve([
                makeItem({id: 'root'}),
                makeItem({id: 'child', parentId: 'root'}),
                makeItem({id: 'grandchild', parentId: 'child'}),
            ]);

            expect(items.map((i) => [i.id, i.parentKey, i.depth, i.hasChildren])).toEqual([
                ['root', undefined, 0, true],
                ['child', 'test-plugin:root', 1, true],
                ['grandchild', 'test-plugin:child', 2, false],
            ]);
            expect(items[0]).not.toHaveProperty('parentKey');
        });

        it('orders depth-first with siblings in array order, even when children come before their parent', () => {
            const items = resolve([
                makeItem({id: 'c1', parentId: 'a'}),
                makeItem({id: 'b'}),
                makeItem({id: 'a'}),
                makeItem({id: 'c2', parentId: 'a'}),
                makeItem({id: 'g1', parentId: 'c1'}),
                makeItem({id: 'b1', parentId: 'b'}),
            ]);

            expect(items.map((i) => i.id)).toEqual(['b', 'b1', 'a', 'c1', 'g1', 'c2']);
            expect(items.map((i) => i.depth)).toEqual([0, 1, 0, 1, 2, 1]);
        });

        it.each([
            ['missing', undefined],
            ['empty', ''],
            ['non-string', 5],
            ['unknown', 'nope'],
            ['self', 'a'],
        ])('treats a %s parent as root level', (_name, parentId) => {
            const [item] = resolve([makeItem({id: 'a', parentId: parentId as string | undefined})]);
            expect(item.depth).toBe(0);
            expect(item).not.toHaveProperty('parentKey');
        });

        it('ignores a parent that is in another registration', () => {
            const state = makeState([
                makeRegistration([makeItem({id: 'a'})], {id: 'r1', pluginId: 'alpha'}),
                makeRegistration([makeItem({id: 'b', parentId: 'a'})], {id: 'r2', pluginId: 'alpha'}),
            ]);
            const items = getChannelSidebarSubItems(state, makeChannel());

            expect(items.map((i) => [i.key, i.parentKey, i.depth, i.hasChildren])).toEqual([
                ['alpha:a', undefined, 0, false],
                ['alpha:b', undefined, 0, false],
            ]);
        });

        it('does not link to a parent with the same id from another plugin', () => {
            const state = makeState([
                makeRegistration([makeItem({id: 'a'})], {id: 'r1', pluginId: 'alpha'}),
                makeRegistration([makeItem({id: 'b', parentId: 'a'})], {id: 'r2', pluginId: 'beta'}),
            ]);
            expect(getChannelSidebarSubItems(state, makeChannel()).map((i) => i.parentKey)).toEqual([undefined, undefined]);
        });

        it('makes every item in a cycle a root and keeps items that descend from the cycle nested', () => {
            const items = resolve([
                makeItem({id: 'a', parentId: 'b'}),
                makeItem({id: 'b', parentId: 'a'}),
                makeItem({id: 'c', parentId: 'a'}),
                makeItem({id: 'd', parentId: 'c'}),
            ]);

            expect(items.map((i) => [i.id, i.parentKey, i.depth, i.hasChildren])).toEqual([
                ['a', undefined, 0, true],
                ['c', 'test-plugin:a', 1, true],
                ['d', 'test-plugin:c', 2, false],
                ['b', undefined, 0, false],
            ]);
        });

        it('handles a three-item cycle and long chains', () => {
            const cyclic = resolve([
                makeItem({id: 'a', parentId: 'c'}),
                makeItem({id: 'b', parentId: 'a'}),
                makeItem({id: 'c', parentId: 'b'}),
            ]);
            expect(cyclic.map((i) => [i.id, i.depth])).toEqual([['a', 0], ['b', 0], ['c', 0]]);

            const chain = Array.from({length: 5000}, (_, i) => makeItem({id: `n${i}`, parentId: i ? `n${i - 1}` : undefined}));
            const items = resolve(chain);
            expect(items).toHaveLength(5000);
            expect(items[4999].depth).toBe(4999);
        });

        it('drops a duplicate id before resolving parents', () => {
            const items = resolve([
                makeItem({id: 'a'}),
                makeItem({id: 'a', parentId: 'b'}),
                makeItem({id: 'b'}),
            ]);
            expect(items.map((i) => [i.id, i.depth])).toEqual([['a', 0], ['b', 0]]);
        });
    });

    describe('draggable', () => {
        const onItemDrop = jest.fn();

        it('is true only when the item is draggable and the registration has onItemDrop', () => {
            const items = [
                makeItem({id: 'yes', draggable: true}),
                makeItem({id: 'no', draggable: false}),
                makeItem({id: 'unset'}),
                makeItem({id: 'truthy', draggable: 'yes' as unknown as boolean}),
            ];

            const withDrop = getChannelSidebarSubItems(makeState([makeRegistration(items, {onItemDrop})]), makeChannel());
            expect(withDrop.map((i) => i.draggable)).toEqual([true, false, false, false]);

            const withoutDrop = getChannelSidebarSubItems(makeState([makeRegistration(items)]), makeChannel());
            expect(withoutDrop.map((i) => i.draggable)).toEqual([false, false, false, false]);
        });
    });
});

describe('selectors/areChannelSidebarSubItemsEqual', () => {
    function resolved(partial: Partial<ResolvedChannelSidebarSubItem> = {}): ResolvedChannelSidebarSubItem {
        return {key: 'p:a', pluginId: 'p', registrationId: 'r', id: 'a', label: 'A', subpath: 'views/a', depth: 0, hasChildren: false, draggable: false, ...partial};
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
        ['registrationId', {registrationId: 'r2'}],
        ['parentKey', {parentKey: 'p:b'}],
        ['depth', {depth: 1}],
        ['hasChildren', {hasChildren: true}],
        ['draggable', {draggable: true}],
    ])('is false when %s differs', (_name, change) => {
        expect(areChannelSidebarSubItemsEqual([resolved()], [resolved(change)])).toBe(false);
    });
});

describe('selectors/getChannelSidebarSubItemsRegistration', () => {
    it('finds a registration by id', () => {
        const reg = makeRegistration([], {id: 'r2'});
        const state = makeState([makeRegistration([], {id: 'r1'}), reg]);

        expect(getChannelSidebarSubItemsRegistration(state, 'r2')).toBe(reg);
        expect(getChannelSidebarSubItemsRegistration(state, 'missing')).toBeUndefined();
        expect(getChannelSidebarSubItemsRegistration(makeState(undefined), 'r1')).toBeUndefined();
    });
});

describe('selectors/ancestor helpers', () => {
    const items = getChannelSidebarSubItems(makeState([makeRegistration([
        makeItem({id: 'a'}),
        makeItem({id: 'b', parentId: 'a'}),
        makeItem({id: 'c', parentId: 'b'}),
        makeItem({id: 'd'}),
    ])]), makeChannel());

    it('returns ancestor keys nearest first', () => {
        expect(getChannelSidebarSubItemAncestorKeys(items, 'test-plugin:c')).toEqual(['test-plugin:b', 'test-plugin:a']);
        expect(getChannelSidebarSubItemAncestorKeys(items, 'test-plugin:a')).toEqual([]);
        expect(getChannelSidebarSubItemAncestorKeys(items, 'unknown')).toEqual([]);
    });

    it('does not loop on malformed parent links', () => {
        const looped = [
            {...items[0], parentKey: 'test-plugin:b'},
            {...items[1], parentKey: 'test-plugin:a'},
        ];
        expect(getChannelSidebarSubItemAncestorKeys(looped, 'test-plugin:a')).toEqual(['test-plugin:b']);
    });

    it('detects strict descendants', () => {
        expect(isChannelSidebarSubItemDescendant(items, 'test-plugin:a', 'test-plugin:c')).toBe(true);
        expect(isChannelSidebarSubItemDescendant(items, 'test-plugin:b', 'test-plugin:c')).toBe(true);
        expect(isChannelSidebarSubItemDescendant(items, 'test-plugin:a', 'test-plugin:a')).toBe(false);
        expect(isChannelSidebarSubItemDescendant(items, 'test-plugin:c', 'test-plugin:a')).toBe(false);
        expect(isChannelSidebarSubItemDescendant(items, 'test-plugin:d', 'test-plugin:c')).toBe(false);
    });
});

describe('selectors/getChannelSidebarSubItemActions', () => {
    const channel = makeChannel();
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        clearLoggedChannelSidebarSubItemsErrors();
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    function actionsFor(getItemActions?: ChannelSidebarSubItemsRegistration['getItemActions']) {
        const state = makeState([makeRegistration([makeItem()], {getItemActions})]);
        const [item] = getChannelSidebarSubItems(state, channel);
        return {state, item, run: () => getChannelSidebarSubItemActions(state, channel, item)};
    }

    it('returns an empty array without getItemActions or when the registration is gone', () => {
        expect(actionsFor().run()).toEqual([]);

        const {item} = actionsFor();
        expect(getChannelSidebarSubItemActions(makeState([]), channel, item)).toEqual([]);
    });

    it('calls getItemActions with the state, channel and plugin item id', () => {
        const getItemActions = jest.fn(() => []);
        const {state, run} = actionsFor(getItemActions);
        run();
        expect(getItemActions).toHaveBeenCalledWith(state, channel, 'a');
    });

    it('returns an empty array for null, undefined and non-array results', () => {
        expect(actionsFor(() => null).run()).toEqual([]);
        expect(actionsFor(() => undefined).run()).toEqual([]);
        expect(actionsFor(() => ({}) as unknown as ChannelSidebarSubItemAction[]).run()).toEqual([]);
    });

    it('keeps valid actions and coerces flags to booleans', () => {
        const onClick = jest.fn();
        const result = actionsFor(() => [
            {id: 'one', text: 'One', onClick},
            {id: 'two', text: 'Two', iconName: 'trash-can-outline', isDestructive: true, separatorBefore: true, onClick},
            {id: 'three', text: 'Three', isDestructive: 1, separatorBefore: 'yes', onClick} as unknown as ChannelSidebarSubItemAction,
        ]).run();

        expect(result).toEqual([
            {id: 'one', text: 'One', isDestructive: false, separatorBefore: false, onClick},
            {id: 'two', text: 'Two', iconName: 'trash-can-outline', isDestructive: true, separatorBefore: true, onClick},
            {id: 'three', text: 'Three', isDestructive: true, separatorBefore: true, onClick},
        ]);
        result[0].onClick();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('drops invalid actions and unknown icons', () => {
        const onClick = jest.fn();
        const result = actionsFor(() => [
            null,
            'string',
            {text: 'No id', onClick},
            {id: 5, text: 'Numeric id', onClick},
            {id: 'no-text', onClick},
            {id: 'empty-text', text: '', onClick},
            {id: 'no-click', text: 'No click'},
            {id: 'string-click', text: 'String click', onClick: 'nope'},
            {id: 'bad-icon', text: 'Bad icon', iconName: 'not-a-real-icon', onClick},
        ] as unknown as ChannelSidebarSubItemAction[]).run();

        expect(result.map((a) => a.id)).toEqual(['bad-icon']);
        expect(result[0]).not.toHaveProperty('iconName');
    });

    it('returns no actions for a throwing getItemActions and logs once per plugin until cleared', () => {
        const {run} = actionsFor(() => {
            throw new Error('boom');
        });

        expect(run()).toEqual([]);
        expect(run()).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ChannelSidebarSubItems: getItemActions for plugin 'test-plugin' threw"), expect.any(Error));

        clearLoggedChannelSidebarSubItemsErrors('test-plugin');
        run();
        expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
});

describe('selectors/canDropChannelSidebarSubItem and dropChannelSidebarSubItem', () => {
    const channel = makeChannel();
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        clearLoggedChannelSidebarSubItemsErrors();
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    const treeItems = [
        makeItem({id: 'a', draggable: true}),
        makeItem({id: 'b', parentId: 'a', draggable: true}),
        makeItem({id: 'c', parentId: 'b', draggable: true}),
        makeItem({id: 'd', draggable: true}),
        makeItem({id: 'fixed', draggable: false}),
    ];

    function setup(regPartial: Partial<ChannelSidebarSubItemsRegistration> = {}, extraRegs: ChannelSidebarSubItemsRegistration[] = []) {
        const onItemDrop = jest.fn();
        const state = makeState([
            makeRegistration(treeItems, {id: 'reg-1', onItemDrop, ...regPartial}),
            ...extraRegs,
        ]);
        const items = getChannelSidebarSubItems(state, channel);
        const byId = (id: string, pluginId = 'test-plugin') => items.find((i) => i.key === `${pluginId}:${id}`)!;
        return {state, items, byId, onItemDrop};
    }

    describe('canDropChannelSidebarSubItem', () => {
        it('allows a valid drop at every position', () => {
            const {state, items, byId} = setup();
            for (const position of ['before', 'after', 'inside'] as const) {
                expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), position, items)).toBe(true);
            }
        });

        it('allows moving an item to a sibling or ancestor of its own subtree', () => {
            const {state, items, byId} = setup();
            expect(canDropChannelSidebarSubItem(state, channel, byId('c'), byId('a'), 'after', items)).toBe(true);
            expect(canDropChannelSidebarSubItem(state, channel, byId('b'), byId('d'), 'inside', items)).toBe(true);
        });

        it('rejects dropping onto itself or a descendant', () => {
            const {state, items, byId} = setup();
            expect(canDropChannelSidebarSubItem(state, channel, byId('a'), byId('a'), 'before', items)).toBe(false);
            expect(canDropChannelSidebarSubItem(state, channel, byId('a'), byId('b'), 'inside', items)).toBe(false);
            expect(canDropChannelSidebarSubItem(state, channel, byId('a'), byId('c'), 'after', items)).toBe(false);
        });

        it('rejects an item that is not draggable', () => {
            const {state, items, byId} = setup();
            expect(canDropChannelSidebarSubItem(state, channel, byId('fixed'), byId('a'), 'before', items)).toBe(false);
        });

        it('rejects a drop across registrations without calling canDrop', () => {
            const otherCanDrop = jest.fn(() => true);
            const canDrop = jest.fn(() => true);
            const other = makeRegistration([makeItem({id: 'x', draggable: true})], {id: 'reg-2', pluginId: 'other', onItemDrop: jest.fn(), canDrop: otherCanDrop});
            const {state, items, byId} = setup({canDrop}, [other]);

            expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('x', 'other'), 'after', items)).toBe(false);
            expect(canDrop).not.toHaveBeenCalled();
            expect(otherCanDrop).not.toHaveBeenCalled();
        });

        it('rejects when the registration has no onItemDrop or is gone', () => {
            const {items, byId} = setup();
            const dragged = {...byId('d'), draggable: true};

            const noDrop = makeState([makeRegistration(treeItems, {id: 'reg-1'})]);
            expect(canDropChannelSidebarSubItem(noDrop, channel, dragged, byId('a'), 'before', items)).toBe(false);
            expect(canDropChannelSidebarSubItem(makeState([]), channel, dragged, byId('a'), 'before', items)).toBe(false);
        });

        it('calls canDrop with the plugin item ids and lets it veto', () => {
            const canDrop = jest.fn(() => false);
            const {state, items, byId} = setup({canDrop});

            expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'inside', items)).toBe(false);
            expect(canDrop).toHaveBeenCalledWith(state, channel, {itemId: 'd', targetId: 'a', position: 'inside'});
        });

        it('allows the drop when canDrop returns true', () => {
            const {state, items, byId} = setup({canDrop: () => true});
            expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'inside', items)).toBe(true);
        });

        it('rejects a throwing canDrop and logs once per plugin', () => {
            const {state, items, byId} = setup({
                canDrop: () => {
                    throw new Error('boom');
                },
            });

            expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'inside', items)).toBe(false);
            expect(canDropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'inside', items)).toBe(false);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ChannelSidebarSubItems: canDrop for plugin 'test-plugin' threw"), expect.any(Error));
        });
    });

    describe('dropChannelSidebarSubItem', () => {
        it('calls onItemDrop with the channel and plugin item ids', () => {
            const {state, items, byId, onItemDrop} = setup();
            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'inside', items);
            expect(onItemDrop).toHaveBeenCalledTimes(1);
            expect(onItemDrop).toHaveBeenCalledWith(channel, {itemId: 'd', targetId: 'a', position: 'inside'});
        });

        it('does not call onItemDrop for a rejected drop', () => {
            const canDrop = jest.fn(() => false);
            const {state, items, byId, onItemDrop} = setup({canDrop});

            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'before', items);
            dropChannelSidebarSubItem(state, channel, byId('a'), byId('c'), 'before', items);
            dropChannelSidebarSubItem(state, channel, byId('fixed'), byId('a'), 'before', items);
            expect(onItemDrop).not.toHaveBeenCalled();
        });

        it('logs a throwing onItemDrop once per plugin', () => {
            const {state, items, byId} = setup({
                onItemDrop: () => {
                    throw new Error('boom');
                },
            });

            expect(() => dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'before', items)).not.toThrow();
            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'after', items);
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ChannelSidebarSubItems: onItemDrop for plugin 'test-plugin' threw"), expect.any(Error));
        });

        it('logs a rejected onItemDrop promise once per plugin', async () => {
            const {state, items, byId} = setup({onItemDrop: () => Promise.reject(new Error('async boom'))});

            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'before', items);
            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'after', items);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("onItemDrop for plugin 'test-plugin' threw"), expect.objectContaining({message: 'async boom'}));
        });

        it('accepts an onItemDrop that resolves', async () => {
            const onItemDrop = jest.fn(() => Promise.resolve());
            const {state, items, byId} = setup({onItemDrop});

            dropChannelSidebarSubItem(state, channel, byId('d'), byId('a'), 'before', items);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(onItemDrop).toHaveBeenCalledTimes(1);
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });
});

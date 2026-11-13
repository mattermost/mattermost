// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {compassIconForName} from 'components/channel_type_icon/compass_icon_resolver';

import {Constants} from 'utils/constants';
import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';
import type {
    ChannelSidebarSubItemAction,
    ChannelSidebarSubItemDropPosition,
    ChannelSidebarSubItemsRegistration,
} from 'types/store/plugins';

export type ResolvedChannelSidebarSubItem = {

    /** `${pluginId}:${id}`, unique across plugins. */
    key: string;
    pluginId: string;

    /** Id of the registration that provided the item. */
    registrationId: string;

    /** The plugin's own item id, as passed to `getItemActions`, `canDrop` and `onItemDrop`. */
    id: string;
    label: string;
    subpath: string;
    iconName?: IconGlyphTypes;

    /** Key of the parent item. Only set when the parent is in the same registration and the item is not part of a cycle. */
    parentKey?: string;

    /** Nesting level, 0 for root items. */
    depth: number;
    hasChildren: boolean;

    /** True only when the plugin set `draggable` and the registration has `onItemDrop`. */
    draggable: boolean;
};

const getItemsErrorLog = createPluginErrorLog('ChannelSidebarSubItems', {
    subject: 'getItems',
    outcome: 'treating as no items',
});

const getItemActionsErrorLog = createPluginErrorLog('ChannelSidebarSubItems', {
    subject: 'getItemActions',
    outcome: 'treating as no actions',
});

const canDropErrorLog = createPluginErrorLog('ChannelSidebarSubItems', {
    subject: 'canDrop',
    outcome: 'rejecting the drop',
});

const onItemDropErrorLog = createPluginErrorLog('ChannelSidebarSubItems', {
    subject: 'onItemDrop',
    outcome: 'ignoring the failure',
});

const errorLogs = [getItemsErrorLog, getItemActionsErrorLog, canDropErrorLog, onItemDropErrorLog];

export const clearLoggedChannelSidebarSubItemsErrors = (pluginId?: string): void => {
    errorLogs.forEach((log) => log.clear(pluginId));
};

// Shared so useSelector sees a stable reference whenever there is nothing to show.
const EMPTY: readonly ResolvedChannelSidebarSubItem[] = Object.freeze([]);

type ResolvedItemDraft = {
    item: ResolvedChannelSidebarSubItem;
    parentId?: string;
    parent?: ResolvedItemDraft;
    children: ResolvedItemDraft[];
};

function isValidIcon(iconName: unknown): iconName is IconGlyphTypes {
    return typeof iconName === 'string' && compassIconForName(iconName as IconGlyphTypes) !== null;
}

function resolveItem(reg: ChannelSidebarSubItemsRegistration, item: unknown): ResolvedItemDraft | null {
    if (!item || typeof item !== 'object') {
        return null;
    }
    const {id, label, subpath, iconName, parentId, draggable} = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof label !== 'string' || !label || typeof subpath !== 'string') {
        return null;
    }
    const cleanSubpath = subpath.replace(/^\/+/, '');
    if (!cleanSubpath) {
        return null;
    }
    const resolved: ResolvedChannelSidebarSubItem = {
        key: `${reg.pluginId}:${id}`,
        pluginId: reg.pluginId,
        registrationId: reg.id,
        id,
        label,
        subpath: cleanSubpath,
        depth: 0,
        hasChildren: false,
        draggable: draggable === true && typeof reg.onItemDrop === 'function',
    };
    if (isValidIcon(iconName)) {
        resolved.iconName = iconName;
    }
    return {
        item: resolved,
        parentId: typeof parentId === 'string' && parentId ? parentId : undefined,
        children: [],
    };
}

/**
 * Links each draft to its parent, which must be in the same registration (`byId` holds only that
 * registration's items). Every item that is part of a parent cycle is made a root, which breaks
 * the cycle; items that merely descend from a cycle keep their parent. So `a -> b -> a` leaves
 * both `a` and `b` at the root, and `c -> a` keeps `c` under `a`. Linear in the number of items.
 */
function linkParents(drafts: ResolvedItemDraft[], byId: Map<string, ResolvedItemDraft>) {
    const parentOf = (draft: ResolvedItemDraft) => {
        const parent = draft.parentId === undefined ? undefined : byId.get(draft.parentId);
        return parent === draft ? undefined : parent;
    };

    const visited = new Set<ResolvedItemDraft>();
    const inCycle = new Set<ResolvedItemDraft>();
    for (const start of drafts) {
        const path: ResolvedItemDraft[] = [];
        let current: ResolvedItemDraft | undefined = start;
        while (current && !visited.has(current)) {
            visited.add(current);
            path.push(current);
            current = parentOf(current);
        }
        if (current) {
            const cycleStart = path.indexOf(current);
            if (cycleStart !== -1) {
                path.slice(cycleStart).forEach((draft) => inCycle.add(draft));
            }
        }
    }

    for (const draft of drafts) {
        const parent = parentOf(draft);
        if (parent && !inCycle.has(draft)) {
            draft.parent = parent;
            parent.children.push(draft);
        }
    }
}

function flattenDepthFirst(drafts: ResolvedItemDraft[], out: ResolvedChannelSidebarSubItem[]) {
    const stack: ResolvedItemDraft[] = drafts.filter((draft) => !draft.parent).reverse();
    while (stack.length) {
        const draft = stack.pop()!;
        const {item, parent, children} = draft;
        if (parent) {
            item.parentKey = parent.item.key;
            item.depth = parent.item.depth + 1;
        }
        item.hasChildren = children.length > 0;
        out.push(item);
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }
    }
}

/**
 * Validated sub-items from every ChannelSidebarSubItems registration for a public or private
 * channel, in registration order. Returns a shared frozen empty array when there are none.
 *
 * Within a registration, items are ordered depth-first pre-order: each parent is followed by its
 * descendants, and siblings keep the plugin's array order. Rendering the flat list with
 * indentation by `depth` therefore shows the tree. A `parentId` that is unknown, not a string,
 * the item's own id, or in another registration places the item at the root, as does being part
 * of a parent cycle (every item in the cycle becomes a root).
 *
 * Not memoized: getItems receives the full Redux state, so the slices it depends on can't be
 * known here. The result is a new array on each call, so use `areChannelSidebarSubItemsEqual`
 * with useSelector.
 */
export function getChannelSidebarSubItems(
    state: GlobalState,
    channel?: Channel,
): ResolvedChannelSidebarSubItem[] {
    const regs = state.plugins.components.ChannelSidebarSubItems;
    if (!channel || !regs?.length || (channel.type !== Constants.OPEN_CHANNEL && channel.type !== Constants.PRIVATE_CHANNEL)) {
        return EMPTY as ResolvedChannelSidebarSubItem[];
    }

    const result: ResolvedChannelSidebarSubItem[] = [];
    const seenKeys = new Set<string>();
    for (const reg of regs) {
        let items: unknown;
        try {
            items = reg.getItems(state, channel);
        } catch (err) {
            getItemsErrorLog.logOnce(reg.pluginId, err);
            continue;
        }
        if (!Array.isArray(items)) {
            continue;
        }

        const drafts: ResolvedItemDraft[] = [];
        const byId = new Map<string, ResolvedItemDraft>();
        for (const item of items) {
            const draft = resolveItem(reg, item);
            if (draft && !seenKeys.has(draft.item.key)) {
                seenKeys.add(draft.item.key);
                drafts.push(draft);
                byId.set(draft.item.id, draft);
            }
        }
        linkParents(drafts, byId);
        flattenDepthFirst(drafts, result);
    }

    return result.length ? result : EMPTY as ResolvedChannelSidebarSubItem[];
}

export function areChannelSidebarSubItemsEqual(
    a: ResolvedChannelSidebarSubItem[],
    b: ResolvedChannelSidebarSubItem[],
): boolean {
    if (a === b) {
        return true;
    }
    if (a.length !== b.length) {
        return false;
    }
    return a.every((item, i) => {
        const other = b[i];
        return item.key === other.key &&
            item.label === other.label &&
            item.subpath === other.subpath &&
            item.iconName === other.iconName &&
            item.registrationId === other.registrationId &&
            item.parentKey === other.parentKey &&
            item.depth === other.depth &&
            item.hasChildren === other.hasChildren &&
            item.draggable === other.draggable;
    });
}

export function getChannelSidebarSubItemsRegistration(
    state: GlobalState,
    registrationId: string,
): ChannelSidebarSubItemsRegistration | undefined {
    return state.plugins.components.ChannelSidebarSubItems?.find((reg) => reg.id === registrationId);
}

/**
 * Whether `key` is a descendant of `ancestorKey` in `items`, following `parentKey` links. An item is
 * not its own descendant.
 */
export function isChannelSidebarSubItemDescendant(
    items: ResolvedChannelSidebarSubItem[],
    ancestorKey: string,
    key: string,
): boolean {
    return getChannelSidebarSubItemAncestorKeys(items, key).includes(ancestorKey);
}

/**
 * Keys of all ancestors of `key`, nearest first (parent, grandparent, ..., root). Empty for a root
 * item or an unknown key.
 */
export function getChannelSidebarSubItemAncestorKeys(
    items: ResolvedChannelSidebarSubItem[],
    key: string,
): string[] {
    const parentKeyByKey = new Map<string, string | undefined>();
    for (const item of items) {
        parentKeyByKey.set(item.key, item.parentKey);
    }

    const ancestors: string[] = [];
    const seen = new Set<string>([key]);
    let parentKey = parentKeyByKey.get(key);
    while (parentKey !== undefined && !seen.has(parentKey)) {
        seen.add(parentKey);
        ancestors.push(parentKey);
        parentKey = parentKeyByKey.get(parentKey);
    }
    return ancestors;
}

/**
 * Menu actions for an item, from the registration's `getItemActions` called with fresh state.
 * Invalid actions are dropped and a throwing `getItemActions` yields no actions.
 */
export function getChannelSidebarSubItemActions(
    state: GlobalState,
    channel: Channel,
    item: ResolvedChannelSidebarSubItem,
): ChannelSidebarSubItemAction[] {
    const reg = getChannelSidebarSubItemsRegistration(state, item.registrationId);
    if (!reg || typeof reg.getItemActions !== 'function') {
        return [];
    }

    let actions: unknown;
    try {
        actions = reg.getItemActions(state, channel, item.id);
    } catch (err) {
        getItemActionsErrorLog.logOnce(reg.pluginId, err);
        return [];
    }
    if (!Array.isArray(actions)) {
        return [];
    }

    const result: ChannelSidebarSubItemAction[] = [];
    for (const action of actions) {
        if (!action || typeof action !== 'object') {
            continue;
        }
        const {id, text, iconName, isDestructive, separatorBefore, onClick} = action as Record<string, unknown>;
        if (typeof id !== 'string' || !id || typeof text !== 'string' || !text || typeof onClick !== 'function') {
            continue;
        }
        const resolved: ChannelSidebarSubItemAction = {
            id,
            text,
            isDestructive: Boolean(isDestructive),
            separatorBefore: Boolean(separatorBefore),
            onClick: onClick as () => void,
        };
        if (isValidIcon(iconName)) {
            resolved.iconName = iconName;
        }
        result.push(resolved);
    }
    return result;
}

/**
 * Whether `dragged` may be dropped at `position` relative to `target`. Core rules first: same
 * registration, `dragged` is draggable, `target` is neither `dragged` nor one of its descendants
 * in `items`, and the registration has `onItemDrop`. Then the plugin's `canDrop`, which vetoes by
 * returning false; a throwing `canDrop` also vetoes.
 */
export function canDropChannelSidebarSubItem(
    state: GlobalState,
    channel: Channel,
    dragged: ResolvedChannelSidebarSubItem,
    target: ResolvedChannelSidebarSubItem,
    position: ChannelSidebarSubItemDropPosition,
    items: ResolvedChannelSidebarSubItem[],
): boolean {
    if (dragged.registrationId !== target.registrationId || !dragged.draggable) {
        return false;
    }
    if (target.key === dragged.key || isChannelSidebarSubItemDescendant(items, dragged.key, target.key)) {
        return false;
    }
    const reg = getChannelSidebarSubItemsRegistration(state, dragged.registrationId);
    if (!reg || typeof reg.onItemDrop !== 'function') {
        return false;
    }
    if (typeof reg.canDrop !== 'function') {
        return true;
    }

    try {
        return reg.canDrop(state, channel, {itemId: dragged.id, targetId: target.id, position}) !== false;
    } catch (err) {
        canDropErrorLog.logOnce(reg.pluginId, err);
        return false;
    }
}

/**
 * Drops `dragged` at `position` relative to `target` by calling the registration's `onItemDrop`,
 * after re-checking `canDropChannelSidebarSubItem`. Failures of `onItemDrop`, whether thrown or
 * returned as a rejected promise, are logged once per plugin.
 */
export function dropChannelSidebarSubItem(
    state: GlobalState,
    channel: Channel,
    dragged: ResolvedChannelSidebarSubItem,
    target: ResolvedChannelSidebarSubItem,
    position: ChannelSidebarSubItemDropPosition,
    items: ResolvedChannelSidebarSubItem[],
): void {
    if (!canDropChannelSidebarSubItem(state, channel, dragged, target, position, items)) {
        return;
    }
    const reg = getChannelSidebarSubItemsRegistration(state, dragged.registrationId);
    if (!reg || typeof reg.onItemDrop !== 'function') {
        return;
    }

    try {
        const result = reg.onItemDrop(channel, {itemId: dragged.id, targetId: target.id, position});
        Promise.resolve(result).catch((err) => onItemDropErrorLog.logOnce(reg.pluginId, err));
    } catch (err) {
        onItemDropErrorLog.logOnce(reg.pluginId, err);
    }
}

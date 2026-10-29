// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {compassIconForName} from 'components/channel_type_icon/compass_icon_resolver';

import {Constants} from 'utils/constants';
import {createPluginErrorLog} from 'utils/plugin_error_log';

import type {GlobalState} from 'types/store';

export type ResolvedChannelSidebarSubItem = {

    /** `${pluginId}:${id}`, unique across plugins. */
    key: string;
    pluginId: string;
    id: string;
    label: string;
    subpath: string;
    iconName?: IconGlyphTypes;
};

const getItemsErrorLog = createPluginErrorLog('ChannelSidebarSubItems', {
    subject: 'getItems',
    outcome: 'treating as no items',
});

export const clearLoggedChannelSidebarSubItemsErrors = getItemsErrorLog.clear;

// Shared so useSelector sees a stable reference whenever there is nothing to show.
const EMPTY: readonly ResolvedChannelSidebarSubItem[] = Object.freeze([]);

function resolveItem(pluginId: string, item: unknown): ResolvedChannelSidebarSubItem | null {
    if (!item || typeof item !== 'object') {
        return null;
    }
    const {id, label, subpath, iconName} = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof label !== 'string' || !label || typeof subpath !== 'string') {
        return null;
    }
    const cleanSubpath = subpath.replace(/^\/+/, '');
    if (!cleanSubpath) {
        return null;
    }
    const resolved: ResolvedChannelSidebarSubItem = {key: `${pluginId}:${id}`, pluginId, id, label, subpath: cleanSubpath};
    if (typeof iconName === 'string' && compassIconForName(iconName as IconGlyphTypes) !== null) {
        resolved.iconName = iconName as IconGlyphTypes;
    }
    return resolved;
}

/**
 * Validated sub-items from every ChannelSidebarSubItems registration for a public or private
 * channel, in registration order. Returns a shared frozen empty array when there are none.
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
        for (const item of items) {
            const resolved = resolveItem(reg.pluginId, item);
            if (resolved && !seenKeys.has(resolved.key)) {
                seenKeys.add(resolved.key);
                result.push(resolved);
            }
        }
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
            item.iconName === other.iconName;
    });
}

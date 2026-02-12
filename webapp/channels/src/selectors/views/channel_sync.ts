// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import {CategorySorting} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';
import type {ChannelSyncUserState, ChannelSyncLayout} from '@mattermost/types/channel_sync';
import type {GlobalState} from 'types/store';

export function getShouldSync(state: GlobalState): boolean {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.shouldSyncByTeam?.[teamId] ?? false;
}

export function isSyncStateLoaded(state: GlobalState): boolean {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.shouldSyncByTeam?.[teamId] !== undefined;
}

export function getSyncState(state: GlobalState): ChannelSyncUserState | undefined {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.syncStateByTeam?.[teamId];
}

export function getSyncLayout(state: GlobalState): ChannelSyncLayout | undefined {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.layoutByTeam?.[teamId];
}

export function isLayoutEditMode(state: GlobalState): boolean {
    return state.views.channelSync?.editMode ?? false;
}

export function getQuickJoinChannelIds(state: GlobalState): string[] {
    const syncState = getSyncState(state);
    if (!syncState?.should_sync) {
        return [];
    }
    const ids: string[] = [];
    for (const cat of syncState.categories) {
        if (cat.quick_join) {
            ids.push(...cat.quick_join);
        }
    }
    return ids;
}

export function getEditorChannels(state: GlobalState): Channel[] {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.editorChannelsByTeam?.[teamId] ?? [];
}

export function getSyncedCategories(state: GlobalState): ChannelCategory[] | null {
    const syncState = getSyncState(state);
    if (!syncState?.should_sync) {
        return null;
    }
    const teamId = getCurrentTeamId(state);
    const userId = getCurrentUserId(state);

    // Collect channel IDs placed in synced categories
    const syncedCats = syncState.categories || [];
    const placedIds = new Set<string>();
    for (const cat of syncedCats) {
        for (const chId of (cat.channel_ids || [])) {
            placedIds.add(chId);
        }
    }

    // Build synced categories, excluding DM category (handled separately by personal categories)
    const categories: ChannelCategory[] = syncedCats
        .filter((cat) => cat.display_name !== 'Direct Messages')
        .map((cat) => ({
            id: cat.id,
            user_id: userId,
            team_id: teamId,
            type: 'custom' as ChannelCategory['type'],
            display_name: cat.display_name,
            sorting: CategorySorting.Manual,
            channel_ids: cat.channel_ids || [],
            muted: cat.muted,
            collapsed: cat.collapsed,
        }));

    // Find uncategorized channels (user's team channels not placed in any synced category)
    const memberships = getMyChannelMemberships(state);
    const allChannels = getAllChannels(state);
    const uncategorized: Array<{id: string; display_name: string}> = [];

    for (const chId of Object.keys(memberships)) {
        if (placedIds.has(chId)) {
            continue;
        }
        const ch = allChannels[chId];
        if (!ch || ch.team_id !== teamId) {
            continue;
        }
        // Skip DMs/GMs — they're handled by the personal DM category
        if (ch.type === 'D' || ch.type === 'G') {
            continue;
        }
        uncategorized.push({id: ch.id, display_name: ch.display_name});
    }

    if (uncategorized.length > 0) {
        uncategorized.sort((a, b) => a.display_name.localeCompare(b.display_name));
        categories.push({
            id: 'synced-uncategorized',
            user_id: userId,
            team_id: teamId,
            type: 'custom' as ChannelCategory['type'],
            display_name: 'Uncategorized',
            sorting: CategorySorting.Manual,
            channel_ids: uncategorized.map((ch) => ch.id),
            muted: false,
            collapsed: false,
        });
    }

    return categories;
}

export function getQuickJoinChannelCategories(state: GlobalState): Record<string, string> {
    const syncState = getSyncState(state);
    if (!syncState?.should_sync) {
        return {};
    }
    const result: Record<string, string> = {};
    for (const cat of syncState.categories) {
        if (cat.quick_join) {
            for (const chId of cat.quick_join) {
                result[chId] = cat.display_name;
            }
        }
    }
    return result;
}

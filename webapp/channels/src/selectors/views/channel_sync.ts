// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import type {Channel} from '@mattermost/types/channels';
import type {ChannelSyncUserState, ChannelSyncLayout} from '@mattermost/types/channel_sync';
import type {GlobalState} from 'types/store';

export function getShouldSync(state: GlobalState): boolean {
    const teamId = getCurrentTeamId(state);
    return state.views.channelSync?.shouldSyncByTeam?.[teamId] ?? false;
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

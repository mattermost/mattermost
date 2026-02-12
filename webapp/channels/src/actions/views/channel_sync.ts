// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {generateId} from 'mattermost-redux/utils/helpers';

import {ActionTypes} from 'utils/constants';

import type {ChannelSyncLayout} from '@mattermost/types/channel_sync';
import type {ActionFunc, ActionFuncAsync} from 'types/store';

export function fetchChannelSyncState(teamId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const state = await Client4.getChannelSyncState(teamId);
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_STATE,
                data: state,
            });
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_SET_SHOULD_SYNC,
                data: {teamId, shouldSync: state.should_sync},
            });

            // Fetch channel data for Quick Join items not already in the store
            if (state.should_sync) {
                const reduxState = getState();
                const quickJoinIds: string[] = [];
                for (const cat of (state.categories || [])) {
                    if (cat.quick_join) {
                        for (const chId of cat.quick_join) {
                            if (!getChannel(reduxState, chId)) {
                                quickJoinIds.push(chId);
                            }
                        }
                    }
                }
                for (const chId of quickJoinIds) {
                    dispatch(fetchChannel(chId));
                }
            }

            return {data: state};
        } catch (error) {
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_SET_SHOULD_SYNC,
                data: {teamId, shouldSync: false},
            });
            return {error};
        }
    };
}

export function fetchChannelSyncLayout(teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const layout = await Client4.getChannelSyncLayout(teamId);
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
                data: layout,
            });
            return {data: layout};
        } catch (error) {
            return {error};
        }
    };
}

export function saveChannelSyncLayout(teamId: string, layout: ChannelSyncLayout): ActionFuncAsync {
    return async (dispatch) => {
        const saved = await Client4.saveChannelSyncLayout(teamId, layout);
        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: saved,
        });
        return {data: saved};
    };
}

export function setLayoutEditMode(enabled: boolean) {
    return {
        type: ActionTypes.CHANNEL_SYNC_SET_EDIT_MODE,
        data: enabled,
    };
}

export function dismissQuickJoinChannel(teamId: string, channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        await Client4.dismissQuickJoinChannel(teamId, channelId);
        dispatch(fetchChannelSyncState(teamId));
        return {data: true};
    };
}

export function handleChannelSyncUpdated(teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch(fetchChannelSyncState(teamId));
        dispatch(fetchMyCategories(teamId));
        return {data: true};
    };
}

export function enterLayoutEditMode(teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch(setLayoutEditMode(true));

        // Fetch all channels available for the layout editor
        const channels = await Client4.getChannelSyncEditorChannels(teamId);
        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_EDITOR_CHANNELS,
            data: {teamId, channels},
        });

        // Fetch current layout
        try {
            const layout = await Client4.getChannelSyncLayout(teamId);
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
                data: layout,
            });
        } catch {
            // No layout exists yet — start with empty default so drag operations work
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
                data: {team_id: teamId, categories: [], update_at: 0, update_by: ''},
            });
        }

        return {data: true};
    };
}

export function moveChannelInCanonicalLayout(
    sourceCategoryId: string,
    destCategoryId: string,
    sourceIndex: number,
    destIndex: number,
    channelId: string,
): ActionFunc {
    return (dispatch, getState) => {
        const teamId = getCurrentTeamId(getState());
        const layout = getState().views.channelSync.layoutByTeam[teamId];
        if (!layout) {
            return {data: false};
        }

        const newLayout = JSON.parse(JSON.stringify(layout)) as ChannelSyncLayout;

        const sourceCat = newLayout.categories.find((c) => c.id === sourceCategoryId);
        if (sourceCat) {
            sourceCat.channel_ids.splice(sourceIndex, 1);
        }

        const destCat = newLayout.categories.find((c) => c.id === destCategoryId);
        if (destCat) {
            destCat.channel_ids.splice(destIndex, 0, channelId);
        }

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

export function moveCategoryInCanonicalLayout(sourceIndex: number, destIndex: number): ActionFunc {
    return (dispatch, getState) => {
        const teamId = getCurrentTeamId(getState());
        const layout = getState().views.channelSync.layoutByTeam[teamId];
        if (!layout) {
            return {data: false};
        }

        const newLayout = JSON.parse(JSON.stringify(layout)) as ChannelSyncLayout;
        const [moved] = newLayout.categories.splice(sourceIndex, 1);
        newLayout.categories.splice(destIndex, 0, moved);

        newLayout.categories.forEach((cat, i) => {
            cat.sort_order = i * 10;
        });

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

export function addCategoryToCanonicalLayout(displayName: string): ActionFunc {
    return (dispatch, getState) => {
        const teamId = getCurrentTeamId(getState());
        const layout = getState().views.channelSync.layoutByTeam[teamId];

        const newLayout = layout
            ? JSON.parse(JSON.stringify(layout)) as ChannelSyncLayout
            : {team_id: teamId, categories: [], update_at: 0, update_by: ''};

        newLayout.categories.push({
            id: generateId(),
            display_name: displayName,
            sort_order: newLayout.categories.length * 10,
            channel_ids: [],
        });

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

export function renameCategoryInCanonicalLayout(categoryId: string, newName: string): ActionFunc {
    return (dispatch, getState) => {
        const teamId = getCurrentTeamId(getState());
        const layout = getState().views.channelSync.layoutByTeam[teamId];
        if (!layout) {
            return {data: false};
        }

        const newLayout = JSON.parse(JSON.stringify(layout)) as ChannelSyncLayout;
        const cat = newLayout.categories.find((c) => c.id === categoryId);
        if (!cat) {
            return {data: false};
        }

        cat.display_name = newName;

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

export function removeCategoryFromCanonicalLayout(categoryId: string): ActionFunc {
    return (dispatch, getState) => {
        const teamId = getCurrentTeamId(getState());
        const layout = getState().views.channelSync.layoutByTeam[teamId];
        if (!layout) {
            return {data: false};
        }

        const newLayout = JSON.parse(JSON.stringify(layout)) as ChannelSyncLayout;
        const removedCat = newLayout.categories.find((c) => c.id === categoryId);
        if (!removedCat) {
            return {data: false};
        }

        const orphanedChannels = removedCat.channel_ids;
        newLayout.categories = newLayout.categories.filter((c) => c.id !== categoryId);

        if (newLayout.categories.length > 0 && orphanedChannels.length > 0) {
            const targetCat = newLayout.categories.find((c) => c.display_name === 'Channels') || newLayout.categories[0];
            targetCat.channel_ids.push(...orphanedChannels);
        }

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

export function importPersonalLayoutToCanonical(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const teamId = getCurrentTeamId(state);
        const userId = getCurrentUserId(state);
        const editorChannels = state.views.channelSync?.editorChannelsByTeam?.[teamId] ?? [];
        const editorChannelIds = new Set(editorChannels.map((ch: {id: string}) => ch.id));

        // Fetch personal categories from API (bypasses sync override via ?personal=true)
        const personalData = await Client4.getPersonalChannelCategories(userId, teamId);

        const categories = (personalData.categories || [])
            .filter((cat) => {
                if (cat.type === CategoryTypes.DIRECT_MESSAGES) {
                    return false;
                }
                if (cat.type === CategoryTypes.FAVORITES && (!cat.channel_ids || cat.channel_ids.length === 0)) {
                    return false;
                }
                return true;
            })
            .map((cat, index) => ({
                id: generateId(),
                display_name: cat.display_name,
                sort_order: index * 10,
                channel_ids: (cat.channel_ids || []).filter((chId: string) => editorChannelIds.has(chId)),
            }));

        const newLayout: ChannelSyncLayout = {
            team_id: teamId,
            categories,
            update_at: 0,
            update_by: '',
        };

        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: newLayout,
        });

        dispatch(saveChannelSyncLayout(teamId, newLayout));
        return {data: true};
    };
}

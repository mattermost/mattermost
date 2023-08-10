// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {CategorySorting} from '@mattermost/types/channel_categories';

import {ChannelCategoryTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {
    getAllCategoriesByIds,
    getCategory,
    getCategoryIdsForTeam,
    getCategoryInTeamByType,
    getCategoryInTeamWithChannel,
} from 'mattermost-redux/selectors/entities/channel_categories';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {insertMultipleWithoutDuplicates, insertWithoutDuplicates, removeItem} from 'mattermost-redux/utils/array_utils';

import {General} from '../constants';

import type {OrderedChannelCategories, ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';
import type {
    ActionFunc,
    DispatchFunc,
    GetStateFunc,
} from 'mattermost-redux/types/actions';

export function expandCategory(categoryId: string) {
    return setCategoryCollapsed(categoryId, false);
}

export function collapseCategory(categoryId: string) {
    return setCategoryCollapsed(categoryId, true);
}

export function setCategoryCollapsed(categoryId: string, collapsed: boolean) {
    return patchCategory(categoryId, {
        collapsed,
    });
}

export function setCategorySorting(categoryId: string, sorting: CategorySorting) {
    return patchCategory(categoryId, {
        sorting,
    });
}

export function patchCategory(categoryId: string, patch: Partial<ChannelCategory>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        const category = getCategory(state, categoryId);
        const patchedCategory = {
            ...category,
            ...patch,
        };

        dispatch({
            type: ChannelCategoryTypes.RECEIVED_CATEGORY,
            data: patchedCategory,
        });

        try {
            await Client4.updateChannelCategory(currentUserId, category.team_id, patchedCategory);
        } catch (error) {
            dispatch({
                type: ChannelCategoryTypes.RECEIVED_CATEGORY,
                data: category,
            });

            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: patchedCategory};
    };
}

export function setCategoryMuted(categoryId: string, muted: boolean) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const category = getCategory(state, categoryId);

        const result = await dispatch(updateCategory({
            ...category,
            muted,
        }));

        if ('error' in result) {
            return result;
        }

        const updated = result.data as ChannelCategory;

        return dispatch(batchActions([
            {
                type: ChannelCategoryTypes.RECEIVED_CATEGORY,
                data: updated,
            },
            ...(updated.channel_ids.map((channelId) => ({
                type: ChannelTypes.SET_CHANNEL_MUTED,
                data: {
                    channelId,
                    muted,
                },
            }))),
        ]));
    };
}

function updateCategory(category: ChannelCategory) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        let updatedCategory;
        try {
            updatedCategory = await Client4.updateChannelCategory(currentUserId, category.team_id, category);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // The updated category will be added to the state after receiving the corresponding websocket event.

        return {data: updatedCategory};
    };
}

export function fetchMyCategories(teamId: string, isWebSocket: boolean) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentUserId = getCurrentUserId(getState());

        let data: OrderedChannelCategories;
        try {
            data = await Client4.getChannelCategories(currentUserId, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return dispatch(batchActions([
            {
                type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
                data: data.categories,
                isWebSocket,
            },
            {
                type: ChannelCategoryTypes.RECEIVED_CATEGORY_ORDER,
                data: {
                    teamId,
                    order: data.order,
                },
            },
        ]));
    };
}

// addChannelToInitialCategory returns an action that can be dispatched to add a newly-joined or newly-created channel
// to its either the Channels or Direct Messages category based on the type of channel. New DM and GM channels are
// added to the Direct Messages category on each team.
//
// Unless setOnServer is true, this only affects the categories on this client. If it is set to true, this updates
// categories on the server too.
export function addChannelToInitialCategory(channel: Channel, setOnServer = false): ActionFunc {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const categories = Object.values(getAllCategoriesByIds(state));

        if (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) {
            const allDmCategories = categories.filter((category) => category.type === CategoryTypes.DIRECT_MESSAGES);

            // Get all the categories in which channel exists
            const channelInCategories = categories.filter((category) => {
                return category.channel_ids.findIndex((channelId) => channelId === channel.id) !== -1;
            });

            // Skip DM categories where channel already exists in a different category
            const dmCategories = allDmCategories.filter((dmCategory) => {
                return channelInCategories.findIndex((category) => dmCategory.team_id === category.team_id) === -1;
            });

            return dispatch({
                type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
                data: dmCategories.map((category) => ({
                    ...category,
                    channel_ids: insertWithoutDuplicates(category.channel_ids, channel.id, 0),
                })),
            });
        }

        // Add the new channel to the Channels category on the channel's team
        if (categories.some((category) => category.channel_ids.some((channelId) => channelId === channel.id))) {
            return {data: false};
        }
        const channelsCategory = getCategoryInTeamByType(state, channel.team_id, CategoryTypes.CHANNELS);

        if (!channelsCategory) {
            // No categories were found for this team, so the categories for this team haven't been loaded yet.
            // The channel will have been added to the category by the server, so we'll get it once the categories
            // are actually loaded.
            return {data: false};
        }

        if (setOnServer) {
            return dispatch(addChannelToCategory(channelsCategory.id, channel.id));
        }

        return dispatch({
            type: ChannelCategoryTypes.RECEIVED_CATEGORY,
            data: {
                ...channelsCategory,
                channel_ids: insertWithoutDuplicates(channelsCategory.channel_ids, channel.id, 0),
            },
        });
    };
}

// addChannelToCategory returns an action that can be dispatched to add a channel to a given category without specifying
// its order. The channel will be removed from its previous category (if any) on the given category's team and it will be
// placed first in its new category.
export function addChannelToCategory(categoryId: string, channelId: string): ActionFunc {
    return moveChannelToCategory(categoryId, channelId, 0, false);
}

// moveChannelToCategory returns an action that moves a channel into a category and puts it at the given index at the
// category. The channel will also be removed from its previous category (if any) on that category's team. The category's
// order will also be set to manual by default.
export function moveChannelToCategory(categoryId: string, channelId: string, newIndex: number, setManualSorting = true) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const targetCategory = getCategory(state, categoryId);
        const currentUserId = getCurrentUserId(state);

        // The default sorting needs to behave like alphabetical sorting until the point that the user rearranges their
        // channels at which point, it becomes manual. Other than that, we never change the sorting method automatically.
        let sorting = targetCategory.sorting;
        if (setManualSorting &&
            targetCategory.type !== CategoryTypes.DIRECT_MESSAGES &&
            targetCategory.sorting === CategorySorting.Default) {
            sorting = CategorySorting.Manual;
        }

        // Add the channel to the new category
        const categories = [{
            ...targetCategory,
            sorting,
            channel_ids: insertWithoutDuplicates(targetCategory.channel_ids, channelId, newIndex),
        }];

        // And remove it from the old category
        const sourceCategory = getCategoryInTeamWithChannel(getState(), targetCategory.team_id, channelId);
        if (sourceCategory && sourceCategory.id !== targetCategory.id) {
            categories.push({
                ...sourceCategory,
                channel_ids: removeItem(sourceCategory.channel_ids, channelId),
            });
        }

        const result = dispatch({
            type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
            data: categories,
        });

        try {
            await Client4.updateChannelCategories(currentUserId, targetCategory.team_id, categories);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            const originalCategories = [targetCategory];
            if (sourceCategory && sourceCategory.id !== targetCategory.id) {
                originalCategories.push(sourceCategory);
            }

            dispatch({
                type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
                data: originalCategories,
            });
            return {error};
        }

        return result;
    };
}

export function moveChannelsToCategory(categoryId: string, channelIds: string[], newIndex: number, setManualSorting = true) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const targetCategory = getCategory(state, categoryId);
        const currentUserId = getCurrentUserId(state);

        // The default sorting needs to behave like alphabetical sorting until the point that the user rearranges their
        // channels at which point, it becomes manual. Other than that, we never change the sorting method automatically.
        let sorting = targetCategory.sorting;
        if (setManualSorting &&
            targetCategory.type !== CategoryTypes.DIRECT_MESSAGES &&
            targetCategory.sorting === CategorySorting.Default) {
            sorting = CategorySorting.Manual;
        }

        // Add the channels to the new category
        let categories = {
            [targetCategory.id]: {
                ...targetCategory,
                sorting,
                channel_ids: insertMultipleWithoutDuplicates(targetCategory.channel_ids, channelIds, newIndex),
            },
        };

        // Needed if we have to revert categories and for checking for favourites
        let unmodifiedCategories = {[targetCategory.id]: targetCategory};
        let sourceCategories: Record<string, string> = {};

        // And remove it from the old categories
        channelIds.forEach((channelId) => {
            const sourceCategory = getCategoryInTeamWithChannel(getState(), targetCategory.team_id, channelId);
            if (sourceCategory && sourceCategory.id !== targetCategory.id) {
                unmodifiedCategories = {
                    ...unmodifiedCategories,
                    [sourceCategory.id]: sourceCategory,
                };
                sourceCategories = {...sourceCategories, [channelId]: sourceCategory.id};
                categories = {
                    ...categories,
                    [sourceCategory.id]: {
                        ...(categories[sourceCategory.id] || sourceCategory),
                        channel_ids: removeItem((categories[sourceCategory.id] || sourceCategory).channel_ids, channelId),
                    },
                };
            }
        });

        const categoriesArray = Object.values(categories).reduce((allCategories: ChannelCategory[], category) => {
            allCategories.push(category);
            return allCategories;
        }, []);

        const result = dispatch({
            type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
            data: categoriesArray,
        });

        try {
            await Client4.updateChannelCategories(currentUserId, targetCategory.team_id, categoriesArray);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            const originalCategories = Object.values(unmodifiedCategories).reduce((allCategories: ChannelCategory[], category) => {
                allCategories.push(category);
                return allCategories;
            }, []);

            dispatch({
                type: ChannelCategoryTypes.RECEIVED_CATEGORIES,
                data: originalCategories,
            });
            return {error};
        }

        return result;
    };
}

export function moveCategory(teamId: string, categoryId: string, newIndex: number) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const order = getCategoryIdsForTeam(state, teamId)!;
        const currentUserId = getCurrentUserId(state);

        const newOrder = insertWithoutDuplicates(order, categoryId, newIndex);

        // Optimistically update the category order
        const result = dispatch({
            type: ChannelCategoryTypes.RECEIVED_CATEGORY_ORDER,
            data: {
                teamId,
                order: newOrder,
            },
        });

        try {
            await Client4.updateChannelCategoryOrder(currentUserId, teamId, newOrder);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            // Restore original order
            dispatch({
                type: ChannelCategoryTypes.RECEIVED_CATEGORY_ORDER,
                data: {
                    teamId,
                    order,
                },
            });

            return {error};
        }

        return result;
    };
}

export function receivedCategoryOrder(teamId: string, order: string[]) {
    return {
        type: ChannelCategoryTypes.RECEIVED_CATEGORY_ORDER,
        data: {
            teamId,
            order,
        },
    };
}

export function createCategory(teamId: string, displayName: string, channelIds: Array<Channel['id']> = []): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const currentUserId = getCurrentUserId(getState());

        let newCategory;
        try {
            newCategory = await Client4.createChannelCategory(currentUserId, teamId, {
                team_id: teamId,
                user_id: currentUserId,
                display_name: displayName,
                channel_ids: channelIds,
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // The new category will be added to the state after receiving the corresponding websocket event.

        return {data: newCategory};
    };
}

export function renameCategory(categoryId: string, displayName: string): ActionFunc {
    return patchCategory(categoryId, {
        display_name: displayName,
    });
}

export function deleteCategory(categoryId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const category = getCategory(state, categoryId);
        const currentUserId = getCurrentUserId(state);

        try {
            await Client4.deleteChannelCategory(currentUserId, category.team_id, category.id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // The category will be deleted from the state after receiving the corresponding websocket event.

        return {data: true};
    };
}

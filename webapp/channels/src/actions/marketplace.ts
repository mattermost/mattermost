// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {Client4} from 'mattermost-redux/client';

import {getFilter, getPlugin} from 'selectors/views/marketplace';

import {ActionTypes} from 'utils/constants';

import type {ActionFuncAsync, ThunkActionFunc} from 'types/store';

// fetchPlugins fetches the latest marketplace plugins, subject to any existing search filter.
export function fetchListing(localOnly = false): ActionFuncAsync<MarketplacePlugin[]> {
    return async (dispatch, getState) => {
        const state = getState();
        const filter = getFilter(state);

        let plugins: MarketplacePlugin[];

        try {
            plugins = await Client4.getMarketplacePlugins(filter, localOnly);
        } catch (error: any) {
            // If the marketplace server is unreachable, try to get the local plugins only.
            if (error.server_error_id === 'app.plugin.marketplace_client.failed_to_fetch' && !localOnly) {
                await dispatch(fetchListing(true));
            }
            return {error};
        }

        dispatch({
            type: ActionTypes.RECEIVED_MARKETPLACE_PLUGINS,
            plugins,
        });

        return {data: plugins ?? []};
    };
}

// filterListing sets a search filter for marketplace listing, fetching the latest data.
export function filterListing(filter: string): ReturnType<typeof fetchListing> {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.FILTER_MARKETPLACE_LISTING,
            filter,
        });

        return dispatch(fetchListing());
    };
}

// installPlugin installs the latest version of the given plugin from the marketplace.
//
// On success, it also requests the current state of the plugins to reflect the newly installed plugin.
export function installPlugin(id: string): ThunkActionFunc<void> {
    return async (dispatch, getState) => {
        dispatch({
            type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
            id,
        });

        const state = getState();

        const marketplacePlugin = getPlugin(state, id);
        if (!marketplacePlugin) {
            dispatch({
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED,
                id,
                error: 'Unknown plugin: ' + id,
            });
            return;
        }

        try {
            await Client4.installMarketplacePlugin(id);
        } catch (error: any) {
            dispatch({
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED,
                id,
                error: error.message,
            });
            return;
        }

        await dispatch(fetchListing());
        dispatch({
            type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED,
            id,
        });
    };
}

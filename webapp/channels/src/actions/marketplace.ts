// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppCall, AppExpand, AppFormValues} from '@mattermost/types/apps';
import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';

import {Client4} from 'mattermost-redux/client';
import {AppBindingLocations, AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {getFilter, getPlugin} from 'selectors/views/marketplace';

import {DoAppCallResult, intlShim} from 'components/suggestion/command_provider/app_command_parser/app_command_parser_dependencies';

import {GlobalState} from 'types/store';
import {createCallContext, createCallRequest} from 'utils/apps';
import {ActionTypes} from 'utils/constants';

import {doAppSubmit, openAppsModal, postEphemeralCallResponseForContext} from './apps';

export function fetchRemoteListing(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const filter = getFilter(state);

        try {
            const plugins = await Client4.getRemoteMarketplacePlugins(filter);
            dispatch({
                type: ActionTypes.RECEIVED_MARKETPLACE_PLUGINS,
                plugins,
            });
            return {data: plugins};
        } catch (error: any) {
            return {error};
        }
    };
}

// fetchPlugins fetches the latest marketplace plugins and apps, subject to any existing search filter.
export function fetchListing(localOnly = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const filter = getFilter(state);

        let plugins: MarketplacePlugin[];
        let apps: MarketplaceApp[] = [];

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

        if (appsEnabled(state)) {
            try {
                apps = await Client4.getMarketplaceApps(filter);
            } catch (error) {
                return {data: plugins};
            }

            dispatch({
                type: ActionTypes.RECEIVED_MARKETPLACE_APPS,
                apps,
            });
        }

        if (plugins) {
            return {data: (plugins as Array<MarketplacePlugin | MarketplaceApp>).concat(apps)};
        }

        return {data: apps};
    };
}

// filterListing sets a search filter for marketplace listing, fetching the latest data.
export function filterListing(filter: string): ActionFunc {
    return async (dispatch: DispatchFunc) => {
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
export function installPlugin(id: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc): Promise<void> => {
        dispatch({
            type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
            id,
        });

        const state = getState() as GlobalState;

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

// installApp installed an App using a given URL a call to the `/install-listed` call path.
//
// On success, it also requests the current state of the apps to reflect the newly installed app.
export function installApp(id: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc): Promise<boolean> => {
        dispatch({
            type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
            id,
        });

        const callPath = '/install-listed';
        const call: AppCall = {
            path: callPath,
        };

        const expand: AppExpand = {
            acting_user: '+summary',
            locale: 'all',
        };

        const values: AppFormValues = {
            app: {
                label: id,
                value: id,
            },
        };

        const state = getState();
        const channelID = getCurrentChannelId(state);
        const teamID = getCurrentTeamId(state);
        const location = AppBindingLocations.MARKETPLACE;
        const context = createCallContext('apps', location, channelID, teamID);

        const creq = createCallRequest(call, context, expand, values);

        const res = await dispatch(doAppSubmit(creq, intlShim)) as DoAppCallResult;

        if (res.error) {
            const errorResponse = res.error;
            dispatch({
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED,
                id,
                error: errorResponse.text,
            });
            return false;
        }

        dispatch({
            type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED,
            id,
        });

        const callResp = res.data!;
        if (callResp.type === AppCallResponseTypes.FORM && callResp.form) {
            dispatch(openAppsModal(callResp.form, creq.context));
        }

        if (callResp.text) {
            dispatch(postEphemeralCallResponseForContext(callResp, callResp.text, context));
        }

        return true;
    };
}

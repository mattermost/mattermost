// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {isPlugin} from 'mattermost-redux/utils/marketplace';

import {GlobalState} from 'types/store';

export const getPlugins = (state: GlobalState): MarketplacePlugin[] => state.views.marketplace.plugins;

export const getApps = (state: GlobalState): MarketplaceApp[] => state.views.marketplace.apps;

export const getListing = createSelector(
    'getListing',
    getPlugins,
    getApps,
    (plugins, apps) => {
        if (plugins) {
            return (plugins as Array<MarketplacePlugin | MarketplaceApp>).concat(apps);
        }

        return apps;
    },
);

export const getInstalledListing = createSelector(
    'getInstalledListing',
    getListing,
    (listing) => listing.filter((i) => {
        if (isPlugin(i)) {
            return i.installed_version !== '';
        }

        return i.installed;
    }),
);

export const getPlugin = (state: GlobalState, id: string): MarketplacePlugin | undefined =>
    getPlugins(state).find(((p) => p.manifest && p.manifest.id === id));

export const getApp = (state: GlobalState, id: string): MarketplaceApp | undefined =>
    getApps(state).find(((p) => p.manifest && p.manifest.app_id === id));

export const getFilter = (state: GlobalState): string => state.views.marketplace.filter;

export const getInstalling = (state: GlobalState, id: string): boolean => Boolean(state.views.marketplace.installing[id]);

export const getError = (state: GlobalState, id: string): string => state.views.marketplace.errors[id];

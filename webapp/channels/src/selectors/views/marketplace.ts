// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';

import type {GlobalState} from 'types/store';

export const getPlugins = (state: GlobalState): MarketplacePlugin[] => state.views.marketplace.plugins;

export const getListing = createSelector(
    'getListing',
    getPlugins,
    (plugins) => plugins ?? [],
);

export const getInstalledListing = createSelector(
    'getInstalledListing',
    getListing,
    (listing) => listing.filter((i) => i.installed_version !== ''),
);

export const getPlugin = (state: GlobalState, id: string): MarketplacePlugin | undefined =>
    getPlugins(state).find(((p) => p.manifest && p.manifest.id === id));

export const getFilter = (state: GlobalState): string => state.views.marketplace.filter;

export const getInstalling = (state: GlobalState, id: string): boolean => Boolean(secureGetFromRecord(state.views.marketplace.installing, id));

export const getError = (state: GlobalState, id: string): string | undefined => secureGetFromRecord(state.views.marketplace.errors, id);

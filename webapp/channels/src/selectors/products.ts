// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ProductIdentifier} from '@mattermost/types/products';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getCurrentProduct, isTeamScopedProduct} from 'utils/products';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';

export function selectCurrentProduct(state: GlobalState, pathname: string): ProductComponent | null {
    return getCurrentProduct(selectProducts(state), pathname);
}

export function selectCurrentProductId(state: GlobalState, pathname: string): ProductIdentifier {
    return selectCurrentProduct(state, pathname)?.id ?? null;
}

export const selectProducts = (state: GlobalState) => state.plugins.components.Product;

export const selectTeamScopedProducts = createSelector(
    'selectTeamScopedProducts',
    selectProducts,
    (products) => products.filter(isTeamScopedProduct),
);

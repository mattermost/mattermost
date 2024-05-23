// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Product} from '@mattermost/types/cloud';
import type {GlobalState} from '@mattermost/types/store';

export function getSelfHostedProducts(state: GlobalState): Record<string, Product> {
    return state.entities.hostedCustomer.products.products;
}

export function getSelfHostedProductsLoaded(state: GlobalState): boolean {
    return state.entities.hostedCustomer.products.productsLoaded;
}

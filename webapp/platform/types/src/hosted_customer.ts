// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Product} from './cloud';

export type HostedCustomerState = {
    products: {
        products: Record<string, Product>;
        productsLoaded: boolean;
    };
}

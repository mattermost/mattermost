// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Product} from '@mattermost/types/cloud';

// find a self-hosted product based on its SKU
// This function should not be used for cloud products, because there are
// deliberately multiple products of the same sku for those (e.g. monthly vs yearly)
export const findSelfHostedProductBySku = (products: Record<string, Product>, sku: string): Product | null => {
    const matches = Object.values(products).filter((p) => p.sku === sku);
    if (matches.length > 1) {
    // eslint-disable-next-line no-console
        console.error(`Found more than one match for sku ${sku}: ${matches.map((x) => x.id).join(', ')}`);
    } else if (matches.length === 0) {
        return null;
    }
    return matches[0];
};


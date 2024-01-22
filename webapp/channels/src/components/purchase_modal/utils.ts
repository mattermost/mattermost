// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Product} from '@mattermost/types/cloud';

import {CloudProducts, RecurringIntervals} from 'utils/constants';

/**
 *
 * @param products  Record<string, Product> | undefined - the list of current cloud products
 * @param productId String - a valid product id used to find a particular product in the dictionary
 * @param productSku String - the sku value of the product of type either cloud-starter | cloud-professional | cloud-enterprise
 * @returns Product
 */
export function findProductInDictionary(products: Record<string, Product> | undefined, productId?: string | null, productSku?: string, productRecurringInterval?: string): Product | null {
    if (!products) {
        return null;
    }
    const keys = Object.keys(products);
    if (!keys.length) {
        return null;
    }
    if (!productId && !productSku) {
        return products[keys[0]];
    }
    let currentProduct = products[keys[0]];
    if (keys.length > 1) {
        // here find the product by the provided id or name, otherwise return the one with Professional in the name
        keys.forEach((key) => {
            if (productId && products[key].id === productId) {
                currentProduct = products[key];
            } else if (productSku && products[key].sku === productSku && products[key].recurring_interval === productRecurringInterval) {
                currentProduct = products[key];
            }
        });
    }
    return currentProduct;
}

export function getSelectedProduct(yearlyProducts: Record<string, Product>) {
    return findProductInDictionary(yearlyProducts, null, CloudProducts.PROFESSIONAL, RecurringIntervals.YEAR);
}

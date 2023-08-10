// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';
import {useLocation, matchPath} from 'react-router-dom';

import {selectProducts, selectCurrentProductId, selectCurrentProduct} from 'selectors/products';

import {RecurringIntervals} from './constants';

import type {Product} from '@mattermost/types/cloud';
import type {ProductIdentifier, ProductScope} from '@mattermost/types/products';
import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';

export const getCurrentProductId = (
    products: ProductComponent[],
    pathname: string,
): ProductIdentifier => {
    return getCurrentProduct(products, pathname)?.id ?? null;
};

export const getCurrentProduct = (
    products: ProductComponent[],
    pathname: string,
): ProductComponent | null => {
    return products?.find(({baseURL}) => matchPath(pathname, {path: baseURL, exact: false, strict: false})) ?? null;
};

export const useProducts = (): ProductComponent[] | undefined => {
    return useSelector(selectProducts);
};

export const useCurrentProductId = () => {
    const {pathname} = useLocation();
    return useSelector((state: GlobalState) => selectCurrentProductId(state, pathname));
};

export const useCurrentProduct = () => {
    const {pathname} = useLocation();
    return useSelector((state: GlobalState) => selectCurrentProduct(state, pathname));
};

export const inScope = (scope: ProductScope, productId: ProductIdentifier, pluginId?: string) => {
    if (scope === '*' || scope?.includes('*')) {
        return true;
    }
    if (Array.isArray(scope)) {
        return scope.includes(productId) || (pluginId !== undefined && scope.includes(pluginId));
    }
    return scope === productId || (pluginId !== undefined && scope === pluginId);
};

export const isChannels = (productId: ProductIdentifier) => productId === null;

// find a product based on its SKU an RecurringInterval
export const findProductBySkuAndInterval = (products: Record<string, Product>, sku: string, interval: string) => {
    return Object.values(products).find(((product) => {
        return product.sku === sku && product.recurring_interval === interval;
    }));
};

export const findProductBySku = (products: Record<string, Product>, sku: string) => {
    return Object.values(products).find(((product) => {
        return product.sku === sku;
    }));
};

export const findProductByID = (products: Record<string, Product>, id: string) => {
    return Object.values(products).find(((product) => {
        return product.id === id;
    }));
};

const filterProductsRecord = (data: Record<string, Product>, predicate: (product: Product) => boolean): Record<string, Product> => {
    return Object.keys(data).reduce((acc: Record<string, Product>, current: string) => {
        if (predicate(data[current])) {
            acc[current] = data[current];
        }
        return acc;
    }, {});
};

export const findOnlyYearlyProducts = (products: Record<string, Product>) => {
    return filterProductsRecord(products, (product: Product) => product.recurring_interval === RecurringIntervals.YEAR);
};

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getLicense} from './general';

import type {
    Limits,
    Subscription,
    Product,
    CloudCustomer,
    CloudState,
} from '@mattermost/types/cloud';
import type {GlobalState} from '@mattermost/types/store';

export function getCloudLimits(state: GlobalState): Limits {
    return state.entities.cloud.limits.limits;
}

export function getCloudSubscription(state: GlobalState): Subscription | undefined {
    return state.entities.cloud.subscription;
}
export function getCloudCustomer(state: GlobalState): CloudCustomer | undefined {
    return state.entities.cloud.customer;
}

export function getCloudProducts(state: GlobalState): Record<string, Product> | undefined {
    return state.entities.cloud.products;
}

export function getCloudLimitsLoaded(state: GlobalState): boolean {
    return state.entities.cloud.limits.limitsLoaded;
}

export function getCloudErrors(state: GlobalState): CloudState['errors'] {
    return state.entities.cloud.errors;
}

export function getCloudInvoices(state: GlobalState): CloudState['invoices'] {
    return state.entities.cloud.invoices;
}

export function getSubscriptionProduct(state: GlobalState): Product | undefined {
    const subscription = getCloudSubscription(state);
    if (!subscription) {
        return undefined;
    }
    const products = getCloudProducts(state);
    if (!products) {
        return undefined;
    }

    return products[subscription.product_id];
}

export function getSubscriptionProductName(state: GlobalState): string {
    return getSubscriptionProduct(state)?.name || '';
}

export function checkHadPriorTrial(state: GlobalState): boolean {
    const subscription = getCloudSubscription(state);
    return Boolean(subscription?.is_free_trial === 'false' && subscription?.trial_end_at > 0);
}

export function isCurrentLicenseCloud(state: GlobalState): boolean {
    const license = getLicense(state);
    return license?.Cloud === 'true';
}

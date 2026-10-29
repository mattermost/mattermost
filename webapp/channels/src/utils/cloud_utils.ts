// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {InvoiceLineItem, Subscription} from '@mattermost/types/cloud';

import {CloudLinks} from 'utils/constants';

export function buildInvoiceSummaryPropsFromLineItems(lineItems: InvoiceLineItem[]) {
    let fullCharges = lineItems.filter((item) => item.type === 'full');
    const partialCharges = lineItems.filter((item) => item.type === 'partial');
    if (!partialCharges.length && !fullCharges.length) {
        fullCharges = lineItems;
    }
    let hasMoreLineItems = 0;
    if (fullCharges.length > 5) {
        hasMoreLineItems = fullCharges.length - 5;
        fullCharges = fullCharges.slice(0, 5);
    }

    return {partialCharges, fullCharges, hasMore: hasMoreLineItems};
}

export function openExternalPricingLink() {
    window.open(CloudLinks.PRICING, '_blank');
}

export const FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS = 30;

export function daysUntil(end?: number, simulatedCurrentTimeMs?: number) {
    let now = new Date();

    if (simulatedCurrentTimeMs) {
        now = new Date(simulatedCurrentTimeMs);
    }

    const expiration = new Date(end || 0);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
}

export function daysToExpiration(subscription?: Subscription): number {
    return daysUntil(subscription?.end_at, subscription?.simulated_current_time_ms);
}

export function daysToCancellation(subscription?: Subscription): number {
    return daysUntil(subscription?.cancel_at, subscription?.simulated_current_time_ms);
}

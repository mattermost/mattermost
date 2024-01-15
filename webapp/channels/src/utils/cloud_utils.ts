// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CloudCustomer, InvoiceLineItem, Subscription} from '@mattermost/types/cloud';

import {trackEvent} from 'actions/telemetry_actions';

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

export function isCustomerCardExpired(customer?: CloudCustomer): boolean {
    if (!customer) {
        return false;
    }

    const expiryYear = customer.payment_method.exp_year;

    // If not expiry year, or its 0, it's not expired (because it probably isn't set)
    if (!expiryYear) {
        return false;
    }

    // This works because we store the expiry month as the actual 1-12 base month, but Date uses a 0-11 base month
    // But credit cards expire at the end of their expiry month, so we can just use that number.
    const lastExpiryDate = new Date(expiryYear, customer.payment_method.exp_month, 1);
    return lastExpiryDate <= new Date();
}

export function openExternalPricingLink() {
    trackEvent('cloud_admin', 'click_pricing_link');
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

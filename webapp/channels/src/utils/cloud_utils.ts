// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Product, CloudCustomer, Limits, InvoiceLineItem} from '@mattermost/types/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import {CloudProducts, CloudLinks} from 'utils/constants';
import {hasSomeLimits} from 'utils/limits';

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

export function isCloudFreePlan(product: Product | undefined, limits: Limits): boolean {
    return product?.sku === CloudProducts.STARTER && hasSomeLimits(limits);
}

export const FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS = 30;

export function daysToExpiration(expirationDate: number): number {
    const now = new Date(1764969209 * 1000);
    const expiration = new Date(expirationDate);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
}

export function buildInvoiceSummaryPropsFromLineItems(lineItems: InvoiceLineItem[]) {
    let fullCharges = lineItems.filter((item) => item.type === 'full');
    const partialCharges = lineItems.filter((item) => item.type === 'partial');
    if (!partialCharges.length && !fullCharges.length) {
        fullCharges = lineItems;
    }
    let hasMore = 0;
    if (fullCharges.length > 5) {
        hasMore = fullCharges.length - 5;
        fullCharges = fullCharges.slice(0, 5);
    }

    return {
        fullCharges,
        partialCharges,
        hasMore,
    };
}

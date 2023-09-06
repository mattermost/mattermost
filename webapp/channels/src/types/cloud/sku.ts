// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StripeCardElement} from '@stripe/stripe-js';

export type StripeSetupIntent = {
    id: string;
    client_secret: string;
};

export type BillingDetails = {
    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    name: string;
    card: StripeCardElement;
    agreedTerms?: boolean;
};

export const areBillingDetailsValid = (
    billingDetails: Omit<BillingDetails, 'card'> | null | undefined,
): boolean => {
    if (billingDetails == null) {
        return false;
    }

    return Boolean(
        billingDetails.address &&
      billingDetails.city &&
      billingDetails.state &&
      billingDetails.country &&
      billingDetails.postalCode &&
      billingDetails.name,
    );
};

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StripeCardElement} from '@stripe/stripe-js';
import {Address} from '@mattermost/types/cloud';

export type StripeSetupIntent = {
    id: string;
    client_secret: string;
};

export type BillingDetails = {
    address: Address;
    name: string;
    card: StripeCardElement;
    agreedTerms?: boolean;
};

export function isAddressValid(address: Address): boolean {
    return Boolean(
        address.city &&
        address.country &&
        address.line1 &&
        address.postal_code &&
        address.state,
    );
}

export const areBillingDetailsValid = (
    billingDetails: Omit<BillingDetails, 'card'> | null | undefined,
): boolean => {
    if (billingDetails == null) {
        return false;
    }

    return Boolean(isAddressValid(billingDetails.address) && billingDetails.name);
};

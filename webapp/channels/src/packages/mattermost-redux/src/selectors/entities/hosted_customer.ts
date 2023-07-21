// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Invoice, Product} from '@mattermost/types/cloud';
import {SelfHostedSignupProgress, HostedCustomerState, TrueUpReviewProfileReducer, TrueUpReviewStatusReducer} from '@mattermost/types/hosted_customer';
import {GlobalState} from '@mattermost/types/store';
import {ValueOf} from '@mattermost/types/utilities';

export function getSelfHostedSignupProgress(state: GlobalState): ValueOf<typeof SelfHostedSignupProgress> {
    return state.entities.hostedCustomer.signupProgress;
}

export function getSelfHostedProducts(state: GlobalState): Record<string, Product> {
    return state.entities.hostedCustomer.products.products;
}

export function getSelfHostedProductsLoaded(state: GlobalState): boolean {
    return state.entities.hostedCustomer.products.productsLoaded;
}

export function getSelfHostedInvoices(state: GlobalState): Record<string, Invoice> {
    return state.entities.hostedCustomer.invoices.invoices;
}

export function getSelfHostedErrors(state: GlobalState): HostedCustomerState['errors'] {
    return state.entities.hostedCustomer.errors;
}

export function getTrueUpReviewProfile(state: GlobalState): TrueUpReviewProfileReducer {
    return state.entities.hostedCustomer.trueUpReviewProfile;
}

export function getTrueUpReviewStatus(state: GlobalState): TrueUpReviewStatusReducer {
    return state.entities.hostedCustomer.trueUpReviewStatus;
}

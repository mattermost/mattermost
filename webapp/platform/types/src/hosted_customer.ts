// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Address, Product, Invoice} from './cloud';
import {ValueOf} from './utilities';

export const SelfHostedSignupProgress = {
    START: 'START',
    CREATED_CUSTOMER: 'CREATED_CUSTOMER',
    CREATED_INTENT: 'CREATED_INTENT',
    CONFIRMED_INTENT: 'CONFIRMED_INTENT',
    CREATED_SUBSCRIPTION: 'CREATED_SUBSCRIPTION',
    PAID: 'PAID',
    CREATED_LICENSE: 'CREATED_LICENSE',
} as const;

export interface SelfHostedSignupForm {
    first_name: string;
    last_name: string;
    billing_address: Address;
    shipping_address: Address;
    organization: string;
}

export interface SelfHostedSignupBootstrapResponse {
    progress: ValueOf<typeof SelfHostedSignupProgress>;
    email: string;
}

export interface SelfHostedSignupCustomerResponse {
    customer_id: string;
    setup_intent_id: string;
    setup_intent_secret: string;
    progress: ValueOf<typeof SelfHostedSignupProgress>;
}

export interface SelfHostedSignupSuccessResponse {
    progress: ValueOf<typeof SelfHostedSignupProgress>;
    license: Record<string, string>;
}

export type HostedCustomerState = {
    products: {
        products: Record<string, Product>;
        productsLoaded: boolean;
    };
    invoices: {
        invoices: Record<string, Invoice>;
        invoicesLoaded: boolean;
    };
    errors: {
        products?: true;
        invoices?: true;
        trueUpReview?: true;
    };
    signupProgress: ValueOf<typeof SelfHostedSignupProgress>;
    trueUpReviewStatus: TrueUpReviewStatusReducer;
    trueUpReviewProfile: TrueUpReviewProfileReducer;
}

export type TrueUpReviewProfile = {
    content: string;
}

export type TrueUpReviewStatus = {
    due_date: number;
    complete: boolean;
}

type RequestState = 'IDLE' | 'LOADING' | 'OK'
export interface TrueUpReviewProfileReducer extends TrueUpReviewProfile {
    getRequestState: RequestState;
}

export interface TrueUpReviewStatusReducer extends TrueUpReviewStatus {
    getRequestState: RequestState;
}

export type SelfHostedExpansionRequest = {
    seats: number;
    license_id: string;
}

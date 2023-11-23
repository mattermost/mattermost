// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {SelfHostedSignupProgress} from '@mattermost/types/cloud';
import type {Product, Subscription, CloudCustomer, Invoice, Limits, LicenseSelfServeStatusReducer} from '@mattermost/types/cloud';
import type {ValueOf} from '@mattermost/types/utilities';

import {CloudTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

export function subscription(state: Subscription | null = null, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION: {
        return action.data;
    }
    default:
        return state;
    }
}

function customer(state: CloudCustomer | null = null, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_CUSTOMER: {
        return action.data;
    }
    default:
        return state;
    }
}

export function subscriptionStats(state: LicenseSelfServeStatusReducer | null = null, action: GenericAction): LicenseSelfServeStatusReducer | null {
    switch (action.type) {
    case CloudTypes.LICENSE_SELF_SERVE_STATS_REQUEST: {
        return {
            getRequestState: 'LOADING',
            ...action.data,
        };
    }
    case CloudTypes.RECEIVED_LICENSE_SELF_SERVE_STATS: {
        return {
            getRequestState: 'OK',
            is_expandable: action.data,
        };
    }
    case CloudTypes.LICENSE_SELF_SERVE_STATS_FAILED: {
        return {
            getRequestState: 'ERROR',
            is_expandable: false,
        };
    }
    default:
        return state;
    }
}

function products(state: Record<string, Product> | null = null, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_PRODUCTS: {
        const productList: Product[] = action.data;
        const productDict = productList.reduce((map, obj) => {
            map[obj.id] = obj;
            return map;
        }, {} as Record<string, Product>);
        return {
            ...state,
            ...productDict,
        };
    }
    default:
        return state;
    }
}

function invoices(state: Record<string, Invoice> | null = null, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_INVOICES: {
        const invoiceList: Invoice[] = action.data;
        const invoiceDict = invoiceList.reduce((map, obj) => {
            map[obj.id] = obj;
            return map;
        }, {} as Record<string, Invoice>);
        return {
            ...state,
            ...invoiceDict,
        };
    }
    default:
        return state;
    }
}

export interface LimitsReducer {
    limits: Limits;
    limitsLoaded: boolean;
}
const emptyLimits = {
    limits: {},
    limitsLoaded: false,
};
export function limits(state: LimitsReducer = emptyLimits, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_LIMITS: {
        return {
            limits: action.data,
            limitsLoaded: true,
        };
    }
    case CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION: {
        return emptyLimits;
    }
    default:
        return state;
    }
}
export interface ErrorsReducer {
    subscription?: true;
    products?: true;
    customer?: true;
    invoices?: true;
    limits?: true;
    trueUpReview?: true;
}
const emptyErrors = {};
export function errors(state: ErrorsReducer = emptyErrors, action: GenericAction) {
    switch (action.type) {
    case CloudTypes.CLOUD_SUBSCRIPTION_FAILED: {
        return {...state, subscription: true};
    }
    case CloudTypes.CLOUD_PRODUCTS_FAILED: {
        return {...state, products: true};
    }
    case CloudTypes.CLOUD_CUSTOMER_FAILED: {
        return {...state, customer: true};
    }
    case CloudTypes.CLOUD_INVOICES_FAILED: {
        return {...state, invoices: true};
    }
    case CloudTypes.CLOUD_LIMITS_FAILED: {
        return {...state, limits: true};
    }

    case CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION: {
        const newState = Object.assign({}, state);
        delete newState.subscription;
        return newState;
    }
    case CloudTypes.RECEIVED_CLOUD_PRODUCTS: {
        const newState = Object.assign({}, state);
        delete newState.products;
        return newState;
    }
    case CloudTypes.RECEIVED_CLOUD_CUSTOMER: {
        const newState = Object.assign({}, state);
        delete newState.customer;
        return newState;
    }
    case CloudTypes.RECEIVED_CLOUD_INVOICES: {
        const newState = Object.assign({}, state);
        delete newState.invoices;
        return newState;
    }
    case CloudTypes.RECEIVED_CLOUD_LIMITS: {
        const newState = Object.assign({}, state);
        delete newState.limits;
        return newState;
    }

    case CloudTypes.CLOUD_SUBSCRIPTION_REQUEST: {
        const newState = Object.assign({}, state);
        delete newState.subscription;
        return newState;
    }
    case CloudTypes.CLOUD_PRODUCTS_REQUEST: {
        const newState = Object.assign({}, state);
        delete newState.products;
        return newState;
    }
    case CloudTypes.CLOUD_CUSTOMER_REQUEST: {
        const newState = Object.assign({}, state);
        delete newState.customer;
        return newState;
    }
    case CloudTypes.CLOUD_INVOICES_REQUEST: {
        const newState = Object.assign({}, state);
        delete newState.invoices;
        return newState;
    }
    case CloudTypes.CLOUD_LIMITS_REQUEST: {
        const newState = Object.assign({}, state);
        delete newState.limits;
        return newState;
    }

    default: {
        return state;
    }
    }
}

interface SelfHostedSignupReducer {
    progress: ValueOf<typeof SelfHostedSignupProgress>;
}
const initialSelfHostedSignup = {
    progress: SelfHostedSignupProgress.START,
};
function selfHostedSignup(state: SelfHostedSignupReducer = initialSelfHostedSignup, action: GenericAction): SelfHostedSignupReducer {
    switch (action.type) {
    case CloudTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS:
        return {
            ...state,
            progress: action.data,
        };
    default:
        return state;
    }
}

export default combineReducers({

    // represents the current cloud customer
    customer,

    // represents the current cloud subscription
    subscription,

    // represents the cloud products offered
    products,

    // represents the invoices tied to the current subscription
    invoices,

    // represents the usage limits associated with this workspace
    limits,

    // network errors, used to show errors in ui instead of blowing up and showing nothing
    errors,

    // Subscription expansion status
    subscriptionStats,

    // state related to self-hosted workspaces purchasing a license not tied to a customer-web-server user.
    selfHostedSignup,
});

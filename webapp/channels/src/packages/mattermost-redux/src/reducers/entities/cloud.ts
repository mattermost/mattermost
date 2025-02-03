// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Product, Subscription, CloudCustomer, Invoice, Limits} from '@mattermost/types/cloud';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {CloudTypes} from 'mattermost-redux/action_types';

export function subscription(state: Subscription | null = null, action: MMReduxAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION: {
        return action.data;
    }
    default:
        return state;
    }
}

function customer(state: CloudCustomer | null = null, action: MMReduxAction) {
    switch (action.type) {
    case CloudTypes.RECEIVED_CLOUD_CUSTOMER: {
        return action.data;
    }
    default:
        return state;
    }
}

function products(state: Record<string, Product> | null = null, action: MMReduxAction) {
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

function invoices(state: Record<string, Invoice> | null = null, action: MMReduxAction) {
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

export function limits(state: LimitsReducer = emptyLimits, action: MMReduxAction) {
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
export function errors(state: ErrorsReducer = emptyErrors, action: MMReduxAction) {
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
});

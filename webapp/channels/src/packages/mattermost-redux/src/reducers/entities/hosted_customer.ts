// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {Invoice, Product} from '@mattermost/types/cloud';
import {SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import type {TrueUpReviewProfileReducer, TrueUpReviewStatusReducer} from '@mattermost/types/hosted_customer';
import type {ValueOf} from '@mattermost/types/utilities';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

interface SelfHostedProducts {
    products: Record<string, Product>;
    productsLoaded: boolean;
}

const initialProducts = {
    products: {},
    productsLoaded: false,
};
interface SelfHostedInvoices {
    invoices: Record<string, Invoice>;
    invoicesLoaded: boolean;
}
const initialInvoices = {
    invoices: {},
    invoicesLoaded: false,
};

function products(state: SelfHostedProducts = initialProducts, action: GenericAction) {
    switch (action.type) {
    case HostedCustomerTypes.RECEIVED_SELF_HOSTED_PRODUCTS: {
        const productList: Product[] = action.data;
        const productDict = productList.reduce((map, obj) => {
            map[obj.id] = obj;
            return map;
        }, {} as Record<string, Product>);
        return {
            ...state,
            products: {
                ...state.products,
                ...productDict,
            },
            productsLoaded: true,
        };
    }
    default:
        return state;
    }
}

function invoices(state: SelfHostedInvoices = initialInvoices, action: GenericAction) {
    switch (action.type) {
    case HostedCustomerTypes.RECEIVED_SELF_HOSTED_INVOICES: {
        const invoiceList: Invoice[] = action.data;
        const invoiceDict = invoiceList.reduce((map, obj) => {
            map[obj.id] = obj;
            return map;
        }, {} as Record<string, Invoice>);
        return {
            ...state,
            invoices: {
                ...state.invoices,
                ...invoiceDict,
            },
            productsLoaded: true,
        };
    }
    default:
        return state;
    }
}

type SignupProgress = ValueOf<typeof SelfHostedSignupProgress>;
function signupProgress(state = SelfHostedSignupProgress.START, action: GenericAction): SignupProgress {
    switch (action.type) {
    case HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS: {
        if (!action.data) {
            throw new Error(`uh ohh, expect action to have data but it dit not. Action: ${JSON.stringify(action, null, 2)}`);
        }
        return action.data;
    }
    default:
        return state;
    }
}

export interface ErrorsReducer {
    products?: true;
    invoices?: true;
}

const emptyErrors = {};
export function errors(state: ErrorsReducer = emptyErrors, action: GenericAction) {
    switch (action.type) {
    case HostedCustomerTypes.SELF_HOSTED_PRODUCTS_FAILED: {
        return {...state, products: true};
    }
    case HostedCustomerTypes.SELF_HOSTED_PRODUCTS_REQUEST:
    case HostedCustomerTypes.RECEIVED_SELF_HOSTED_PRODUCTS: {
        const newState = Object.assign({}, state);
        delete newState.products;
        return newState;
    }
    case HostedCustomerTypes.SELF_HOSTED_INVOICES_FAILED: {
        return {...state, products: true};
    }
    case HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_FAILED:
    case HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_FAILED: {
        return {...state, trueUpReview: true};
    }
    case HostedCustomerTypes.SELF_HOSTED_INVOICES_REQUEST:
    case HostedCustomerTypes.RECEIVED_SELF_HOSTED_INVOICES: {
        const newState = Object.assign({}, state);
        delete newState.invoices;
        return newState;
    }
    default:
        return state;
    }
}

function trueUpReviewProfile(state: TrueUpReviewProfileReducer | null = null, action: GenericAction) {
    switch (action.type) {
    case HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_BUNDLE: {
        return {
            ...state,
            getRequestState: 'OK',
            ...action.data,
        };
    }
    case HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_REQUEST: {
        return {
            ...state,
            getRequestState: 'LOADING',
        };
    }
    default:
        return state;
    }
}

function trueUpReviewStatus(state: TrueUpReviewStatusReducer | null = null, action: GenericAction) {
    switch (action.type) {
    case HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_STATUS: {
        return {
            ...state,
            getRequestState: 'OK',
            ...action.data,
        };
    }
    case HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_REQUEST: {
        return {
            ...state,
            getRequestState: 'LOADING',
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    products,
    invoices,
    signupProgress,
    errors,
    trueUpReviewProfile,
    trueUpReviewStatus,
});

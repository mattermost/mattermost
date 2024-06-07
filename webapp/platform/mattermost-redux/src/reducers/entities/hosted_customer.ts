// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Product} from '@mattermost/types/cloud';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';

export interface SelfHostedProducts {
    products: Record<string, Product>;
    productsLoaded: boolean;
}

const initialProducts = {
    products: {},
    productsLoaded: false,
};

function products(state: SelfHostedProducts = initialProducts, action: AnyAction) {
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

export interface ErrorsReducer {
    products?: true;
    invoices?: true;
}

const emptyErrors = {};
export function errors(state: ErrorsReducer = emptyErrors, action: AnyAction) {
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
    default:
        return state;
    }
}

export default combineReducers({
    products,
    errors,
});

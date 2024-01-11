// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Address, CloudCustomer, CloudCustomerPatch, Invoice, LicenseSelfServeStatus, Product} from '@mattermost/types/cloud';

import {CloudTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

export function getCloudSubscription(): NewActionFuncAsync<Subscription> {
    return bindClientFunc({
        clientFunc: Client4.getSubscription,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION],
        onFailure: CloudTypes.CLOUD_SUBSCRIPTION_FAILED,
        onRequest: CloudTypes.CLOUD_SUBSCRIPTION_REQUEST,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getCloudProducts(includeLegacyProducts?: boolean): NewActionFuncAsync<Product[]> {
    return bindClientFunc({
        clientFunc: Client4.getCloudProducts,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_PRODUCTS],
        onFailure: CloudTypes.CLOUD_PRODUCTS_FAILED,
        onRequest: CloudTypes.CLOUD_PRODUCTS_REQUEST,
        params: [includeLegacyProducts],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getCloudCustomer(): NewActionFuncAsync<CloudCustomer> {
    return bindClientFunc({
        clientFunc: Client4.getCloudCustomer,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_CUSTOMER],
        onFailure: CloudTypes.CLOUD_CUSTOMER_FAILED,
        onRequest: CloudTypes.CLOUD_CUSTOMER_REQUEST,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getLicenseSelfServeStatus(): NewActionFuncAsync<LicenseSelfServeStatus> {
    return bindClientFunc({
        clientFunc: Client4.getLicenseSelfServeStatus,
        onRequest: CloudTypes.LICENSE_SELF_SERVE_STATS_REQUEST,
        onSuccess: [CloudTypes.RECEIVED_LICENSE_SELF_SERVE_STATS],
        onFailure: CloudTypes.LICENSE_SELF_SERVE_STATS_FAILED,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getInvoices(): NewActionFuncAsync<Invoice[]> {
    return bindClientFunc({
        clientFunc: Client4.getInvoices,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_INVOICES],
        onFailure: CloudTypes.CLOUD_INVOICES_FAILED,
        onRequest: CloudTypes.CLOUD_INVOICES_REQUEST,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function updateCloudCustomer(customerPatch: CloudCustomerPatch): NewActionFuncAsync<CloudCustomer> {
    return bindClientFunc({
        clientFunc: Client4.updateCloudCustomer,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_CUSTOMER],
        params: [customerPatch],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function updateCloudCustomerAddress(address: Address): NewActionFuncAsync<CloudCustomer> {
    return bindClientFunc({
        clientFunc: Client4.updateCloudCustomerAddress,
        onSuccess: [CloudTypes.RECEIVED_CLOUD_CUSTOMER],
        params: [address],
    }) as any; // HARRISONTODO Type bindClientFunc
}

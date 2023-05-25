// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Invoice, Subscription} from '@mattermost/types/cloud';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {createSelector} from 'reselect';

import {GlobalState} from 'types/store';

export const getExpandSeatsLink: (state: GlobalState) => (licenseId: string) => string = createSelector(
    'getExpandSeatsLink',
    getConfig,
    (config) => {
        const cwsUrl = config.CWSURL;
        return (licenseId: string) => {
            return `${cwsUrl}/subscribe/expand?licenseId=${licenseId}`;
        };
    },
);

export const getCloudDelinquentInvoices = createSelector(
    'getCloudDelinquentInvoices',
    (state: GlobalState) => state.entities.cloud.invoices as Record<string, Invoice>,
    (invoices: Record<string, Invoice>) => {
        if (!invoices) {
            return [];
        }

        return Object.values(invoices || []).filter((invoice) => invoice.status !== 'paid' && invoice.total > 0);
    },
);

export const isCloudDelinquencyGreaterThan90Days = createSelector(
    'isCloudDelinquencyGreaterThan90Days',
    (state: GlobalState) => state.entities.cloud.subscription as Subscription,
    (subscription: Subscription) => {
        if (!subscription || !subscription.delinquent_since) {
            return false;
        }
        const now = new Date();
        const delinquentDate = new Date(subscription.delinquent_since * 1000);
        return (Math.floor((now.getTime() - delinquentDate.getTime()) / (1000 * 60 * 60 * 24)) >= 90);
    },
);

export const isCwsMockMode = (state: GlobalState) => getConfig(state)?.CWSMock === 'true';

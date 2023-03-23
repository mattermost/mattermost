// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Invoice, Subscription} from '@mattermost/types/cloud';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {createSelector} from 'reselect';

import {GlobalState} from 'types/store';

export enum InquiryType {
    Technical = 'technical',
    Sales = 'sales',
    Billing = 'billing',
}

export enum TechnicalInquiryIssue {
    AdminConsole = 'admin_console',
    MattermostMessaging = 'mm_messaging',
    DataExport = 'data_export',
    Other = 'other',
}

export enum SalesInquiryIssue {
    AboutPurchasing = 'about_purchasing',
    CancelAccount = 'cancel_account',
    PurchaseNonprofit = 'purchase_nonprofit',
    TrialQuestions = 'trial_questions',
    UpgradeEnterprise = 'upgrade_enterprise',
    SomethingElse = 'something_else',
}

type Issue = SalesInquiryIssue | TechnicalInquiryIssue

export const getCloudContactUsLink: (state: GlobalState) => (inquiry: InquiryType, inquiryIssue?: Issue) => string = createSelector(
    'getCloudContactUsLink',
    getConfig,
    getCurrentUser,
    (config, user) => {
        // cloud/contact-us with query params for name, email and inquiry
        const cwsUrl = config.CWSURL;
        const fullName = `${user.first_name} ${user.last_name}`;
        return (inquiry: InquiryType, inquiryIssue?: Issue) => {
            const inquiryIssueQuery = inquiryIssue ? `&inquiry-issue=${inquiryIssue}` : '';

            return `${cwsUrl}/cloud/contact-us?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(fullName)}&inquiry=${inquiry}${inquiryIssueQuery}`;
        };
    },
);

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

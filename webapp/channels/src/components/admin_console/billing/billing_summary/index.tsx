// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getSubscriptionProduct, getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';

import {buildInvoiceSummaryPropsFromLineItems} from 'utils/cloud_utils';

import {
    noBillingHistory,
    InvoiceInfo,
    freeTrial,
} from './billing_summary';

import './billing_summary.scss';

type BillingSummaryProps = {
    isFreeTrial: boolean;
    daysLeftOnTrial: number;
    onUpgradeMattermostCloud: (callerInfo: string) => void;
}

const BillingSummary = ({isFreeTrial, daysLeftOnTrial, onUpgradeMattermostCloud}: BillingSummaryProps) => {
    const subscription = useSelector(getCloudSubscription);
    const product = useSelector(getSubscriptionProduct);

    let body = noBillingHistory;

    if (isFreeTrial) {
        body = freeTrial(onUpgradeMattermostCloud, daysLeftOnTrial);
    } else if (subscription?.last_invoice && !subscription?.upcoming_invoice) {
        const invoice = subscription.last_invoice;
        const fullCharges = invoice.line_items.filter((item) => item.type === 'full');
        const partialCharges = invoice.line_items.filter((item) => item.type === 'partial');

        body = (
            <InvoiceInfo
                invoice={invoice}
                product={product}
                fullCharges={fullCharges}
                partialCharges={partialCharges}
            />
        );
    } else if (subscription?.upcoming_invoice) {
        const invoice = subscription.upcoming_invoice;
        const {fullCharges, partialCharges, hasMore} = buildInvoiceSummaryPropsFromLineItems(invoice.line_items);

        body = (
            <InvoiceInfo
                invoice={invoice}
                product={product}
                fullCharges={fullCharges}
                partialCharges={partialCharges}
                hasMore={hasMore}
                willRenew={subscription?.will_renew === 'true'}
            />
        );
    }

    return (
        <div className='BillingSummary'>
            {body}
        </div>
    );
};

export default BillingSummary;

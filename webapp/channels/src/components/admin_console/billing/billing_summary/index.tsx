// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getSubscriptionProduct, checkHadPriorTrial, getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';

import {CloudProducts} from 'utils/constants';

import {
    noBillingHistory,
    InvoiceInfo,
    freeTrial,
} from './billing_summary';

import {tryEnterpriseCard, UpgradeToProfessionalCard} from './upsell_card';

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

    const isPreTrial = subscription?.is_free_trial === 'false' && subscription?.trial_end_at === 0;
    const hasPriorTrial = useSelector(checkHadPriorTrial);
    const showTryEnterprise = product?.sku === CloudProducts.STARTER && isPreTrial;
    const showUpgradeProfessional = product?.sku === CloudProducts.STARTER && hasPriorTrial;

    if (showTryEnterprise) {
        body = tryEnterpriseCard;
    } else if (showUpgradeProfessional) {
        body = <UpgradeToProfessionalCard/>;
    } else if (isFreeTrial) {
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
        let fullCharges = invoice.line_items.filter((item) => item.type === 'full');
        const partialCharges = invoice.line_items.filter((item) => item.type === 'partial');
        if (!partialCharges.length && !fullCharges.length) {
            fullCharges = invoice.line_items;
        }
        let hasMoreLineItems = 0;
        if (fullCharges.length > 5) {
            hasMoreLineItems = fullCharges.length - 5;
            fullCharges = fullCharges.slice(0, 5);
        }

        body = (
            <InvoiceInfo
                invoice={invoice}
                product={product}
                fullCharges={fullCharges}
                partialCharges={partialCharges}
                hasMore={hasMoreLineItems}
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

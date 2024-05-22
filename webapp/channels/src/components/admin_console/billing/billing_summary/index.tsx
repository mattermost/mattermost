// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    noBillingHistory,
    FreeTrial,
} from './billing_summary';

import './billing_summary.scss';

type BillingSummaryProps = {
    isFreeTrial: boolean;
    daysLeftOnTrial: number;
}

export default function BillingSummary({isFreeTrial, daysLeftOnTrial}: BillingSummaryProps) {
    let body = noBillingHistory;

    if (isFreeTrial) {
        // eslint-disable-next-line new-cap
        body = FreeTrial({daysLeftOnTrial});
    }
    return (
        <div className='BillingSummary'>
            {body}
        </div>
    );
}


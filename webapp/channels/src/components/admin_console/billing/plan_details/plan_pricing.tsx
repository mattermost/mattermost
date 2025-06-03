// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Product} from '@mattermost/types/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import ExternalLink from 'components/external_link';

import {BillingSchemes, CloudProducts, CloudLinks, RecurringIntervals} from 'utils/constants';

import './plan_pricing.scss';

interface Props {
    product: Product;
}
const PlanPricing = ({
    product,
}: Props) => {
    if (product.sku === CloudProducts.STARTER) {
        return null;
    }

    const getPrice = (product: Product) => {
        if (product.recurring_interval === RecurringIntervals.YEAR) {
            return (product.price_per_seat / 12).toFixed(2);
        }
        return product.price_per_seat.toFixed(2);
    };

    return (
        <div className='PlanPricing'>
            <div className='PlanDetails__paid-tier'>
                {`$${getPrice(product)}`}
                {product.billing_scheme === BillingSchemes.FLAT_FEE ? (
                    <FormattedMessage
                        id='admin.billing.subscription.planDetails.flatFeePerMonth'
                        defaultMessage='/month (Unlimited Users). '
                    />
                ) : (
                    <FormattedMessage
                        id='admin.billing.subscription.planDetails.perUserPerMonth'
                        defaultMessage='/user/month. '
                    />) }
            </div>
        </div>
    );
};

export default PlanPricing;

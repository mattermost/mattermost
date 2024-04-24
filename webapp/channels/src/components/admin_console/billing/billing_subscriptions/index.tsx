// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCloudSubscription, getCloudProducts, getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {
    getSubscriptionProduct,
    getCloudSubscription as selectCloudSubscription,
    getCloudErrors,
} from 'mattermost-redux/selectors/entities/cloud';

import {pageVisited} from 'actions/telemetry_actions';

import CloudTrialBanner from 'components/admin_console/billing/billing_subscriptions/cloud_trial_banner';
import CloudFetchError from 'components/cloud_fetch_error';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {
    TrialPeriodDays,
} from 'utils/constants';
import {useQuery} from 'utils/http_utils';
import {getRemainingDaysFromFutureTimestamp} from 'utils/utils';

import ContactSalesCard from './contact_sales_card';

import BillingSummary from '../billing_summary';
import PlanDetails from '../plan_details';

import './billing_subscriptions.scss';

const messages = defineMessages({
    title: {id: 'admin.billing.subscription.title', defaultMessage: 'Subscription'},
});

export const searchableStrings = [
    messages.title,
];

const BillingSubscriptions = () => {
    const dispatch = useDispatch();
    const subscription = useSelector(selectCloudSubscription);
    const errorLoadingData = useSelector((state: GlobalState) => {
        const errors = getCloudErrors(state);
        return Boolean(errors.limits || errors.subscription || errors.customer || errors.products);
    });
    const trialEndDate = subscription?.trial_end_at || 0;
    const query = useQuery();
    const actionQueryParam = query.get('action');

    const product = useSelector(getSubscriptionProduct);

    const openPricingModal = useOpenPricingModal();

    let isFreeTrial = false;
    let daysLeftOnTrial = 0;
    if (subscription?.is_free_trial === 'true') {
        isFreeTrial = true;
        daysLeftOnTrial = Math.min(
            getRemainingDaysFromFutureTimestamp(subscription.trial_end_at),
            TrialPeriodDays.TRIAL_30_DAYS,
        );
    }

    useEffect(() => {
        dispatch(getCloudSubscription());
        const includeLegacyProducts = true;
        dispatch(getCloudProducts(includeLegacyProducts));
        dispatch(getCloudCustomer());

        pageVisited('cloud_admin', 'pageview_billing_subscription');

        if (actionQueryParam === 'show_pricing_modal') {
            openPricingModal({trackingLocation: 'billing_subscriptions_external_direct_link'});
        }
    }, []);

    // handle not loaded yet here, failed to load handled below
    if ((!subscription || !product) && !errorLoadingData) {
        return null;
    }

    return (
        <div className='wrapper--fixed BillingSubscriptions'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {errorLoadingData && <CloudFetchError/>}
                    {!errorLoadingData && <>
                        {isFreeTrial && <CloudTrialBanner trialEndDate={trialEndDate}/>}
                        <div className='BillingSubscriptions__topWrapper'>
                            <PlanDetails
                                isFreeTrial={isFreeTrial}
                                subscriptionPlan={product?.sku}
                            />
                            <BillingSummary
                                isFreeTrial={isFreeTrial}
                                daysLeftOnTrial={daysLeftOnTrial}
                            />
                        </div>
                        <ContactSalesCard
                            isFreeTrial={isFreeTrial}
                            subscriptionPlan={product?.sku}
                            onUpgradeMattermostCloud={openPricingModal}
                        />
                    </>}
                </div>
            </div>
        </div>
    );
};

export default BillingSubscriptions;

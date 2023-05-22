// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {GlobalState} from '@mattermost/types/store';

import {getCloudSubscription, getCloudProducts, getCloudCustomer} from 'mattermost-redux/actions/cloud';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {
    getSubscriptionProduct,
    getCloudSubscription as selectCloudSubscription,
    getCloudCustomer as selectCloudCustomer,
    getCloudErrors,
} from 'mattermost-redux/selectors/entities/cloud';

import {pageVisited} from 'actions/telemetry_actions';

import {
    CloudProducts,
    RecurringIntervals,
    TrialPeriodDays,
} from 'utils/constants';
import {isCustomerCardExpired} from 'utils/cloud_utils';
import {hasSomeLimits} from 'utils/limits';
import {getRemainingDaysFromFutureTimestamp} from 'utils/utils';
import {useQuery} from 'utils/http_utils';

import CloudTrialBanner from 'components/admin_console/billing/billing_subscriptions/cloud_trial_banner';
import CloudFetchError from 'components/cloud_fetch_error';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useGetLimits from 'components/common/hooks/useGetLimits';
import DeleteWorkspaceCTA from 'components/admin_console/billing//delete_workspace/delete_workspace_cta';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import PlanDetails from '../plan_details';
import BillingSummary from '../billing_summary';
import ContactSalesCard from './contact_sales_card';
import Limits from './limits';
import {
    creditCardExpiredBanner,
    paymentFailedBanner,
} from './billing_subscriptions';
import LimitReachedBanner from './limit_reached_banner';
import CancelSubscription from './cancel_subscription';
import {ToYearlyNudgeBanner} from './to_yearly_nudge_banner';
import {ToPaidNudgeBanner} from './to_paid_plan_nudge_banner';

import './billing_subscriptions.scss';

const BillingSubscriptions = () => {
    const dispatch = useDispatch<DispatchFunc>();
    const subscription = useSelector(selectCloudSubscription);
    const [cloudLimits] = useGetLimits();
    const errorLoadingData = useSelector((state: GlobalState) => {
        const errors = getCloudErrors(state);
        return Boolean(errors.limits || errors.subscription || errors.customer || errors.products);
    });

    const isCardExpired = isCustomerCardExpired(useSelector(selectCloudCustomer));

    const trialEndDate = subscription?.trial_end_at || 0;

    const [showCreditCardBanner, setShowCreditCardBanner] = useState(true);

    const query = useQuery();
    const actionQueryParam = query.get('action');

    const product = useSelector(getSubscriptionProduct);
    const isAnnualProfessionalOrEnterprise = product?.sku === CloudProducts.ENTERPRISE || (product?.sku === CloudProducts.PROFESSIONAL && product?.recurring_interval === RecurringIntervals.YEAR);

    const openPricingModal = useOpenPricingModal();

    const openCloudPurchaseModal = useOpenCloudPurchaseModal({});

    // show the upgrade section when is a free tier customer
    const onUpgradeMattermostCloud = (callerInfo: string) => {
        openCloudPurchaseModal({trackingLocation: callerInfo});
    };

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

        if (actionQueryParam === 'show_purchase_modal') {
            onUpgradeMattermostCloud('billing_subscriptions_external_direct_link');
        }

        if (actionQueryParam === 'show_pricing_modal') {
            openPricingModal({trackingLocation: 'billing_subscriptions_external_direct_link'});
        }

        if (actionQueryParam === 'show_delinquency_modal') {
            openCloudPurchaseModal({trackingLocation: 'billing_subscriptions_external_direct_link'});
        }
    }, []);

    const shouldShowPaymentFailedBanner = () => {
        return subscription?.last_invoice?.status === 'failed';
    };

    // handle not loaded yet here, failed to load handled below
    if ((!subscription || !product) && !errorLoadingData) {
        return null;
    }

    return (
        <div className='wrapper--fixed BillingSubscriptions'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.billing.subscription.title'
                    defaultMessage='Subscription'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {errorLoadingData && <CloudFetchError/>}
                    {!errorLoadingData && <>
                        <LimitReachedBanner
                            product={product}
                        />
                        {shouldShowPaymentFailedBanner() && paymentFailedBanner()}
                        {<ToYearlyNudgeBanner/>}
                        {<ToPaidNudgeBanner/>}
                        {showCreditCardBanner &&
                            isCardExpired &&
                            creditCardExpiredBanner(setShowCreditCardBanner)}
                        {isFreeTrial && <CloudTrialBanner trialEndDate={trialEndDate}/>}
                        <div className='BillingSubscriptions__topWrapper'>
                            <PlanDetails
                                isFreeTrial={isFreeTrial}
                                subscriptionPlan={product?.sku}
                            />
                            <BillingSummary
                                isFreeTrial={isFreeTrial}
                                daysLeftOnTrial={daysLeftOnTrial}
                                onUpgradeMattermostCloud={onUpgradeMattermostCloud}
                            />
                        </div>
                        {hasSomeLimits(cloudLimits) && !isFreeTrial ? (
                            <Limits/>
                        ) : (
                            <ContactSalesCard
                                isFreeTrial={isFreeTrial}
                                subscriptionPlan={product?.sku}
                                onUpgradeMattermostCloud={openPricingModal}
                            />
                        )}
                        {isAnnualProfessionalOrEnterprise && !isFreeTrial ? <CancelSubscription/> : <DeleteWorkspaceCTA/>}
                    </>}
                </div>
            </div>
        </div>
    );
};

export default BillingSubscriptions;

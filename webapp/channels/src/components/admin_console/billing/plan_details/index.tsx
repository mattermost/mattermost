// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getSubscriptionProduct, getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';

import useGetTotalUsersNoBots from 'components/common/hooks/useGetTotalUsersNoBots';

import {TrialPeriodDays} from 'utils/constants';
import {getRemainingDaysFromFutureTimestamp} from 'utils/utils';

import FeatureList from './feature_list';
import {
    PlanDetailsTopElements,
    currentPlanText,
} from './plan_details';
import PlanPricing from './plan_pricing';

import './plan_details.scss';

type Props = {
    isFreeTrial: boolean;
    subscriptionPlan: string | undefined;
}
const PlanDetails = ({isFreeTrial, subscriptionPlan}: Props) => {
    const subscription = useSelector(getCloudSubscription);
    const product = useSelector(getSubscriptionProduct);
    const daysLeftOnTrial = Math.min(
        getRemainingDaysFromFutureTimestamp(subscription?.trial_end_at),
        TrialPeriodDays.TRIAL_30_DAYS,
    );
    const userCount = useGetTotalUsersNoBots();

    if (!product || !userCount) {
        return null;
    }

    return (
        <div className='PlanDetails'>
            <PlanDetailsTopElements
                userCount={userCount}
                isFreeTrial={isFreeTrial}
                subscriptionPlan={subscriptionPlan}
                daysLeftOnTrial={daysLeftOnTrial}
                isYearly={product.recurring_interval === 'year'}
            />
            <PlanPricing
                product={product}
            />
            <div className='PlanDetails__teamAndChannelCount'>
                <FormattedMessage
                    id='admin.billing.subscription.planDetails.subheader'
                    defaultMessage='Plan details'
                />
            </div>
            <FeatureList
                subscriptionPlan={subscriptionPlan}
            />
            {currentPlanText(isFreeTrial)}
        </div>
    );
};

export default PlanDetails;

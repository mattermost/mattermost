// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {useEffect} from 'react';
import {FormattedDate, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ArrowUpBoldCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {
    getCloudSubscription,
    getSubscriptionProduct,
} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import * as Menu from 'components/menu';
import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers, CloudProducts} from 'utils/constants';

export default function ProductSwitcherCloudTrialMenuItem() {
    const dispatch = useDispatch();
    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    const license = useSelector(getLicense);
    const isCloud = license?.Cloud === 'true';

    const subscription = useSelector(getCloudSubscription);
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isStarter = subscriptionProduct?.sku === CloudProducts.STARTER;

    const someLimitNeedsAttention = Boolean(useGetHighestThresholdCloudLimit(useGetUsage(), useGetLimits()[0]));

    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, [dispatch]);

    // Don't show if not cloud
    if (!isCloud) {
        return null;
    }

    // Don't show if some limit needs attention OR not on starter/trial
    if (Boolean(someLimitNeedsAttention) || (!isStarter && !isFreeTrial)) {
        return null;
    }

    // For end users only display the trial information
    if (!isAdmin && !isFreeTrial) {
        return null;
    }

    // Don't show if air-gapped (no internet access for pricing modal)
    if (isAirGapped) {
        return null;
    }

    function handleDiscoverEnterpriseFeaturesClick() {
        if (isAdmin) {
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
                    dialogType: TrialBenefitsModal,
                }),
            );
        } else {
            openPricingModal();
        }
    }

    function handleSeePlansClick() {
        openPricingModal();
    }

    if (isFreeTrial) {
        return (
            <Menu.Item
                className='globalHeader-leftControls-productSwitcherMenu-trialMenuItem'
                leadingElement={<ArrowUpBoldCircleOutlineIcon size={18}/>}
                labels={
                    <>
                        <FormattedMessage
                            id='globalHeader.productSwitcherMenu.trialMenuItem.isFreeTrial.primaryLabel'
                            defaultMessage='Enterprise Advanced Trial'
                        />
                        <FormattedMessage
                            id='globalHeader.productSwitcherMenu.trialMenuItem.isFreeTrial.secondaryLabel'
                            defaultMessage='Your trial is active until {trialEndDay}. Discover our top Enterprise features.'
                            values={{
                                trialEndDay: (
                                    <FormattedDate
                                        value={moment(subscription?.trial_end_at).toDate()}
                                        year='numeric'
                                        month='long'
                                        day='2-digit'
                                    />
                                ),
                            }}
                        />
                    </>
                }
                onClick={handleDiscoverEnterpriseFeaturesClick}
            />
        );
    }

    return (
        <Menu.Item
            className='globalHeader-leftControls-productSwitcherMenu-trialMenuItem'
            labels={
                <>
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.trialMenuItem.noFreeTrial.primaryLabel'
                        defaultMessage='Interested in a limitless plan with high-security features?'
                    />
                    <FormattedMessage
                        id='globalHeader.productSwitcherMenu.trialMenuItem.noFreeTrial.secondaryLabel'
                        defaultMessage='See plans'
                    />
                </>
            }
            onClick={handleSeePlansClick}
        />
    );
}
